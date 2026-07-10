"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { UploadCloud, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import { toast } from '@/lib/store/toastStore';

interface PresignResponse {
  upload_id: string;
  presigned_url: string;
  object_key: string;
  expires_in: number;
  headers: Record<string, string>;
}

interface ConfirmResponse {
  upload_id: string;
  file_url: string;
  file_type: string;
  content_type: string;
  file_size: number;
  uploaded_at: string;
}

export type FileType = 'avatar' | 'portfolio' | 'service_photo' | 'category_icon';

interface FileUploadProps {
  /** Tipe file untuk presigned URL */
  fileType: FileType;
  /** Maksimum ukuran file dalam MB (default 5) */
  maxSizeMB?: number;
  /** MIME types yang diizinkan (default: image/*) */
  accept?: string;
  /** URL gambar saat ini (untuk edit mode) */
  currentUrl?: string;
  /** Callback ketika upload berhasil, mengembalikan URL */
  onUploaded?: (url: string) => void;
  /** Callback ketika file dipilih (sebelum upload) */
  onFileSelect?: (file: File | null) => void;
  /** Callback ketika file dihapus */
  onRemove?: () => void;
  /** Preview width */
  previewWidth?: number;
  /** Preview height */
  previewHeight?: number;
  /** Apakah boleh kosong */
  optional?: boolean;
  /** Label untuk file */
  label?: string;
  className?: string;
}

export function FileUpload({
  fileType,
  maxSizeMB = 5,
  accept = 'image/jpeg,image/png,image/webp',
  currentUrl,
  onUploaded,
  onFileSelect,
  onRemove,
  previewWidth = 120,
  previewHeight = 120,
  optional = true,
  label,
  className,
}: FileUploadProps) {
  const [preview, setPreview] = useState<string>(currentUrl ?? '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!accept.includes(file.type) && !file.type.startsWith('image/')) {
        return `Tipe file tidak diizinkan. Gunakan: ${accept}`;
      }
      if (file.size > maxSizeBytes) {
        return `Ukuran file maksimal ${maxSizeMB}MB`;
      }
      return null;
    },
    [accept, maxSizeBytes, maxSizeMB],
  );

  const handleFileSelect = useCallback(
    (file: File) => {
      setError('');
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        onFileSelect?.(null);
        return;
      }
      setSelectedFile(file);
      // Create local preview
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      onFileSelect?.(file);
    },
    [validateFile, onFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleRemove = useCallback(() => {
    setSelectedFile(null);
    setPreview('');
    setError('');
    onFileSelect?.(null);
    onRemove?.();
    if (inputRef.current) inputRef.current.value = '';
  }, [onFileSelect, onRemove]);

  const uploadFile = useCallback(async (): Promise<string | null> => {
    if (!selectedFile) return preview || null;

    // If we already have a URL (currentUrl) and no new file selected, return it
    if (!selectedFile && preview) return preview;

    setUploading(true);
    setError('');

    try {
      // Step 1: Get presigned URL
      const presignRes = await fetchAPI<PresignResponse>('/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_type: fileType,
          content_type: selectedFile.type,
          file_size: selectedFile.size,
        }),
      });

      if (!presignRes.success || !presignRes.data) {
        throw new Error(getErrorMessage(presignRes));
      }

      const { presigned_url, upload_id } = presignRes.data;

      // Step 2: Upload to S3 using presigned URL
      const uploadRes = await fetch(presigned_url, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type,
        },
      });

      if (!uploadRes.ok) {
        throw new Error('Gagal mengupload file ke storage');
      }

      // Step 3: Confirm upload
      const confirmRes = await fetchAPI<ConfirmResponse>('/upload/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upload_id,
          file_type: fileType,
        }),
      });

      if (!confirmRes.success || !confirmRes.data) {
        throw new Error(getErrorMessage(confirmRes));
      }

      const finalUrl = confirmRes.data.file_url;
      setPreview(finalUrl);
      onUploaded?.(finalUrl);
      toast.success('File berhasil diupload');

      return finalUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload gagal';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setUploading(false);
    }
  }, [selectedFile, preview, fileType, onUploaded]);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const hasPreview = !!preview;
  const showRemove = hasPreview && (!optional || preview);

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="text-sm font-medium">
          {label}
          {!optional && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      {hasPreview ? (
        <div className="relative inline-block" style={{ width: previewWidth, height: previewHeight }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full rounded-lg object-cover border border-border"
            style={{ width: previewWidth, height: previewHeight }}
          />
          {/* Upload indicator */}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
              <Loader2 className="size-6 animate-spin text-white" />
            </div>
          )}
          {/* Success indicator */}
          {!uploading && selectedFile && (
            <div className="absolute -bottom-1 -right-1 rounded-full bg-green-500 p-1">
              <CheckCircle className="size-3 text-white" />
            </div>
          )}
          {/* Remove button */}
          {showRemove && !uploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-white shadow-sm hover:bg-destructive/90"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          disabled={uploading}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors',
            'text-muted-foreground hover:text-foreground cursor-pointer',
            dragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/50',
            uploading && 'opacity-50 cursor-not-allowed',
          )}
          style={{ width: previewWidth, height: previewHeight }}
        >
          {uploading ? (
            <>
              <Loader2 className="size-6 animate-spin" />
              <span className="text-xs">Mengupload...</span>
            </>
          ) : (
            <>
              <UploadCloud className="size-6" />
              <span className="text-xs text-center px-2">
                Klik atau drag file
                <br />
                <span className="opacity-60">Max {maxSizeMB}MB</span>
              </span>
            </>
          )}
        </button>
      )}

      {/* Selected file info */}
      {selectedFile && !uploading && (
        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
          {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)}MB)
        </p>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="size-3" />
          {error}
        </div>
      )}

      {/* Hidden input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}

// Export the upload function for programmatic use
export async function uploadFileToStorage(
  file: File,
  fileType: FileType,
): Promise<string | null> {
  const maxSizes: Record<FileType, number> = {
    avatar: 5,
    portfolio: 10,
    service_photo: 10,
    category_icon: 5,
  };

  const maxSizeBytes = (maxSizes[fileType] || 5) * 1024 * 1024;

  if (file.size > maxSizeBytes) {
    toast.error(`Ukuran file maksimal ${maxSizes[fileType]}MB`);
    return null;
  }

  try {
    // Step 1: Get presigned URL
    const presignRes = await fetchAPI<PresignResponse>('/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_type: fileType,
        content_type: file.type,
        file_size: file.size,
      }),
    });

    if (!presignRes.success || !presignRes.data) {
      throw new Error(getErrorMessage(presignRes));
    }

    const { presigned_url, upload_id } = presignRes.data;

    // Step 2: Upload to S3
    const uploadRes = await fetch(presigned_url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!uploadRes.ok) {
      throw new Error('Gagal mengupload file ke storage');
    }

    // Step 3: Confirm upload
    const confirmRes = await fetchAPI<ConfirmResponse>('/upload/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_id,
        file_type: fileType,
      }),
    });

    if (!confirmRes.success || !confirmRes.data) {
      throw new Error(getErrorMessage(confirmRes));
    }

    return confirmRes.data.file_url;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload gagal';
    toast.error(message);
    return null;
  }
}
