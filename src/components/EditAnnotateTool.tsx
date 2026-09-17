import React, { useState, useEffect } from 'react';
import {
  FileEdit,
  Type,
  Highlighter,
  Square,
  Stamp,
  RotateCw,
  Trash2,
  Download,
  Upload,
  Sparkles,
  Check,
  Undo2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PDFDocument, degrees } from 'pdf-lib';
import { InteractiveCanvasEditor } from './InteractiveCanvasEditor';
import { createSampleDocument, applyAnnotationsToPdf } from '../utils/pdfOperations';
import { generatePdfThumbnail } from '../utils/pdfWorker';
import type { AnnotationItem, PageInfo } from '../types';

interface EditAnnotateToolProps {
  currentPdfBuffer?: ArrayBuffer | null;
  currentPdfName?: string;
  onPdfLoaded?: (buffer: ArrayBuffer, name: string) => void;
}

export const EditAnnotateTool: React.FC<EditAnnotateToolProps> = ({
  currentPdfBuffer,
  currentPdfName = 'Document.pdf',
  onPdfLoaded,
}) => {
  const [activePdfBuffer, setActivePdfBuffer] = useState<ArrayBuffer | null>(null);
  const [docName, setDocName] = useState<string>(currentPdfName);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Active Tool Selection
  const [activeTool, setActiveTool] = useState<
    'select' | 'text' | 'highlight' | 'redact' | 'stamp' | 'check'
  >('select');
  const [textColor, setTextColor] = useState<string>('#0f172a');
  const [textSize, setTextSize] = useState<number>(14);
  const [stampText, setStampText] = useState<string>('APPROVED');

  useEffect(() => {
    if (currentPdfBuffer) {
      loadBuffer(currentPdfBuffer, currentPdfName);
    }
  }, [currentPdfBuffer, currentPdfName]);

  const loadBuffer = async (buffer: ArrayBuffer, name: string) => {
    try {
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const count = pdfDoc.getPageCount();
      const pageInfos: PageInfo[] = [];

      for (let i = 0; i < count; i++) {
        const thumb = await generatePdfThumbnail(buffer, i + 1, 100);
        pageInfos.push({
          pageIndex: i,
          pageNumber: i + 1,
          rotation: 0,
          thumbnail: thumb,
        });
      }

      setActivePdfBuffer(buffer);
      setDocName(name);
      setPages(pageInfos);
      setCurrentPageIndex(0);
      setAnnotations([]);

      if (onPdfLoaded) {
        onPdfLoaded(buffer, name);
      }
    } catch (err) {
      console.error('Error loading PDF in EditTool:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const rawBuffer = await file.arrayBuffer();
    await loadBuffer(rawBuffer.slice(0), file.name);
  };

  const handleLoadSample = async () => {
    setIsProcessing(true);
    try {
      const sampleBytes = await createSampleDocument();
      const safeBuffer = sampleBytes.buffer.slice(
        sampleBytes.byteOffset,
        sampleBytes.byteOffset + sampleBytes.byteLength
      );
      await loadBuffer(safeBuffer, 'Sample_Document.pdf');
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Add Annotation Helper
  const addAnnotation = (
    type: 'text' | 'highlight' | 'redact' | 'stamp' | 'checkmark',
    coords?: { xPercent: number; yPercent: number }
  ) => {
    const x = coords ? coords.xPercent : 35;
    const y = coords ? coords.yPercent : 35;

    let newAnnot: AnnotationItem;

    if (type === 'text') {
      newAnnot = {
        id: `text-${Date.now()}`,
        type: 'text',
        pageIndex: currentPageIndex,
        xPercent: x,
        yPercent: y,
        widthPercent: 28,
        heightPercent: 5,
        text: 'Click to edit text',
        fontSize: textSize,
        color: textColor,
      };
    } else if (type === 'highlight') {
      newAnnot = {
        id: `hl-${Date.now()}`,
        type: 'highlight',
        pageIndex: currentPageIndex,
        xPercent: x,
        yPercent: y,
        widthPercent: 32,
        heightPercent: 4,
        color: '#fef08a', // Yellow highlight
      };
    } else if (type === 'redact') {
      newAnnot = {
        id: `redact-${Date.now()}`,
        type: 'redact',
        pageIndex: currentPageIndex,
        xPercent: x,
        yPercent: y,
        widthPercent: 25,
        heightPercent: 4,
      };
    } else if (type === 'stamp') {
      newAnnot = {
        id: `stamp-${Date.now()}`,
        type: 'stamp',
        pageIndex: currentPageIndex,
        xPercent: x,
        yPercent: y,
        widthPercent: 24,
        heightPercent: 7,
        text: stampText,
        color: stampText === 'APPROVED' ? '#16a34a' : '#dc2626',
      };
    } else {
      newAnnot = {
        id: `chk-${Date.now()}`,
        type: 'checkmark',
        pageIndex: currentPageIndex,
        xPercent: x,
        yPercent: y,
        widthPercent: 5,
        heightPercent: 5,
      };
    }

    setAnnotations((prev) => [...prev, newAnnot]);
  };

  // Canvas click handler
  const handleCanvasClick = (percentX: number, percentY: number) => {
    if (activeTool === 'text') {
      addAnnotation('text', { xPercent: percentX, yPercent: percentY });
      setActiveTool('select');
    } else if (activeTool === 'highlight') {
      addAnnotation('highlight', { xPercent: percentX, yPercent: percentY });
      setActiveTool('select');
    } else if (activeTool === 'redact') {
      addAnnotation('redact', { xPercent: percentX, yPercent: percentY });
      setActiveTool('select');
    } else if (activeTool === 'stamp') {
      addAnnotation('stamp', { xPercent: percentX, yPercent: percentY });
      setActiveTool('select');
    } else if (activeTool === 'check') {
      addAnnotation('checkmark', { xPercent: percentX, yPercent: percentY });
      setActiveTool('select');
    }
  };

  // Rotate Active Page
  const rotateCurrentPage = async () => {
    if (!activePdfBuffer) return;
    setIsProcessing(true);
    try {
      const pdfDoc = await PDFDocument.load(activePdfBuffer, { ignoreEncryption: true });
      const page = pdfDoc.getPage(currentPageIndex);
      const currentAngle = page.getRotation().angle;
      page.setRotation(degrees((currentAngle + 90) % 360));
      const newBuffer = (await pdfDoc.save()).buffer as ArrayBuffer;

      // Update thumbnail
      const newThumb = await generatePdfThumbnail(newBuffer, currentPageIndex + 1, 100);
      setPages((prev) =>
        prev.map((p, i) =>
          i === currentPageIndex ? { ...p, rotation: (p.rotation + 90) % 360, thumbnail: newThumb } : p
        )
      );
      setActivePdfBuffer(newBuffer);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete Active Page
  const deleteCurrentPage = async () => {
    if (!activePdfBuffer || pages.length <= 1) {
      alert('A document must have at least 1 page remaining.');
      return;
    }
    if (!confirm(`Delete page ${currentPageIndex + 1}?`)) return;

    setIsProcessing(true);
    try {
      const pdfDoc = await PDFDocument.load(activePdfBuffer, { ignoreEncryption: true });
      pdfDoc.removePage(currentPageIndex);
      const newBuffer = (await pdfDoc.save()).buffer as ArrayBuffer;

      // Remap annotations
      setAnnotations((prev) =>
        prev
          .filter((a) => a.pageIndex !== currentPageIndex)
          .map((a) => (a.pageIndex > currentPageIndex ? { ...a, pageIndex: a.pageIndex - 1 } : a))
      );

      // Re-index pages
      const newPages = pages
        .filter((_, idx) => idx !== currentPageIndex)
        .map((p, idx) => ({ ...p, pageIndex: idx, pageNumber: idx + 1 }));

      setPages(newPages);
      setCurrentPageIndex(Math.max(0, currentPageIndex - 1));
      setActivePdfBuffer(newBuffer);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Export Modified Document
  const handleExport = async () => {
    if (!activePdfBuffer) return;
    setIsProcessing(true);
    try {
      const editedBytes = await applyAnnotationsToPdf(activePdfBuffer, annotations);

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      const blob = new Blob([editedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = docName.replace('.pdf', '');
      a.download = `${baseName}_edited.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Could not export the edited document.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Edit & Annotate PDF</h2>
              <p className="text-xs text-slate-400">
                Add text annotations, highlight key phrases, blackout confidential details, and apply stamps
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!activePdfBuffer && (
            <button
              id="edit-load-sample-btn"
              type="button"
              onClick={handleLoadSample}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/80 rounded-xl transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Load Sample Document</span>
            </button>
          )}

          {activePdfBuffer && (
            <button
              id="edit-export-btn"
              type="button"
              onClick={handleExport}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              {isProcessing ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Export Edited PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Upload Zone if empty */}
      {!activePdfBuffer && (
        <div className="max-w-2xl mx-auto my-12">
          <label
            htmlFor="edit-file-upload"
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all shadow-inner group"
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-400 flex items-center justify-center transition-colors">
              <Upload className="w-7 h-7" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-white">Upload PDF to Edit</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Add text, annotations, highlights, blackout redactions, and rotate pages with ease.
              </p>
            </div>
            <input
              id="edit-file-upload"
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Main Editor */}
      {activePdfBuffer && (
        <div className="space-y-4">
          {/* Top Quick Actions Toolbar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            {/* Tool buttons */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                id="tool-btn-text"
                type="button"
                onClick={() => addAnnotation('text')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTool === 'text'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Type className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-normal break-words">+ Text Box</span>
              </button>

              <button
                id="tool-btn-highlight"
                type="button"
                onClick={() => addAnnotation('highlight')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTool === 'highlight'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Highlighter className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                <span className="whitespace-normal break-words">+ Highlight</span>
              </button>

              <button
                id="tool-btn-redact"
                type="button"
                onClick={() => addAnnotation('redact')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTool === 'redact'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Square className="w-3.5 h-3.5 text-slate-400 fill-slate-400 shrink-0" />
                <span className="whitespace-normal break-words">+ Redact</span>
              </button>

              {/* Stamps */}
              <div className="flex flex-wrap items-center gap-1 sm:border-l sm:border-slate-700 sm:pl-2">
                <button
                  id="tool-stamp-approved"
                  type="button"
                  onClick={() => {
                    setStampText('APPROVED');
                    addAnnotation('stamp');
                  }}
                  className="px-2.5 py-1.5 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/80 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-normal break-words"
                >
                  ✓ APPROVED
                </button>
                <button
                  id="tool-stamp-confidential"
                  type="button"
                  onClick={() => {
                    setStampText('CONFIDENTIAL');
                    addAnnotation('stamp');
                  }}
                  className="px-2.5 py-1.5 bg-rose-950/50 hover:bg-rose-900/60 text-rose-400 border border-rose-800/80 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-normal break-words"
                >
                  CONFIDENTIAL
                </button>
              </div>
            </div>

            {/* Page Manipulation Actions */}
            <div className="flex flex-wrap items-center gap-2 sm:border-l sm:border-slate-700 sm:pl-3">
              <button
                id="edit-rotate-page-btn"
                type="button"
                onClick={rotateCurrentPage}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                title="Rotate current page 90 degrees clockwise"
              >
                <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
                <span>Rotate Page</span>
              </button>

              <button
                id="edit-delete-page-btn"
                type="button"
                onClick={deleteCurrentPage}
                disabled={pages.length <= 1 || isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-950/80 text-slate-300 hover:text-rose-400 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-30"
                title="Delete current page"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Page</span>
              </button>
            </div>
          </div>

          {/* Editor Grid: Left Thumbnail Rail + Center Canvas */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            {/* Thumbnail Rail */}
            <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-3 max-h-[600px] overflow-y-auto space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1 block">
                Pages ({pages.length})
              </span>
              <div className="space-y-2">
                {pages.map((p, idx) => (
                  <div
                    key={p.pageNumber}
                    id={`page-thumb-${idx}`}
                    onClick={() => setCurrentPageIndex(idx)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                      currentPageIndex === idx
                        ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/30'
                        : 'bg-slate-800/50 border-slate-700/60 hover:border-slate-600'
                    }`}
                  >
                    {p.thumbnail ? (
                      <img
                        src={p.thumbnail}
                        alt={`Page ${p.pageNumber}`}
                        className="w-24 h-32 object-contain bg-white rounded shadow-sm border border-slate-600"
                        style={{ transform: `rotate(${p.rotation}deg)` }}
                      />
                    ) : (
                      <div className="w-24 h-32 bg-slate-800 rounded flex items-center justify-center text-xs text-slate-500">
                        Page {p.pageNumber}
                      </div>
                    )}
                    <span className="text-[11px] font-semibold text-slate-300">
                      Page {p.pageNumber}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Canvas Editor */}
            <div className="lg:col-span-4">
              <InteractiveCanvasEditor
                pdfBuffer={activePdfBuffer}
                currentPageIndex={currentPageIndex}
                totalPageCount={pages.length}
                onPageChange={setCurrentPageIndex}
                annotations={annotations}
                onUpdateAnnotation={(id, updates) =>
                  setAnnotations((prev) =>
                    prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
                  )
                }
                onDeleteAnnotation={(id) =>
                  setAnnotations((prev) => prev.filter((item) => item.id !== id))
                }
                onCanvasClick={handleCanvasClick}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
