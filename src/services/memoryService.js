import crypto from "node:crypto";
import { getSessionsCollection, getMessagesCollection } from "../config/database.js";

const MAX_HISTORY = Number(process.env.MAX_HISTORY || 20);


export async function createSession(title = "New Chat") {
    const sessionsColl = await getSessionsCollection();
    const sessionId = crypto.randomUUID();
    const now = new Date();

    const session = {
        sessionId,
        title,
        createdAt: now,
        updatedAt: now
    };

    await sessionsColl.insertOne(session);
    return session;
}

/**
 * Lists all previous chat sessions sorted by latest activity.
 */
export async function listSessions() {
    const sessionsColl = await getSessionsCollection();
    return sessionsColl.find().sort({ updatedAt: -1 }).toArray();
}

/**
 * Retrieves a session and its message history in chronological order.
 */
export async function getSessionWithMessages(sessionId, limit = MAX_HISTORY) {
    const sessionsColl = await getSessionsCollection();
    const messagesColl = await getMessagesCollection();

    let session = await sessionsColl.findOne({ sessionId });
    if (!session) {
        // Auto-create if not found
        session = {
            sessionId,
            title: "New Chat",
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await sessionsColl.insertOne(session);
    }

    // Retrieve latest messages, but return in ascending chronological order
    const messages = await messagesColl
        .find({ sessionId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

    return {
        session,
        messages: messages.reverse()
    };
}

/**
 * Adds a message to a session and updates the session's updatedAt timestamp.
 * If this is the first user message and session has default title, auto-generates title.
 */
export async function saveMessage(sessionId, role, content, sources = []) {
    const sessionsColl = await getSessionsCollection();
    const messagesColl = await getMessagesCollection();
    const now = new Date();

    const message = {
        sessionId,
        role,
        content,
        createdAt: now,
        sources: sources || []
    };

    await messagesColl.insertOne(message);

    // Update session timestamp & auto-generate title if first user message
    const session = await sessionsColl.findOne({ sessionId });
    let updateFields = { updatedAt: now };

    if (role === "user" && (!session || session.title === "New Chat" || !session.title)) {
        // Generate a concise title from the first 40 characters
        const cleanTitle = content.trim().replace(/[\r\n]+/g, " ");
        const title = cleanTitle.length > 40 ? cleanTitle.slice(0, 40) + "..." : cleanTitle;
        updateFields.title = title;
    }

    await sessionsColl.updateOne(
        { sessionId },
        {
            $set: updateFields,
            $setOnInsert: { createdAt: now }
        },
        { upsert: true }
    );

    return message;
}

/**
 * Deletes an individual session and all its messages.
 */
export async function deleteSession(sessionId) {
    const sessionsColl = await getSessionsCollection();
    const messagesColl = await getMessagesCollection();

    await messagesColl.deleteMany({ sessionId });
    const res = await sessionsColl.deleteOne({ sessionId });

    return { success: res.deletedCount > 0, sessionId };
}

/**
 * Clears all messages from a session without deleting the session itself.
 */
export async function clearSessionMessages(sessionId) {
    const messagesColl = await getMessagesCollection();
    const sessionsColl = await getSessionsCollection();

    const res = await messagesColl.deleteMany({ sessionId });
    await sessionsColl.updateOne(
        { sessionId },
        { $set: { updatedAt: new Date() } }
    );

    return { clearedCount: res.deletedCount, sessionId };
}
