import React, { useState, useEffect } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  Download,
  Upload,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Layers,
  FileCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  convertPdfToWord,
  convertPdfToExcel,
  convertPdfToPpt,
} from '../utils/conversionOperations';
import { createSampleDocument } from '../utils/pdfOperations';
import { downloadBlob } from '../utils/downloadHelper';

type OfficeFormat = 'word' | 'excel' | 'ppt';

interface PdfToOfficeToolProps {
  currentPdfBuffer?: ArrayBuffer | null;
  currentPdfName?: string;
  defaultFormat?: OfficeFormat;
  onPdfLoaded?: (buffer: ArrayBuffer, name: string) => void;
}

export const PdfToOfficeTool: React.FC<PdfToOfficeToolProps> = ({
  currentPdfBuffer,
  currentPdfName = 'Document.pdf',
  defaultFormat = 'word',
  onPdfLoaded,
}) => {
  const [activeBuffer, setActiveBuffer] = useState<ArrayBuffer | null>(null);
  const [docName, setDocName] = useState<string>(currentPdfName);
  const [targetFormat, setTargetFormat] = useState<OfficeFormat>(defaultFormat);
  const [wordMode, setWordMode] = useState<'smart_layout' | 'exact_clone'>('smart_layout');
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [convertedBlob, setConvertedBlob] = useState<{
    blob: Blob;
    fileName: string;
    format: OfficeFormat;
  } | null>(null);

  useEffect(() => {
    if (currentPdfBuffer) {
      loadBuffer(currentPdfBuffer, currentPdfName);
    }
  }, [currentPdfBuffer, currentPdfName]);

  const loadBuffer = (buffer: ArrayBuffer, name: string) => {
    setActiveBuffer(buffer);
    setDocName(name);
    setConvertedBlob(null);
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
      loadBuffer(safeBuffer, 'Munish_Agreement_2026.pdf');
    } catch (e) {
      console.error(e);
    }
  };

  const handleConvert = async () => {
    if (!activeBuffer) return;
    setIsConverting(true);
    const baseName = docName.replace(/\.pdf$/i, '');

    try {
      if (targetFormat === 'word') {
        setProgressText('Extracting structured layout & styling Word document...');
        const docxBlob = await convertPdfToWord(activeBuffer, {
          mode: wordMode,
          onProgress: (cur, tot) => {
            setProgressText(`Formatting Word page ${cur} of ${tot}...`);
          },
        });
        setConvertedBlob({
          blob: docxBlob,
          fileName: `${baseName}.docx`,
          format: 'word',
        });
      } else if (targetFormat === 'excel') {
        setProgressText('Analyzing table columns & generating Excel workbook...');
        const xlsxBlob = await convertPdfToExcel(activeBuffer, (cur, tot) => {
          setProgressText(`Aligning tabular cells on page ${cur} of ${tot}...`);
        });
        setConvertedBlob({
          blob: xlsxBlob,
          fileName: `${baseName}.xlsx`,
          format: 'excel',
        });
      } else if (targetFormat === 'ppt') {
        setProgressText('Generating high-definition slides for PowerPoint...');
        const pptBlob = await convertPdfToPpt(activeBuffer, (cur, tot) => {
          setProgressText(`Rendering 300 DPI slide ${cur} of ${tot}...`);
        });
        setConvertedBlob({
          blob: pptBlob,
          fileName: `${baseName}.pptx`,
          format: 'ppt',
        });
      }

      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      console.error('Conversion error:', err);
      alert(`Conversion failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsConverting(false);
      setProgressText('');
    }
  };

  const handleDownload = () => {
    if (!convertedBlob) return;
    downloadBlob(convertedBlob.blob, convertedBlob.fileName);
  };

  const formatOptions = [
    {
      id: 'word' as OfficeFormat,
      title: 'PDF to Word (.docx)',
      desc: 'Preserves exact text fonts, bold weights, italics, headings, alignments, and structured tables with auto-fallback for scanned pages.',
      icon: FileText,
      color: 'from-blue-600 to-indigo-600',
      badge: 'DOCX',
    },
    {
      id: 'excel' as OfficeFormat,
      title: 'PDF to Excel (.xlsx)',
      desc: '2D spatial table reconstruction aligning columns into true cells with automatic number/currency detection and dynamic column auto-fit.',
      icon: FileSpreadsheet,
      color: 'from-emerald-600 to-teal-600',
      badge: 'XLSX',
    },
    {
      id: 'ppt' as OfficeFormat,
      title: 'PDF to PowerPoint (.pptx)',
      desc: 'High-definition 300 DPI canvas matching widescreen (16:9) or standard (4:3) with editable text shapes and full speaker presentation notes.',
      icon: Presentation,
      color: 'from-orange-600 to-amber-600',
      badge: 'PPTX',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Convert PDF to Office</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            High-fidelity conversion preserving exact typography, tables, alignments, and visual structure
          </p>
        </div>

        {!activeBuffer && (
          <button
            id="office-load-sample-btn"
            type="button"
            onClick={handleLoadSample}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/80 rounded-xl transition-all cursor-pointer whitespace-normal break-words"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Load Sample Document</span>
          </button>
        )}
      </div>

      {/* Upload Zone */}
      {!activeBuffer && (
        <div className="max-w-2xl mx-auto my-8">
          <label
            htmlFor="office-file-upload"
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all shadow-inner group"
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-400 flex items-center justify-center transition-colors">
              <Upload className="w-7 h-7" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-white">Upload PDF to Convert</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Converts digital PDFs and scanned documents into high-fidelity Word, Excel, or PowerPoint.
              </p>
            </div>
            <input
              id="office-file-upload"
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {activeBuffer && (
        <div className="space-y-6">
          {/* Active File Bar */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-800 text-indigo-400 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white break-all">{docName}</p>
                <p className="text-[11px] text-slate-400">
                  Ready to convert to {targetFormat.toUpperCase()} with high precision
                </p>
              </div>
            </div>

            <label
              htmlFor="office-change-file"
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer transition-colors whitespace-normal break-words"
            >
              Change PDF
              <input
                id="office-change-file"
                type="file"
                accept="application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Format Selector Cards */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Select Output Office Format
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {formatOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = targetFormat === opt.id;
                return (
                  <div
                    key={opt.id}
                    id={`opt-format-${opt.id}`}
                    onClick={() => {
                      setTargetFormat(opt.id);
                      setConvertedBlob(null);
                    }}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                      isSelected
                        ? 'bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${opt.color} flex items-center justify-center text-white shadow-md`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-slate-800 text-slate-300 rounded-md border border-slate-700">
                        {opt.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-white mb-1 whitespace-normal break-words">{opt.title}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">{opt.desc}</p>
                    </div>

                    <div className="flex items-center text-xs font-semibold text-indigo-400 gap-1 pt-2 border-t border-slate-800/80">
                      <span>{isSelected ? 'Selected' : 'Select'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Word Conversion Mode Toggle (When Word is selected) */}
          {targetFormat === 'word' && (
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl">
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-2">
                Word (.docx) Formatting Strategy
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  id="word-mode-smart"
                  onClick={() => setWordMode('smart_layout')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    wordMode === 'smart_layout'
                      ? 'bg-indigo-950/40 border-indigo-500/80 ring-1 ring-indigo-500/30 text-white'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white whitespace-normal break-words">Smart Layout & Tables (Editable)</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-indigo-900/60 text-indigo-300 rounded font-semibold">Recommended</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Converts text into native editable paragraphs, headings, and Word tables with exact font sizes, bold weights, and alignment.
                  </p>
                </div>

                <div
                  id="word-mode-clone"
                  onClick={() => setWordMode('exact_clone')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    wordMode === 'exact_clone'
                      ? 'bg-indigo-950/40 border-indigo-500/80 ring-1 ring-indigo-500/30 text-white'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white whitespace-normal break-words">Visual Clone (Scanned & Forms)</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded font-semibold">100% Identical</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Embeds high-resolution visual pages inside Word alongside editable transcripts. Perfect for scanned papers, certificates, and logos.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action & Status */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-white">
                Convert <span className="text-indigo-400 break-all">{docName}</span> to{' '}
                <span className="text-white uppercase font-mono">
                  .{targetFormat === 'word' ? 'docx' : targetFormat === 'excel' ? 'xlsx' : 'pptx'}
                </span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Processed locally with client-side zero-loss parsing algorithms.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <button
                id="office-start-convert-btn"
                type="button"
                onClick={handleConvert}
                disabled={isConverting}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50 whitespace-normal break-words"
              >
                {isConverting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <Layers className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {isConverting ? progressText || 'Converting...' : `Convert to ${targetFormat.toUpperCase()}`}
                </span>
              </button>

              {convertedBlob && (
                <button
                  id="office-download-btn"
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer whitespace-normal break-words"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Download {convertedBlob.fileName}</span>
                </button>
              )}
            </div>
          </div>

          {convertedBlob && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800/70 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-emerald-300 text-xs">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="whitespace-normal break-words">
                  Successfully converted to <strong>{convertedBlob.fileName}</strong> with exact formatting!
                </span>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="underline font-bold hover:text-white cursor-pointer whitespace-normal break-words"
              >
                Click to Download
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
