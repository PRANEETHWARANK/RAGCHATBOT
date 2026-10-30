import React, { useState } from 'react';
import { Files, ChevronLeft, ChevronRight, Layers, RefreshCw } from 'lucide-react';
import { UploadArea } from './UploadArea.jsx';
import { DocumentCard } from './DocumentCard.jsx';

export function DocumentPanel({
  documents,
  uploading,
  uploadProgress,
  onUpload,
  onDelete,
  onReprocess,
  onRefresh
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <aside className="w-10 border-l border-gray-100 bg-white flex flex-col items-center py-4 gap-4">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-violet-600 transition-colors"
          title="Open document panel"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="-rotate-90 text-[10px] font-semibold text-gray-400 tracking-widest whitespace-nowrap mt-4 select-none">
          DOCS ({documents.length})
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-72 border-l border-gray-100 bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-violet-600" />
          <h3 className="text-sm font-semibold text-gray-800">Knowledge Base</h3>
          {documents.length > 0 && (
            <span className="text-[10px] bg-violet-100 text-violet-600 font-bold px-1.5 py-0.5 rounded-full">
              {documents.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh documents"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
            title="Collapse panel"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Upload Area */}
      <div className="px-3 pt-3 pb-2 border-b border-gray-50">
        <UploadArea
          onUpload={onUpload}
          uploading={uploading}
          uploadProgress={uploadProgress}
        />
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Files size={28} className="text-gray-200 mb-2" />
            <p className="text-xs text-gray-400 font-medium">No documents indexed yet</p>
            <p className="text-[11px] text-gray-300 mt-1">Upload TXT, PDF, DOCX, CSV, XLSX or TEX files</p>
          </div>
        ) : (
          documents.map((doc) => (
            <DocumentCard
              key={doc.documentId || doc._id}
              doc={doc}
              onDelete={onDelete}
              onReprocess={onReprocess}
            />
          ))
        )}
      </div>
    </aside>
  );
}
