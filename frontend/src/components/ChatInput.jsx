import React, { useRef, useEffect } from 'react';
import { Send, Paperclip, Square } from 'lucide-react';

export function ChatInput({ value, onChange, onSend, onUploadClick, loading, disabled }) {
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && value.trim()) onSend();
    }
  };

  return (
    <div className="p-4 border-t border-gray-100 bg-white">
      <div className={`flex items-end gap-2 bg-gray-50 border rounded-2xl px-3 py-2 transition-all duration-200
        ${disabled ? 'opacity-60' : 'focus-within:border-violet-300 focus-within:bg-white focus-within:shadow-sm border-gray-200'}`}
      >
        {/* Attach button */}
        <button
          type="button"
          onClick={onUploadClick}
          disabled={disabled}
          className="p-1.5 rounded-xl text-gray-400 hover:text-violet-600 hover:bg-violet-50 flex-shrink-0 mb-0.5 transition-colors disabled:opacity-40"
          title="Upload documents"
        >
          <Paperclip size={16} />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          placeholder="Ask a question about your documents…"
          rows={1}
          className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none leading-relaxed py-1 max-h-48"
        />

        {/* Send button */}
        <button
          type="button"
          onClick={onSend}
          disabled={disabled || loading || !value.trim()}
          className={`p-2 rounded-xl flex-shrink-0 mb-0.5 transition-all duration-200
            ${!disabled && !loading && value.trim()
              ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-sm hover:shadow'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
        >
          {loading
            ? <Square size={14} className="animate-pulse" />
            : <Send size={14} />
          }
        </button>
      </div>
      <p className="text-center text-[10px] text-gray-300 mt-2">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
