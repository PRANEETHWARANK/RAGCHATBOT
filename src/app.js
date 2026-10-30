import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";

import chatRoutes from "./routes/chatRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import { errorHandler } from "./middleware/errorMiddleware.js";

const app = express();
const FRONTEND_DIST = path.resolve("frontend", "dist");

// CORS & Body Parsers
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// API Routes
app.use("/api/chat", chatRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/status", healthRoutes); // Backward compatibility alias

// Serve Frontend build if present
if (fs.existsSync(FRONTEND_DIST)) {
    app.use(express.static(FRONTEND_DIST));

    // Fallback all non-API GET requests to React's index.html (Express 5 compatible)
    app.use((req, res, next) => {
        if (req.method === "GET" && !req.path.startsWith("/api")) {
            return res.sendFile(path.join(FRONTEND_DIST, "index.html"));
        }
        next();
    });
} else {
    app.use((req, res, next) => {
        if (req.method === "GET" && !req.path.startsWith("/api")) {
            return res.send(`
                <h1>RAG Chatbot Backend API is running!</h1>
                <p>Frontend is running on <a href="http://localhost:5173">http://localhost:5173</a> (Vite dev server) or run <code>npm run build</code> to build production bundle.</p>
                <p>API Health: <a href="/api/health">/api/health</a></p>
            `);
        }
        next();
    });
}

// Global Error Handler Middleware
app.use(errorHandler);

export default app;
