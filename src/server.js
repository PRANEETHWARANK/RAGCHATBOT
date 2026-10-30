import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "./config/database.js";
import app from "./app.js";

const PORT = process.env.PORT || 5000;

// Start Express server immediately so the website is always accessible
const server = app.listen(PORT, () => {
    console.log(`🚀 RAG Chatbot server running at http://localhost:${PORT}`);
    console.log(`   Chat Model   : ${process.env.CHAT_MODEL || "llama3.1:8b"}`);
    console.log(`   Embed Model  : ${process.env.EMBED_MODEL || "nomic-embed-text"}`);
    console.log(`   MongoDB URI  : ${process.env.MONGO_URI || "mongodb://127.0.0.1:27017"}`);
});

// Connect to MongoDB in background; log clearly if offline without crashing web server
connectDB()
    .then(() => {
        console.log("✅ Database initialized and ready.");
    })
    .catch((err) => {
        console.warn(`⚠️  MongoDB is currently unreachable (${err.message}).`);
        console.warn(`   Please make sure MongoDB is running on port 27017.`);
        console.warn(`   The web server is active and will auto-reconnect when MongoDB starts.`);
    });

export default server;
