import fs from "node:fs";
import path from "node:path";
import { getDocumentCollection } from "../config/database.js";
import { createEmbedding } from "../config/ollama.js";
import { chunkText } from "./chunker.js";

const DOCUMENTS_DIR = path.resolve("documents");

export async function ingestDocumentContent(filename, content) {
    if (!content || !content.trim()) {
        throw new Error("Document content is empty");
    }

    const collection = await getDocumentCollection();
    const chunks = await chunkText(content);

    if (chunks.length === 0) {
        throw new Error("No text chunks could be generated");
    }

    for (let i = 0; i < chunks.length; i++) {
        const embedding = await createEmbedding(chunks[i]);

        await collection.updateOne(
            {
                source: filename,
                chunkIndex: i
            },
            {
                $set: {
                    source: filename,
                    chunkIndex: i,
                    text: chunks[i],
                    embedding,
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );
    
}
    
    await collection.deleteMany({
        source: filename,
        chunkIndex: { $gte: chunks.length }
    });

    return {
        filename,
        chunksCount: chunks.length
    };
}

export async function ingestAllDocuments() {
    if (!fs.existsSync(DOCUMENTS_DIR)) {
        fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
        return { processed: 0, files: [] };
    }

    const files = fs.readdirSync(DOCUMENTS_DIR)
        .filter(file => file.toLowerCase().endsWith(".txt") || file.toLowerCase().endsWith(".md"));
        
    const results = [];

    for (const file of files) {
        const filePath = path.join(DOCUMENTS_DIR, file);
        const content = fs.readFileSync(filePath, "utf8");

        if (!content.trim()) continue;

        const result = await ingestDocumentContent(file, content);
        results.push(result);
    }

    return {
        processed: results.length,
        files: results
    };
}

export async function listStoredDocuments() {
    const collection = await getDocumentCollection();

    const stats = await collection.aggregate([
        {
            $group: {
                _id: "$source",
                chunksCount: { $sum: 1 },
                lastUpdated: { $max: "$updatedAt" }
            }
        },
        {
            $project: {
                _id: 0,
                source: "$_id",
                chunksCount: 1,
                lastUpdated: 1
            }
        },
        { $sort: { source: 1 } }
    ]).toArray();

    return stats;
}

export async function deleteDocument(source) {
    const collection = await getDocumentCollection();
    const deleteResult = await collection.deleteMany({ source });

    
    const filePath = path.join(DOCUMENTS_DIR, source);
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (e) {
            console.warn(`Could not delete file ${filePath} from disk:`, e.message);
        }
    }

    return {
        deletedChunks: deleteResult.deletedCount,
        source
    };
}
