import { useState, useCallback } from 'react';
import { documentService } from '../services/documentService.js';

export function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await documentService.list();
      setDocuments(docs);
      return docs;
    } catch (err) {
      setError(err.message);
      return [];
    }
  }, []);

  const uploadFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const result = await documentService.upload(files, (pct) => {
        setUploadProgress(pct);
      });
      await loadDocuments();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [loadDocuments]);

  const deleteDocument = useCallback(async (documentId) => {
    try {
      await documentService.delete(documentId);
      setDocuments((prev) => prev.filter((d) => d.documentId !== documentId));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const reprocessDocument = useCallback(async (documentId) => {
    try {
      const result = await documentService.reprocess(documentId);
      await loadDocuments();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [loadDocuments]);

  return {
    documents,
    uploading,
    uploadProgress,
    error,
    setError,
    loadDocuments,
    uploadFiles,
    deleteDocument,
    reprocessDocument
  };
}
