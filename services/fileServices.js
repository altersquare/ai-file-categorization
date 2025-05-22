const fs = require("fs-extra");
const path = require("path");
const { categorizeContent } = require("./gemini");
const fsPromises = require("fs/promises");

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
            const ext = path.extname(itemPath).toLowerCase();
            let category = "Uncategorized";

            try {
                // PDF files - can use PDF parser to extract text
                if (ext === ".pdf") {
                    const pdfText = await extractTextFromPDF(itemPath);
                    category = await categorizeContent(
                        pdfText.slice(0, 4000),
                        item
                    );
                }
                // Text-like files
                else if (
                    [
                        ".txt",
                        ".md",
                        ".json",
                        ".csv",
                        ".js",
                        ".py",
                        ".html",
                        ".css",
                    ].includes(ext)
                ) {
                    const content = await fsPromises.readFile(itemPath, "utf8");
                    category = await categorizeContent(
                        content.slice(0, 4000),
                        item
                    );
                }
                // Office documents - could use dedicated parsers
                else if (
                    [
                        ".doc",
                        ".docx",
                        ".xls",
                        ".xlsx",
                        ".ppt",
                        ".pptx",
                    ].includes(ext)
                ) {
                    // For production, implement proper Office document text extraction
                    // For now, we'll categorize based on extension but with more specific categories
                    if ([".xls", ".xlsx"].includes(ext)) {
                        category = "Spreadsheet";
                    } else if ([".ppt", ".pptx"].includes(ext)) {
                        category = "Presentation";
                    } else {
                        category = "Word Document";
                    }
                }
                // Images - use filename and possibly image recognition API
                else if (
                    [".jpg", ".jpeg", ".png", ".gif", ".bmp"].includes(ext)
                ) {
                    // Consider image recognition APIs for better categorization
                    // For now, a simple categorization based on filename patterns
                    if (
                        item.toLowerCase().includes("invoice") ||
                        item.toLowerCase().includes("receipt")
                    ) {
                        category = "Receipt/Invoice Image";
                    } else if (item.toLowerCase().includes("screenshot")) {
                        category = "Screenshot";
                    } else {
                        category = "Image";
                    }
                }
                // Other file types - try to read as text, otherwise fallback
                else {
                    try {
                        const content = await fsPromises.readFile(
                            itemPath,
                            "utf8"
                        );
                        category = await categorizeContent(
                            content.slice(0, 4000),
                            item
                        );
                    } catch {
                        category = "Other";
                    }
                }
            } catch (e) {
                console.error(`Error processing ${itemPath}:`, e);
                category = "Error_Processing";
            }

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
    // Apply smart normalization and grouping to categories
    const normalizedCategories = await normalizeCategoriesAndGroup(
        fileCategories
    );

    // Create folders and copy files using the normalized categories
    for (const category in normalizedCategories) {
        const categoryPath = path.join(outputPath, category);
        await fs.ensureDir(categoryPath);

        for (const filePath of normalizedCategories[category]) {
            const fileName = path.basename(filePath);
            const destPath = path.join(categoryPath, fileName);
            try {
                await fs.copy(filePath, destPath);
                console.log(`Copied: ${filePath} -> ${destPath}`);
            } catch (error) {
                console.error(`Failed to copy ${filePath}:`, error);
            }
        }
    }
}

/**
 * Extract text content from a PDF file
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<string>} - Extracted text content
 */
async function extractTextFromPDF(pdfPath) {
    try {
        // Require the pdf-parse library
        const pdfParse = require("pdf-parse");

        // Read the PDF file as a buffer
        const fs = require("fs-extra");
        const dataBuffer = await fs.readFile(pdfPath);

        // Parse options
        const options = {
            // Limit the number of pages to parse if the PDF is very large
            // Set to 0 for all pages (might be slow for large files)
            max: 20,

            // Extract hyperlinks (useful for some categorizations)
            hyperlinks: true,

            // Some PDFs may have text in different encodings
            textEncoding: "UTF-8",
        };

        // Parse the PDF
        const data = await pdfParse(dataBuffer, options);

        // Return the extracted text
        return data.text || "";
    } catch (error) {
        console.error(
            `Error extracting text from PDF ${pdfPath}:`,
            error.message
        );
        // Return a limited description of the PDF if extraction fails
        return `[PDF text extraction failed: ${error.message}]`;
    }
}

