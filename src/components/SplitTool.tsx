import React, { useState, useEffect } from 'react';
import {
  Scissors,
  Download,
  Upload,
  Sparkles,
  Check,
  FileText,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PDFDocument } from 'pdf-lib';
import { extractPagesFromPdf, createSampleDocument } from '../utils/pdfOperations';
import { generatePdfThumbnail } from '../utils/pdfWorker';
import type { PageInfo } from '../types';

interface SplitToolProps {
  currentPdfBuffer?: ArrayBuffer | null;
  currentPdfName?: string;
  onPdfLoaded?: (buffer: ArrayBuffer, name: string) => void;
}

export const SplitTool: React.FC<SplitToolProps> = ({
  currentPdfBuffer,
  currentPdfName = 'Document.pdf',
  onPdfLoaded,
}) => {
  const [activeBuffer, setActiveBuffer] = useState<ArrayBuffer | null>(null);
  const [docName, setDocName] = useState<string>(currentPdfName);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [selectedPageIndices, setSelectedPageIndices] = useState<number[]>([]);
  const [rangeInput, setRangeInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [extractedPdfBytes, setExtractedPdfBytes] = useState<Uint8Array | null>(null);

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
      // default select page 1
      setSelectedPageIndices([0]);
      setRangeInput('1');
      setExtractedPdfBytes(null);

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
      await loadBuffer(safeBuffer, 'Sample_Agreement.pdf');
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const togglePageSelection = (index: number) => {
    const updated = selectedPageIndices.includes(index)
      ? selectedPageIndices.filter((i) => i !== index)
      : [...selectedPageIndices, index].sort((a, b) => a - b);
    setSelectedPageIndices(updated);
    setRangeInput(updated.map((i) => i + 1).join(', '));
    setExtractedPdfBytes(null);
  };

  const selectAll = () => {
    const all = pages.map((p) => p.pageIndex);
    setSelectedPageIndices(all);
    setRangeInput(all.map((i) => i + 1).join(', '));
    setExtractedPdfBytes(null);
  };

  const deselectAll = () => {
    setSelectedPageIndices([]);
    setRangeInput('');
    setExtractedPdfBytes(null);
  };

  const handleRangeInputChange = (input: string) => {
    setRangeInput(input);
    const parsed: number[] = [];
    const parts = input.split(',');
    for (const part of parts) {
      const clean = part.trim();
      if (clean.includes('-')) {
        const [startStr, endStr] = clean.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          for (let p = Math.min(start, end); p <= Math.max(start, end); p++) {
            if (p >= 1 && p <= pages.length) {
              parsed.push(p - 1);
            }
          }
        }
      } else {
        const p = parseInt(clean, 10);
        if (!isNaN(p) && p >= 1 && p <= pages.length) {
          parsed.push(p - 1);
        }
      }
    }
    const uniqueSorted = Array.from(new Set(parsed)).sort((a, b) => a - b);
    setSelectedPageIndices(uniqueSorted);
    setExtractedPdfBytes(null);
  };

  const handleExtract = async () => {
    if (!activeBuffer || selectedPageIndices.length === 0) return;
    setIsProcessing(true);
    try {
      const extractedBytes = await extractPagesFromPdf(activeBuffer, selectedPageIndices);
      setExtractedPdfBytes(extractedBytes);

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err) {
      console.error(err);
      alert('Failed to extract selected pages.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!extractedPdfBytes) return;
    const blob = new Blob([extractedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = docName.replace('.pdf', '');
    a.download = `${baseName}_extracted_pages.pdf`;
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
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Split & Extract Pages</h2>
              <p className="text-xs text-slate-400">
                Extract specific pages or page ranges into a separate, standalone PDF document
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!activeBuffer && (
            <button
              id="split-load-sample-btn"
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
                id="split-extract-btn"
                type="button"
                onClick={handleExtract}
                disabled={selectedPageIndices.length === 0 || isProcessing}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-40"
              >
                {isProcessing ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Scissors className="w-3.5 h-3.5" />
                )}
                <span>Extract {selectedPageIndices.length} Pages</span>
              </button>

              {extractedPdfBytes && (
                <button
                  id="split-download-btn"
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Extracted PDF</span>
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
            htmlFor="split-file-upload"
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all shadow-inner group"
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-400 flex items-center justify-center transition-colors">
              <Upload className="w-7 h-7" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-white">Upload PDF to Extract Pages</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Pick individual pages or type custom page numbers (e.g. 1, 3-5).
              </p>
            </div>
            <input
              id="split-file-upload"
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Page Selector */}
      {activeBuffer && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-xs text-slate-400">Page Range:</span>
              <input
                id="split-range-input"
                type="text"
                value={rangeInput}
                onChange={(e) => handleRangeInputChange(e.target.value)}
                placeholder="e.g. 1, 2-3"
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36"
              />
              <span className="text-xs text-slate-500">
                ({selectedPageIndices.length} of {pages.length} selected)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="split-select-all-btn"
                type="button"
                onClick={selectAll}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                Select All
              </button>
              <button
                id="split-deselect-all-btn"
                type="button"
                onClick={deselectAll}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                Clear Selection
              </button>
            </div>
          </div>

          {/* Page Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {pages.map((p, idx) => {
              const isSelected = selectedPageIndices.includes(p.pageIndex);
              return (
                <div
                  key={p.pageNumber}
                  id={`split-page-card-${idx}`}
                  onClick={() => togglePageSelection(p.pageIndex)}
                  className={`bg-slate-900 rounded-2xl p-3 flex flex-col items-center gap-3 transition-all cursor-pointer border relative group ${
                    isSelected
                      ? 'border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg'
                      : 'border-slate-800 hover:border-slate-700 opacity-70 hover:opacity-90'
                  }`}
                >
                  {/* Select badge */}
                  <div
                    className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center transition-colors shadow-sm ${
                      isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 border border-slate-600 text-transparent'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </div>

                  <span className="text-xs font-bold text-slate-300 self-start px-1">
                    Page {p.pageNumber}
                  </span>

                  <div className="w-full h-44 bg-slate-950/80 rounded-xl overflow-hidden flex items-center justify-center p-2 border border-slate-800">
                    {p.thumbnail ? (
                      <img
                        src={p.thumbnail}
                        alt={`Page ${p.pageNumber}`}
                        className="max-h-full max-w-full object-contain bg-white rounded shadow-sm"
                      />
                    ) : (
                      <div className="text-xs text-slate-500">Page {p.pageNumber}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
