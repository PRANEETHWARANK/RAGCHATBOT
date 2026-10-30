import alasql from "alasql";
import * as XLSX from "xlsx";
import { parse as csvParse } from "csv-parse/sync";
import fs from "node:fs/promises";
import path from "node:path";
import { getTablesCollection } from "../config/database.js";

/**
 * Normalizes a column header: removes newlines, tabs, and trims whitespace.
 */
function normalizeHeader(header) {
    if (!header) return "";
    return String(header)
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Normalizes a cell value: trims strings, converts clean numeric strings to numbers.
 */
function normalizeValue(val) {
    if (val === undefined || val === null) return "";
    if (typeof val === "string") {
        const trimmed = val.replace(/[\r\n\t]+/g, " ").trim();
        // Check if it's a clean numeric string (excluding phone numbers or roll numbers that start with letters or have leading zeroes)
        if (/^-?\d+(\.\d+)?$/.test(trimmed) && trimmed.length <= 10 && !trimmed.startsWith("0")) {
            const num = Number(trimmed);
            if (!isNaN(num)) return num;
        }
        return trimmed;
    }
    return val;
}

/**
 * Parses a CSV or Excel file into structured sheets with normalized columns and rows.
 */
export async function parseTabularFile(filePath, originalName) {
    const ext = path.extname(filePath).toLowerCase();
    const isCsv = ext === ".csv";
    const isExcel = [".xlsx", ".xls", ".xlsm"].includes(ext);

    if (!isCsv && !isExcel) {
        return null; // Not a tabular file
    }

    if (isCsv) {
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
            return null;
        }

        if (!records || records.length === 0) return null;

        const rawHeaders = records[0].map(normalizeHeader);
        const dataRows = records.slice(1);

        const rows = dataRows.map((r, rowIdx) => {
            const obj = { __rowNum: rowIdx + 1 };
            rawHeaders.forEach((col, cIdx) => {
                if (col) {
                    obj[col] = normalizeValue(r[cIdx]);
                }
            });
            return obj;
        });

        return [
            {
                sheetName: "Sheet1",
                columns: rawHeaders.filter(Boolean),
                rows,
                rowCount: rows.length
            }
        ];
    }

    if (isExcel) {
        const dataBuffer = await fs.readFile(filePath);
        const workbook = XLSX.read(dataBuffer, { type: "buffer", cellDates: true });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            return null;
        }

        const sheets = [];

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const rawRows = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                defval: "",
                raw: false
            });

            if (!rawRows || rawRows.length === 0) continue;

            // Find first non-empty row as header
            const headerRowIdx = rawRows.findIndex(r => r.some(c => String(c).trim() !== ""));
            if (headerRowIdx === -1) continue;

            const rawHeaders = rawRows[headerRowIdx].map(normalizeHeader);
            const dataRows = rawRows.slice(headerRowIdx + 1);

            const rows = dataRows
                .filter(r => r.some(c => String(c).trim() !== ""))
                .map((r, rowIdx) => {
                    const obj = { __rowNum: rowIdx + 1 };
                    rawHeaders.forEach((col, cIdx) => {
                        if (col) {
                            obj[col] = normalizeValue(r[cIdx]);
                        }
                    });
                    return obj;
                });

            sheets.push({
                sheetName,
                columns: rawHeaders.filter(Boolean),
                rows,
                rowCount: rows.length
            });
        }

        return sheets.length > 0 ? sheets : null;
    }

    return null;
}

/**
 * Converts structured table rows into clean, semantic row-aware chunks.
 * Every chunk contains the complete table schema and complete, intact rows.
 */
