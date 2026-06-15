'use client';

import { ImagePlus, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';

type Props = {
  files: File[];
  onFiles: (files: File[]) => void;
  urls: string;
  onUrls: (value: string) => void;
  accept?: string;
  multiple?: boolean;
  label?: string;
  fieldLabel?: string;
  urlLabel?: string;
};

const imageCompressTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const imageCompressMaxEdge = 2560;
const imageCompressMinBytes = 1024 * 1024;

function replaceExtension(name: string, ext: string) {
  return name.replace(/\.[a-z0-9]+$/i, '') + ext;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

async function compressImageFile(file: File) {
  if (!imageCompressTypes.has(file.type) || file.size < imageCompressMinBytes || typeof createImageBitmap !== 'function') {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const scale = Math.min(1, imageCompressMaxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && file.size < 2.5 * imageCompressMinBytes) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', { alpha: file.type === 'image/png' });
    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const outputType = file.type === 'image/png' ? 'image/webp' : file.type;
    const blob = await canvasToBlob(canvas, outputType, outputType === 'image/webp' ? 0.82 : 0.84);
    if (!blob || blob.size >= file.size) return file;

    const outputName = outputType === file.type
      ? file.name
      : replaceExtension(file.name, outputType === 'image/webp' ? '.webp' : '.jpg');
    return new File([blob], outputName, { type: outputType, lastModified: Date.now() });
  } catch {
    return file;
  }
}

export function MediaDropzone({
  files,
  onFiles,
  urls,
  onUrls,
  accept = 'image/*',
  multiple = true,
  label = '上传图片',
  fieldLabel = '图片 URL',
  urlLabel = multiple ? '粘贴图片 URL，多个用换行分隔' : '粘贴图片 URL'
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [compressing, setCompressing] = useState(false);

  async function addFiles(list: FileList | File[]) {
    setCompressing(true);
    try {
      const prepared = await Promise.all(Array.from(list).map(compressImageFile));
      const next = multiple ? files.concat(prepared) : prepared.slice(0, 1);
      onFiles(next.slice(0, multiple ? 12 : 1));
    } finally {
      setCompressing(false);
    }
  }

  return (
    <div
      className={dragging ? 'dropzone dragging' : 'dropzone'}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void addFiles(event.dataTransfer.files);
      }}
    >
      <label className="url-field">
        <span>{fieldLabel}</span>
        <div className="media-url-row">
          {multiple ? (
            <textarea value={urls} onChange={(event) => onUrls(event.target.value)} placeholder={urlLabel} rows={1} />
          ) : (
            <input value={urls} onChange={(event) => onUrls(event.target.value)} placeholder={urlLabel} />
          )}
          <button type="button" className="drop-main" onClick={() => inputRef.current?.click()} disabled={compressing}>
            <UploadCloud size={17} />
            <span>{compressing ? '优化中' : label}</span>
          </button>
        </div>
      </label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(event) => {
          if (event.target.files) void addFiles(event.target.files);
          event.currentTarget.value = '';
        }}
      />
      {files.length > 0 && (
        <div className="file-chips">
          {files.map((file, index) => (
            <button key={`${file.name}-${index}`} type="button" onClick={() => onFiles(files.filter((_, i) => i !== index))}>
              <ImagePlus size={13} />
              {file.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
