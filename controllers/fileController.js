const path = require("path");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs-extra");
const AdmZip = require("adm-zip");
const fileService = require("../services/fileServices");
const upload = require("../middlewares/upload");

/**
 * Handle file upload, extraction, and categorization
 */
exports.uploadZip = async (req, res) => {
    // Helper for cleanup
    async function cleanup(paths) {
        for (const p of paths) {
            try {
                await fs.remove(p);
            } catch (e) {
                /* ignore */
            }
        }
    }
    let extractPath, categorizedPath;
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        if (req.file.size > upload.MAX_FILE_SIZE) {
            // Should be handled by multer, but double check
            await fs.remove(req.file.path);
            return res
                .status(400)
.json({ error: `File size exceeds ${upload.MAX_FILE_SIZE_MB}MB limit.` });
        }
        console.log("File uploaded successfully:", {
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
        });
        // Create a unique session ID for this processing job
        const sessionId = uuidv4();
        extractPath = path.join("extracted", sessionId);
        categorizedPath = path.join("categorized", sessionId);
        fs.ensureDirSync(extractPath);
        fs.ensureDirSync(categorizedPath);
        console.log(`Processing file: ${req.file.path}`);
        // Extract and check folder depth
        try {
            const zip = new AdmZip(req.file.path);
            const zipEntries = zip.getEntries();
            console.log(`Zip file contains ${zipEntries.length} entries`);
            zip.extractAllTo(extractPath, true);
        } catch (error) {
            await cleanup([req.file.path, extractPath, categorizedPath]);
            return res
                .status(400)
                .json({
                    error: "Failed to extract zip file. The file may be corrupted or not a valid zip archive.",
                });
        }
        // Restriction: No zip files allowed inside the uploaded zip
        function containsZipFile(dir) {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const itemPath = path.join(dir, item);
                if (fs.statSync(itemPath).isDirectory()) {
                    if (containsZipFile(itemPath)) return true;
                } else if (item.toLowerCase().endsWith('.zip')) {
                    return true;
                }
            }
            return false;
        }
        if (containsZipFile(extractPath)) {
            await cleanup([req.file.path, extractPath, categorizedPath]);
            return res.status(400).json({ error: "Nested zip files are not allowed. Please remove any zip files inside your archive and try again." });
        }
        // Check max folder depth (no more than 3)
        function getMaxDepth(dir, current = 1) {
            const items = fs.readdirSync(dir);
            let max = current;
            for (const item of items) {
                const itemPath = path.join(dir, item);
                if (fs.statSync(itemPath).isDirectory()) {
                    max = Math.max(max, getMaxDepth(itemPath, current + 1));
                }
            }
            return max;
        }
        const maxDepth = getMaxDepth(extractPath);
        if (maxDepth > 3) {
            await cleanup([req.file.path, extractPath, categorizedPath]);
            return res
                .status(400)
                .json({
                    error: "More than 3 folder levels detected in the zip. Only up to 3 levels are allowed.",
                });
        }
        // Process and organize
        const fileCategories = await fileService.processDirectory(
            extractPath,
            0,
            3
        );
        await fileService.organizeFilesByCategory(
            fileCategories,
            categorizedPath
        );
        // Bundle the categorized result as zip
        const resultZipPath = path.join(
            "categorized",
            `${sessionId}-result.zip`
        );
        const resultZip = new AdmZip();
        resultZip.addLocalFolder(categorizedPath);
        resultZip.writeZip(resultZipPath);
        // Send the zip as a download
        res.setHeader("X-Response-Type", "file");
        res.download(resultZipPath, `${sessionId}-result.zip`, async (err) => {
            await cleanup([
                req.file.path,
                extractPath,
                categorizedPath,
                resultZipPath,
            ]);
            if (err && !res.headersSent) {
                // Only send JSON if headers not sent
                res.status(500).json({
                    error: "Failed to send result zip file.",
                });
            }
        });
    } catch (error) {
        await cleanup([req.file?.path, extractPath, categorizedPath]);
        console.error("Error processing upload:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get categorized files for a session
 */
exports.getResults = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const categorizedPath = path.join("categorized", sessionId);

        if (!(await fs.pathExists(categorizedPath))) {
            return res.status(404).json({ error: "Session not found" });
        }

        const categories = await fs.readdir(categorizedPath);
        const result = {};

        for (const category of categories) {
            const categoryPath = path.join(categorizedPath, category);
            const files = await fs.readdir(categoryPath);
            result[category] = files;
        }

        res.json(result);
    } catch (error) {
        console.error("Error retrieving results:", error);
        res.status(500).json({ error: error.message });
    }
};
