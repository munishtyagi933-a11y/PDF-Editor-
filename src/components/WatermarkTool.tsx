import React, { useState, useEffect } from 'react';
import {
  Stamp,
  Download,
  Upload,
  Sparkles,
  FileCheck,
  Type,
  Hash,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PDFDocument } from 'pdf-lib';
import { addWatermarkAndPageNumbers, createSampleDocument } from '../utils/pdfOperations';
import { renderPdfPageToCanvas } from '../utils/pdfWorker';

interface WatermarkToolProps {
  currentPdfBuffer?: ArrayBuffer | null;
  currentPdfName?: string;
  onPdfLoaded?: (buffer: ArrayBuffer, name: string) => void;
}

export const WatermarkTool: React.FC<WatermarkToolProps> = ({
  currentPdfBuffer,
  currentPdfName = 'Document.pdf',
  onPdfLoaded,
}) => {
  const [activeBuffer, setActiveBuffer] = useState<ArrayBuffer | null>(null);
  const [docName, setDocName] = useState<string>(currentPdfName);
  const [pageCount, setPageCount] = useState<number>(1);

  // Watermark Settings
  const [watermarkText, setWatermarkText] = useState<string>('CONFIDENTIAL');
  const [opacity, setOpacity] = useState<number>(0.2);
  const [colorHex, setColorHex] = useState<string>('#94a3b8');

  // Page Numbers Settings
  const [includePageNumbers, setIncludePageNumbers] = useState<boolean>(true);
  const [pageFormat, setPageFormat] = useState<'standard' | 'page_of_total'>('page_of_total');
  const [pagePosition, setPagePosition] = useState<'bottom-center' | 'bottom-right' | 'top-right'>('bottom-center');

  // Processing & Export
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processedBuffer, setProcessedBuffer] = useState<ArrayBuffer | null>(null);

  useEffect(() => {
    if (currentPdfBuffer) {
      loadBuffer(currentPdfBuffer, currentPdfName);
    }
  }, [currentPdfBuffer, currentPdfName]);

  const loadBuffer = async (buffer: ArrayBuffer, name: string) => {
    try {
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      setActiveBuffer(buffer);
      setDocName(name);
      setPageCount(pdfDoc.getPageCount());
      setProcessedBuffer(null);

      if (onPdfLoaded) {
        onPdfLoaded(buffer, name);
      }
    } catch (err) {
      console.error(err);
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

  const handleApplyWatermark = async () => {
    if (!activeBuffer) return;
    setIsProcessing(true);
    try {
      const bytes = await addWatermarkAndPageNumbers(activeBuffer, {
        watermarkText: watermarkText.trim(),
        watermarkOpacity: opacity,
        watermarkColor: colorHex,
        includePageNumbers,
        pageNumberFormat: pageFormat,
        pageNumberPosition: pagePosition,
      });

      setProcessedBuffer(bytes.buffer as ArrayBuffer);

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      // Trigger download
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = docName.replace('.pdf', '');
      a.download = `${baseName}_watermarked.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to apply watermark.');
    } finally {
      setIsProcessing(false);
    }
  };

  const presetWatermarks = [
    'CONFIDENTIAL',
    'DRAFT',
    'FOR REVIEW ONLY',
    'MUNISH TYAGI',
    'ORIGINAL',
    'COPY',
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <Stamp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Watermark & Page Numbers</h2>
              <p className="text-xs text-slate-400">
                Protect documents with diagonal security watermarks and sequential page numbers
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!activeBuffer && (
            <button
              id="watermark-load-sample-btn"
              type="button"
              onClick={handleLoadSample}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/80 rounded-xl transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Load Sample Document</span>
            </button>
          )}

          {activeBuffer && (
            <button
              id="watermark-apply-btn"
              type="button"
              onClick={handleApplyWatermark}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              {isProcessing ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Apply & Download PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Upload Zone */}
      {!activeBuffer && (
        <div className="max-w-2xl mx-auto my-12">
          <label
            htmlFor="watermark-file-upload"
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all shadow-inner group"
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-400 flex items-center justify-center transition-colors">
              <Upload className="w-7 h-7" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-white">Upload PDF to Watermark</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Add diagonal text stamps and formatted page numbering across all pages.
              </p>
            </div>
            <input
              id="watermark-file-upload"
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Controls Form */}
      {activeBuffer && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Watermark Section */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Type className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Watermark Settings
              </h3>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Watermark Text
              </label>
              <input
                id="watermark-text-input"
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder="e.g. CONFIDENTIAL"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Quick presets */}
            <div>
              <span className="text-xs text-slate-400 block mb-1.5">Presets:</span>
              <div className="flex flex-wrap gap-1.5">
                {presetWatermarks.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setWatermarkText(p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      watermarkText === p
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Opacity Slider */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Opacity</span>
                <span>{Math.round(opacity * 100)}%</span>
              </div>
              <input
                id="watermark-opacity-slider"
                type="range"
                min="0.05"
                max="0.8"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Color selection */}
            <div>
              <span className="text-xs text-slate-400 block mb-1.5">Watermark Color</span>
              <div className="flex items-center gap-2">
                {[
                  { name: 'Slate Gray', hex: '#94a3b8' },
                  { name: 'Alert Red', hex: '#ef4444' },
                  { name: 'Royal Blue', hex: '#3b82f6' },
                  { name: 'Indigo', hex: '#6366f1' },
                ].map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setColorHex(c.hex)}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition-all cursor-pointer ${
                      colorHex === c.hex
                        ? 'border-white text-white font-bold'
                        : 'border-slate-700 text-slate-400'
                    }`}
                    style={{ backgroundColor: `${c.hex}25` }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Page Numbers Section */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Hash className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Page Numbering
              </h3>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-xl border border-slate-700">
              <span className="text-xs font-semibold text-slate-200">
                Include Page Numbers
              </span>
              <input
                id="watermark-include-numbers"
                type="checkbox"
                checked={includePageNumbers}
                onChange={(e) => setIncludePageNumbers(e.target.checked)}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
              />
            </div>

            {includePageNumbers && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Number Format
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPageFormat('page_of_total')}
                      className={`p-2.5 text-xs font-medium rounded-xl border transition-all cursor-pointer text-center ${
                        pageFormat === 'page_of_total'
                          ? 'bg-indigo-950/60 border-indigo-500 text-white font-bold'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      Page 1 of {pageCount}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPageFormat('standard')}
                      className={`p-2.5 text-xs font-medium rounded-xl border transition-all cursor-pointer text-center ${
                        pageFormat === 'standard'
                          ? 'bg-indigo-950/60 border-indigo-500 text-white font-bold'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      1, 2, 3...
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Position
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'bottom-center', label: 'Bottom Center' },
                      { id: 'bottom-right', label: 'Bottom Right' },
                      { id: 'top-right', label: 'Top Right' },
                    ].map((pos) => (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() => setPagePosition(pos.id as any)}
                        className={`p-2 text-[11px] font-medium rounded-xl border transition-all cursor-pointer text-center ${
                          pagePosition === pos.id
                            ? 'bg-indigo-950/60 border-indigo-500 text-white font-bold'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Document Info */}
            <div className="p-3 bg-slate-800/40 rounded-xl text-xs text-slate-400">
              Document: <strong className="text-slate-200">{docName}</strong> ({pageCount} pages total)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
