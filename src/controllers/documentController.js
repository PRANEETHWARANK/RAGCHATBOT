import {
    processMultipleFiles,
    listAllDocuments,
    getDocumentById,
    deleteDocument,
    reprocessDocument
} from "../services/documentService.js";

export async function handleUpload(req, res, next) {
    try {
        const files = req.files || (req.file ? [req.file] : []);

        if (!files || files.length === 0) {
            return res.status(400).json({ error: "No files uploaded. Please select at least one file." });
        }

        const results = await processMultipleFiles(files);
        res.status(201).json({
            message: `Uploaded and processed ${results.length} document(s)`,
            results
        });
    } catch (error) {
        next(error);
    }
}

export async function handleListDocuments(req, res, next) {
    try {
        const documents = await listAllDocuments();
        res.json({ documents });
    } catch (error) {
        next(error);
    }
}

export async function handleGetDocumentDetails(req, res, next) {
    try {
        const { documentId } = req.params;
        const document = await getDocumentById(documentId);
        if (!document) {
            return res.status(404).json({ error: "Document not found." });
        }
        res.json({ document });
    } catch (error) {
        next(error);
    }
}

export async function handleDeleteDocument(req, res, next) {
    try {
        const { documentId } = req.params;
        const result = await deleteDocument(documentId);
        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function handleReprocessDocument(req, res, next) {
    try {
        const { documentId } = req.params;
        const result = await reprocessDocument(documentId);
        res.json({
            message: "Document reprocessed successfully",
            document: result
        });
    } catch (error) {
        next(error);
    }
}
