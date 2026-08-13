import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export interface ExtractedFile {
  name: string;
  text: string;
  error?: string;
  size?: number;
  chars?: number;
}

interface Props {
  onFilesExtracted: (files: ExtractedFile[]) => void;
}

const ACCEPT =
  '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown';

export function MatterFileUpload({ onFilesExtracted }: Props) {
  const [files, setFiles] = useState<ExtractedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handle = useCallback(
    async (selected: File[]) => {
      if (!selected.length || uploading) return;
      setError('');
      setUploading(true);
      try {
        const fd = new FormData();
        for (const f of selected.slice(0, 5)) fd.append('files', f);
        const token = typeof window !== 'undefined' ? (localStorage.getItem('myccblitai_access_token') ?? '') : '';
        const res = await fetch('/api/shared/uploads/extract', {
          method: 'POST',
          body: fd,
          credentials: 'include',
          ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        });
        if (!res.ok) throw new Error('Upload failed');
        const data: { files: ExtractedFile[] } = await res.json();
        const next = [...files, ...data.files];
        setFiles(next);
        onFilesExtracted(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [files, uploading, onFilesExtracted],
  );

  const remove = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    onFilesExtracted(next);
  };

  return (
    <div className="space-y-2">
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handle(Array.from(e.dataTransfer.files)); }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handle(Array.from(e.target.files ?? []))}
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Extracting text from files...
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-2">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Drop files here or click to upload</span>
            <span className="text-xs text-muted-foreground">PDF, DOCX, TXT, MD · up to 5 files · 5 MB each</span>
          </div>
        )}
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />{error}
        </p>
      )}
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-secondary/50 rounded-md px-2.5 py-1.5">
              {f.error ? (
                <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              )}
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate flex-1 font-medium">{f.name}</span>
              {f.error ? (
                <span className="text-destructive shrink-0 text-right max-w-[160px] truncate">{f.error}</span>
              ) : (
                <span className="text-muted-foreground shrink-0">
                  {(f.chars ?? f.text?.length ?? 0).toLocaleString()} chars
                </span>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); remove(i); }}
                className="ml-1 text-muted-foreground hover:text-destructive shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
