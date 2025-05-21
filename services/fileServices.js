const fs = require("fs-extra");
const path = require("path");

/**
 * Recursively process all files in a directory and categorize them.
 * @param {string} dirPath
 * @param {number} currentDepth
 * @param {number} maxDepth
 * @returns {Promise<Object>} fileCategories
 */
async function processDirectory(dirPath, currentDepth, maxDepth = 5) {
    const fileCategories = {};
    if (currentDepth > maxDepth) {
        return fileCategories;
    }
    const items = await fs.readdir(dirPath);
    for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);
        if (stats.isDirectory()) {
            const subDirCategories = await processDirectory(
                itemPath,
                currentDepth + 1,
                maxDepth
            );
            for (const category in subDirCategories) {
                if (!fileCategories[category]) fileCategories[category] = [];
                fileCategories[category].push(...subDirCategories[category]);
            }
        } else {
            // Categorize file by extension/type
            const ext = path.extname(itemPath).toLowerCase();
            let category = "Other";
            if ([".txt", ".md", ".json", ".csv"].includes(ext))
                category = "Text";
            else if ([".js", ".py", ".html", ".css"].includes(ext))
                category = "Code";
            else if ([".jpg", ".jpeg", ".png", ".gif", ".bmp"].includes(ext))
                category = "Images";
            else if (
                [
                    ".pdf",
                    ".doc",
                    ".docx",
                    ".xls",
                    ".xlsx",
                    ".ppt",
                    ".pptx",
                ].includes(ext)
            )
                category = "Documents";
            if (!fileCategories[category]) fileCategories[category] = [];
            fileCategories[category].push(itemPath);
        }
    }
    return fileCategories;
}

/**
 * Organize files into category folders
 * @param {Object} fileCategories
 * @param {string} outputPath
 */
async function organizeFilesByCategory(fileCategories, outputPath) {
    for (const category in fileCategories) {
        const categoryPath = path.join(outputPath, category);
        await fs.ensureDir(categoryPath);
        for (const filePath of fileCategories[category]) {
            const fileName = path.basename(filePath);
            const destPath = path.join(categoryPath, fileName);
            try {
                await fs.copy(filePath, destPath);
            } catch (error) {
                // Log error if needed
            }
        }
    }
}

module.exports = {
    processDirectory,
    organizeFilesByCategory,
};
