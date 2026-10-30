import React, { useEffect, useRef, useState } from 'react';
import { Sidebar } from '../components/Sidebar.jsx';
import { ChatWindow } from '../components/ChatWindow.jsx';
import { DocumentPanel } from '../components/DocumentPanel.jsx';
import { SettingsPanel } from '../components/SettingsPanel.jsx';
import { useChat } from '../hooks/useChat.js';
import { useDocuments } from '../hooks/useDocuments.js';
import { useHealth } from '../hooks/useHealth.js';

export function ChatPage() {
  const chat = useChat();
  const docs = useDocuments();
  const { status: health, fetchHealth } = useHealth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [docPanelOpen, setDocPanelOpen] = useState(true);
  const uploadAreaRef = useRef(null);

  // On mount: load sessions, documents, health, and restore last session
  useEffect(() => {
    const init = async () => {
      await fetchHealth();
      await docs.loadDocuments();
      const sessionList = await chat.loadSessions();

      // Restore last active session if it still exists
      const storedId = chat.activeSessionId;
      if (storedId && sessionList.some((s) => s.sessionId === storedId)) {
        await chat.loadSession(storedId);
      } else if (sessionList.length > 0) {
        // Auto-load the most recent session
        await chat.loadSession(sessionList[0].sessionId);
      }
      // If no sessions exist, don't auto-create — let user click New Chat
    };
    init();
  }, []);

  const handleNewChat = async () => {
    const session = await chat.createSession();
    if (session) chat.loadSession(session.sessionId);
  };

  const handleSendMessage = async (text) => {
    await chat.sendMessage(text);
  };

  const handleUploadClick = () => {
    setDocPanelOpen(true);
    // Scroll doc panel into view is handled by CSS
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Left Sidebar */}
      <Sidebar
        sessions={chat.sessions}
        activeSessionId={chat.activeSessionId}
        onNewChat={handleNewChat}
        onSelectSession={chat.loadSession}
        onDeleteSession={chat.deleteSession}
        onOpenSettings={() => setSettingsOpen(true)}
        health={health}
      />

      {/* Main Chat Window */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <ChatWindow
          messages={chat.messages}
          loading={chat.loading}
          onSendMessage={handleSendMessage}
          onUploadClick={handleUploadClick}
          activeSessionId={chat.activeSessionId}
          documentsCount={docs.documents.filter(d => d.status === 'indexed').length}
        />
      </main>

      {/* Right Document Panel */}
      <DocumentPanel
        documents={docs.documents}
        uploading={docs.uploading}
        uploadProgress={docs.uploadProgress}
        onUpload={async (files) => {
          await docs.uploadFiles(files);
          await fetchHealth();
        }}
        onDelete={async (id) => {
          await docs.deleteDocument(id);
          await fetchHealth();
        }}
        onReprocess={docs.reprocessDocument}
        onRefresh={() => { docs.loadDocuments(); fetchHealth(); }}
      />

      {/* Settings Modal */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        health={health}
      />
    </div>
  );
}
