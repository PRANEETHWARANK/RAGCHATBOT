import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { retrieveDocuments } from "./rag/retriever.js";
import { getChatModel } from "./config/ollama.js";

export async function startChat() {
    const rl = readline.createInterface({
        input,
        output
    });

    const conversationHistory = [];
    const chatModel = getChatModel();
    const promptTemplate = ChatPromptTemplate.fromMessages([
        ["system", "{system_prompt}"],
        new MessagesPlaceholder("chat_history"),
        ["user", "{question}"]
    ]);
    const chain = promptTemplate.pipe(chatModel).pipe(new StringOutputParser());

    try {
        while (true) {
            const question = await rl.question("\nYou: ");

            if (question.trim().toLowerCase() === "exit") {
                console.log("\nGoodbye!");
                break;
            }

            if (!question.trim()) {
                continue;
            }

            try {
                console.log("\nSearching relevant documents...");

                const documents = await retrieveDocuments(question);

                let systemPrompt;

                if (documents.length > 0) {
                    const context = documents
                        .map(doc => doc.text)
                        .join("\n\n");

                    systemPrompt = `
You are a helpful RAG AI assistant.
Answer the user's question using the following document context.
If the answer is not present in the context, clearly say so.
Do not invent information.
Always understand and prioritize the user's CURRENT question.

Do not automatically assume that every question is related to previously uploaded documents.

Use conversation history only when the current question clearly depends on an earlier message.

Use retrieved document context only when it is relevant to the current question.

Never use irrelevant student records, names, roll numbers, or unrelated document information to answer general questions.

For direct questions, provide a direct answer first.

If the user asks a classification question, clearly classify the subject and explain briefly.

If the user corrects or challenges a previous answer, reconsider the question instead of blindly repeating previous context.

If the question is ambiguous, ask for clarification rather than inventing an interpretation.

Never force an answer from retrieved documents when they do not contain relevant information.

DOCUMENT CONTEXT:
${context}
`;
                    console.log(`Found ${documents.length} relevant document chunks.`);
                } else {
                    systemPrompt = `
You are a helpful general-purpose AI assistant.
No relevant uploaded document was found.
Answer general questions using your knowledge.
If the user asks about a specific uploaded document, explain that no relevant information was retrieved.
Always understand and prioritize the user's CURRENT question.

Do not automatically assume that every question is related to previously uploaded documents.

Use conversation history only when the current question clearly depends on an earlier message.

Use retrieved document context only when it is relevant to the current question.

Never use irrelevant student records, names, roll numbers, or unrelated document information to answer general questions.

For direct questions, provide a direct answer first.

If the user asks a classification question, clearly classify the subject and explain briefly.

If the user corrects or challenges a previous answer, reconsider the question instead of blindly repeating previous context.

If the question is ambiguous, ask for clarification rather than inventing an interpretation.

Never force an answer from retrieved documents when they do not contain relevant information.
`;
                    console.log("No relevant document found. Using general AI mode.");
                }

                console.log("\nThinking (via LangChain)...");

                const answer = await chain.invoke({
                    system_prompt: systemPrompt,
                    chat_history: conversationHistory,
                    question: question.trim()
                });

                console.log(`\nAI: ${answer}`);

                conversationHistory.push(new HumanMessage(question.trim()));
                conversationHistory.push(new AIMessage(answer));

            } catch (err) {
                console.error("\nError generating response:", err.message);
            }
        }
    } finally {
        rl.close();
    }
}
