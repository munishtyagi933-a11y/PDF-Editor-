import React, { useState, useEffect } from 'react';
import {
  Image as ImageIcon,
  Download,
  Upload,
  Sparkles,
  Archive,
  Check,
  ZoomIn,
  Layers,
  FileText,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { convertPdfToImages, createImagesZip, type PdfImageResult } from '../utils/conversionOperations';
import { createSampleDocument } from '../utils/pdfOperations';

interface PdfToImagesToolProps {
  currentPdfBuffer?: ArrayBuffer | null;
  currentPdfName?: string;
  onPdfLoaded?: (buffer: ArrayBuffer, name: string) => void;
}

export const PdfToImagesTool: React.FC<PdfToImagesToolProps> = ({
  currentPdfBuffer,
  currentPdfName = 'Document.pdf',
  onPdfLoaded,
}) => {
  const [activeBuffer, setActiveBuffer] = useState<ArrayBuffer | null>(null);
  const [docName, setDocName] = useState<string>(currentPdfName);
  const [format, setFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/png');
  const [scale, setScale] = useState<number>(2.0);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [images, setImages] = useState<PdfImageResult[]>([]);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<PdfImageResult | null>(null);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  useEffect(() => {
    if (currentPdfBuffer) {
      loadBuffer(currentPdfBuffer, currentPdfName);
    }
  }, [currentPdfBuffer, currentPdfName]);

  const loadBuffer = (buffer: ArrayBuffer, name: string) => {
    setActiveBuffer(buffer);
    setDocName(name);
    setImages([]);
    setProgress(null);
    if (onPdfLoaded) {
      onPdfLoaded(buffer, name);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const rawBuffer = await file.arrayBuffer();
    loadBuffer(rawBuffer.slice(0), file.name);
  };

  const handleLoadSample = async () => {
    try {
      const sample = await createSampleDocument();
      const safeBuffer = sample.buffer.slice(
        sample.byteOffset,
        sample.byteOffset + sample.byteLength
      );
      loadBuffer(safeBuffer, 'Sample_Agreement.pdf');
    } catch (e) {
      console.error(e);
    }
  };

  const handleConvert = async () => {
    if (!activeBuffer) return;
    setIsConverting(true);
    setProgress({ current: 0, total: 1 });
    try {
      const results = await convertPdfToImages(
        activeBuffer,
        format,
        scale,
        (current, total) => setProgress({ current, total })
      );
      setImages(results);

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err) {
      console.error('PDF to Image conversion error:', err);
      alert('Failed to convert PDF to images.');
    } finally {
      setIsConverting(false);
      setProgress(null);
    }
  };

  const handleDownloadSingle = (img: PdfImageResult) => {
    const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
    const base = docName.replace(/\.pdf$/i, '');
    const a = document.createElement('a');
    a.href = img.dataUrl;
    a.download = `${base}_page_${String(img.pageNumber).padStart(2, '0')}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadAllZip = async () => {
    if (images.length === 0) return;
    setIsZipping(true);
    try {
      const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
      const base = docName.replace(/\.pdf$/i, '');
      const zipBlob = await createImagesZip(images, base, ext);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${base}_all_pages.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to generate ZIP archive.');
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">PDF to High-Res Images</h2>
            <p className="text-xs text-slate-400">
              Convert PDF pages into crystal-clear PNG, JPG, or WebP images with custom resolution
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!activeBuffer && (
            <button
              id="pdf2img-load-sample-btn"
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
              <label
                htmlFor="pdf2img-change-file"
                className="px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                Change PDF
                <input
                  id="pdf2img-change-file"
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                id="pdf2img-convert-btn"
                type="button"
                onClick={handleConvert}
                disabled={isConverting}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isConverting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Layers className="w-3.5 h-3.5" />
                )}
                <span>
                  {isConverting
                    ? progress
                      ? `Converting (${progress.current}/${progress.total})...`
                      : 'Rendering Pages...'
                    : 'Convert to Images'}
                </span>
              </button>

              {images.length > 0 && (
                <button
                  id="pdf2img-download-all-btn"
                  type="button"
                  onClick={handleDownloadAllZip}
                  disabled={isZipping}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  {isZipping ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Archive className="w-3.5 h-3.5" />
                  )}
                  <span>Download All as ZIP</span>
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
            htmlFor="pdf2img-file-upload"
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all shadow-inner group"
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-400 flex items-center justify-center transition-colors">
              <Upload className="w-7 h-7" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-white">Upload PDF to Extract Images</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Renders each page into high-definition standalone images ready for presentations and web sharing.
              </p>
            </div>
            <input
              id="pdf2img-file-upload"
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Configuration Settings */}
      {activeBuffer && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Format
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'image/png', label: 'PNG (Lossless)' },
                  { id: 'image/jpeg', label: 'JPG (Compact)' },
                  { id: 'image/webp', label: 'WebP (Modern)' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-normal break-words transition-all cursor-pointer ${
                      format === f.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Quality / Resolution
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { scaleVal: 1.5, label: '150 DPI (Fast)' },
                  { scaleVal: 2.0, label: '300 DPI (High-Res)' },
                  { scaleVal: 3.0, label: '450 DPI (Ultra HD)' },
                ].map((s) => (
                  <button
                    key={s.scaleVal}
                    type="button"
                    onClick={() => setScale(s.scaleVal)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-normal break-words transition-all cursor-pointer ${
                      scale === s.scaleVal
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-400">
            Document: <strong className="text-slate-200">{docName}</strong>
          </div>
        </div>
      )}

      {/* Rendered Images Grid */}
      {images.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Generated <strong>{images.length}</strong> image{images.length > 1 ? 's' : ''} from PDF
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((img) => (
              <div
                key={img.pageNumber}
                id={`pdf-img-card-${img.pageNumber}`}
                className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-3 flex flex-col gap-3 transition-all shadow-md group"
              >
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span className="font-bold text-slate-200">Page {img.pageNumber}</span>
                  <span className="text-[10px] text-slate-500">
                    {img.width} × {img.height} px
                  </span>
                </div>

                <div
                  className="w-full h-56 bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center p-2 border border-slate-800 cursor-pointer relative group/img"
                  onClick={() => setSelectedPreviewImage(img)}
                >
                  <img
                    src={img.dataUrl}
                    alt={`Page ${img.pageNumber}`}
                    className="max-h-full max-w-full object-contain rounded shadow-sm"
                  />
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 text-white text-xs font-semibold flex items-center gap-1">
                      <ZoomIn className="w-3.5 h-3.5" />
                      Preview
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                  <span className="text-[11px] text-slate-500">
                    {(img.blob.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDownloadSingle(img)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Preview */}
      {selectedPreviewImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm p-4 flex items-center justify-center"
          onClick={() => setSelectedPreviewImage(null)}
        >
          <div
            className="max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-sm font-bold text-white">
                Page {selectedPreviewImage.pageNumber} Preview
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadSingle(selectedPreviewImage)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPreviewImage(null)}
                  className="px-2 py-1 text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-950 rounded-xl p-2">
              <img
                src={selectedPreviewImage.dataUrl}
                alt="Page Preview"
                className="max-h-[75vh] object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
