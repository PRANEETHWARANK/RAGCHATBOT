import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 20);

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Safe filename with UUID prefix to prevent collisions and path traversal
        const fileExt = path.extname(file.originalname).toLowerCase();
        const baseName = path.basename(file.originalname, fileExt).replace(/[^a-zA-Z0-9_-]/g, "_");
        const uniqueId = crypto.randomUUID().slice(0, 8);
        const safeName = `${Date.now()}-${uniqueId}-${baseName}${fileExt}`;
        cb(null, safeName);
    }
});

const allowedExtensions = [
    ".txt",
    ".md",
    ".json",
    ".pdf",
    ".docx",
    // New formats
    ".csv",
    ".xlsx",
    ".xls",
    ".xlsm",
    ".tex"
];

const allowedMimeTypes = [
    // Plain text
    "text/plain",
    "text/markdown",
    "application/json",
    // PDF
    "application/pdf",
    // Word
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    // CSV
    "text/csv",
    "application/csv",
    // Excel
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",   // .xlsx
    "application/vnd.ms-excel",                                            // .xls
    "application/vnd.ms-excel.sheet.macroEnabled.12",                      // .xlsm
    // LaTeX (browsers often send as text/plain; also cover common explicit MIME)
    "application/x-tex",
    "application/x-latex",
    "text/x-tex"
];

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;

    if (allowedExtensions.includes(ext) || allowedMimeTypes.includes(mime)) {
        cb(null, true);
    } else {
        cb(new Error(
            `File type "${ext}" is not supported. ` +
            `Allowed formats: TXT, MD, JSON, PDF, DOCX, CSV, XLSX, XLS, XLSM, TEX`
        ));
    }
};

export const upload = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE_MB * 1024 * 1024
    },
    fileFilter
});

export { UPLOAD_DIR };
