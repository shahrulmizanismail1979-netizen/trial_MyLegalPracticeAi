import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface ExtractedFile {
  name: string;
  mimetype: string;
  size: number;
  chars: number;
  text: string;
  error?: string;
}

interface Props {
  onFilesExtracted: (files: ExtractedFile[]) => void;
  label?: string;
  hint?: string;
  maxFiles?: number;
}

const ACCEPT = '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown';

export function FileUploadDropzone({
  onFilesExtracted,
  label = 'Upload supporting documents',
  hint = 'PDF, DOCX, TXT  •  up to 5 files, 100 MB each. The AI will read these and use them as context for your draft.',
  maxFiles = 5,
}: Props) {
  const MAX_FILE_BYTES = 100 * 1024 * 1024;
  const [files, setFiles] = useState<ExtractedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const upload = useCallback(
    async (selected: File[]) => {
      if (selected.length === 0) return;
      setError('');
      const tooBig = selected.find((f) => f.size > MAX_FILE_BYTES);
      if (tooBig) {
        setError(
          `"${tooBig.name}" is ${(tooBig.size / 1024 / 1024).toFixed(1)} MB. Each file must be under 100 MB.`,
        );
        return;
      }
      setUploading(true);
      try {
        // Upload each file straight to object storage via a presigned URL, then
        // ask the server to extract text from the stored file. This bypasses the
        // hosting platform's ~32MB request-body limit, which otherwise rejects
        // large uploads at the edge ("Failed to fetch") before they ever reach
        // the server.
        const toExtract: { objectPath: string; name: string; contentType: string }[] = [];
        for (const f of selected.slice(0, maxFiles)) {
          const urlRes = await fetch('/api/lit/uploads/upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: f.name }),
          });
          if (!urlRes.ok) {
            const m = await urlRes.json().catch(() => ({}));
            throw new Error(m.error || `Could not start upload (${urlRes.status})`);
          }
          const { uploadURL, objectPath } = (await urlRes.json()) as {
            uploadURL: string;
            objectPath: string;
          };
          const put = await fetch(uploadURL, {
            method: 'PUT',
            headers: { 'Content-Type': f.type || 'application/octet-stream' },
            body: f,
          });
          if (!put.ok) throw new Error(`Upload of "${f.name}" failed (${put.status})`);
          toExtract.push({ objectPath, name: f.name, contentType: f.type || '' });
        }

        const res = await fetch('/api/lit/uploads/extract-stored', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: toExtract }),
        });
        if (!res.ok) {
          const msg = await res.json().catch(() => ({}));
          throw new Error(msg.error || `Extraction failed (${res.status})`);
        }
        const data = (await res.json()) as { files: ExtractedFile[] };
        const merged = [...files, ...data.files].slice(0, maxFiles);
        setFiles(merged);
        onFilesExtracted(merged);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [files, maxFiles, onFilesExtracted],
  );

  const remove = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    onFilesExtracted(next);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) upload(dropped);
  };

  const formatSize = (b: number) =>
    b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed transition-colors p-5 text-center ${
          dragOver
            ? 'border-primary bg-primary/10'
            : 'border-border bg-secondary/20 hover:border-primary/50 hover:bg-primary/5'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const sel = Array.from(e.target.files ?? []);
            if (sel.length) upload(sel);
            e.target.value = '';
          }}
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Extracting text from your files…</span>
          </div>
        ) : (
          <>
            <Upload className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground mt-1">{hint}</p>
            <p className="text-xs text-primary/80 mt-2">Click to browse or drag & drop</p>
          </>
        )}
      </div>

      {error && (
        <div className="flex gap-2 items-start text-xs text-red-400 bg-red-950/20 border border-red-800/30 rounded-lg p-2.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 text-xs bg-background border border-border rounded-lg px-3 py-2"
            >
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-medium text-foreground truncate flex-1">{f.name}</span>
              <span className="text-muted-foreground whitespace-nowrap">
                {formatSize(f.size)}
              </span>
              {f.error ? (
                <span className="text-red-400 flex items-center gap-1 whitespace-nowrap">
                  <AlertCircle className="h-3 w-3" />
                  {f.error}
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1 whitespace-nowrap">
                  <CheckCircle2 className="h-3 w-3" />
                  {f.chars.toLocaleString()} chars
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(i);
                }}
                className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                aria-label="Remove file"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function buildContextFromFiles(files: ExtractedFile[]): string {
  const usable = files.filter((f) => f.text && !f.error);
  if (usable.length === 0) return '';
  const sections = usable.map(
    (f) =>
      `\n\n=== UPLOADED FILE: ${f.name} ===\n${f.text}\n=== END OF FILE: ${f.name} ===`,
  );
  return `\n\nThe user has uploaded the following supporting document(s). Use these as primary source material when drafting:${sections.join('')}`;
}
