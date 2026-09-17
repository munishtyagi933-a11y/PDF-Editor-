import React, { useState } from 'react';
import {
  FileText,
  Download,
  Upload,
  Sparkles,
  FileCheck,
  Archive,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { convertWordToPdf, convertWordToImages, createImagesZip, type PdfImageResult } from '../utils/conversionOperations';
import { downloadBlob } from '../utils/downloadHelper';

export const WordConverterTool: React.FC = () => {
  const [docxBuffer, setDocxBuffer] = useState<ArrayBuffer | null>(null);
  const [docxName, setDocxName] = useState<string>('');
  const [targetType, setTargetType] = useState<'pdf' | 'images'>('pdf');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  // Results
  const [convertedPdfBytes, setConvertedPdfBytes] = useState<Uint8Array | null>(null);
  const [convertedImages, setConvertedImages] = useState<PdfImageResult[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const rawBuffer = await file.arrayBuffer();
    setDocxBuffer(rawBuffer.slice(0));
    setDocxName(file.name);
    setConvertedPdfBytes(null);
    setConvertedImages([]);
  };

  const handleLoadSampleWord = async () => {
    setIsProcessing(true);
    setStatusMsg('Generating sample Word (.docx) document...');
    try {
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                text: 'CONSULTING SERVICES AGREEMENT',
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 200 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'This Professional Services Agreement is entered into between Munish Tyagi Enterprises and Client Corp.',
                    size: 24,
                  }),
                ],
                spacing: { after: 150 },
              }),
              new Paragraph({
                text: '1. SCOPE OF SERVICES',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'The Consultant shall deliver comprehensive technical architecture, systems review, and continuous document auditing throughout the duration of the 2026 engagement.',
                    size: 22,
                  }),
                ],
                spacing: { after: 150 },
              }),
              new Paragraph({
                text: '2. COMPENSATION AND RETAINER',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Payment of $12,500 shall be remitted bi-weekly upon formal milestone approvals. All invoices are payable within net 30 business days.',
                    size: 22,
                  }),
                ],
                spacing: { after: 150 },
              }),
              new Paragraph({
                text: '3. CONFIDENTIALITY AND IP OWNERSHIP',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'All deliverables, source repositories, documentation, and operational workflows remain the exclusive intellectual property of the Client upon final compensation.',
                    size: 22,
                  }),
                ],
                spacing: { after: 150 },
              }),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const buffer = await blob.arrayBuffer();
      setDocxBuffer(buffer);
      setDocxName('Sample_Consulting_Agreement.docx');
      setConvertedPdfBytes(null);
      setConvertedImages([]);
    } catch (err) {
      console.error(err);
      alert('Failed to generate sample Word document.');
    } finally {
      setIsProcessing(false);
      setStatusMsg('');
    }
  };

  const handleConvert = async () => {
    if (!docxBuffer) return;
    setIsProcessing(true);
    try {
      if (targetType === 'pdf') {
        setStatusMsg('Formatting document layout and generating PDF...');
        const pdfBytes = await convertWordToPdf(docxBuffer);
        setConvertedPdfBytes(pdfBytes);
      } else {
        setStatusMsg('Rendering Word pages into high-resolution images...');
        const imgs = await convertWordToImages(docxBuffer);
        setConvertedImages(imgs);
      }

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      console.error(err);
      alert(`Conversion failed: ${err.message || 'Error parsing Word document'}`);
    } finally {
      setIsProcessing(false);
      setStatusMsg('');
    }
  };

  const handleDownloadPdf = () => {
    if (!convertedPdfBytes) return;
    const blob = new Blob([convertedPdfBytes], { type: 'application/pdf' });
    const base = docxName.replace(/\.docx?$/i, '');
    downloadBlob(blob, `${base}_converted.pdf`);
  };

  const handleDownloadImagesZip = async () => {
    if (convertedImages.length === 0) return;
    const base = docxName.replace(/\.docx?$/i, '');
    const zipBlob = await createImagesZip(convertedImages, base, 'png');
    downloadBlob(zipBlob, `${base}_word_images.zip`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Word Converter</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Convert Microsoft Word documents (.docx) into PDF documents or high-res images
          </p>
        </div>

        {!docxBuffer && (
          <button
            id="word-load-sample-btn"
            type="button"
            onClick={handleLoadSampleWord}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/80 rounded-xl transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Load Sample Word (.docx)</span>
          </button>
        )}
      </div>

      {/* Upload Zone */}
      {!docxBuffer && (
        <div className="max-w-2xl mx-auto my-8">
          <label
            htmlFor="word-file-upload"
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all shadow-inner group"
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-400 flex items-center justify-center transition-colors">
              <Upload className="w-7 h-7" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-white">Upload Microsoft Word Document (.docx)</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Convert Word agreements, reports, and memos to formatted PDF or images.
              </p>
            </div>
            <input
              id="word-file-upload"
              type="file"
              accept=".docx, application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {docxBuffer && (
        <div className="space-y-6">
          {/* Active File Bar */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">{docxName}</p>
                <p className="text-[11px] text-slate-400">
                  {(docxBuffer.byteLength / 1024).toFixed(1)} KB Word Document
                </p>
              </div>
            </div>

            <label
              htmlFor="word-change-file"
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer transition-colors"
            >
              Change Word File
              <input
                id="word-change-file"
                type="file"
                accept=".docx, application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Conversion Target Mode */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Select Output Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                id="word-to-pdf-card"
                onClick={() => {
                  setTargetType('pdf');
                  setConvertedPdfBytes(null);
                  setConvertedImages([]);
                }}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                  targetType === 'pdf'
                    ? 'bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    Word to PDF (.pdf)
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Converts Word document text, headings, and structure into a standardized, paginated PDF.
                </p>
              </div>

              <div
                id="word-to-img-card"
                onClick={() => {
                  setTargetType('images');
                  setConvertedPdfBytes(null);
                  setConvertedImages([]);
                }}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                  targetType === 'images'
                    ? 'bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                    Word to Images (.png)
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                    High Res
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Renders each page of your Word document into individual high-resolution PNG image pages.
                </p>
              </div>
            </div>
          </div>

          {/* Action Trigger */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-white">
                Ready to convert into {targetType === 'pdf' ? 'PDF Document' : 'High-Res Images'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Processed 100% in your browser for total privacy.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                id="word-convert-action-btn"
                type="button"
                onClick={handleConvert}
                disabled={isProcessing}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Layers className="w-4 h-4" />
                )}
                <span>
                  {isProcessing
                    ? statusMsg || 'Processing...'
                    : targetType === 'pdf'
                    ? 'Convert to PDF Now'
                    : 'Convert to Images Now'}
                </span>
              </button>

              {convertedPdfBytes && (
                <button
                  id="word-download-pdf-btn"
                  type="button"
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>
              )}

              {convertedImages.length > 0 && (
                <button
                  id="word-download-zip-btn"
                  type="button"
                  onClick={handleDownloadImagesZip}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Archive className="w-4 h-4" />
                  <span>Download Images (ZIP)</span>
                </button>
              )}
            </div>
          </div>

          {/* Success Banners */}
          {convertedPdfBytes && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800/70 rounded-2xl flex items-center justify-between text-emerald-300 text-xs">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <span>Word document successfully converted to PDF!</span>
              </div>
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="underline font-bold hover:text-white cursor-pointer"
              >
                Download PDF ({((convertedPdfBytes.byteLength || 0) / 1024).toFixed(1)} KB)
              </button>
            </div>
          )}

          {convertedImages.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{convertedImages.length} Image Pages Generated</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {convertedImages.map((img) => (
                  <div
                    key={img.pageNumber}
                    className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2"
                  >
                    <span className="text-[11px] font-bold text-slate-300">
                      Page {img.pageNumber}
                    </span>
                    <div className="h-40 bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center p-2 border border-slate-800">
                      <img
                        src={img.dataUrl}
                        alt={`Page ${img.pageNumber}`}
                        className="max-h-full max-w-full object-contain rounded"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = img.dataUrl;
                        a.download = `page_${img.pageNumber}.png`;
                        a.click();
                      }}
                      className="mt-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
