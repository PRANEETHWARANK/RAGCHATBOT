export function errorHandler(err, req, res, next) {
    console.error("Unhandled error:", err);

    if (err.name === "MulterError") {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                error: `File size exceeds the allowed limit (max ${process.env.MAX_FILE_SIZE_MB || 20}MB).`
            });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
    }

    const statusCode = err.statusCode || 500;
    const message = err.message || "An unexpected internal server error occurred.";

    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {})
    });
}