export function chunkTableRows(sheets, originalName, rowsPerChunk = 10, overlapRows = 2) {
    const chunks = [];

    for (const sheet of sheets) {
        const { sheetName, columns, rows } = sheet;
        if (!rows || rows.length === 0) continue;

        const headerLine = `[Document: ${originalName} | Sheet: ${sheetName}]\nColumns: ${columns.join(", ")}`;

        // Step by (rowsPerChunk - overlapRows)
        const step = Math.max(1, rowsPerChunk - overlapRows);

        for (let i = 0; i < rows.length; i += step) {
            const slice = rows.slice(i, i + rowsPerChunk);

            const rowLines = slice.map(row => {
                const parts = columns
                    .filter(col => row[col] !== undefined && row[col] !== "")
                    .map(col => `${col}: ${row[col]}`);
                return parts.join(" | ");
            });

            const chunkText = `${headerLine}\n\n` + rowLines.join("\n");
            chunks.push(chunkText);

            if (i + rowsPerChunk >= rows.length) {
                break;
            }
        }
    }

    return chunks;
}

/**
 * Saves parsed table sheets to MongoDB document_tables collection.
 */
export async function saveTableData(documentId, version, originalName, sheets) {
    const tablesColl = await getTablesCollection();

    // Remove any previous versions for this document
    await tablesColl.deleteMany({ documentId });

    for (const sheet of sheets) {
        await tablesColl.insertOne({
            documentId,
            version: version || 1,
            tableName: originalName,
            sheetName: sheet.sheetName,
            columns: sheet.columns,
            rows: sheet.rows,
            rowCount: sheet.rowCount,
            createdAt: new Date()
        });
    }

    console.log(`[ALASQL] Stored ${sheets.length} structured table sheet(s) for "${originalName}" (${documentId}).`);
}

/**
 * Deletes table data for a document.
 */
export async function deleteTableData(documentId) {
    const tablesColl = await getTablesCollection();
    await tablesColl.deleteMany({ documentId });
}

function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Automatically wraps column and table names in brackets if not already bracketed.
 * e.g. SELECT Student Name, CGPA (up to 4th Sem) FROM Sheet1
 *   -> SELECT [Student Name], [CGPA (up to 4th Sem)] FROM [Sheet1]
 */
function autoBracketSql(rawSql, columns, sheetName, tableName) {
    let sql = rawSql.trim();

    // 1. Bracket sheet / table names after FROM / JOIN
    const sheetRegex = new RegExp(`\\b(FROM|JOIN)\\s+(${escapeRegex(sheetName)})\\b`, "gi");
    sql = sql.replace(sheetRegex, "$1 [$2]");

    if (tableName) {
        const cleanTable = tableName.replace(/\.[^/.]+$/, "");
        const tableRegex = new RegExp(`\\b(FROM|JOIN)\\s+["']?(${escapeRegex(tableName)}|${escapeRegex(cleanTable)})["']?\\b`, "gi");
        sql = sql.replace(tableRegex, `$1 [${sheetName}]`);
    }

    // 2. Bracket column names (sort longest first to prevent sub-string collision)
    const sortedCols = [...columns].sort((a, b) => b.length - a.length);
    for (const col of sortedCols) {
        const colRegex = new RegExp(`(?<!\\[)${escapeRegex(col)}(?!\\])`, "g");
        sql = sql.replace(colRegex, `[${col}]`);
    }

    return sql;
}

/**
 * Formats an array of row objects into a GitHub Flavored Markdown (GFM) table.
 */
function formatMarkdownTable(rows, columns) {
    if (!rows || rows.length === 0) return "No records found.";
    const displayCols = columns || Object.keys(rows[0]).filter(k => k !== "__rowNum");

    const header = `| ${displayCols.join(" | ")} |`;
    const divider = `| ${displayCols.map(() => "---").join(" | ")} |`;
    const body = rows.map(r => {
        return `| ${displayCols.map(c => {
            const val = r[c];
            if (val === undefined || val === null || val === "") return "-";
            return String(val).replace(/\|/g, "\\|");
        }).join(" | ")} |`;
    }).join("\n");

    return `${header}\n${divider}\n${body}`;
}

