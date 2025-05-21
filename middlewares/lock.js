// Basic in-memory lock middleware for single-threaded Node.js
let isLocked = false;

function lockMiddleware(req, res, next) {
    if (isLocked) {
        return res.status(429).json({ error: "Another upload is currently being processed. Please try again later." });
    }
    isLocked = true;
    res.on('finish', () => {
        isLocked = false;
    });
    next();
}

module.exports = lockMiddleware;
