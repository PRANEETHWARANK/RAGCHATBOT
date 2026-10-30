import fs from "node:fs/promises";
import path from "node:path";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { parse as csvParse } from "csv-parse/sync";

/**
 * Extracts plain, readable text from the following formats:
 *   Plain text  : .txt .md .json
 *   CSV         : .csv  — parsed into aligned column rows
 *   Excel       : .xlsx .xls .xlsm  — all sheets, cell values joined
 *   LaTeX       : .tex  — LaTeX markup stripped, prose preserved
 *   PDF         : .pdf  — text layer extracted via pdf-parse
 *   Word        : .docx — extracted via mammoth
 *
 * @param {string} filePath - Absolute path to the file on disk
 * @returns {Promise<string>} Plain text ready for chunking
 */
export async function extractTextFromFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
        // ── Plain text formats ──────────────────────────────────────────
        case ".txt":
        case ".md":
        case ".json": {
            const content = await fs.readFile(filePath, "utf-8");
            return content.trim();
        }

        // ── CSV ─────────────────────────────────────────────────────────
        case ".csv": {
            return extractCsv(filePath);
        }

        // ── Excel (.xlsx / .xls / .xlsm) ────────────────────────────────
        case ".xlsx":
        case ".xls":
        case ".xlsm": {
            return extractExcel(filePath);
        }

        // ── LaTeX (.tex) ─────────────────────────────────────────────────
        case ".tex": {
            return extractLatex(filePath);
        }

        // ── PDF ──────────────────────────────────────────────────────────
        case ".pdf": {
            const dataBuffer = await fs.readFile(filePath);
            const pdfData = await pdfParse(dataBuffer);
            if (!pdfData?.text?.trim()) {
                throw new Error(
                    "PDF contains no extractable text (it may be scanned or image-only)."
                );
            }
            return pdfData.text.trim();
        }

        // ── DOCX ─────────────────────────────────────────────────────────
        case ".docx": {
            const dataBuffer = await fs.readFile(filePath);
            const docxData = await mammoth.extractRawText({ buffer: dataBuffer });
            if (!docxData?.value?.trim()) {
                throw new Error("DOCX contains no extractable text.");
            }
            return docxData.value.trim();
        }

        default:
            throw new Error(
                `Unsupported file format: "${ext}". ` +
                `Supported formats: .txt, .md, .json, .csv, .xlsx, .xls, .xlsm, .tex, .pdf, .docx`
            );
    }
}

// ─── CSV extractor ────────────────────────────────────────────────────────────
async function extractCsv(filePath) {
    const raw = await fs.readFile(filePath, "utf-8");

    let records;
    try {
        records = csvParse(raw, {
            skip_empty_lines: true,
            relax_quotes: true,
            relax_column_count: true,
            trim: true
        });
    } catch {
        
        return raw.trim();
    }

    if (!records || records.length === 0) {
        throw new Error("CSV file is empty or could not be parsed.");
    }

    
    const headers = records[0];
    const dataRows = records.slice(1);

    
    const lines = dataRows.map((row) =>
        headers
            .map((h, i) => `${h}: ${row[i] ?? ""}`)
            .join(" | ")
    );

    return `[CSV: ${path.basename(filePath)}]\nColumns: ${headers.join(", ")}\n\n` +
        lines.join("\n");
}


async function extractExcel(filePath) {
    const dataBuffer = await fs.readFile(filePath);
    const workbook = XLSX.read(dataBuffer, { type: "buffer", cellText: true, cellDates: true });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("Excel file contains no sheets.");
    }

    const sections = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        // Convert to array of arrays
        const rows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: "",
            raw: false    
        });

        if (!rows || rows.length === 0) return null;

        // Remove completely empty rows
        const nonEmpty = rows.filter((r) => r.some((c) => String(c).trim() !== ""));
        if (nonEmpty.length === 0) return null;

        // Use first non-empty row as header
        const headers = nonEmpty[0].map(String);
        const dataRows = nonEmpty.slice(1);

        const lines = dataRows.map((row) =>
            headers
                .map((h, i) => `${h}: ${String(row[i] ?? "")}`)
                .join(" | ")
        );

        return `[Sheet: ${sheetName}]\nColumns: ${headers.join(", ")}\n\n` +
            lines.join("\n");
    });

    const combined = sections.filter(Boolean).join("\n\n---\n\n");
    if (!combined.trim()) {
        throw new Error("Excel file contains no readable data.");
    }

    return combined.trim();
}

// ─── LaTeX extractor ─────────────────────────────────────────────────────────
async function extractLatex(filePath) {
    const raw = await fs.readFile(filePath, "utf-8");

    let text = raw;

    // 1. Remove LaTeX comments (lines starting with %)
    text = text.replace(/^%.*$/gm, "");

    // 2. Remove preamble (\documentclass … \begin{document})
    text = text.replace(/\\documentclass[\s\S]*?\\begin\{document\}/i, "");

    // 3. Remove \end{document} and everything after
    text = text.replace(/\\end\{document\}[\s\S]*/i, "");

    // 4. Extract text from common content commands — keep their argument
    //    e.g. \textbf{word} → word, \emph{word} → word
    const keepArgCommands = [
        "textbf", "textit", "emph", "underline", "textrm", "texttt",
        "textsc", "textsl", "text", "title", "author", "section",
        "subsection", "subsubsection", "paragraph", "caption", "label",
        "footnote", "chapter", "part"
    ];
    for (const cmd of keepArgCommands) {
        text = text.replace(
            new RegExp(`\\\\${cmd}\\{([^}]*)\\}`, "g"),
            (_, arg) => arg
        );
    }

    // 5. Replace \\ (line break) with newline
    text = text.replace(/\\\\/g, "\n");

    // 6. Replace \newline, \par, \medskip, \bigskip, \vspace{...} with newlines
    text = text.replace(/\\(newline|par|medskip|bigskip|smallskip)/g, "\n");
    text = text.replace(/\\vspace\{[^}]*\}/g, "\n");
    text = text.replace(/\\hspace\{[^}]*\}/g, " ");

    // 7. Remove \begin{...} and \end{...} tags but keep content
    text = text.replace(/\\(begin|end)\{[^}]*\}/g, "");

    // 8. Remove remaining LaTeX commands with optional arguments
    //    e.g. \usepackage[utf8]{inputenc}, \includegraphics[width=...]{fig}
    text = text.replace(/\\[a-zA-Z]+(\[[^\]]*\])?(\{[^}]*\})?/g, " ");

    // 9. Remove math delimiters and inline math: $...$ and $$...$$
    text = text.replace(/\$\$[\s\S]*?\$\$/g, "[math]");
    text = text.replace(/\$[^$\n]*?\$/g, "[math]");

    // 10. Remove remaining curly braces
    text = text.replace(/[{}]/g, "");

    // 11. Collapse excessive whitespace
    text = text
        .replace(/[ \t]+/g, " ")           // collapse spaces/tabs
        .replace(/\n{3,}/g, "\n\n")        // max two consecutive newlines
        .trim();

    if (!text) {
        throw new Error("LaTeX file contains no extractable text after stripping markup.");
    }

    return text;
}