/**
 * Executes an AlaSQL query across loaded document tables.
 * Supports:
 * 1. Direct SQL queries (SELECT ... FROM ...)
 * 2. Natural language record extraction (extract all students, list students with name and cgpa)
 * 3. Aggregations (how many students, highest CGPA, average CGPA)
 * 4. Entity & keyword search (Who is Abhijith Pillai?)
 */
export async function queryTableWithAlaSql(userQuery, activeDocumentIds) {
    if (!userQuery || !userQuery.trim()) return null;

    try {
        const tablesColl = await getTablesCollection();

        const queryFilter = activeDocumentIds && activeDocumentIds.length > 0
            ? { documentId: { $in: activeDocumentIds } }
            : {};

        const tables = await tablesColl.find(queryFilter).toArray();
        if (!tables || tables.length === 0) return null;

        const cleanQuery = userQuery.trim();
        const queryLower = cleanQuery.toLowerCase();

        for (const table of tables) {
            const { tableName, sheetName, columns, rows, documentId } = table;
            if (!rows || rows.length === 0) continue;

            // Register tables into AlaSQL memory
            alasql(`CREATE TABLE IF NOT EXISTS [${sheetName}]`);
            alasql.tables[sheetName] = { data: rows };
            alasql.tables["data"] = { data: rows };
            alasql.tables["records"] = { data: rows };
            alasql.tables["students"] = { data: rows };
            alasql.tables["Sheet1"] = { data: rows };

            // ==============================================================
            // CASE 1: Direct SQL Query (e.g. SELECT ... FROM ...)
            // ==============================================================
            const isDirectSql = /^\s*(SELECT|WITH)\b/i.test(cleanQuery) ||
                (/\bSELECT\b[\s\S]+\bFROM\b/i.test(cleanQuery));

            if (isDirectSql) {
                try {
                    const bracketedSql = autoBracketSql(cleanQuery, columns, sheetName, tableName);
                    console.log(`[ALASQL] Executing Direct SQL: ${bracketedSql}`);
                    let sqlResult = alasql(bracketedSql);

                    if (sqlResult && Array.isArray(sqlResult)) {
                        const count = sqlResult.length;
                        const resultCols = sqlResult.length > 0
                            ? Object.keys(sqlResult[0]).filter(k => k !== "__rowNum")
                            : columns;

                        const mdTable = formatMarkdownTable(sqlResult, resultCols);
                        const answer = `### Database Query Results (${tableName})\n\nFound **${count}** matching record(s):\n\n${mdTable}`;

                        return {
                            isDirectResult: true,
                            directAnswer: answer,
                            context: `[AlaSQL Direct SQL Execution from ${tableName} (${sheetName})]:\n${mdTable}`,
                            sourceName: tableName,
                            documentId,
                            rowCount: count,
                            matchedRows: sqlResult
                        };
                    }
                } catch (sqlErr) {
                    console.warn("[ALASQL] Direct SQL failed, attempting fallback:", sqlErr.message);
                }
            }

            // ==============================================================
            // CASE 2: Natural Language Table Extraction / Listing Query
            // e.g. "extract all the students with the name and cgpa"
            //      "list all students in section C"
            // ==============================================================
            const isExtractionQuery = /\b(extract|list|show all|get all|display all|fetch all|all students|all the students|all records|all rows)\b/i.test(queryLower) ||
                (/\b(students|records)\b.*\b(with|having|whose|in|where)\b/i.test(queryLower) && /\b(name|cgpa|roll|section)\b/i.test(queryLower));

            if (isExtractionQuery) {
                // Determine which columns the user requested
                const targetCols = [];
                if (/\b(sl|no|serial|index|sno)\b/i.test(queryLower) || columns.some(c => /sl\.?no/i.test(c))) {
                    const snoCol = columns.find(c => /sl\.?no/i.test(c));
                    if (snoCol) targetCols.push(snoCol);
                }

                // Name
                if (/\b(name|student)\b/i.test(queryLower)) {
                    const nameCol = columns.find(c => /name/i.test(c));
                    if (nameCol && !targetCols.includes(nameCol)) targetCols.push(nameCol);
                }

                // Roll Number
                if (/\b(roll|reg|id|registration)\b/i.test(queryLower)) {
                    const rollCol = columns.find(c => /roll|id/i.test(c));
                    if (rollCol && !targetCols.includes(rollCol)) targetCols.push(rollCol);
                }

                // Department
                if (/\b(dept|department|branch)\b/i.test(queryLower)) {
                    const deptCol = columns.find(c => /dept|department/i.test(c));
                    if (deptCol && !targetCols.includes(deptCol)) targetCols.push(deptCol);
                }

                // Section
                if (/\b(sec|section)\b/i.test(queryLower)) {
                    const secCol = columns.find(c => /section/i.test(c));
                    if (secCol && !targetCols.includes(secCol)) targetCols.push(secCol);
                }

                // CGPA / GPA
                if (/\b(cgpa|gpa|grade|score|marks)\b/i.test(queryLower)) {
                    const cgpaCol = columns.find(c => /cgpa|gpa|grade|score/i.test(c));
                    if (cgpaCol && !targetCols.includes(cgpaCol)) targetCols.push(cgpaCol);
                }

                // Email
                if (/\b(email|mail)\b/i.test(queryLower)) {
                    const emailCol = columns.find(c => /email|mail/i.test(c));
                    if (emailCol && !targetCols.includes(emailCol)) targetCols.push(emailCol);
                }

                // If user didn't mention specific columns, include standard readable columns
                if (targetCols.length === 0) {
                    targetCols.push(...columns.slice(0, 7));
                } else if (!targetCols.some(c => /name/i.test(c)) && columns.some(c => /name/i.test(c))) {
                    // Always include name if available
                    targetCols.splice(1, 0, columns.find(c => /name/i.test(c)));
                }

                // Determine WHERE filters
                const whereConditions = [];

                // Section filter (e.g. "section C" or "section = C")
                const sectionMatch = queryLower.match(/\bsection\s*(?:=|is|:)?\s*['"]?([a-z0-9]+)['"]?/i);
                if (sectionMatch && columns.some(c => /section/i.test(c))) {
                    const secCol = columns.find(c => /section/i.test(c));
                    const secVal = sectionMatch[1].toUpperCase();
                    whereConditions.push(`UPPER(CAST([${secCol}] AS STRING)) = '${secVal}'`);
                }

                // Department filter (e.g. "CSE" or "department CSE")
                const deptMatch = queryLower.match(/\b(cse|ece|mech|civil|aids|cce|eee)\b/i);
                if (deptMatch && columns.some(c => /dept/i.test(c))) {
                    const deptCol = columns.find(c => /dept/i.test(c));
                    whereConditions.push(`UPPER(CAST([${deptCol}] AS STRING)) LIKE '%${deptMatch[1].toUpperCase()}%'`);
                }

                // CGPA filter (e.g. "cgpa > 8" or "above 8.5")
                const cgpaCol = columns.find(c => /cgpa/i.test(c));
                if (cgpaCol) {
                    const compMatch = queryLower.match(/(?:cgpa|gpa)?\s*(>|>=|<|<=|=)\s*([0-9.]+)/i);
                    const aboveMatch = queryLower.match(/(?:above|greater than|higher than|more than)\s*([0-9.]+)/i);
                    const belowMatch = queryLower.match(/(?:below|less than|lower than)\s*([0-9.]+)/i);

                    if (compMatch) {
                        whereConditions.push(`CAST([${cgpaCol}] AS NUMBER) ${compMatch[1]} ${compMatch[2]}`);
                    } else if (aboveMatch) {
                        whereConditions.push(`CAST([${cgpaCol}] AS NUMBER) >= ${aboveMatch[1]}`);
                    } else if (belowMatch) {
                        whereConditions.push(`CAST([${cgpaCol}] AS NUMBER) <= ${belowMatch[1]}`);
                    }
                }

                const colSelectSql = targetCols.map(c => `[${c}]`).join(", ");
                const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";
                const extractSql = `SELECT ${colSelectSql} FROM [${sheetName}] ${whereSql}`;

                console.log(`[ALASQL] Executing Natural Language Table Extraction: ${extractSql}`);
                try {
                    const extractResult = alasql(extractSql);
                    if (extractResult && Array.isArray(extractResult) && extractResult.length > 0) {
                        const count = extractResult.length;
                        const mdTable = formatMarkdownTable(extractResult, targetCols);
                        const answer = `Here are the **${count}** student record(s) extracted from **${tableName}**:\n\n${mdTable}`;

                        return {
                            isDirectResult: true,
                            directAnswer: answer,
                            context: `[AlaSQL Verified Records from ${tableName} (${sheetName})]:\n${mdTable}`,
                            sourceName: tableName,
                            documentId,
                            rowCount: count,
                            matchedRows: extractResult
                        };
                    }
                } catch (extractErr) {
                    console.warn("[ALASQL] Extraction SQL notice:", extractErr.message);
                }
            }

            // ==============================================================
            // CASE 3: Aggregation Queries (COUNT, AVG, MAX, MIN)
            // ==============================================================
            const isCountQuery = /\b(how many|count|total number|number of)\b/i.test(queryLower);
            const isHighestQuery = /\b(highest|top|max|best|greatest)\b/i.test(queryLower);
            const isLowestQuery = /\b(lowest|bottom|min|worst|least)\b/i.test(queryLower);
            const isAverageQuery = /\b(average|mean|avg)\b/i.test(queryLower);

            if (isCountQuery) {
                const secMatch = queryLower.match(/\bsection\s*([a-z0-9]+)\b/i);
                if (secMatch && columns.some(c => /section/i.test(c))) {
                    const secCol = columns.find(c => /section/i.test(c));
                    const secVal = secMatch[1].toUpperCase();
                    const countRes = alasql(`SELECT COUNT(*) AS [cnt] FROM ? WHERE UPPER(CAST([${secCol}] AS STRING)) = '${secVal}'`, [rows]);
                    const count = countRes[0]?.cnt || 0;
                    const ans = `There are **${count}** students in **Section ${secVal}** according to **${tableName}**.`;
                    return {
                        isDirectResult: true,
                        directAnswer: ans,
                        context: `[AlaSQL Calculation from ${tableName}]: ${ans}`,
                        sourceName: tableName,
                        documentId,
                        rowCount: 1
                    };
                } else {
                    const totalRes = alasql(`SELECT COUNT(*) AS [cnt] FROM ?`, [rows]);
                    const count = totalRes[0]?.cnt || 0;
                    const ans = `There are **${count}** total records in **${tableName}**.`;
                    return {
                        isDirectResult: true,
                        directAnswer: ans,
                        context: `[AlaSQL Calculation from ${tableName}]: ${ans}`,
                        sourceName: tableName,
                        documentId,
                        rowCount: 1
                    };
                }
            }

            if (isHighestQuery || isLowestQuery) {
                const numericCol = columns.find(c => /(cgpa|mark|score|salary|price|total|gpa|rank)/i.test(c));
                if (numericCol) {
                    const orderDir = isHighestQuery ? "DESC" : "ASC";
                    const label = isHighestQuery ? "Highest" : "Lowest";
                    const secMatch = queryLower.match(/\bsection\s*([a-z0-9]+)\b/i);
                    let filterSql = `[${numericCol}] != ''`;
                    let secLabel = "";

                    if (secMatch && columns.some(c => /section/i.test(c))) {
                        const secCol = columns.find(c => /section/i.test(c));
                        const secVal = secMatch[1].toUpperCase();
                        filterSql += ` AND UPPER(CAST([${secCol}] AS STRING)) = '${secVal}'`;
                        secLabel = ` in Section ${secVal}`;
                    }

                    try {
                        const topRows = alasql(`SELECT * FROM ? WHERE ${filterSql} ORDER BY CAST([${numericCol}] AS NUMBER) ${orderDir} LIMIT 5`, [rows]);
                        if (topRows.length > 0) {
                            const nameCol = columns.find(c => /name/i.test(c)) || columns[1];
                            const md = formatMarkdownTable(topRows, [nameCol, numericCol, columns.find(c => /section/i.test(c))].filter(Boolean));
                            const ans = `Here are the students with the **${label.toLowerCase()} ${numericCol}**${secLabel} from **${tableName}**:\n\n${md}`;
                            return {
                                isDirectResult: true,
                                directAnswer: ans,
                                context: `[AlaSQL Calculation from ${tableName}]:\n${md}`,
                                sourceName: tableName,
                                documentId,
                                rowCount: topRows.length
                            };
                        }
                    } catch (aggErr) {
                        console.warn("[ALASQL] Superlative query notice:", aggErr.message);
                    }
                }
            }

            if (isAverageQuery) {
                const numericCol = columns.find(c => /(cgpa|mark|score|salary|price|total|gpa)/i.test(c));
                if (numericCol) {
                    try {
                        const avgRes = alasql(`SELECT ROUND(AVG(CAST([${numericCol}] AS NUMBER)), 2) AS [average] FROM ? WHERE [${numericCol}] != ''`, [rows]);
                        if (avgRes[0]?.average !== undefined) {
                            const ans = `The average **${numericCol}** across **${tableName}** is **${avgRes[0].average}**.`;
                            return {
                                isDirectResult: true,
                                directAnswer: ans,
                                context: `[AlaSQL Calculation from ${tableName}]: ${ans}`,
                                sourceName: tableName,
                                documentId,
                                rowCount: 1
                            };
                        }
                    } catch (avgErr) {
                        console.warn("[ALASQL] Average query notice:", avgErr.message);
                    }
                }
            }

            // ==============================================================
            // CASE 4: Keyword / Entity Exact Row Search (e.g. "Who is Abhijith Pillai?")
            // ==============================================================
            const tokens = queryLower
                .replace(/[^a-z0-9\s]/g, " ")
                .split(/\s+/)
                .filter(t => t.length >= 3 && !["the", "and", "what", "who", "show", "tell", "list", "give", "from", "with", "this", "that", "how", "many", "extract"].includes(t));

            if (tokens.length > 0) {
                const stringCols = columns.slice(0, 8);
                const conditions = [];

                for (const token of tokens) {
                    const colConditions = stringCols.map(col => `LOWER(CAST([${col}] AS STRING)) LIKE '%${token}%'`);
                    conditions.push(`(${colConditions.join(" OR ")})`);
                }

                const sql = `SELECT * FROM ? WHERE ${conditions.join(" AND ")} LIMIT 10`;
                let matchedRows = [];
                try {
                    matchedRows = alasql(sql, [rows]);
                } catch {
                    try {
                        matchedRows = alasql(`SELECT * FROM ? WHERE ${conditions.join(" OR ")} LIMIT 5`, [rows]);
                    } catch {
                        // ignore
                    }
                }

                if (matchedRows.length > 0) {
                    let sectionText = `[AlaSQL Verified Database Results from ${tableName} (Sheet: ${sheetName})]:\n`;
                    sectionText += `Matched ${matchedRows.length} Exact Record(s):\n`;
                    sectionText += matchedRows.map((r, idx) => {
                        const fields = columns
                            .filter(c => r[c] !== undefined && r[c] !== "" && c !== "__rowNum")
                            .map(c => `${c}: ${r[c]}`);
                        return `Record ${idx + 1}: ${fields.join(" | ")}`;
                    }).join("\n");

                    return {
                        isDirectResult: false, // Let LLM synthesize conversational answer for entity lookup
                        context: sectionText,
                        sourceName: tableName,
                        documentId,
                        rowCount: matchedRows.length,
                        matchedRows
                    };
                }
            }
        }

        return null;
    } catch (err) {
        console.warn("[ALASQL] Query execution notice:", err.message);
        return null;
    }
}
