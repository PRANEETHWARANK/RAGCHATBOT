import { BaseRetriever } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import { getChunksCollection, getDocumentsCollection, connectDB } from "../config/database.js";
import { createEmbedding } from "../config/ollama.js";

const DEFAULT_SIMILARITY_THRESHOLD = Number(
    process.env.SIMILARITY_THRESHOLD || 0.35
);

const DEFAULT_MAX_RESULTS = Number(
    process.env.MAX_RETRIEVED_CHUNKS || 4
);

export function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) {
        return 0;
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        magnitudeA += a[i] * a[i];
        magnitudeB += b[i] * b[i];
    }

    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;
    }

    return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

/**
 * Retrieves the most relevant document chunks for a question.
 * @param {string} question - Search query
 * @param {number} similarityThreshold - Minimum cosine similarity (0 to 1)
 * @param {number} maxResults - Max number of top chunks
 * @returns {Promise<Array>} - List of ranked chunks
 */
export async function retrieveDocuments(
    question,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
    maxResults = DEFAULT_MAX_RESULTS
) {
    const chunksColl = await getChunksCollection();
    const docsColl = await getDocumentsCollection();

    // 1. Generate an embedding for the user's question via Ollama / LangChain
    const queryEmbedding = await createEmbedding(question);

    // 2. Fetch list of currently indexed documents from documents_metadata
    const indexedMetadata = await docsColl.find(
        { status: "indexed" },
        { projection: { _id: 0, documentId: 1, version: 1, originalName: 1 } }
    ).toArray();

    let documents = [];

    if (indexedMetadata.length > 0) {
        // Map documentId -> active version number
        const activeVersionMap = new Map(
            indexedMetadata.map(doc => [doc.documentId, doc.version || 1])
        );

        const activeDocIds = Array.from(activeVersionMap.keys());

        // Fetch all stored chunks for active indexed documents
        const allChunks = await chunksColl.find(
            {
                documentId: { $in: activeDocIds },
                embedding: { $exists: true }
            },
            {
                projection: {
                    _id: 0,
                    documentId: 1,
                    text: 1,
                    source: 1,
                    chunkIndex: 1,
                    embedding: 1,
                    version: 1
                }
            }
        ).toArray();

        // Keep chunks belonging to the active version
        documents = allChunks.filter(chunk => {
            const activeVer = activeVersionMap.get(chunk.documentId);
            return chunk.version === undefined || chunk.version === activeVer;
        });
    }

    // 3. Fallback to legacy 'documents' collection ONLY IF there are no modern documents at all
    if (documents.length === 0 && indexedMetadata.length === 0) {
        const db = await connectDB();
        const legacyColl = db.collection("documents");
        documents = await legacyColl.find(
            { embedding: { $exists: true } },
            {
                projection: {
                    _id: 0,
                    documentId: 1,
                    text: 1,
                    source: 1,
                    chunkIndex: 1,
                    embedding: 1
                }
            }
        ).toArray();
    }

    if (documents.length === 0) {
        return [];
    }

    // 4. Calculate cosine similarity locally with keyword enhancement for tabular/CSV data
    const lowerQuery = question.toLowerCase();
    const queryTokens = lowerQuery
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 2);

    const rankedDocuments = documents.map(doc => {
        let score = cosineSimilarity(queryEmbedding, doc.embedding);

        // Hybrid boost: if query keywords (like names, IDs, numbers) appear in chunk text
        if (queryTokens.length > 0) {
            const lowerChunk = (doc.text || "").toLowerCase();
            const matchedTokens = queryTokens.filter(t => lowerChunk.includes(t));
            if (matchedTokens.length > 0) {
                const matchRatio = matchedTokens.length / queryTokens.length;
                score = Math.min(1.0, score + matchRatio * 0.15);
            }
        }

        return {
            documentId: doc.documentId || "legacy",
            text: doc.text,
            source: doc.source || "unknown",
            chunkIndex: doc.chunkIndex,
            score
        };
    });

    // 5. Sort from most relevant to least relevant
    rankedDocuments.sort((a, b) => b.score - a.score);

    const threshold = Number(similarityThreshold) !== undefined && !isNaN(Number(similarityThreshold))
        ? Number(similarityThreshold)
        : DEFAULT_SIMILARITY_THRESHOLD;

    const limit = Number(maxResults) || DEFAULT_MAX_RESULTS;

    // 6. Filter by threshold and take top K
    let filtered = rankedDocuments
        .filter(doc => doc.score >= threshold)
        .slice(0, limit);

    if (filtered.length > 1 && filtered[0].score >= 0.55) {
        const topScore = filtered[0].score;
        filtered = filtered.filter(doc => {
            return (topScore - doc.score <= 0.22) || doc.score >= 0.50;
        });
    }

    if (filtered.length === 0 && rankedDocuments.length > 0 && rankedDocuments[0].score >= 0.25) {
        console.log(`[RETRIEVER] Threshold ${threshold} filtered out all chunks. Falling back to top ${limit} chunks (best score: ${rankedDocuments[0].score.toFixed(4)}).`);
        return rankedDocuments.slice(0, limit);
    }

    return filtered;
}

/**
 * LangChain BaseRetriever implementation that bridges our MongoDB vector knowledge base
 * with standard LangChain LCEL chains and agents.
 */
export class MongoVectorRetriever extends BaseRetriever {
    lc_namespace = ["langchain", "retrievers", "mongodb_vector"];

    constructor(options = {}) {
        super(options);
        this.similarityThreshold = options.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
        this.maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
    }

    async _getRelevantDocuments(query) {
        const results = await retrieveDocuments(query, this.similarityThreshold, this.maxResults);
        return results.map(r => new Document({
            pageContent: r.text,
            metadata: {
                documentId: r.documentId,
                source: r.source,
                chunkIndex: r.chunkIndex,
                score: r.score
            }
        }));
    }
}

/**
 * Convenience factory to create a LangChain retriever.
 */
export function createLangChainRetriever(similarityThreshold, maxResults) {
    return new MongoVectorRetriever({ similarityThreshold, maxResults });
}
