import React, { useRef, useState } from 'react';
import { Upload, FileUp, X } from 'lucide-react';

const ACCEPTED = '.txt,.md,.json,.pdf,.docx,.csv,.xlsx,.xls,.xlsm,.tex';

// Human-readable labels for the hint text
const FORMAT_HINTS = 'TXT · MD · PDF · DOCX · CSV · XLSX · XLS · TEX';

// Per-extension colour badges shown in the file queue
const EXT_BADGE = {
  '.pdf':  'bg-red-50 text-red-600',
  '.docx': 'bg-blue-50 text-blue-600',
  '.txt':  'bg-gray-50 text-gray-500',
  '.md':   'bg-green-50 text-green-600',
  '.json': 'bg-yellow-50 text-yellow-600',
  '.csv':  'bg-teal-50 text-teal-600',
  '.xlsx': 'bg-emerald-50 text-emerald-600',
  '.xls':  'bg-emerald-50 text-emerald-600',
  '.xlsm': 'bg-emerald-50 text-emerald-600',
  '.tex':  'bg-orange-50 text-orange-600',
};

function extOf(filename) {
  const idx = filename.lastIndexOf('.');
  return idx === -1 ? '' : filename.slice(idx).toLowerCase();
}

export function UploadArea({ onUpload, uploading, uploadProgress }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    // Merge new files with existing pending files (avoid exact-name duplicates)
    setPendingFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const next = Array.from(files).filter((f) => !existingNames.has(f.name));
      return [...prev, ...next];
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const doUpload = async () => {
    if (pendingFiles.length === 0) return;
    await onUpload(pendingFiles);
    setPendingFiles([]);
  };

  const removeFile = (idx) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200
          ${dragOver
            ? 'border-violet-400 bg-violet-50'
            : 'border-gray-200 bg-gray-50 hover:border-violet-300 hover:bg-violet-50/50'
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Upload size={20} className="mx-auto text-gray-400 mb-2" />
        <p className="text-xs font-medium text-gray-600">Drop files or click to browse</p>
        <p className="text-[11px] text-gray-400 mt-0.5">{FORMAT_HINTS}</p>
        <p className="text-[10px] text-gray-300 mt-0.5">Max 20 MB per file</p>
      </div>

      {/* File queue */}
      {pendingFiles.length > 0 && (
        <div className="space-y-1.5">
          {pendingFiles.map((f, i) => {
            const ext = extOf(f.name);
            const badge = EXT_BADGE[ext] || 'bg-gray-50 text-gray-500';
            return (
              <div
                key={i}
                className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-1.5 text-xs"
              >
                {/* Extension badge */}
                <span className={`text-[10px] font-bold px-1 py-0.5 rounded uppercase tracking-wide flex-shrink-0 ${badge}`}>
                  {ext.replace('.', '') || '?'}
                </span>
                <span className="truncate text-gray-700 flex-1">{f.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  className="ml-1 text-gray-400 hover:text-red-500 flex-shrink-0 transition-colors"
                  title="Remove file"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}

          {/* Progress / Upload button */}
          {uploading ? (
            <div className="space-y-1">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress || 10}%` }}
                />
              </div>
              <p className="text-[11px] text-center text-gray-400">
                Uploading &amp; embedding… {uploadProgress}%
              </p>
            </div>
          ) : (
            <button
              onClick={doUpload}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
            >
              <FileUp size={13} />
              Upload {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
