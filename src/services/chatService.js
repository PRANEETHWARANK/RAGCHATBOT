import crypto from "node:crypto";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { getChatModel, contextualizeQuestion, CHAT_MODEL } from "../config/ollama.js";
import { searchContext } from "./ragService.js";
import { getSessionWithMessages, saveMessage } from "./memoryService.js";
import { queryTableWithAlaSql } from "./tableService.js";

const DEFAULT_SIMILARITY_THRESHOLD = Number(process.env.SIMILARITY_THRESHOLD || 0.35);
const DEFAULT_MAX_RETRIEVED_CHUNKS = Number(process.env.MAX_RETRIEVED_CHUNKS || 4);
const MAX_HISTORY = Number(process.env.MAX_HISTORY || 20);

/**
 * Builds a LangChain LCEL RAG execution chain using ChatPromptTemplate, ChatOllama, and StringOutputParser.
 */
function createRagChain(modelName) {
    const chatModel = getChatModel(modelName);

    const promptTemplate = ChatPromptTemplate.fromMessages([
        ["system", "{system_prompt}"],
        new MessagesPlaceholder("chat_history"),
        ["user", "{question}"]
    ]);

    const chain = promptTemplate.pipe(chatModel).pipe(new StringOutputParser());
    return chain;
}

/**
 * Handles incoming chat message with memory, AlaSQL tabular queries & vector RAG retrieval via LangChain.
 */
export async function processChatMessage({
    sessionId,
    message,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
    maxResults = DEFAULT_MAX_RETRIEVED_CHUNKS,
    model = CHAT_MODEL
}) {
    if (!message || !message.trim()) {
        const error = new Error("Message content cannot be empty.");
        error.statusCode = 400;
        throw error;
    }

    // 1. Ensure sessionId exists
    const activeSessionId = sessionId || crypto.randomUUID();

    // 2. Retrieve chronological conversation history from MongoDB
    const { messages: previousMessages } = await getSessionWithMessages(activeSessionId, MAX_HISTORY);

    // 3. Contextualize query for follow-up questions
    let searchQuery = message.trim();
    if (previousMessages.length > 0) {
        const recentContext = previousMessages.slice(-4).map(m => ({
            role: m.role,
            content: m.content
        }));
        searchQuery = await contextualizeQuestion(message, recentContext);
    }

    // 4. Run AlaSQL in-memory query against structured table records
    let alasqlResult = null;
    try {
        alasqlResult = await queryTableWithAlaSql(message.trim());
        if (!alasqlResult && searchQuery !== message.trim()) {
            alasqlResult = await queryTableWithAlaSql(searchQuery);
        }
    } catch (e) {
        console.warn("[ALASQL] Query warning:", e.message);
    }

    // Direct AlaSQL Result (direct SQL query, table extraction, or exact calculation)
    if (alasqlResult && alasqlResult.isDirectResult) {
        const sources = [
            {
                documentId: alasqlResult.documentId || "alasql-engine",
                source: alasqlResult.sourceName || "AlaSQL Database Engine",
                chunkIndex: 0,
                score: 1.0,
                text: alasqlResult.context ? alasqlResult.context.slice(0, 300) : "Verified AlaSQL query output."
            }
        ];

        await saveMessage(activeSessionId, "user", message.trim());
        await saveMessage(activeSessionId, "assistant", alasqlResult.directAnswer, sources);

        return {
            sessionId: activeSessionId,
            answer: alasqlResult.directAnswer,
            sources,
            documents: sources,
            usedDocuments: true,
            retrievedCount: sources.length
        };
    }

    // 5. Retrieve relevant document chunks using vector retrieval
    let documents = await searchContext(searchQuery, similarityThreshold, maxResults);
    if ((!documents || documents.length === 0) && searchQuery !== message.trim()) {
        documents = await searchContext(message.trim(), similarityThreshold, maxResults);
    }

    // If AlaSQL matched records for a specific table document, filter vector chunks to keep only relevant ones
    if (alasqlResult && alasqlResult.documentId && documents && documents.length > 0) {
        const docMatches = documents.filter(d => d.documentId === alasqlResult.documentId);
        if (docMatches.length > 0) {
            documents = docMatches;
        }
    }

    const usedDocuments = Boolean(alasqlResult || (documents && documents.length > 0));

    // 6. Build system prompt
    let systemPrompt;
    if (usedDocuments) {
        const contextBlocks = [];

        if (alasqlResult && alasqlResult.context) {
            contextBlocks.push(alasqlResult.context);
        }

        if (documents && documents.length > 0) {
            const vectorContext = documents
                .map(doc => `[Source: ${doc.source} (chunk ${doc.chunkIndex + 1})]:\n${doc.text}`)
                .join("\n\n---\n\n");
            contextBlocks.push(vectorContext);
        }

        const fullContext = contextBlocks.join("\n\n====================\n\n");

        systemPrompt = `You are an intelligent RAG AI assistant equipped with AlaSQL database querying and document retrieval.
Answer the user's question accurately and helpfully using the provided DOCUMENT CONTEXT.
Note: The context contains verified AlaSQL database records and structured tabular rows. Extract and present all matching fields, attributes, rows, and records related to the user's question.
If the requested information is genuinely not present in the context, inform the user clearly.
Never invent facts, names, or numbers that are not in the document context.

DOCUMENT CONTEXT:
${fullContext}
`;
    } else {
        systemPrompt = `You are a helpful and knowledgeable general AI assistant.
No relevant information was found in the uploaded knowledge base matching this question.
Answer general questions using your knowledge.
If the user asks about specific uploaded files or private documents, politely inform them that no matching document context was found.
`;
    }

    // 7. Format conversation history as LangChain BaseMessage objects (HumanMessage, AIMessage)
    const chatHistory = previousMessages.map(m => {
        if (m.role === "assistant" || m.role === "ai") {
            return new AIMessage(m.content);
        }
        return new HumanMessage(m.content);
    });

    // 8. Execute the LangChain LCEL chain
    const ragChain = createRagChain(model);
    const answer = await ragChain.invoke({
        system_prompt: systemPrompt,
        chat_history: chatHistory,
        question: message.trim()
    });

    // 9. Prepare clean sources array
    const sources = (documents || []).map(doc => ({
        documentId: doc.documentId,
        source: doc.source,
        chunkIndex: doc.chunkIndex,
        score: Math.round((doc.score || 0) * 100) / 100,
        text: doc.text
    }));

    // If AlaSQL provided verified query results, prepend as citation source
    if (alasqlResult) {
        sources.unshift({
            documentId: alasqlResult.documentId || "alasql-engine",
            source: alasqlResult.sourceName || "AlaSQL Query Engine (Verified Records)",
            chunkIndex: 0,
            score: 1.0,
            text: (alasqlResult.context || "").slice(0, 300) + ((alasqlResult.context || "").length > 300 ? "..." : "")
        });
    }

    // 10. Save both user message and assistant message to MongoDB
    await saveMessage(activeSessionId, "user", message.trim());
    await saveMessage(activeSessionId, "assistant", answer, sources);

    // 11. Return response
    return {
        sessionId: activeSessionId,
        answer,
        sources,
        documents: sources,
        usedDocuments,
        retrievedCount: sources.length
    };
}
