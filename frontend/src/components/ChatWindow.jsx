import React, { useRef, useEffect, useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { ChatMessage } from './ChatMessage.jsx';
import { ChatInput } from './ChatInput.jsx';
import { LoadingIndicator } from './LoadingIndicator.jsx';

function WelcomeScreen({ onSuggestion, documentsCount }) {
  const suggestions = [
    'What topics are covered in the uploaded documents?',
    'Summarize the key points from the knowledge base.',
    'What is machine learning?',
    'Explain the main ideas in your own words.'
  ];

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 text-center py-16">
      <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mb-4 shadow-sm">
        <Bot size={28} className="text-violet-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-800 mb-1">RAG AI Assistant</h2>
      <p className="text-sm text-gray-500 max-w-sm mb-6 leading-relaxed">
        Ask questions about your uploaded documents, or anything general.{' '}
        {documentsCount > 0
          ? <span className="text-violet-600 font-medium">{documentsCount} document{documentsCount > 1 ? 's' : ''} indexed.</span>
          : <span className="text-amber-600 font-medium">Upload a document to ground answers in your data.</span>
        }
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSuggestion(s)}
            className="text-left text-xs text-gray-600 bg-white border border-gray-100 rounded-xl px-3 py-2.5 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 transition-all duration-200 shadow-sm"
          >
            <Sparkles size={11} className="inline mr-1.5 text-violet-400" />
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChatWindow({
  messages,
  loading,
  onSendMessage,
  onUploadClick,
  activeSessionId,
  documentsCount
}) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;
    onSendMessage(text);
    setInput('');
  };

  const handleSuggestion = (text) => {
    setInput(text);
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {messages.length === 0 ? (
          <WelcomeScreen onSuggestion={handleSuggestion} documentsCount={documentsCount} />
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {loading && <LoadingIndicator text="Searching documents & generating answer…" />}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onUploadClick={onUploadClick}
        loading={loading}
        disabled={false}
      />
    </div>
  );
}
