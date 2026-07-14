import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface FileUploadProps {
  onUpload: (files: File[]) => void;
  isUploading: boolean;
  title?: string;
  hint?: string;
  buttonLabel?: string;
  compact?: boolean;
  /** Max bytes per file. Defaults to 50MB. */
  maxSizeBytes?: number;
  /** react-dropzone accept map (e.g. audio/video). Omit to accept any file. */
  accept?: Record<string, string[]>;
  /** Allow multiple files. Defaults to true. */
  multiple?: boolean;
}

export function FileUpload({
  onUpload,
  isUploading,
  title,
  hint,
  buttonLabel,
  compact = false,
  maxSizeBytes = 50 * 1024 * 1024,
  accept,
  multiple = true,
}: FileUploadProps) {
  const { t } = useLanguage();
  const resolvedTitle = title ?? t("tool.upload.defaultTitle");
  const resolvedHint = hint ?? t("tool.upload.defaultHint");
  const resolvedButtonLabel = buttonLabel ?? t("tool.upload.defaultButton");
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onUpload(acceptedFiles);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop,
    disabled: isUploading,
    maxSize: maxSizeBytes,
    maxFiles: multiple ? 30 : 1,
    multiple,
    ...(accept ? { accept } : {}),
  });

  return (
    <div className="w-full">
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors duration-200 ease-in-out
          ${compact ? 'p-6' : 'p-10'}
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-card/50'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className={`flex flex-col items-center justify-center ${compact ? 'space-y-2' : 'space-y-4'}`}>
          <div className={`rounded-full ${compact ? 'p-3' : 'p-4'} ${isDragActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
            <UploadCloud className={compact ? 'w-6 h-6' : 'w-8 h-8'} />
          </div>
          <div>
            <p className={`font-medium text-foreground ${compact ? 'text-sm' : 'text-base'}`}>
              {isDragActive ? t("tool.upload.dropHere") : resolvedTitle}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("tool.upload.orClick")}
            </p>
          </div>
          {!compact && (
            <div className="text-xs text-muted-foreground pt-2">
              {resolvedHint}
            </div>
          )}
        </div>
      </div>
      
      {acceptedFiles.length > 0 && !isUploading && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2 text-foreground">{t("tool.upload.selectedFiles")}</h4>
          <ul className="space-y-2">
            {acceptedFiles.map((file, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-3 py-2 rounded-md border border-border">
                <File className="w-4 h-4 text-primary" />
                <span className="truncate flex-1">{file.name}</span>
                <span className="text-xs shrink-0">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end">
            <Button onClick={(e) => { e.stopPropagation(); onUpload([...acceptedFiles]); }} disabled={isUploading} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {resolvedButtonLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
