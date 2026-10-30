import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import {
    getDocumentsCollection,
    getChunksCollection
} from "../config/database.js";

import { createEmbedding } from "../config/ollama.js";
import { extractTextFromFile } from "../rag/documentLoader.js";
import { chunkText } from "../rag/chunker.js";
import { hashFile } from "./hash.js";

import alasql from "alasql";
function activeVersionFilter(document) {
    if (document.activeVersion === undefined) {
        return { version: { $exists: false } };
    }

    return {
        version: document.activeVersion,
        ...(document.activeVersionToken ? { versionToken: document.activeVersionToken } : {})
    };
}

function getDocumentResult(document, details = {}) {
    return {
        documentId: document.documentId,
        originalName: document.originalName,
        status: document.status,
        indexingStatus: document.indexingStatus || document.status,
        fileHash: document.fileHash,
        version: document.activeVersion ?? document.version,
        chunksCount: document.chunksCount || 0,
        size: document.size,
        ...details
    };
    
}

async function findIndexedDuplicate(docsColl, fileHash, documentId) {
    const filter = {
        fileHash,
        status: "indexed",
        $or: [
            { activeVersion: { $exists: false } },
            { activeVersion: { $ne: null } }
        ]
    };
    if (documentId) {
        filter.documentId = { $ne: documentId };
    }
    return docsColl.findOne(filter);
}


export async function processFile(file, { document: knownDocument, throwOnFailure = false } = {}) {
    const fileHash = await hashFile(file.path);
    const docsColl = await getDocumentsCollection();
    const chunksColl = await getChunksCollection();
    const existing = knownDocument || await docsColl.findOne({ originalName: file.originalname });

    if (existing?.fileHash === fileHash && existing.status === "indexed") {
        console.log(`Duplicate detection: ${file.originalname} is already indexed; skipped ingestion.`);
        return getDocumentResult(existing, { skipped: true, reason: "unchanged-content" });
    }

    const duplicate = await findIndexedDuplicate(docsColl, fileHash, existing?.documentId);
    if (duplicate) {
        console.log(`Duplicate detection: ${file.originalname} matches indexed document ${duplicate.documentId}.`);
        console.log(`Skipped ingestion for ${file.originalname}; reusing its indexed chunks.`);
    }

    const documentId = existing?.documentId || crypto.randomUUID();
    const activeVersion = existing?.activeVersion
        ?? (existing?.status === "indexed" ? existing?.version : 0);
    const version = Number(activeVersion || 0) + 1;
    const pendingToken = crypto.randomUUID();
    const now = new Date();
    const ext = path.extname(file.originalname).toLowerCase();

    if (existing) {
        const reservationFilter = { documentId };
        reservationFilter.activeVersion = existing.activeVersion === undefined
            ? { $exists: false }
            : existing.activeVersion;

        const reservation = await docsColl.updateOne(
            {
                ...reservationFilter,
                $or: [
                    { indexingStatus: { $ne: "processing" } },
                    { pendingToken: { $exists: false } }
                ]
            },
            {
                $set: {
                    indexingStatus: "processing",
                    pendingVersion: version,
                    pendingFileHash: fileHash,
                    pendingToken,
                    updatedAt: now
                }
            }
        );

        if (reservation.matchedCount !== 1) {
            throw new Error(`Document ${documentId} is already being processed.`);
        }

        if (existing.status === "indexed" && existing.fileHash !== fileHash) {
            console.log(`Changed document detected: ${file.originalname} will be indexed as version ${version}.`);
        }
    } else {
        await docsColl.insertOne({
            documentId,
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            extension: ext,
            size: file.size,
            fileHash,
            version,
            activeVersion: null,
            activeVersionToken: null,
            status: "processing",
            indexingStatus: "processing",
            chunksCount: 0,
            pendingVersion: version,
            pendingFileHash: fileHash,
            pendingToken,
            createdAt: now,
            updatedAt: now
        });
    }

    let activated = false;
    try {
        let chunkDocs;

        if (duplicate) {
            const sourceChunks = await chunksColl.find({
                documentId: duplicate.documentId,
                ...activeVersionFilter(duplicate)
            }).toArray();
            if (sourceChunks.length === 0) {
                throw new Error(`Indexed duplicate ${duplicate.documentId} has no reusable chunks.`);
            }

            chunkDocs = sourceChunks.map(chunk => ({
                documentId,
                version,
                versionToken: pendingToken,
                source: file.originalname,
                chunkIndex: chunk.chunkIndex,
                text: chunk.text,
                embedding: chunk.embedding,
                createdAt: now
            }));
        } else {
            const text = await extractTextFromFile(file.path);
            if (!text || text.length === 0) {
                throw new Error("File contains no readable text.");
            }

            const chunks = await chunkText(text);
            if (chunks.length === 0) {
                throw new Error("No valid text chunks could be generated.");
            }

            chunkDocs = [];
            for (let i = 0; i < chunks.length; i++) {
                const embedding = await createEmbedding(chunks[i]);
                chunkDocs.push({
                    documentId,
                    version,
                    versionToken: pendingToken,
                    source: file.originalname,
                    chunkIndex: i,
                    text: chunks[i],
                    embedding,
                    createdAt: now
                });
            }
        }

        await chunksColl.insertMany(chunkDocs);

        const verifiedCount = await chunksColl.countDocuments({
            documentId,
            version,
            versionToken: pendingToken,
            embedding: { $exists: true }
        });
        if (verifiedCount !== chunkDocs.length) {
            throw new Error(`Chunk verification failed: expected ${chunkDocs.length}, found ${verifiedCount}.`);
        }

        const activationFilter = { documentId, pendingToken };
        activationFilter.activeVersion = existing?.activeVersion === undefined
            ? (existing ? { $exists: false } : null)
            : existing.activeVersion;

        const activation = await docsColl.updateOne(
            activationFilter,
            {
                $set: {
                    fileHash,
                    version,
                    activeVersion: version,
                    activeVersionToken: pendingToken,
                    status: "indexed",
                    indexingStatus: "indexed",
                    chunksCount: chunkDocs.length,
                    filename: file.filename,
                    originalName: file.originalname,
                    mimeType: file.mimetype,
                    extension: ext,
                    size: file.size,
                    error: null,
                    updatedAt: new Date()
                },
                $unset: {
                    pendingVersion: "",
                    pendingFileHash: "",
                    pendingToken: ""
                }
            }
        );

        if (activation.matchedCount !== 1) {
            throw new Error(`Could not activate version ${version} for document ${documentId}.`);
        }
        activated = true;

        if (existing) {
            try {
                await chunksColl.deleteMany({ documentId, versionToken: { $ne: pendingToken } });
            } catch (cleanupError) {
                console.error(`Version ${version} is active, but old chunks for ${documentId} could not be removed:`, cleanupError.message);
            }
        }
        if (existing?.status === "indexed") {
            console.log(`Successful version replacement: ${documentId} is now active at version ${version}.`);
        } else {
            console.log(`Successfully indexed ${file.originalname} as version ${version} (${chunkDocs.length} chunks).`);
        }

        return getDocumentResult({
            documentId,
            originalName: file.originalname,
            status: "indexed",
            indexingStatus: "indexed",
            fileHash,
            activeVersion: version,
            version,
            chunksCount: chunkDocs.length,
            size: file.size
        }, duplicate ? { skipped: true, duplicateOf: duplicate.documentId } : {});
    } catch (err) {
        if (activated) {
            throw err;
        }

        console.error(`Error processing document ${file.originalname}:`, err.message);
        try {
            await chunksColl.deleteMany({ documentId, versionToken: pendingToken });
        } catch (cleanupError) {
            console.error(`Could not remove failed staging chunks for ${documentId} version ${version}:`, cleanupError.message);
        }

        if (existing) {
            await docsColl.updateOne(
                { documentId, pendingToken },
                {
                    $set: { indexingStatus: "failed", error: err.message, updatedAt: new Date() },
                    $unset: { pendingVersion: "", pendingFileHash: "", pendingToken: "" }
                }
            );
        } else {
            await docsColl.updateOne(
                { documentId, pendingToken },
                {
                    $set: { status: "failed", indexingStatus: "failed", error: err.message, updatedAt: new Date() },
                    $unset: { pendingVersion: "", pendingFileHash: "", pendingToken: "" }
                }
            );
        }

        if (throwOnFailure) {
            throw err;
        }

        return getDocumentResult({
            documentId,
            originalName: file.originalname,
            status: existing?.status || "failed",
            indexingStatus: "failed",
            fileHash: existing?.fileHash || fileHash,
            activeVersion: existing?.activeVersion,
            version: existing?.version,
            chunksCount: existing?.chunksCount || 0,
            size: file.size
        }, { error: err.message });
    }
}


