import React, { useState } from 'react';
import { FileText, FileType, Trash2, RefreshCw, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';

const EXT_COLORS = {
  '.pdf':  'bg-red-50 text-red-600 border-red-100',
  '.docx': 'bg-blue-50 text-blue-600 border-blue-100',
  '.txt':  'bg-gray-50 text-gray-600 border-gray-100',
  '.md':   'bg-green-50 text-green-600 border-green-100',
  '.json': 'bg-yellow-50 text-yellow-600 border-yellow-100',
  '.csv':  'bg-teal-50 text-teal-600 border-teal-100',
  '.xlsx': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  '.xls':  'bg-emerald-50 text-emerald-700 border-emerald-100',
  '.xlsm': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  '.tex':  'bg-orange-50 text-orange-600 border-orange-100',
};

const STATUS_CONFIG = {
  indexed:    { icon: CheckCircle,  color: 'text-green-500',  label: 'Indexed' },
  processing: { icon: Clock,        color: 'text-yellow-500', label: 'Processing…' },
  failed:     { icon: XCircle,      color: 'text-red-500',    label: 'Failed' },
};

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DocumentCard({ doc, onDelete, onReprocess }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  const ext = doc.extension || '.txt';
  const extColor = EXT_COLORS[ext] || 'bg-gray-50 text-gray-600 border-gray-100';
  const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.processing;
  const StatusIcon = statusCfg.icon;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(doc.documentId);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      await onReprocess(doc.documentId);
    } finally {
      setReprocessing(false);
    }
  };

  return (
    <div className="border border-gray-100 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start gap-3 p-3">
        {/* Extension badge */}
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide flex-shrink-0 mt-0.5 ${extColor}`}>
          {ext.replace('.', '')}
        </span>

        {/* Name & meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate" title={doc.originalName}>
            {doc.originalName}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <StatusIcon size={11} className={statusCfg.color} />
            <span className={`text-[11px] font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
            {doc.chunksCount > 0 && (
              <span className="text-[11px] text-gray-400">{doc.chunksCount} chunks</span>
            )}
            <span className="text-[11px] text-gray-300">{formatSize(doc.size)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            title="Details"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {doc.status !== 'processing' && (
            <button
              onClick={handleReprocess}
              disabled={reprocessing}
              className="p-1 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors disabled:opacity-40"
              title="Re-index document"
            >
              <RefreshCw size={14} className={reprocessing ? 'animate-spin' : ''} />
            </button>
          )}
          {confirmDelete ? (
            <div className="flex gap-1">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-semibold hover:bg-red-200 transition"
              >
                {deleting ? '…' : 'Yes'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold hover:bg-gray-200 transition"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete document"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-50 mt-1 pt-2 space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-gray-400">Uploaded</span>
            <span className="text-gray-600">{formatDate(doc.createdAt)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-gray-400">Last indexed</span>
            <span className="text-gray-600">{formatDate(doc.updatedAt)}</span>
          </div>
          {doc.error && (
            <div className="text-[11px] text-red-500 bg-red-50 rounded px-2 py-1 mt-1">
              {doc.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
