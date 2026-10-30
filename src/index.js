import dotenv from "dotenv";

import {
    connectDB,
    closeDB
} from "./config/database.js";

import { startChat } from "./chat.js";

dotenv.config();

async function main() {
    try {
        console.log("Starting RAG chatbot...");

        await connectDB();

        console.log("Starting terminal interface...");

        await startChat();

    } catch (error) {
        console.error("Application error:", error.message);

    } finally {
        await closeDB();
    }
}

main();