export async function processMultipleFiles(files) {
    if (!files || files.length === 0) {
        throw new Error("No files uploaded.");
    }

    const results = [];
    for (const file of files) {
        const res = await processFile(file);
        results.push(res);
    }

    return results;
}


export async function listAllDocuments() {
    const docsColl = await getDocumentsCollection();
    return docsColl.find().sort({ createdAt: -1 }).toArray();
}


export async function getDocumentById(documentId) {
    const docsColl = await getDocumentsCollection();
    return docsColl.findOne({ documentId });
}


export async function reprocessDocument(documentId) {
    const docsColl = await getDocumentsCollection();

    const doc = await docsColl.findOne({ documentId });
    if (!doc) {
        throw new Error("Document not found.");
    }

    const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");
    const filePath = path.join(UPLOAD_DIR, doc.filename);

    if (!fsSync.existsSync(filePath)) {
        throw new Error("Original file not found on disk.");
    }

    return processFile({
        path: filePath,
        filename: doc.filename,
        originalname: doc.originalName,
        mimetype: doc.mimeType,
        size: doc.size
    }, { document: doc, throwOnFailure: true });
}


export async function deleteDocument(documentId) {
    const docsColl = await getDocumentsCollection();
    const chunksColl = await getChunksCollection();

    const doc = await docsColl.findOne({ documentId });
    if (!doc) {
        return { message: "Document not found", documentId, deletedChunks: 0 };
    }

    
    const chunksRes = await chunksColl.deleteMany({ documentId });

    
    await docsColl.deleteOne({ documentId });

    
    const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");
    const filePath = path.join(UPLOAD_DIR, doc.filename);
    if (fsSync.existsSync(filePath)) {
        try {
            await fs.unlink(filePath);
        } catch (e) {
            console.warn(`Could not unlink ${filePath}:`, e.message);
        }
    }

    return {
        message: "Document deleted successfully",
        documentId,
        deletedChunks: chunksRes.deletedCount
    };

}

