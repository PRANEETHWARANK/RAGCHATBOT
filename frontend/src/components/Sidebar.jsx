import React, { useState } from 'react';
import {
  Plus, Search, Trash2, MessageSquare, ChevronLeft, ChevronRight,
  Bot, Settings, Wifi, WifiOff, Database
} from 'lucide-react';

function SessionItem({ session, isActive, onSelect, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    await onDelete(session.sessionId);
  };

  return (
    <div
      onClick={() => onSelect(session.sessionId)}
      className={`group flex items-start gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 relative
        ${isActive
          ? 'bg-violet-600 text-white shadow-sm'
          : 'text-gray-700 hover:bg-gray-100'
        }`}
    >
      <MessageSquare size={14} className={`flex-shrink-0 mt-0.5 ${isActive ? 'text-violet-200' : 'text-gray-400'}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${isActive ? 'text-white' : 'text-gray-700'}`}>
          {session.title || 'New Chat'}
        </p>
        <p className={`text-[10px] mt-0.5 ${isActive ? 'text-violet-200' : 'text-gray-400'}`}>
          {new Date(session.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </p>
      </div>

      {/* Delete button */}
      <div className={`opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'opacity-100' : ''}`}>
        {confirmDelete ? (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleDelete}
              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${isActive ? 'bg-violet-500 text-white' : 'bg-red-100 text-red-600'}`}
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${isActive ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
            className={`p-0.5 rounded ${isActive ? 'text-violet-200 hover:text-white' : 'text-gray-400 hover:text-red-500'}`}
            title="Delete conversation"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

export function Sidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onOpenSettings,
  health
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = sessions.filter((s) =>
    (s.title || 'New Chat').toLowerCase().includes(search.toLowerCase())
  );

  const dbOnline = health?.db?.online;
  const ollamaOnline = health?.ollama?.online;

  if (collapsed) {
    return (
      <aside className="w-12 bg-white border-r border-gray-100 flex flex-col items-center py-4 gap-3">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-xl hover:bg-gray-50 text-gray-500"
          title="Expand sidebar"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={onNewChat}
          className="p-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 shadow-sm"
          title="New Chat"
        >
          <Plus size={16} />
        </button>
        <div className="flex-1" />
        <div className={`w-2 h-2 rounded-full ${dbOnline && ollamaOnline ? 'bg-green-400' : 'bg-red-400'}`} />
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col overflow-hidden">
      {/* Brand */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center shadow-sm">
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-tight">RAG AI</h1>
            <p className="text-[10px] text-gray-400 leading-tight">Knowledge Assistant</p>
          </div>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600"
        >
          <ChevronLeft size={15} />
        </button>
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-50">
        <div className={`flex items-center gap-1 text-[10px] font-medium ${dbOnline ? 'text-green-600' : 'text-red-500'}`}>
          <Database size={9} />
          MongoDB
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-medium ${ollamaOnline ? 'text-green-600' : 'text-red-500'}`}>
          {ollamaOnline ? <Wifi size={9} /> : <WifiOff size={9} />}
          Ollama
        </div>
        {health?.ollama?.chatModel && (
          <span className="ml-auto text-[10px] text-gray-300 truncate">{health.ollama.chatModel}</span>
        )}
      </div>

      {/* New Chat button */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors shadow-sm"
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
          <Search size={12} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-xs text-gray-700 placeholder-gray-400 flex-1 outline-none"
          />
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-3">
        {filtered.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-6">
            {search ? 'No matching conversations' : 'No conversations yet'}
          </p>
        ) : (
          filtered.map((session) => (
            <SessionItem
              key={session.sessionId}
              session={session}
              isActive={session.sessionId === activeSessionId}
              onSelect={onSelectSession}
              onDelete={onDeleteSession}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-gray-50">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <Settings size={14} />
          Settings
        </button>
      </div>
    </aside>
  );
}
