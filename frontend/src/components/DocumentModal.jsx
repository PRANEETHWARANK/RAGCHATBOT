import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export function DocumentModal({ isOpen, onClose, onDocumentAdded }) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'text'
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: '' }

  if (!isOpen) return null;

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setStatus(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');

      setStatus({
        type: 'success',
        message: `${data.message} (${data.details?.chunksCount || 0} chunks generated)`
      });
      setFile(null);
      if (onDocumentAdded) onDocumentAdded();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch('/api/documents/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to ingest text');

      setStatus({
        type: 'success',
        message: `${data.message} (${data.details?.chunksCount || 0} chunks generated)`
      });
      setTitle('');
      setContent('');
      if (onDocumentAdded) onDocumentAdded();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Knowledge Document</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => { setActiveTab('upload'); setStatus(null); }}
          >
            <Upload size={16} /> Upload File (.txt, .md)
          </button>
          <button
            className={`tab-btn ${activeTab === 'text' ? 'active' : ''}`}
            onClick={() => { setActiveTab('text'); setStatus(null); }}
          >
            <FileText size={16} /> Paste Raw Text
          </button>
        </div>

        {status && (
          <div className={`status-banner ${status.type}`}>
            {status.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{status.message}</span>
          </div>
        )}

        {activeTab === 'upload' ? (
          <form onSubmit={handleFileUpload} className="modal-body">
            <div className="dropzone">
              <input
                type="file"
                id="file-upload"
                accept=".txt,.md,.json,.csv"
                onChange={(e) => setFile(e.target.files[0])}
                style={{ display: 'none' }}
              />
              <label htmlFor="file-upload" className="dropzone-label">
                <Upload size={32} className="dropzone-icon" />
                <p className="dropzone-text">
                  {file ? file.name : 'Click or drop text document here'}
                </p>
                <span className="dropzone-hint">Supports .txt, .md, .json (max 10MB)</span>
              </label>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={!file || loading}>
                {loading ? (
                  <>
                    <Loader2 size={16} className="spinner" /> Ingesting & Embedding...
                  </>
                ) : (
                  'Upload & Ingest'
                )}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleTextSubmit} className="modal-body">
            <div className="form-group">
              <label>Document Name</label>
              <input
                type="text"
                placeholder="e.g. customer_policies.txt"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Document Content</label>
              <textarea
                rows={7}
                placeholder="Paste knowledge text, notes, guidelines, FAQs..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={!title.trim() || !content.trim() || loading}>
                {loading ? (
                  <>
                    <Loader2 size={16} className="spinner" /> Chunking & Ingesting...
                  </>
                ) : (
                  'Ingest Text'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
