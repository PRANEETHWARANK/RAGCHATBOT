import {
    createSession,
    listSessions,
    getSessionWithMessages,
    deleteSession,
    clearSessionMessages
} from "../services/memoryService.js";

export async function handleCreateSession(req, res, next) {
    try {
        const { title } = req.body || {};
        const session = await createSession(title || "New Chat");
        res.status(201).json(session);
    } catch (error) {
        next(error);
    }
}

export async function handleListSessions(req, res, next) {
    try {
        const sessions = await listSessions();
        res.json({ sessions });
    } catch (error) {
        next(error);
    }
}

export async function handleGetSession(req, res, next) {
    try {
        const { sessionId } = req.params;
        if (!sessionId) {
            return res.status(400).json({ error: "sessionId is required." });
        }

        const data = await getSessionWithMessages(sessionId);
        res.json(data);
    } catch (error) {
        next(error);
    }
}

export async function handleDeleteSession(req, res, next) {
    try {
        const { sessionId } = req.params;
        const result = await deleteSession(sessionId);
        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function handleClearSessionMessages(req, res, next) {
    try {
        const { sessionId } = req.params;
        const result = await clearSessionMessages(sessionId);
        res.json(result);
    } catch (error) {
        next(error);
    }
}
