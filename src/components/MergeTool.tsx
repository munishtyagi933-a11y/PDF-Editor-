import React, { useState } from 'react';
import {
  Layers,
  Upload,
  ArrowUp,
  ArrowDown,
  Trash2,
  FileCheck,
  Download,
  Plus,
  Sparkles,
  FileText,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PDFDocument } from 'pdf-lib';
import { mergePdfs, createSampleDocument } from '../utils/pdfOperations';
import { generatePdfThumbnail } from '../utils/pdfWorker';
import type { PdfFileItem } from '../types';

interface MergeToolProps {
  onDocumentMerged?: (buffer: ArrayBuffer, name: string) => void;
}

export const MergeTool: React.FC<MergeToolProps> = ({ onDocumentMerged }) => {
  const [fileList, setFileList] = useState<PdfFileItem[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [mergedPdfBytes, setMergedPdfBytes] = useState<Uint8Array | null>(null);
  const [outputFileName, setOutputFileName] = useState('merged_document.pdf');

  // Handle uploaded files
  const handleFilesAdded = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newItems: PdfFileItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        continue;
      }

      try {
        const rawBuffer = await file.arrayBuffer();
        const arrayBuffer = rawBuffer.slice(0);
        const pdfDoc = await PDFDocument.load(arrayBuffer.slice(0), { ignoreEncryption: true });
        const pageCount = pdfDoc.getPageCount();
        const thumbnail = await generatePdfThumbnail(arrayBuffer.slice(0), 1, 140);

        newItems.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          name: file.name,
          size: file.size,
          pageCount,
          arrayBuffer,
          thumbnailUrl: thumbnail,
        });
      } catch (err) {
        console.error('Failed to load PDF:', file.name, err);
      }
    }

    setFileList((prev) => [...prev, ...newItems]);
    setMergedPdfBytes(null);
  };

  // Add 2 realistic sample files for instant test
  const handleAddSampleFiles = async () => {
    setIsMerging(true);
    try {
      const sample1Bytes = await createSampleDocument();
      const buffer1 = sample1Bytes.buffer.slice(
        sample1Bytes.byteOffset,
        sample1Bytes.byteOffset + sample1Bytes.byteLength
      );
      const thumb1 = await generatePdfThumbnail(buffer1.slice(0), 1, 140);

      // Create a second variant for Annexure / Exhibit
      const doc2 = await PDFDocument.create();
      const p = doc2.addPage([595, 842]);
      p.drawText('ANNEXURE B: CERTIFICATION & AUDIT RECORDS', {
        x: 50,
        y: 780,
        size: 14,
      });
      p.drawText('Official Compliance Registry - Document ID #998-ALPHA', {
        x: 50,
        y: 750,
        size: 10,
      });
      p.drawText('All security scans passed with 100% data integrity verified.', {
        x: 50,
        y: 720,
        size: 10,
      });
      const sample2Bytes = await doc2.save();
      const buffer2 = sample2Bytes.buffer.slice(
        sample2Bytes.byteOffset,
        sample2Bytes.byteOffset + sample2Bytes.byteLength
      );
      const thumb2 = await generatePdfThumbnail(buffer2.slice(0), 1, 140);

      setFileList([
        {
          id: `sample-msa-${Date.now()}`,
          name: 'Master_Services_Agreement_2026.pdf',
          size: buffer1.byteLength,
          pageCount: 2,
          arrayBuffer: buffer1,
          thumbnailUrl: thumb1,
        },
        {
          id: `sample-annexure-${Date.now()}`,
          name: 'Annexure_B_Audit_Records.pdf',
          size: buffer2.byteLength,
          pageCount: 1,
          arrayBuffer: buffer2,
          thumbnailUrl: thumb2,
        },
      ]);
      setMergedPdfBytes(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsMerging(false);
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= fileList.length) return;
    const updated = [...fileList];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setFileList(updated);
  };

  const removeItem = (id: string) => {
    setFileList((prev) => prev.filter((item) => item.id !== id));
    setMergedPdfBytes(null);
  };

  const executeMerge = async () => {
    if (fileList.length < 2) return;
    setIsMerging(true);
    try {
      const buffers = fileList.map((f) => f.arrayBuffer);
      const mergedBytes = await mergePdfs(buffers);
      setMergedPdfBytes(mergedBytes);

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      if (onDocumentMerged) {
        onDocumentMerged(mergedBytes.buffer as ArrayBuffer, outputFileName);
      }
    } catch (err) {
      console.error('Merge failed:', err);
      alert('Could not merge the selected files. Please check if any are password protected.');
    } finally {
      setIsMerging(false);
    }
  };

  const handleDownload = () => {
    if (!mergedPdfBytes) return;
    const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outputFileName.endsWith('.pdf') ? outputFileName : `${outputFileName}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalPages = fileList.reduce((sum, item) => sum + item.pageCount, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Merge PDF Files</h2>
              <p className="text-xs text-slate-400">
                Combine multiple PDFs into a single unified document with custom ordering
              </p>
            </div>
          </div>
        </div>

        {fileList.length === 0 && (
          <button
            id="merge-try-samples-btn"
            type="button"
            onClick={handleAddSampleFiles}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/80 rounded-xl transition-all cursor-pointer shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Load 2 Sample Documents</span>
          </button>
        )}
      </div>

      {/* Upload Zone */}
      <div className="mb-6">
        <label
          htmlFor="merge-file-input"
          className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all shadow-inner group"
        >
          <div className="w-12 h-12 rounded-full bg-slate-800 group-hover:bg-indigo-600/20 flex items-center justify-center transition-colors">
            <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-white">
              Drop your PDF files here, or <span className="text-indigo-400 underline">browse</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Select 2 or more files to combine. All files process client-side with 100% privacy.
            </p>
          </div>
          <input
            id="merge-file-input"
            type="file"
            multiple
            accept="application/pdf"
            onChange={(e) => handleFilesAdded(e.target.files)}
            className="hidden"
          />
        </label>
      </div>

      {/* File List */}
      {fileList.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-300">
              Files to merge ({fileList.length}) • Total {totalPages} pages
            </span>
            <label
              htmlFor="merge-add-more-input"
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add More Files</span>
              <input
                id="merge-add-more-input"
                type="file"
                multiple
                accept="application/pdf"
                onChange={(e) => handleFilesAdded(e.target.files)}
                className="hidden"
              />
            </label>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 gap-3">
            {fileList.map((item, idx) => (
              <div
                key={item.id}
                id={`merge-item-${idx}`}
                className="flex items-center justify-between p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-xl hover:border-slate-600 transition-colors gap-4"
              >
                {/* Index badge & Thumbnail */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-md bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.name}
                      className="w-10 h-14 object-cover rounded border border-slate-600 shadow-sm shrink-0 bg-white"
                    />
                  ) : (
                    <div className="w-10 h-14 rounded bg-slate-700 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                    <p className="text-xs text-slate-400">
                      {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'} •{' '}
                      {(item.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>

                {/* Actions: Reorder & Delete */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    id={`move-up-btn-${idx}`}
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveItem(idx, 'up')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-20 cursor-pointer"
                    title="Move Up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    id={`move-down-btn-${idx}`}
                    type="button"
                    disabled={idx === fileList.length - 1}
                    onClick={() => moveItem(idx, 'down')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-20 cursor-pointer"
                    title="Move Down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    id={`remove-file-btn-${idx}`}
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700 cursor-pointer ml-1"
                    title="Remove File"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Merge Controls & Output Configuration */}
          <div className="mt-8 p-5 bg-slate-800/40 border border-slate-700 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="w-full sm:w-auto flex-1 max-w-sm">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Merged PDF File Name
              </label>
              <input
                id="merge-filename-input"
                type="text"
                value={outputFileName}
                onChange={(e) => setOutputFileName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                id="merge-execute-btn"
                type="button"
                onClick={executeMerge}
                disabled={fileList.length < 2 || isMerging}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                  fileList.length < 2 || isMerging
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                }`}
              >
                {isMerging ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Layers className="w-4 h-4" />
                )}
                <span>{isMerging ? 'Merging Documents...' : 'Merge PDFs Now'}</span>
              </button>

              {mergedPdfBytes && (
                <button
                  id="merge-download-btn"
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Merged PDF</span>
                </button>
              )}
            </div>
          </div>

          {/* Success Banner */}
          {mergedPdfBytes && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800/80 rounded-xl flex items-center justify-between gap-3 text-emerald-300 text-xs">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Successfully merged {fileList.length} files ({totalPages} pages total) into{' '}
                  <strong className="text-white">{outputFileName}</strong>!
                </span>
              </div>
              <span className="font-semibold text-emerald-400">
                {(mergedPdfBytes.byteLength / 1024).toFixed(1)} KB
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
