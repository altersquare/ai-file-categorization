const multer = require("multer");
const fs = require("fs-extra");

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
    limits: { fileSize: 10 * 1024 * 1024 },
});

fs.ensureDirSync("uploads");

module.exports = upload;
