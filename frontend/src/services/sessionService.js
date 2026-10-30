import api from './api.js';

export const sessionService = {
  async create(title = 'New Chat') {
    const { data } = await api.post('/sessions', { title });
    return data;
  },

  async list() {
    const { data } = await api.get('/sessions');
    return data.sessions || [];
  },

  async get(sessionId) {
    const { data } = await api.get(`/sessions/${sessionId}`);
    return data; // { session, messages }
  },

  async delete(sessionId) {
    const { data } = await api.delete(`/sessions/${sessionId}`);
    return data;
  },

  async clearMessages(sessionId) {
    const { data } = await api.delete(`/sessions/${sessionId}/messages`);
    return data;
  }
};
