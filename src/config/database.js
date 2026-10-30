import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "rag_chatbot";

// Fast 3-second timeout for server selection so the app never hangs indefinitely
const client = new MongoClient(MONGO_URI, {
    serverSelectionTimeoutMS: 3000,
    connectTimeoutMS: 3000
});

let database = null;

export async function connectDB() {
    try {
        if (database) {
            return database;
        }

        await client.connect();
        database = client.db(DB_NAME);

        // Ensure indexes for fast queries
        try {
            await database.collection("chat_sessions").createIndex({ sessionId: 1 }, { unique: true });
            await database.collection("chat_messages").createIndex({ sessionId: 1, createdAt: 1 });
            await database.collection("documents_metadata").createIndex({ documentId: 1 }, { unique: true });
            await database.collection("documents_metadata").createIndex({ fileHash: 1 });
            await database.collection("document_chunks").createIndex({ documentId: 1, version: 1, chunkIndex: 1 });
        } catch (idxErr) {
            // Non-critical if indexes already exist
        }

        console.log("MongoDB connected successfully!");
        return database;
    } catch (error) {
        database = null;
        console.error("MongoDB connection notice:", error.message);
        throw error;
    }
}

export async function getDocumentsCollection() {
    const db = await connectDB();
    return db.collection("documents_metadata");
}

export async function getChunksCollection() {
    const db = await connectDB();
    return db.collection("document_chunks");
}

export async function getTablesCollection() {
    const db = await connectDB();
    return db.collection("document_tables");
}

export async function getSessionsCollection() {
    const db = await connectDB();
    return db.collection("chat_sessions");
}

export async function getMessagesCollection() {
    const db = await connectDB();
    return db.collection("chat_messages");
}

// Backward compatibility with original terminal-based code
export async function getDocumentCollection() {
    return getChunksCollection();
}

export async function checkDBStatus() {
    try {
        const db = await connectDB();
        await db.command({ ping: 1 });
        const chunksColl = db.collection("document_chunks");
        const docsColl = db.collection("documents_metadata");
        const sessionsColl = db.collection("chat_sessions");

        const [chunksCount, docsCount, sessionsCount] = await Promise.all([
            chunksColl.countDocuments().catch(() => 0),
            docsColl.countDocuments().catch(() => 0),
            sessionsColl.countDocuments().catch(() => 0)
        ]);

        return {
            online: true,
            database: DB_NAME,
            documentChunksCount: chunksCount,
            documentsCount: docsCount,
            sessionsCount
        };
    } catch (error) {
        return {
            online: false,
            database: DB_NAME,
            error: error.message
        };
    }
}

export async function closeDB() {
    if (client) {
        try {
            await client.close();
        } catch (e) {
            // ignore
        }
        database = null;
        console.log("MongoDB connection closed.");
    }
}