/**
 * Smart category normalization and grouping
 * @param {Object} fileCategories - The original file categories object
 * @returns {Object} - Normalized file categories
 */
async function normalizeCategoriesAndGroup(fileCategories) {
    // Step 1: Create a map of original categories to normalized categories
    const categoryMap = {};
    const normalizedCategories = {};
    const categoryGroups = [];

    // Basic normalization function
    const basicNormalize = (category) => {
        return category
            .toLowerCase()
            .replace(/&/g, " and ")
            .replace(/[^\w\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    };

    // Define comprehensive synonyms and related terms for all possible file categorization scenarios
    const synonymGroups = [
        // Financial & Accounting
        ["report", "statement", "analysis", "summary", "overview", "review"],
        ["invoice", "bill", "receipt", "voucher", "ticket", "stub"],
        ["sales", "revenue", "income", "earnings", "proceeds"],
        ["expense", "cost", "expenditure", "spending", "outlay"],
        ["stock", "inventory", "assets", "holdings", "shares"],
        ["budget", "forecast", "projection", "estimate", "plan"],
        ["profit", "loss", "pnl", "p&l", "earnings"],
        ["tax", "taxes", "taxation", "duty", "levy"],
        ["audit", "auditing", "compliance", "verification"],
        ["payroll", "salary", "wages", "compensation"],
        ["balance", "sheet", "financial", "fiscal"],

        // Legal & Contracts
        ["contract", "agreement", "deal", "arrangement", "pact"],
        ["legal", "law", "lawyer", "attorney", "counsel"],
        ["license", "permit", "authorization", "certification"],
        ["terms", "conditions", "policy", "policies"],
        ["compliance", "regulation", "regulatory", "rule"],
        ["lawsuit", "litigation", "dispute", "claim"],
        ["patent", "trademark", "copyright", "intellectual property"],
        ["nda", "non disclosure", "confidentiality"],

        // HR & Employment
        ["resume", "cv", "curriculum vitae", "bio", "profile"],
        ["employee", "staff", "personnel", "worker"],
        ["job", "position", "role", "employment"],
        ["hire", "hiring", "recruitment", "onboarding"],
        ["performance", "evaluation", "appraisal", "review"],
        ["training", "development", "education", "learning"],
        ["benefit", "benefits", "compensation", "package"],

        // Communication & Correspondence
        ["letter", "correspondence", "mail", "email", "message"],
        ["memo", "memorandum", "notice", "announcement"],
        ["newsletter", "bulletin", "update", "communication"],
        ["proposal", "offer", "bid", "quote", "quotation"],
        ["presentation", "slides", "deck", "slideshow"],
        ["meeting", "minutes", "notes", "agenda"],

        // Technical & IT
        ["code", "script", "source", "program", "software"],
        ["manual", "guide", "instruction", "documentation", "doc"],
        ["specification", "spec", "requirement", "design"],
        ["config", "configuration", "settings", "setup"],
        ["log", "logs", "logging", "debug", "trace"],
        ["database", "db", "data", "dataset", "records"],
        ["backup", "archive", "copy", "duplicate"],
        ["security", "password", "credential", "auth"],
        ["api", "interface", "endpoint", "service"],
        ["test", "testing", "qa", "quality", "validation"],

        // Marketing & Sales
        ["marketing", "promotion", "advertising", "campaign"],
        ["brochure", "flyer", "pamphlet", "leaflet"],
        ["catalog", "catalogue", "brochure", "portfolio"],
        ["customer", "client", "prospect", "lead"],
        ["product", "service", "offering", "solution"],
        ["brand", "branding", "identity", "logo"],
        ["social", "media", "digital", "online"],

        // Project Management
        ["project", "initiative", "program", "effort"],
        ["timeline", "schedule", "plan", "roadmap"],
        ["milestone", "deliverable", "task", "activity"],
        ["resource", "allocation", "assignment", "distribution"],
        ["status", "progress", "update", "tracker"],
        ["risk", "issue", "problem", "concern"],

        // Medical & Health
        ["medical", "health", "healthcare", "clinical"],
        ["patient", "record", "chart", "file"],
        ["prescription", "medication", "drug", "medicine"],
        ["treatment", "therapy", "procedure", "intervention"],
        ["diagnosis", "condition", "disease", "illness"],
        ["insurance", "claim", "coverage", "policy"],

        // Real Estate
        ["property", "real estate", "realty", "estate"],
        ["lease", "rental", "rent", "tenancy"],
        ["mortgage", "loan", "financing", "credit"],
        ["inspection", "appraisal", "valuation", "assessment"],
        ["deed", "title", "ownership", "property"],

        // Education & Academic
        ["course", "class", "lesson", "lecture"],
        ["assignment", "homework", "project", "exercise"],
        ["exam", "test", "quiz", "assessment"],
        ["grade", "score", "mark", "result"],
        ["thesis", "dissertation", "paper", "research"],
        ["student", "pupil", "learner", "scholar"],
        ["teacher", "instructor", "professor", "educator"],

        // Creative & Media
        ["image", "photo", "picture", "graphic"],
        ["video", "movie", "film", "clip"],
        ["audio", "sound", "music", "recording"],
        ["design", "artwork", "creative", "visual"],
        ["template", "layout", "format", "style"],
        ["content", "material", "media", "asset"],

        // General Document Types
        ["form", "application", "request", "submission"],
        ["certificate", "diploma", "award", "recognition"],
        ["warranty", "guarantee", "service", "support"],
        ["inventory", "list", "catalog", "index"],
        ["schedule", "calendar", "timetable", "agenda"],
        ["checklist", "todo", "task", "action"],

        // Industry Specific
        ["manufacturing", "production", "factory", "plant"],
        ["retail", "store", "shop", "outlet"],
        ["logistics", "shipping", "delivery", "transport"],
        ["supply", "vendor", "supplier", "procurement"],
        ["quality", "control", "assurance", "standard"],

        // Time & Date Related
        ["daily", "weekly", "monthly", "quarterly", "annual"],
        ["year", "yearly", "annual", "12month"],
        ["quarter", "quarterly", "q1", "q2", "q3", "q4"],
        ["month", "monthly", "30day"],

        // Action & Process Words
        ["create", "creation", "develop", "development"],
        ["update", "revision", "modification", "change"],
        ["draft", "preliminary", "initial", "rough"],
        ["final", "complete", "finished", "done"],
        ["approved", "signed", "executed", "ratified"],
        ["pending", "waiting", "review", "approval"],

        // Format & File Types
        ["spreadsheet", "excel", "csv", "data"],
        ["document", "word", "text", "doc"],
        ["pdf", "portable", "acrobat"],
        ["image", "jpg", "png", "gif"],
        ["archive", "zip", "compressed", "backup"],

        // Organizational
        ["admin", "administrative", "administration", "office"],
        ["internal", "external", "public", "private"],
        ["confidential", "secret", "classified", "restricted"],
        ["draft", "working", "temp", "temporary"],
        ["old", "archive", "historical", "legacy"],
        ["new", "latest", "current", "recent"],

        // Relationship & Contact
        ["contact", "address", "phone", "directory"],
        ["partner", "vendor", "supplier", "contractor"],
        ["internal", "staff", "employee", "team"],
        ["external", "client", "customer", "public"],
    ];

    // First pass: Normalize all categories and prepare for grouping
    for (const category of Object.keys(fileCategories)) {
        const normalized = basicNormalize(category);
        categoryMap[category] = {
            original: category,
            normalized,
            words: normalized.split(" ").filter((w) => w.length > 2),
            hasBeenGrouped: false,
        };
    }

    // Second pass: Group similar categories
    const categoryEntries = Object.values(categoryMap);

    for (let i = 0; i < categoryEntries.length; i++) {
        const entry = categoryEntries[i];

        // Skip if already grouped
        if (entry.hasBeenGrouped) continue;

        // Start a new group with this category
        const group = {
            categories: [entry.original],
            primaryName: entry.original,
        };
        entry.hasBeenGrouped = true;

        // Compare with all other categories
        for (let j = 0; j < categoryEntries.length; j++) {
            if (i === j) continue;

            const otherEntry = categoryEntries[j];
            if (otherEntry.hasBeenGrouped) continue;

            let shouldGroup = false;

            // Method 1: Exact match after normalization
            if (entry.normalized === otherEntry.normalized) {
                shouldGroup = true;
            }

            // Method 2: Check if they share the same significant words
            else {
                const entryWords = new Set(entry.words);
                const otherWords = new Set(otherEntry.words);
                const intersection = new Set(
                    [...entryWords].filter((x) => otherWords.has(x))
                );

                // If they share significant words
                if (intersection.size >= 2) {
                    shouldGroup = true;
                }
                // If one is a subset of the other (with at least one significant word)
                else if (
                    intersection.size > 0 &&
                    (intersection.size === entryWords.size ||
                        intersection.size === otherWords.size)
                ) {
                    shouldGroup = true;
                }
            }

            // Method 3: Check for synonym relationships
            if (!shouldGroup) {
                const entryWords = entry.words;
                const otherWords = otherEntry.words;

                // Check if they have synonymous terms
                for (const synonymSet of synonymGroups) {
                    const entryHasSynonym = entryWords.some((word) =>
                        synonymSet.includes(word)
                    );
                    const otherHasSynonym = otherWords.some((word) =>
                        synonymSet.includes(word)
                    );

                    if (entryHasSynonym && otherHasSynonym) {
                        // Check if the non-synonym parts are similar
                        const entryNonSynonyms = entryWords.filter(
                            (word) => !synonymSet.includes(word)
                        );
                        const otherNonSynonyms = otherWords.filter(
                            (word) => !synonymSet.includes(word)
                        );

                        const nonSynIntersection = new Set(
                            [...entryNonSynonyms].filter((x) =>
                                otherNonSynonyms.includes(x)
                            )
                        );

                        if (nonSynIntersection.size > 0) {
                            shouldGroup = true;
                            break;
                        }
                    }
                }
            }

            // If should be grouped, add to current group
            if (shouldGroup) {
                group.categories.push(otherEntry.original);
                otherEntry.hasBeenGrouped = true;

                // Select the most descriptive name as primary
                // (generally prefer longer names as they're more specific)
                if (otherEntry.original.length > group.primaryName.length) {
                    group.primaryName = otherEntry.original;
                }
            }
        }

        categoryGroups.push(group);
    }

    // Build the new fileCategories object
    for (const group of categoryGroups) {
        // Generalized handling: Merge all image-related categories into 'Images'
        let primaryName = group.primaryName;
        const imagePattern = /\b(image|photo|picture|graphic|svg|scalable vector graphic|png|jpg|jpeg|gif|bmp|tiff|webp)\b/i;
        if (imagePattern.test(primaryName)) {
            primaryName = 'Images';
        }
        normalizedCategories[primaryName] = normalizedCategories[primaryName] || [];

        // Merge all files from the group categories
        for (const category of group.categories) {
            // If this category is image-related, also merge under 'Images'
            if (imagePattern.test(category)) {
                normalizedCategories['Images'] = normalizedCategories['Images'] || [];
                normalizedCategories['Images'].push(...fileCategories[category]);
            } else {
                normalizedCategories[primaryName].push(...fileCategories[category]);
            }
        }
    }

    return normalizedCategories;
}

module.exports = {
    processDirectory,
    organizeFilesByCategory,
    extractTextFromPDF,
};
