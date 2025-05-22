// Gemini AI utility for content categorization
const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-pro";

if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Categorize file content using Gemini AI
 * @param {string} content - The file content to analyze
 * @param {string} [filename] - Optional filename for context
 * @returns {Promise<string>} - Category name
 */
async function categorizeContent(content, filename = "") {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Updated prompt for content-based categorization
    let prompt = `You are an AI file categorization assistant. Analyze the following file content and categorize it based on its ACTUAL CONTENT (not just file type).

Return ONLY ONE specific category name without explanation or additional text. Choose the most precise category that describes the content.

Examples of content-based categories:
- Invoice
- Receipt
- Resume/CV
- Cover Letter
- Contract
- Business Report
- Financial Statement
- Meeting Notes
- Tutorial
- Research Paper
- Personal Letter
- Product Description
- API Documentation
- User Manual
- Creative Story
- Source Code (specify language if clear)
- Dataset
- Configuration File
- Log File
- Marketing Copy
- Legal Document

If none of these categories fit precisely, create a specific descriptive category that accurately reflects the content.
DO NOT use generic categories like "Document" or "Text File" unless the content is truly generic.`;

    if (filename) {
        prompt += `\n\nFilename: ${filename}`;
    }
    prompt += `\n\nContent:\n${content}`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const DEBUG_LOGGING = process.env.GEMINI_DEBUG_LOG === "1";

        if (DEBUG_LOGGING) {
            const fs = require("fs");
            const logMsg = `[${new Date().toISOString()}] ${
                filename || ""
            }\nPrompt: ${prompt}\nGemini raw response: ${text}\n\n`;
            fs.appendFileSync("logs/gemini_debug.log", logMsg, {
                encoding: "utf8",
                flag: "a",
            });
        }

        console.log("Gemini raw response:", filename || "", text); // Always log to console

        // No longer filtering to a limited set of categories - accepting whatever specific category Gemini returns
        return text;
    } catch (error) {
        console.error("Gemini API error:", error);
        return "Uncategorized";
    }
}

module.exports = {
    categorizeContent,
};
