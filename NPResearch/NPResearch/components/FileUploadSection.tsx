/**
 * File Upload Section Component
 *
 * Unified upload zone for all documents:
 * - Form 990s (financial data)
 * - Provider Profiles (organization info)
 * - Quality Service Reviews (performance metrics)
 *
 * Gemini determines document types from content - no tagging needed.
 */

import React from 'react';
import { UploadedFile } from '../types';

// File validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export const validateFile = (file: File): string | null => {
  if (file.size > MAX_FILE_SIZE) {
    return `File "${file.name}" exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
  }
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return `File "${file.name}" has unsupported type "${file.type}". Allowed: PDF, PNG, JPEG`;
  }
  return null;
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

interface FileUploadSectionProps {
  files: UploadedFile[];
  onFilesAdd: (files: UploadedFile[]) => void;
  onFileRemove: (index: number) => void;
  onError: (error: string) => void;
}

const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  files,
  onFilesAdd,
  onFileRemove,
  onError,
}) => {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: UploadedFile[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const validationError = validateFile(file);
        if (validationError) {
          onError(validationError);
          return;
        }
        const base64 = await fileToBase64(file);
        newFiles.push({
          name: file.name,
          type: file.type,
          base64
        });
      }
      onFilesAdd(newFiles);
    }
  };

  return (
    <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-700">
        <i className="fa-solid fa-cloud-arrow-up text-indigo-500"></i>
        Upload Documents
      </h2>
      <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-indigo-400 transition-colors group relative">
        <input
          type="file"
          multiple
          accept="application/pdf,image/*"
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <i className="fa-solid fa-file-pdf text-3xl text-slate-300 group-hover:text-indigo-400 transition-colors mb-2"></i>
        <p className="text-slate-600 font-medium text-sm">Drop 990s, Provider Profiles & QSRs</p>
        <p className="text-slate-400 text-xs mt-1">or click to browse</p>
      </div>
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-3 overflow-hidden">
                <i className="fa-solid fa-file-lines text-indigo-500 text-xs"></i>
                <span className="text-xs text-slate-700 truncate font-medium">{f.name}</span>
              </div>
              <button
                onClick={() => onFileRemove(i)}
                className="text-slate-400 hover:text-red-500 transition-colors p-1"
                aria-label={`Remove file ${f.name}`}
                title={`Remove ${f.name}`}
              >
                <i className="fa-solid fa-xmark text-xs" aria-hidden="true"></i>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default FileUploadSection;
