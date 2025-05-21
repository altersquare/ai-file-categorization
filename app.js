require("dotenv").config();

const express = require("express");
require("dotenv").config();
const path = require("path");
const upload = require("./middlewares/upload");
const lock = require("./middlewares/lock");
const fileController = require("./controllers/fileController");

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static("public"));

// Route for the home page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API Routes (delegated to controllers)
app.post("/upload", lock, upload.single("zipFile"), fileController.uploadZip);
app.get("/results/:sessionId", fileController.getResults);

// Error handler for Multer and other errors
app.use((err, req, res, next) => {
    // Multer file too large
    if (err && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum allowed size is 10MB.' });
    }
    // Multer errors
    if (err && err.name === 'MulterError') {
        return res.status(400).json({ error: err.message });
    }
    // Other errors
    if (err) {
        return res.status(500).json({ error: err.message || 'Internal server error.' });
    }
    next();
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
