import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, ChevronDown, ChevronUp, User, Bot, Database } from 'lucide-react';

function SourceBadge({ source, score }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-50 border border-violet-100 text-violet-700 font-medium">
      <Database size={9} />
      {source}
      {score !== undefined && (
        <span className="opacity-60">{Math.round(score * 100)}%</span>
      )}
    </span>
  );
}

function SourcesDrawer({ sources }) {
  const [open, setOpen] = useState(false);
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 font-medium transition-colors"
      >
        <Database size={11} />
        {sources.length} source{sources.length > 1 ? 's' : ''} used
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {sources.map((s, i) => (
            <div key={i} className="bg-violet-50 border border-violet-100 rounded-lg p-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-violet-700 truncate">{s.source}</span>
                <span className="text-[10px] text-violet-400 ml-2 flex-shrink-0">
                  chunk {s.chunkIndex + 1} · {Math.round((s.score || 0) * 100)}% match
                </span>
              </div>
              <p className="text-[11px] text-gray-500 italic leading-relaxed line-clamp-3">"{s.text}"</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const time = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 px-4 py-2 group">
        <div className="max-w-[78%]">
          <div className="bg-violet-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm">
            {message.content}
          </div>
          <p className="text-[10px] text-gray-300 text-right mt-1">{time}</p>
        </div>
        <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-1">
          <User size={14} className="text-violet-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 px-4 py-2 group">
      <div className="w-7 h-7 rounded-full bg-white border border-gray-100 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
        <Bot size={14} className="text-violet-600" />
      </div>
      <div className="max-w-[80%]">
        <div className={`bg-white border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-sm leading-relaxed
          ${message.isError ? 'border-red-100 bg-red-50' : 'border-gray-100'}`}
        >
          <div className="prose prose-sm prose-gray max-w-none overflow-x-auto
            prose-code:bg-gray-100 prose-code:text-violet-700 prose-code:rounded prose-code:px-1 prose-code:text-[0.8em]
            prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-lg prose-pre:text-xs
            prose-headings:text-gray-800 prose-a:text-violet-600
            prose-table:border-collapse prose-table:w-full prose-table:text-xs prose-table:my-2
            prose-th:bg-violet-50 prose-th:text-violet-900 prose-th:p-2 prose-th:border prose-th:border-violet-200 prose-th:font-semibold prose-th:text-left
            prose-td:p-2 prose-td:border prose-td:border-gray-200 prose-td:text-gray-700
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
          <SourcesDrawer sources={message.sources} />
        </div>

        <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <span className="text-[10px] text-gray-300">{time}</span>
          {message.usedDocuments && (
            <span className="text-[10px] text-violet-400 flex items-center gap-0.5">
              <Database size={9} /> RAG
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
