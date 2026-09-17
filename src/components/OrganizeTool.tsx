import React, { useState, useEffect } from 'react';
import {
  RotateCw,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Download,
  Upload,
  Sparkles,
  Layers,
  CheckSquare,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PDFDocument } from 'pdf-lib';
import { organizePdf, createSampleDocument } from '../utils/pdfOperations';
import { generatePdfThumbnail } from '../utils/pdfWorker';
import type { PageInfo } from '../types';

interface OrganizeToolProps {
  currentPdfBuffer?: ArrayBuffer | null;
  currentPdfName?: string;
  onPdfLoaded?: (buffer: ArrayBuffer, name: string) => void;
}

export const OrganizeTool: React.FC<OrganizeToolProps> = ({
  currentPdfBuffer,
  currentPdfName = 'Document.pdf',
  onPdfLoaded,
}) => {
  const [activeBuffer, setActiveBuffer] = useState<ArrayBuffer | null>(null);
  const [docName, setDocName] = useState<string>(currentPdfName);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [organizedPdfBytes, setOrganizedPdfBytes] = useState<Uint8Array | null>(null);

  useEffect(() => {
    if (currentPdfBuffer) {
      loadBuffer(currentPdfBuffer, currentPdfName);
    }
  }, [currentPdfBuffer, currentPdfName]);

  const loadBuffer = async (buffer: ArrayBuffer, name: string) => {
    setIsProcessing(true);
    try {
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const count = pdfDoc.getPageCount();
      const pageInfos: PageInfo[] = [];

      for (let i = 0; i < count; i++) {
        const thumb = await generatePdfThumbnail(buffer, i + 1, 160);
        pageInfos.push({
          pageIndex: i,
          pageNumber: i + 1,
          rotation: 0,
          thumbnail: thumb,
        });
      }

      setActiveBuffer(buffer);
      setDocName(name);
      setPages(pageInfos);
      setOrganizedPdfBytes(null);

      if (onPdfLoaded) {
        onPdfLoaded(buffer, name);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    await loadBuffer(buffer, file.name);
  };

  const handleLoadSample = async () => {
    setIsProcessing(true);
    try {
      const sample = await createSampleDocument();
      const safeBuffer = sample.buffer.slice(
        sample.byteOffset,
        sample.byteOffset + sample.byteLength
      );
      await loadBuffer(safeBuffer, 'Sample_Document.pdf');
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const movePage = (index: number, direction: 'left' | 'right') => {
    const target = direction === 'left' ? index - 1 : index + 1;
    if (target < 0 || target >= pages.length) return;
    const copy = [...pages];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    setPages(copy);
    setOrganizedPdfBytes(null);
  };

  const rotatePage = (index: number) => {
    setPages((prev) =>
      prev.map((p, idx) =>
        idx === index ? { ...p, rotation: (p.rotation + 90) % 360 } : p
      )
    );
    setOrganizedPdfBytes(null);
  };

  const rotateAllPages = () => {
    setPages((prev) =>
      prev.map((p) => ({ ...p, rotation: (p.rotation + 90) % 360 }))
    );
    setOrganizedPdfBytes(null);
  };

  const deletePage = (index: number) => {
    if (pages.length <= 1) {
      alert('Document must have at least one page.');
      return;
    }
    setPages((prev) => prev.filter((_, idx) => idx !== index));
    setOrganizedPdfBytes(null);
  };

  const saveOrganizedPdf = async () => {
    if (!activeBuffer || pages.length === 0) return;
    setIsProcessing(true);
    try {
      const config = pages.map((p) => ({
        pageIndex: p.pageIndex,
        rotation: p.rotation,
      }));
      const bytes = await organizePdf(activeBuffer, config);
      setOrganizedPdfBytes(bytes);

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err) {
      console.error(err);
      alert('Failed to reorder and save PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!organizedPdfBytes) return;
    const blob = new Blob([organizedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = docName.replace('.pdf', '');
    a.download = `${baseName}_organized.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <RotateCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Organize & Rotate Pages</h2>
              <p className="text-xs text-slate-400">
                Drag, reorder, rotate individual pages, or delete unnecessary sheets
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!activeBuffer && (
            <button
              id="organize-load-sample-btn"
              type="button"
              onClick={handleLoadSample}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/80 rounded-xl transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Load Sample Document</span>
            </button>
          )}

          {activeBuffer && (
            <div className="flex items-center gap-2">
              <button
                id="organize-rotate-all-btn"
                type="button"
                onClick={rotateAllPages}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
                <span>Rotate All 90°</span>
              </button>

              <button
                id="organize-save-btn"
                type="button"
                onClick={saveOrganizedPdf}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Layers className="w-3.5 h-3.5" />
                )}
                <span>Save New Order</span>
              </button>

              {organizedPdfBytes && (
                <button
                  id="organize-download-btn"
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload Zone */}
      {!activeBuffer && (
        <div className="max-w-2xl mx-auto my-12">
          <label
            htmlFor="organize-file-upload"
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all shadow-inner group"
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-400 flex items-center justify-center transition-colors">
              <Upload className="w-7 h-7" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-white">Upload PDF to Organize Pages</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Rearrange pages, rotate upside-down scans, or delete individual sheets.
              </p>
            </div>
            <input
              id="organize-file-upload"
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Page Cards Grid */}
      {activeBuffer && (
        <div className="space-y-4">
          <div className="text-xs text-slate-400 px-1">
            Current Order: {pages.length} pages in document
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {pages.map((p, idx) => (
              <div
                key={`${p.pageIndex}-${idx}`}
                id={`organize-card-${idx}`}
                className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-3 flex flex-col items-center gap-3 transition-all shadow-md group"
              >
                {/* Header info */}
                <div className="w-full flex items-center justify-between text-xs text-slate-400 px-1">
                  <span className="font-bold text-slate-200">
                    Pos {idx + 1}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Orig Pg {p.pageIndex + 1}
                  </span>
                </div>

                {/* Thumbnail */}
                <div className="w-full h-44 bg-slate-950/80 rounded-xl overflow-hidden flex items-center justify-center p-2 border border-slate-800">
                  {p.thumbnail ? (
                    <img
                      src={p.thumbnail}
                      alt={`Page ${idx + 1}`}
                      className="max-h-full max-w-full object-contain bg-white rounded shadow-sm transition-transform"
                      style={{ transform: `rotate(${p.rotation}deg)` }}
                    />
                  ) : (
                    <div className="text-xs text-slate-500">Page {p.pageIndex + 1}</div>
                  )}
                </div>

                {/* Card Toolbar */}
                <div className="w-full flex items-center justify-between gap-1 pt-1 border-t border-slate-800/80">
                  <div className="flex items-center gap-1">
                    <button
                      id={`page-move-left-${idx}`}
                      type="button"
                      disabled={idx === 0}
                      onClick={() => movePage(idx, 'left')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 cursor-pointer"
                      title="Move Left"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id={`page-move-right-${idx}`}
                      type="button"
                      disabled={idx === pages.length - 1}
                      onClick={() => movePage(idx, 'right')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 cursor-pointer"
                      title="Move Right"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      id={`page-rotate-btn-${idx}`}
                      type="button"
                      onClick={() => rotatePage(idx)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 cursor-pointer"
                      title="Rotate 90° clockwise"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id={`page-delete-btn-${idx}`}
                      type="button"
                      disabled={pages.length <= 1}
                      onClick={() => deletePage(idx)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer disabled:opacity-20"
                      title="Delete this page"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
