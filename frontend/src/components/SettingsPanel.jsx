import React from 'react';
import { X, Sliders, Database, Cpu } from 'lucide-react';

export function SettingsPanel({ isOpen, onClose, health }) {
  if (!isOpen) return null;

  const config = health?.config || {};
  const dbStatus = health?.db || {};
  const ollamaStatus = health?.ollama || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-violet-600" />
            <h2 className="text-sm font-bold text-gray-800">Settings & System Info</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* MongoDB Status */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Database size={14} className="text-violet-500" />
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">MongoDB</h3>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <Row label="Status" value={dbStatus.online ? '✅ Connected' : '❌ Disconnected'} />
              <Row label="Database" value={dbStatus.database || '—'} />
              <Row label="Document Chunks" value={dbStatus.documentChunksCount ?? '—'} />
              <Row label="Documents" value={dbStatus.documentsCount ?? '—'} />
              <Row label="Sessions" value={dbStatus.sessionsCount ?? '—'} />
            </div>
          </section>

          {/* Ollama Status */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Cpu size={14} className="text-violet-500" />
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Ollama LLM</h3>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <Row label="Status" value={ollamaStatus.online ? '✅ Online' : '❌ Offline'} />
              <Row label="Chat Model" value={ollamaStatus.chatModel || '—'} mono />
              <Row label="Embed Model" value={ollamaStatus.embedModel || '—'} mono />
              {ollamaStatus.availableModels?.length > 0 && (
                <div className="flex items-start justify-between text-xs gap-2">
                  <span className="text-gray-500">Available</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {ollamaStatus.availableModels.map((m) => (
                      <span key={m} className="px-1.5 py-0.5 bg-violet-100 text-violet-600 rounded text-[10px] font-mono">{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* RAG Config */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Sliders size={14} className="text-violet-500" />
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">RAG Configuration</h3>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <Row label="Similarity Threshold" value={config.similarityThreshold ?? '—'} />
              <Row label="Max Retrieved Chunks" value={config.maxRetrievedChunks ?? '—'} />
              <Row label="Max History Messages" value={config.maxHistory ?? '—'} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className={`text-gray-800 font-medium ${mono ? 'font-mono text-[11px]' : ''}`}>{String(value)}</span>
    </div>
  );
}
