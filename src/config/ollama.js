import dotenv from "dotenv";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";

dotenv.config();

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const CHAT_MODEL = process.env.CHAT_MODEL || "llama3.1:8b";
const EMBED_MODEL = process.env.EMBED_MODEL || "nomic-embed-text";

export { OLLAMA_URL, CHAT_MODEL, EMBED_MODEL };

/**
 * Returns a LangChain ChatOllama instance configured with the specified or default model.
 */
export function getChatModel(model = CHAT_MODEL, temperature = 0.2) {
    return new ChatOllama({
        baseUrl: OLLAMA_URL,
        model: model || CHAT_MODEL,
        temperature
    });
}

/**
 * Returns a LangChain OllamaEmbeddings instance.
 */
export function getEmbeddingsModel(model = EMBED_MODEL) {
    return new OllamaEmbeddings({
        baseUrl: OLLAMA_URL,
        model: model || EMBED_MODEL
    });
}

/**
 * Generate embeddings for document chunks and questions using LangChain OllamaEmbeddings.
 * Returns a 1D number array.
 */
export async function createEmbedding(text) {
    if (!text || !text.trim()) {
        return [];
    }
    const embeddings = getEmbeddingsModel();
    return await embeddings.embedQuery(text);
}

/**
 * Generate chatbot response given a list of messages.
 * Supports array of { role, content } objects, LangChain BaseMessage instances, or a raw string.
 */
export async function askOllama(messages, customModel = CHAT_MODEL) {
    const chat = getChatModel(customModel);

    let formattedMessages;
    if (typeof messages === "string") {
        formattedMessages = messages;
    } else if (Array.isArray(messages)) {
        formattedMessages = messages.map(m => {
            if (m && typeof m === "object" && "role" in m && "content" in m) {
                const role = m.role === "assistant" ? "ai" : m.role;
                return [role, m.content];
            }
            return m;
        });
    } else {
        formattedMessages = messages;
    }

    const response = await chat.invoke(formattedMessages);
    return typeof response.content === "string" ? response.content : JSON.stringify(response.content);
}

/**
 * Contextualize follow-up questions to resolve pronouns/references (e.g. "its types", "that again")
 * using LangChain's PromptTemplate + ChatOllama + StringOutputParser pipeline.
 */
export async function contextualizeQuestion(question, recentHistory = []) {
    if (!recentHistory || recentHistory.length === 0) {
        return question;
    }

    const followUpPattern = /\b(it|its|they|them|their|this|that|these|those|he|him|his|she|her|again|more|else|both|second|third|former|latter|the same)\b/i;
    const words = question.trim().split(/\s+/);
    if (words.length >= 3 && !followUpPattern.test(question)) {
        return question;
    }

    try {
        const historyText = recentHistory
            .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
            .join("\n");

        const chat = getChatModel(CHAT_MODEL, 0.0);

        const prompt = [
            ["system", `You are a query contextualizer for a search engine. Given the conversation history and the user's latest follow-up question, rephrase the question into a clear, standalone search query that incorporates the context.
Rules:
- Do NOT answer the question.
- Do NOT add explanations or preamble.
- Output ONLY the standalone search query.
- If the question is already standalone, return it as is.`],
            ["user", `Conversation History:\n${historyText}\n\nLatest User Question: ${question}\n\nStandalone Query:`]
        ];

        const response = await chat.invoke(prompt);
        const contextualized = typeof response.content === "string" ? response.content : "";
        const cleaned = contextualized?.trim()?.replace(/^["']|["']$/g, "");
        return cleaned || question;
    } catch (err) {
        console.warn("Contextualize query warning (fallback to original):", err.message);
        return question;
    }
}

/**
 * Check Ollama connectivity and list available models.
 */
export async function checkOllamaStatus() {
    try {
        const response = await fetch(`${OLLAMA_URL}/api/tags`);
        if (!response.ok) {
            return {
                online: false,
                error: `HTTP ${response.status}`,
                chatModel: CHAT_MODEL,
                embedModel: EMBED_MODEL,
                availableModels: []
            };
        }
        const data = await response.json();
        return {
            online: true,
            chatModel: CHAT_MODEL,
            embedModel: EMBED_MODEL,
            availableModels: (data.models || []).map(m => m.name)
        };
    } catch (err) {
        return {
            online: false,
            chatModel: CHAT_MODEL,
            embedModel: EMBED_MODEL,
            error: err.message,
            availableModels: []
        };
    }
}
