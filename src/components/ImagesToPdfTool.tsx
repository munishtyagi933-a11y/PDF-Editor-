import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Upload,
  ArrowUp,
  ArrowDown,
  Trash2,
  Download,
  Plus,
  FileCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { imagesToPdf } from '../utils/pdfOperations';

interface ImageItem {
  id: string;
  name: string;
  dataUrl: string;
  size: number;
}

export const ImagesToPdfTool: React.FC = () => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [outputFileName, setOutputFileName] = useState<string>('converted_photos.pdf');
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);

  const handleFilesAdded = (files: FileList | null) => {
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setImages((prev) => [
          ...prev,
          {
            id: `${file.name}-${Date.now()}-${Math.random()}`,
            name: file.name,
            dataUrl,
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
    setPdfBytes(null);
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= images.length) return;
    const copy = [...images];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    setImages(copy);
    setPdfBytes(null);
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setPdfBytes(null);
  };

  const convertToPdf = async () => {
    if (images.length === 0) return;
    setIsConverting(true);
    try {
      const bytes = await imagesToPdf(images);
      setPdfBytes(bytes);

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err) {
      console.error(err);
      alert('Failed to convert images to PDF.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (!pdfBytes) return;
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outputFileName.endsWith('.pdf') ? outputFileName : `${outputFileName}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Convert Images to PDF</h2>
            <p className="text-xs text-slate-400">
              Combine photos, receipts, and scans (JPG, PNG) into a high-quality PDF document
            </p>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="mb-6">
        <label
          htmlFor="img2pdf-file-upload"
          className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all shadow-inner group"
        >
          <div className="w-12 h-12 rounded-full bg-slate-800 group-hover:bg-indigo-600/20 flex items-center justify-center transition-colors">
            <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-white">
              Drop images here, or <span className="text-indigo-400 underline">browse</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">Supports PNG, JPG, JPEG formats</p>
          </div>
          <input
            id="img2pdf-file-upload"
            type="file"
            multiple
            accept="image/png, image/jpeg, image/webp"
            onChange={(e) => handleFilesAdded(e.target.files)}
            className="hidden"
          />
        </label>
      </div>

      {/* Images List */}
      {images.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-300">
              Selected Images ({images.length} pages in PDF)
            </span>
            <label
              htmlFor="img2pdf-add-more"
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add More Photos</span>
              <input
                id="img2pdf-add-more"
                type="file"
                multiple
                accept="image/png, image/jpeg, image/webp"
                onChange={(e) => handleFilesAdded(e.target.files)}
                className="hidden"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((img, idx) => (
              <div
                key={img.id}
                id={`img-item-${idx}`}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col items-center gap-2 group hover:border-slate-700 transition-colors shadow-md"
              >
                <div className="w-full flex items-center justify-between text-xs text-slate-400 px-1">
                  <span className="font-bold text-slate-200">Page {idx + 1}</span>
                  <span className="text-[10px]">{(img.size / 1024).toFixed(0)} KB</span>
                </div>

                <div className="w-full h-36 bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center p-2 border border-slate-800">
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="max-h-full max-w-full object-contain rounded"
                  />
                </div>

                <p className="text-xs text-slate-300 truncate w-full px-1">{img.name}</p>

                <div className="w-full flex items-center justify-between pt-1 border-t border-slate-800">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveImage(idx, 'up')}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === images.length - 1}
                      onClick={() => moveImage(idx, 'down')}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Action Footer */}
          <div className="p-5 bg-slate-800/40 border border-slate-700 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
            <div className="w-full sm:w-auto flex-1 max-w-sm">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Output File Name
              </label>
              <input
                id="img2pdf-filename-input"
                type="text"
                value={outputFileName}
                onChange={(e) => setOutputFileName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                id="img2pdf-convert-btn"
                type="button"
                onClick={convertToPdf}
                disabled={isConverting}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                {isConverting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4" />
                )}
                <span>{isConverting ? 'Creating PDF...' : 'Convert to PDF Now'}</span>
              </button>

              {pdfBytes && (
                <button
                  id="img2pdf-download-btn"
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>
              )}
            </div>
          </div>

          {pdfBytes && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800/80 rounded-xl flex items-center justify-between gap-3 text-emerald-300 text-xs">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>PDF successfully generated from {images.length} photos!</span>
              </div>
              <span className="font-semibold text-emerald-400">
                {(pdfBytes.byteLength / 1024).toFixed(1)} KB
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
