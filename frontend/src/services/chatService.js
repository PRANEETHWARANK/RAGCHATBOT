import api from './api.js';

export const chatService = {
  async sendMessage({ sessionId, message, similarityThreshold, maxResults, model }) {
    const { data } = await api.post('/chat', {
      sessionId,
      message,
      ...(similarityThreshold !== undefined && { similarityThreshold }),
      ...(maxResults !== undefined && { maxResults }),
      ...(model && { model })
    });
    return data; // { sessionId, answer, sources, usedDocuments, retrievedCount }
  }
};
