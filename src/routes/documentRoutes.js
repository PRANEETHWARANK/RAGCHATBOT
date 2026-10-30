import { Router } from "express";
import { upload } from "../middleware/uploadMiddleware.js";
import {
    handleUpload,
    handleListDocuments,
    handleGetDocumentDetails,
    handleDeleteDocument,
    handleReprocessDocument
} from "../controllers/documentController.js";

const router = Router();

// Accept multiple files with field name 'files' or single file 'file'
router.post("/upload", upload.any(), handleUpload);
router.get("/", handleListDocuments);
router.get("/:documentId", handleGetDocumentDetails);
router.delete("/:documentId", handleDeleteDocument);
router.post("/:documentId/reprocess", handleReprocessDocument);

export default router;
