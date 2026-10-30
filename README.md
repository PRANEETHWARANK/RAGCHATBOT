# RAG AI — Intelligent Knowledge Chatbot

A production-quality, full-stack **Retrieval-Augmented Generation (RAG)** chatbot web application with **persistent conversation memory**, **multi-document support**, and **follow-up question understanding**.

Built with: **React + Vite + Tailwind CSS** (frontend) · **Node.js + Express** (backend) · **LangChain.js** (RAG orchestration & LCEL) · **MongoDB** (storage) · **Ollama** (local LLMs)

---

## ✨ Features

| Feature | Details |
|---|---|
| 📂 Multi-document upload | TXT, PDF, DOCX, MD — up to 20 MB each |
| 🔍 RAG vector search | Local cosine similarity — no Atlas required |
| 💬 Persistent sessions | Conversations survive browser refresh / restart |
| 🧠 Follow-up memory | Contextualizes pronouns and references across turns |
| 🗂 Multiple sessions | Create, switch, delete independent chat sessions |
| 📑 Source citations | See exactly which document chunks answered each question |
| ⚙️ Configurable | Threshold, top-K, history limit via `.env` |
| 🗑 Document management | Upload, re-index, delete with real-time status |

---

## 🏗 Architecture

```
RAGCHATBOT/
├── src/                        # Node.js Express backend
│   ├── app.js                  # Express app + routes
│   ├── server.js               # Entry point
│   ├── config/
│   │   ├── database.js         # MongoDB connection + collections
│   │   └── ollama.js           # Ollama embed/chat + query contextualizer
│   ├── rag/
│   │   ├── chunker.js          # Text chunking (word-level, configurable)
│   │   ├── documentLoader.js   # TXT / PDF / DOCX extraction
│   │   └── retriever.js        # Cosine similarity vector search
│   ├── services/
│   │   ├── chatService.js      # RAG + memory pipeline
│   │   ├── memoryService.js    # Session & message CRUD
│   │   ├── documentService.js  # Upload, chunk, embed, delete
│   │   └── ragService.js       # Thin wrapper around retriever
│   ├── controllers/
│   │   ├── chatController.js
│   │   ├── sessionController.js
│   │   └── documentController.js
│   ├── routes/
│   │   ├── chatRoutes.js
│   │   ├── sessionRoutes.js
│   │   ├── documentRoutes.js
│   │   └── healthRoutes.js
│   └── middleware/
│       ├── uploadMiddleware.js  # Multer + file validation
│       └── errorMiddleware.js   # Global error handler
│
├── frontend/                   # React + Vite + Tailwind CSS
│   └── src/
│       ├── components/
│       │   ├── Sidebar.jsx         # Session list, new chat, status
│       │   ├── ChatWindow.jsx      # Main chat area + welcome screen
│       │   ├── ChatMessage.jsx     # Message bubbles + source drawer
│       │   ├── ChatInput.jsx       # Multiline input + send + attach
│       │   ├── DocumentPanel.jsx   # Right-side knowledge base panel
│       │   ├── DocumentCard.jsx    # Per-document card with actions
│       │   ├── UploadArea.jsx      # Drag-and-drop file uploader
│       │   ├── LoadingIndicator.jsx
│       │   └── SettingsPanel.jsx   # System info modal
│       ├── hooks/
│       │   ├── useChat.js          # Session + message state
│       │   ├── useDocuments.js     # Document upload/delete state
│       │   └── useHealth.js        # API health polling
│       ├── services/
│       │   ├── api.js              # Axios instance
│       │   ├── chatService.js
│       │   ├── sessionService.js
│       │   └── documentService.js
│       └── pages/
│           └── ChatPage.jsx        # Root page layout
│
├── documents/                  # Folder for legacy CLI ingestion
├── uploads/                    # Auto-created: uploaded files live here
├── .env                        # Your private environment config
├── .env.example                # Template for new setups
└── package.json
```

---

## ⚙️ Prerequisites

1. **Node.js** v18 or higher
2. **MongoDB** running locally:
   ```
   mongod --dbpath <your-data-dir>
   ```
3. **Ollama** running with required models:
   ```bash
   ollama pull llama3.1:8b
   ollama pull nomic-embed-text
   ollama serve
   ```

---

## 🚀 Installation & Startup

```bash
# 1. Install root (backend) dependencies
npm install

# 2. Install frontend dependencies
npm install --prefix frontend

# 3. (Optional) Ingest documents from documents/ folder via CLI
npm run ingest

# 4. Start both backend and frontend together
npm run dev
```

| Server | URL |
|---|---|
| **React Frontend** | http://localhost:5173 |
| **Express API** | http://localhost:5000 |
| **Health Check** | http://localhost:5000/api/health |

---

## 📡 REST API Reference

### Chat
| Method | Path | Body |
|---|---|---|
| POST | `/api/chat` | `{ sessionId, message }` |

### Sessions
| Method | Path | Description |
|---|---|---|
| POST | `/api/sessions` | Create new session |
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/:sessionId` | Get session + messages |
| DELETE | `/api/sessions/:sessionId` | Delete session |
| DELETE | `/api/sessions/:sessionId/messages` | Clear messages |

### Documents
| Method | Path | Description |
|---|---|---|
| POST | `/api/documents/upload` | Upload files (multipart) |
| GET | `/api/documents` | List all documents |
| GET | `/api/documents/:id` | Get document details |
| DELETE | `/api/documents/:id` | Delete document + chunks |
| POST | `/api/documents/:id/reprocess` | Re-index document |

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | MongoDB + Ollama + config status |

---

## 🗄 MongoDB Collections

| Collection | Purpose |
|---|---|
| `document_chunks` | Embedded text chunks with cosine-searchable vectors |
| `documents_metadata` | File metadata, status, chunk count |
| `chat_sessions` | Session records with auto-generated titles |
| `chat_messages` | All messages with sources, timestamps, roles |

---

## 🔧 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MONGO_URI` | `mongodb://127.0.0.1:27017` | MongoDB connection |
| `DB_NAME` | `rag_chatbot` | Database name |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama API base URL |
| `CHAT_MODEL` | `llama3.1:8b` | LLM for chat responses |
| `EMBED_MODEL` | `nomic-embed-text` | Model for embeddings |
| `PORT` | `5000` | Backend server port |
| `SIMILARITY_THRESHOLD` | `0.35` | Min cosine score (0–1) |
| `MAX_RETRIEVED_CHUNKS` | `4` | Top-K documents returned |
| `MAX_HISTORY` | `20` | Messages per session sent to LLM |
| `MAX_FILE_SIZE_MB` | `20` | Maximum upload size in MB |
| `UPLOAD_DIR` | `uploads` | Directory for uploaded files |

---

## 📋 npm Scripts

| Script | Action |
|---|---|
| `npm run dev` | Start backend + frontend concurrently |
| `npm run server` | Backend only (port 5000) |
| `npm run client` | Frontend Vite dev server only |
| `npm run build` | Build React production bundle |
| `npm run ingest` | CLI ingest all files in `documents/` |
| `npm run cli` | Original terminal-based RAG chat |
