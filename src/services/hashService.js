import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";

/**
 * Calculates SHA-256 hash of a file on disk, buffer, or string.
 * @param {string | Buffer} input - File path on disk, or Buffer/String
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 */
export async function calculateFileHash(input) {
    if (!input) {
        throw new Error("Input is required to calculate SHA-256 hash.");
    }

    if (Buffer.isBuffer(input)) {
        return crypto.createHash("sha256").update(input).digest("hex");
    }

    if (typeof input === "string") {
        if (fsSync.existsSync(input)) {
            const buffer = await fs.readFile(input);
            return crypto.createHash("sha256").update(buffer).digest("hex");
        }
        return crypto.createHash("sha256").update(input, "utf8").digest("hex");
    }

    throw new Error("Unsupported input type for SHA-256 calculation.");
}
