require('dotenv').config();
const multer = require("multer");
const fs = require("fs-extra");

const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (
            file.mimetype === "application/zip" ||
            file.mimetype === "application/x-zip-compressed" ||
            file.originalname.toLowerCase().endsWith(".zip")
        ) {
            cb(null, true);
        } else {
            cb(new Error("Only zip files are allowed"), false);
        }
    },
    limits: { fileSize: MAX_FILE_SIZE },
});

fs.ensureDirSync("uploads");

module.exports = upload;
module.exports.MAX_FILE_SIZE = MAX_FILE_SIZE;
module.exports.MAX_FILE_SIZE_MB = MAX_FILE_SIZE_MB;
