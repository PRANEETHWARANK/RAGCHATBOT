import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const DEFAULT_CHUNK_SIZE = Number(process.env.CHUNK_SIZE || 1000);
const DEFAULT_CHUNK_OVERLAP = Number(process.env.CHUNK_OVERLAP || 200);

/**
 * Creates and returns a LangChain RecursiveCharacterTextSplitter instance.
 */
export function getLangChainSplitter(chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP) {
    return new RecursiveCharacterTextSplitter({
        chunkSize: Number(chunkSize) || DEFAULT_CHUNK_SIZE,
        chunkOverlap: Number(overlap) || DEFAULT_CHUNK_OVERLAP,
        separators: ["\n\n", "\n", ". ", " ", ""]
    });
}

/**
 * Splits prose text (TXT, PDF, DOCX, MD, TEX) using LangChain's RecursiveCharacterTextSplitter.
 * Returns an array of chunk string texts.
 */
export async function chunkText(text, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP) {
    if (!text || !text.trim()) {
        return [];
    }

    const cleanText = text.replace(/\r\n/g, "\n").trim();
    const splitter = getLangChainSplitter(chunkSize, overlap);
    return await splitter.splitText(cleanText);
}

/**
 * Splits text into LangChain Document objects with attached metadata.
 */
export async function createDocumentChunks(text, metadata = {}, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP) {
    if (!text || !text.trim()) {
        return [];
    }

    const cleanText = text.replace(/\r\n/g, "\n").trim();
    const splitter = getLangChainSplitter(chunkSize, overlap);
    return await splitter.createDocuments([cleanText], [metadata]);
}
