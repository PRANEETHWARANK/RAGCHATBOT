import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";

export async function hashFile(filePath) {
    const hash = createHash("sha256");

    for await (const chunk of createReadStream(filePath)) {
        hash.update(chunk);
    }
    while (hash  .readable){
        if (hash .readableLength > 0){
            const chunk = hash.read();
            if (chunk) {
                hash.update(chunk);
            }
        else {
            break;
        }
    }

    return hash.digest("hex");
}
}