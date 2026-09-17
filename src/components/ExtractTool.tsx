import React, { useState, useEffect } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Copy,
  Check,
  Download,
  Upload,
  Sparkles,
  Layers,
  Search,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { extractTextFromPdf } from '../utils/pdfWorker';
import { convertPdfToExcel } from '../utils/conversionOperations';
import { createSampleDocument } from '../utils/pdfOperations';
import { downloadBlob } from '../utils/downloadHelper';

interface ExtractToolProps {
  currentPdfBuffer?: ArrayBuffer | null;
  currentPdfName?: string;
  onPdfLoaded?: (buffer: ArrayBuffer, name: string) => void;
}

export const ExtractTool: React.FC<ExtractToolProps> = ({
  currentPdfBuffer,
  currentPdfName = 'Document.pdf',
  onPdfLoaded,
}) => {
  const [activeBuffer, setActiveBuffer] = useState<ArrayBuffer | null>(null);
  const [docName, setDocName] = useState<string>(currentPdfName);
  const [extractedText, setExtractedText] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'text' | 'table'>('text');

  useEffect(() => {
    if (currentPdfBuffer) {
      loadBuffer(currentPdfBuffer, currentPdfName);
    }
  }, [currentPdfBuffer, currentPdfName]);

  const loadBuffer = async (buffer: ArrayBuffer, name: string) => {
    setActiveBuffer(buffer);
    setDocName(name);
    setExtractedText('');
    if (onPdfLoaded) onPdfLoaded(buffer, name);

    // Auto extract text
    setIsExtracting(true);
    try {
      const text = await extractTextFromPdf(buffer);
      setExtractedText(text);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await file.arrayBuffer();
    await loadBuffer(raw.slice(0), file.name);
  };

  const handleLoadSample = async () => {
    try {
      const sample = await createSampleDocument();
      const safeBuffer = sample.buffer.slice(
        sample.byteOffset,
        sample.byteOffset + sample.byteLength
      );
      await loadBuffer(safeBuffer, 'Contract_Terms_Sample.pdf');
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopy = () => {
    if (!extractedText) return;
    navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!extractedText) return;
    const blob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${docName.replace(/\.pdf$/i, '')}_extracted_text.txt`);
  };

  const handleDownloadExcel = async () => {
    if (!activeBuffer) return;
    try {
      const blob = await convertPdfToExcel(activeBuffer);
      downloadBlob(blob, `${docName.replace(/\.pdf$/i, '')}_extracted_tables.xlsx`);

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err) {
      console.error(err);
      alert('Failed to extract Excel tables.');
    }
  };

  // Word statistics
  const wordCount = extractedText ? extractedText.trim().split(/\s+/).length : 0;
  const charCount = extractedText ? extractedText.length : 0;
  const lineCount = extractedText ? extractedText.split('\n').length : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Extract PDF Content</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Extract raw text, paragraphs, and structured spreadsheet data from any PDF
          </p>
        </div>

        {!activeBuffer && (
          <button
            id="extract-load-sample-btn"
            type="button"
            onClick={handleLoadSample}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/80 rounded-xl transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Load Sample Document</span>
          </button>
        )}
      </div>

      {/* Upload Zone */}
      {!activeBuffer && (
        <div className="max-w-2xl mx-auto my-8">
          <label
            htmlFor="extract-file-upload"
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all shadow-inner group"
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-400 flex items-center justify-center transition-colors">
              <Upload className="w-7 h-7" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-white">Upload PDF to Extract Data</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Extract full document text, word count metrics, or export tables to Excel.
              </p>
            </div>
            <input
              id="extract-file-upload"
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
          {/* File & Stats Bar */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-800 text-indigo-400 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">{docName}</p>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                  <span>{wordCount.toLocaleString()} Words</span>
                  <span>•</span>
                  <span>{charCount.toLocaleString()} Characters</span>
                  <span>•</span>
                  <span>{lineCount} Lines</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="extract-copy-btn"
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copied ? 'Copied!' : 'Copy Text'}</span>
              </button>

              <button
                id="extract-dl-txt-btn"
                type="button"
                onClick={handleDownloadTxt}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .TXT</span>
              </button>

              <button
                id="extract-dl-excel-btn"
                type="button"
                onClick={handleDownloadExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Tables (.xlsx)</span>
              </button>

              <label
                htmlFor="extract-change-file"
                className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer transition-colors"
              >
                Change PDF
                <input
                  id="extract-change-file"
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Search within Extracted Text */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search words in extracted content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
            />
          </div>

          {/* Text Display Area */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-slate-300">Extracted Document Text</span>
              {isExtracting && (
                <span className="text-indigo-400 animate-pulse">Extracting text...</span>
              )}
            </div>

            <div className="p-6 max-h-[500px] overflow-auto font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed selection:bg-indigo-600 selection:text-white">
              {extractedText || (isExtracting ? 'Reading document...' : 'No text detected in document.')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
