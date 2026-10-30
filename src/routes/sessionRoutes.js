import { Router } from "express";
import {
    handleCreateSession,
    handleListSessions,
    handleGetSession,
    handleDeleteSession,
    handleClearSessionMessages
} from "../controllers/sessionController.js";

const router = Router();

router.post("/", handleCreateSession);
router.get("/", handleListSessions);
router.get("/:sessionId", handleGetSession);
router.delete("/:sessionId", handleDeleteSession);
router.delete("/:sessionId/messages", handleClearSessionMessages);

export default router;
