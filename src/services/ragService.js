import { retrieveDocuments, MongoVectorRetriever, createLangChainRetriever } from "../rag/retriever.js";

/**
 * Search context for a given query with similarity threshold and max results.
 */
export async function searchContext(query, similarityThreshold, maxResults) {
    return retrieveDocuments(query, similarityThreshold, maxResults);
}

/**
 * Returns a LangChain retriever instance for LCEL chains.
 */
export function getRetriever(similarityThreshold, maxResults) {
    return createLangChainRetriever(similarityThreshold, maxResults);
}

export { MongoVectorRetriever };
