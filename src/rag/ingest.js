import { connectDB, closeDB } from "../config/database.js";
import { ingestAllDocuments } from "./ingestService.js";

async function run() {
    try {
        console.log("Starting document ingestion from documents/ folder...");
        await connectDB();
        const result = await ingestAllDocuments();
        console.log(`\nDocument ingestion complete!`);
        console.log(`Processed ${result.processed} file(s):`);
        for (const file of result.files) {
            console.log(` - ${file.filename} (${file.chunksCount} chunks stored in MongoDB)`);
        }
    } catch (error) {
        console.error("Ingestion failed:", error.message);
        process.exitCode = 1;
    } finally {
        await closeDB();
    }
}

run();
