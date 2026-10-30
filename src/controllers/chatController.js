import { processChatMessage } from "../services/chatService.js";

export async function handleChat(req, res, next) {
    try {
        const { sessionId, message, similarityThreshold, maxResults, model } = req.body;

        if (!message || typeof message !== "string" || !message.trim()) {
            return res.status(400).json({ error: "Message is required and must be non-empty." });
        }

        const result = await processChatMessage({
            sessionId,
            message,
            similarityThreshold,
            maxResults,
            model
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
}
