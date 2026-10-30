import { Router } from "express";
import { checkDBStatus } from "../config/database.js";
import { checkOllamaStatus, CHAT_MODEL, EMBED_MODEL } from "../config/ollama.js";

const router = Router();

router.get("/", async (req, res) => {
    try {
        const [dbStatus, ollamaStatus] = await Promise.all([
            checkDBStatus(),
            checkOllamaStatus()
        ]);

        const isHealthy = dbStatus.online && ollamaStatus.online;

        res.status(200).json({
            status: isHealthy ? "healthy" : "degraded",
            timestamp: new Date().toISOString(),
            db: dbStatus,
            ollama: ollamaStatus,
            config: {
                chatModel: CHAT_MODEL,
                embedModel: EMBED_MODEL,
                similarityThreshold: Number(process.env.SIMILARITY_THRESHOLD || 0.35),
                maxRetrievedChunks: Number(process.env.MAX_RETRIEVED_CHUNKS || 4),
                maxHistory: Number(process.env.MAX_HISTORY || 20)
            }
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            error: error.message
        });
    }
});

export default router;
