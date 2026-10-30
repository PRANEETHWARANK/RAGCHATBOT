import { useState, useCallback, useRef } from 'react';
import { sessionService } from '../services/sessionService.js';
import { chatService } from '../services/chatService.js';

const ACTIVE_SESSION_KEY = 'rag_active_session_id';

export function useChat() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(
    () => localStorage.getItem(ACTIVE_SESSION_KEY) || null
  );
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load session list
  const loadSessions = useCallback(async () => {
    try {
      const data = await sessionService.list();
      setSessions(data || []);
      return data || [];
    } catch (err) {
      console.warn('Failed to list sessions (backend/DB may be starting):', err.message);
      return [];
    }
  }, []);

  // Switch to / load an existing session
  const loadSession = useCallback(async (sessionId) => {
    if (!sessionId) return;
    try {
      setLoading(true);
      setError(null);
      const { session, messages: msgs } = await sessionService.get(sessionId);
      setActiveSessionId(sessionId);
      localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);

      // Map DB messages to UI format
      setMessages(
        (msgs || []).map((m) => ({
          id: m._id || Math.random().toString(),
          role: m.role,
          content: m.content,
          sources: m.sources || [],
          createdAt: m.createdAt
        }))
      );
      return session;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new session and activate it
  const createSession = useCallback(async (title = 'New Chat') => {
    try {
      const session = await sessionService.create(title);
      await loadSessions();
      setActiveSessionId(session.sessionId);
      localStorage.setItem(ACTIVE_SESSION_KEY, session.sessionId);
      setMessages([]);
      setError(null);
      return session;
    } catch (err) {
      console.warn('Create session warning:', err.message);
      // Fallback local session ID if DB is temporarily disconnected
      const fallbackId = `local-${Date.now()}`;
      setActiveSessionId(fallbackId);
      localStorage.setItem(ACTIVE_SESSION_KEY, fallbackId);
      setMessages([]);
      return { sessionId: fallbackId, title };
    }
  }, [loadSessions]);

  // Delete a session
  const deleteSession = useCallback(async (sessionId) => {
    try {
      await sessionService.delete(sessionId);
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      }
      await loadSessions();
    } catch (err) {
      setError(err.message);
    }
  }, [activeSessionId, loadSessions]);

  // Clear messages in a session
  const clearMessages = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      await sessionService.clearMessages(activeSessionId);
      setMessages([]);
    } catch (err) {
      setError(err.message);
    }
  }, [activeSessionId]);

  // Send a message
  const sendMessage = useCallback(async (text, options = {}) => {
    if (!text?.trim()) return;

    let targetSessionId = activeSessionId;

    // Auto-create a session if none active
    if (!targetSessionId) {
      try {
        const session = await sessionService.create('New Chat');
        targetSessionId = session.sessionId;
        setActiveSessionId(targetSessionId);
        localStorage.setItem(ACTIVE_SESSION_KEY, targetSessionId);
        await loadSessions();
      } catch (err) {
        targetSessionId = `session-${Date.now()}`;
        setActiveSessionId(targetSessionId);
        localStorage.setItem(ACTIVE_SESSION_KEY, targetSessionId);
      }
    }

    setError(null);

    // Optimistically add user message to UI immediately
    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      sources: [],
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const result = await chatService.sendMessage({
        sessionId: targetSessionId,
        message: text.trim(),
        ...options
      });

      const aiMsg = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: result.answer,
        sources: result.sources || [],
        usedDocuments: result.usedDocuments,
        createdAt: new Date().toISOString()
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Refresh session list to update 'updatedAt' / auto-title
      await loadSessions();

      return result;
    } catch (err) {
      console.error('Chat send error:', err);
      setError(err.message);
      const errMsg = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Error:** ${err.message}`,
        sources: [],
        isError: true,
        createdAt: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [activeSessionId, loadSessions]);

  return {
    sessions,
    activeSessionId,
    messages,
    loading,
    error,
    setError,
    loadSessions,
    loadSession,
    createSession,
    deleteSession,
    clearMessages,
    sendMessage
  };
}
