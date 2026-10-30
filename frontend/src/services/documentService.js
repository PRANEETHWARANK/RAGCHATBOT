import api from './api.js';

export const documentService = {
  async upload(files, onProgress) {
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('files', file));

    const { data } = await api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      }
    });
    return data; // { message, results }
  },

  async list() {
    const { data } = await api.get('/documents');
    return data.documents || [];
  },

  async get(documentId) {
    const { data } = await api.get(`/documents/${documentId}`);
    return data.document;
  },

  async delete(documentId) {
    const { data } = await api.delete(`/documents/${documentId}`);
    return data;
  },

  async reprocess(documentId) {
    const { data } = await api.post(`/documents/${documentId}/reprocess`);
    return data;
  }
};
