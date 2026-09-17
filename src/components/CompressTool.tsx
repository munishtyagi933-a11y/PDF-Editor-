import React, { useState, useEffect } from 'react';
import {
  Minimize2,
  Image as ImageIcon,
  FileText,
  Download,
  Upload,
  Sparkles,
  Archive,
  ArrowDown,
  CheckCircle2,
  Layers,
  Sliders,
  ZoomIn,
  ZoomOut,
  Eye,
  ShieldCheck,
  Check,
  Settings2,
  Gauge,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  compressPdfDocument,
  compressImageFile,
  createImagesZip,
  renderPdfPagePreview,
  type PdfImageResult,
  type PdfManualCompressOptions,
} from '../utils/conversionOperations';
import { createSampleDocument } from '../utils/pdfOperations';
import { downloadBlob } from '../utils/downloadHelper';

interface CompressToolProps {
  currentPdfBuffer?: ArrayBuffer | null;
  currentPdfName?: string;
  onPdfLoaded?: (buffer: ArrayBuffer, name: string) => void;
}

interface CompressedImageItem {
  id: string;
  fileName: string;
  originalSize: number;
  compressedSize: number;
  dataUrl: string;
  blob: Blob;
}

type PdfCompressionMode = 'manual' | 'recommended' | 'extreme' | 'light';

export const CompressTool: React.FC<CompressToolProps> = ({
  currentPdfBuffer,
  currentPdfName = 'Document.pdf',
  onPdfLoaded,
}) => {
  const [compressTab, setCompressTab] = useState<'pdf' | 'image'>('pdf');

  // PDF State
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [pdfDocName, setPdfDocName] = useState<string>(currentPdfName);
  const [pdfMode, setPdfMode] = useState<PdfCompressionMode>('manual');
  const [isCompressingPdf, setIsCompressingPdf] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [compressedPdfResult, setCompressedPdfResult] = useState<{
    bytes: Uint8Array;
    originalSize: number;
    compressedSize: number;
  } | null>(null);

  // Manual Tuning Controls (Designed to preserve pixels and visual sharpness)
  const [manualDpi, setManualDpi] = useState<number>(180);
  const [manualQuality, setManualQuality] = useState<number>(85);
  const [manualStrategy, setManualStrategy] = useState<'smart_resample' | 'lossless_stream'>('smart_resample');
  const [stripMetadata, setStripMetadata] = useState<boolean>(true);

  // Pixel Quality Inspector / Live Preview
  const [showPreviewInspector, setShowPreviewInspector] = useState<boolean>(true);
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<{
    originalDataUrl: string;
    compressedDataUrl: string;
    width: number;
    height: number;
  } | null>(null);
  const [previewViewType, setPreviewViewType] = useState<'sideBySide' | 'compressed' | 'original'>('sideBySide');

  // Image State
  const [quality, setQuality] = useState<number>(75);
  const [maxDimension, setMaxDimension] = useState<number>(1920);
  const [isCompressingImages, setIsCompressingImages] = useState<boolean>(false);
  const [compressedImages, setCompressedImages] = useState<CompressedImageItem[]>([]);

  useEffect(() => {
    if (currentPdfBuffer) {
      setPdfBuffer(currentPdfBuffer);
      setPdfDocName(currentPdfName);
      setCompressedPdfResult(null);
      loadPreview(currentPdfBuffer, manualDpi, manualQuality / 100);
    }
  }, [currentPdfBuffer, currentPdfName]);

  const loadPreview = async (buffer: ArrayBuffer, dpi: number, qual: number) => {
    try {
      setIsLoadingPreview(true);
      const data = await renderPdfPagePreview(buffer, 1, dpi, qual);
      setPreviewData(data);
    } catch (e) {
      console.warn('Preview generation note:', e);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await file.arrayBuffer();
    const safeBuffer = raw.slice(0);
    setPdfBuffer(safeBuffer);
    setPdfDocName(file.name);
    setCompressedPdfResult(null);
    if (onPdfLoaded) onPdfLoaded(safeBuffer, file.name);
    loadPreview(safeBuffer, manualDpi, manualQuality / 100);
  };

  const handleLoadSamplePdf = async () => {
    try {
      const sample = await createSampleDocument();
      const safeBuffer = sample.buffer.slice(
        sample.byteOffset,
        sample.byteOffset + sample.byteLength
      );
      setPdfBuffer(safeBuffer);
      setPdfDocName('Munish_Sample_Doc.pdf');
      setCompressedPdfResult(null);
      if (onPdfLoaded) onPdfLoaded(safeBuffer, 'Munish_Sample_Doc.pdf');
      loadPreview(safeBuffer, manualDpi, manualQuality / 100);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdatePreview = () => {
    if (pdfBuffer) {
      loadPreview(pdfBuffer, manualDpi, manualQuality / 100);
    }
  };

  const handleCompressPdf = async () => {
    if (!pdfBuffer) return;
    setIsCompressingPdf(true);
    setProgressStatus('Initializing high-fidelity compression engine...');
    try {
      const options: PdfManualCompressOptions = {
        dpi: pdfMode === 'manual' ? manualDpi : undefined,
        quality: pdfMode === 'manual' ? manualQuality / 100 : undefined,
        strategy: pdfMode === 'manual' ? manualStrategy : undefined,
        stripMetadata,
        onProgress: (cur, tot) => {
          const dpiDesc = pdfMode === 'manual' ? `${manualDpi} DPI` : 'Smart HD';
          setProgressStatus(`Processing page ${cur} of ${tot} with ${dpiDesc} bicubic filter...`);
        },
      };

      const compressedBytes = await compressPdfDocument(pdfBuffer, pdfMode, options);
      setCompressedPdfResult({
        bytes: compressedBytes,
        originalSize: pdfBuffer.byteLength,
        compressedSize: compressedBytes.byteLength,
      });

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      console.error(err);
      alert(`Compression failed: ${err.message || 'Error processing document'}`);
    } finally {
      setIsCompressingPdf(false);
      setProgressStatus('');
    }
  };

  const handleDownloadCompressedPdf = () => {
    if (!compressedPdfResult) return;
    const blob = new Blob([compressedPdfResult.bytes], { type: 'application/pdf' });
    const base = pdfDocName.replace(/\.pdf$/i, '');
    const suffix = pdfMode === 'manual' ? `manual_${manualDpi}dpi` : pdfMode;
    downloadBlob(blob, `${base}_compressed_${suffix}.pdf`);
  };

  // Image Multi-upload & Compression
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    setIsCompressingImages(true);
    try {
      const results: CompressedImageItem[] = [];
      for (const file of files) {
        const comp = await compressImageFile(
          file,
          quality / 100,
          maxDimension,
          file.type === 'image/png' ? 'image/jpeg' : 'image/jpeg'
        );
        results.push({
          id: Math.random().toString(36).substring(2, 9),
          fileName: file.name.replace(/\.[^/.]+$/, '.jpg'),
          originalSize: comp.originalSize,
          compressedSize: comp.compressedSize,
          dataUrl: comp.dataUrl,
          blob: comp.blob,
        });
      }
      setCompressedImages((prev) => [...results, ...prev]);

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err) {
      console.error(err);
      alert('Error compressing images.');
    } finally {
      setIsCompressingImages(false);
    }
  };

  const handleDownloadAllImagesZip = async () => {
    if (compressedImages.length === 0) return;
    const zipImages: PdfImageResult[] = compressedImages.map((img, idx) => ({
      pageNumber: idx + 1,
      dataUrl: img.dataUrl,
      blob: img.blob,
      width: 0,
      height: 0,
    }));
    const zipBlob = await createImagesZip(zipImages, 'compressed_images', 'jpg');
    downloadBlob(zipBlob, 'compressed_images.zip');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getSavings = (orig: number, comp: number) => {
    if (orig <= 0) return 0;
    const diff = orig - comp;
    if (diff <= 0) return 0;
    return Math.round((diff / orig) * 100);
  };

  // Quality badge helper for manual sliders
  const getQualityBadge = (qual: number, dpi: number) => {
    if (qual >= 88 && dpi >= 200) {
      return {
        label: '💎 Ultra Crisp (Zero Visible Pixel Loss)',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        desc: 'Prints, fine typography, and high-res photos stay razor sharp.',
      };
    }
    if (qual >= 75 && dpi >= 150) {
      return {
        label: '✨ High Definition Sharp (Recommended)',
        color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
        desc: 'Clear readable text with great size reduction.',
      };
    }
    if (qual >= 60) {
      return {
        label: '⚡ Standard Compact',
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        desc: 'Good for standard screen viewing and email attachments.',
      };
    }
    return {
      label: '📉 Deep Compression',
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      desc: 'Smallest file size with maximum compaction.',
    };
  };

  const qualityBadge = getQualityBadge(manualQuality, manualDpi);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Tool Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Minimize2 className="w-5 h-5 text-indigo-400" />
            PDF & Image Compression
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Optimize file size with manual pixel-protection controls, high-res DPI tuning, and instant sharpness preview
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex flex-wrap items-center p-1 bg-slate-900 border border-slate-800 rounded-xl gap-1">
          <button
            id="compress-tab-pdf"
            type="button"
            onClick={() => setCompressTab('pdf')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              compressTab === 'pdf'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Compress PDF</span>
          </button>

          <button
            id="compress-tab-image"
            type="button"
            onClick={() => setCompressTab('image')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              compressTab === 'image'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 shrink-0" />
            <span>Compress Images</span>
          </button>
        </div>
      </div>

      {/* COMPRESS PDF TAB */}
      {compressTab === 'pdf' && (
        <div className="space-y-6">
          {!pdfBuffer && (
            <div className="max-w-2xl mx-auto my-8">
              <label
                htmlFor="compress-pdf-upload"
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all shadow-inner group"
              >
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-400 flex items-center justify-center transition-colors">
                  <Minimize2 className="w-7 h-7" />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-white">Upload PDF to Compress</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Select a document to optimize size, fine-tune DPI & quality manually, and inspect pixel sharpness.
                  </p>
                </div>
                <input
                  id="compress-pdf-upload"
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                />
              </label>

              <div className="text-center mt-4">
                <button
                  id="compress-pdf-sample-btn"
                  type="button"
                  onClick={handleLoadSamplePdf}
                  className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Or load sample document to test
                </button>
              </div>
            </div>
          )}

          {pdfBuffer && (
            <div className="space-y-6">
              {/* Document Overview */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white truncate max-w-xs sm:max-w-md">{pdfDocName}</p>
                    <p className="text-[11px] text-slate-400">
                      Original File Size: <strong className="text-slate-200">{formatSize(pdfBuffer.byteLength)}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label
                    htmlFor="compress-pdf-change"
                    className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer transition-colors border border-slate-700"
                  >
                    Change PDF
                    <input
                      id="compress-pdf-change"
                      type="file"
                      accept="application/pdf"
                      onChange={handlePdfUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Compression Mode Selector Cards */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Select Compression Mode
                  </label>
                  <span className="text-[11px] text-indigo-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Pixel Protection Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    {
                      id: 'manual' as const,
                      title: 'Manual Custom Tuning',
                      desc: 'Full control over DPI (72-300) & Quality (40-95%) with anti-blur pixel preservation.',
                      badge: 'Manual Control',
                      highlight: true,
                    },
                    {
                      id: 'recommended' as const,
                      title: 'Recommended Balanced',
                      desc: 'Crisp 160 DPI & 85% Quality. Sharp text with excellent size savings.',
                      badge: 'Balanced HD',
                    },
                    {
                      id: 'extreme' as const,
                      title: 'Maximum Reduction',
                      desc: '120 DPI & 72% Quality. Compact size for strict email & portal limits.',
                      badge: 'Max Savings',
                    },
                    {
                      id: 'light' as const,
                      title: '100% Lossless Compaction',
                      desc: 'Zero pixel modification. Strips hidden bloat and compacts object streams.',
                      badge: 'Zero Pixel Loss',
                    },
                  ].map((level) => {
                    const isSelected = pdfMode === level.id;
                    return (
                      <div
                        key={level.id}
                        id={`compress-level-${level.id}`}
                        onClick={() => {
                          setPdfMode(level.id);
                          setCompressedPdfResult(null);
                        }}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                          isSelected
                            ? 'bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            {level.id === 'manual' && <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />}
                            {level.title}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 font-semibold rounded border shrink-0 ${
                            level.highlight
                              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {level.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">{level.desc}</p>
                        <div className="text-[11px] font-bold text-indigo-400 flex items-center gap-1">
                          {isSelected ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              Selected
                            </>
                          ) : (
                            'Click to select'
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* MANUAL PIXEL & QUALITY TUNING PANEL (If manual selected) */}
              {pdfMode === 'manual' && (
                <div className="p-6 bg-slate-900/90 border border-indigo-500/40 rounded-2xl shadow-xl space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-indigo-400" />
                        Manual Fine-Tuning: Sharpness & Pixel Controls
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Customize resolution (DPI) and compression quality to ensure your PDF stays clear without pixel degradation.
                      </p>
                    </div>

                    <div className={`px-3 py-1 rounded-lg border text-xs font-bold ${qualityBadge.color} shrink-0`}>
                      {qualityBadge.label}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Control 1: DPI / Resolution */}
                    <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-300 flex items-center gap-1.5">
                          <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                          Sharpness Resolution (DPI)
                        </span>
                        <span className="font-mono text-indigo-300 font-bold bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">
                          {manualDpi} DPI
                        </span>
                      </div>

                      <input
                        id="compress-manual-dpi-slider"
                        type="range"
                        min="72"
                        max="300"
                        step="10"
                        value={manualDpi}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setManualDpi(val);
                          setCompressedPdfResult(null);
                        }}
                        className="w-full accent-indigo-500 cursor-pointer"
                      />

                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                        <span>72 DPI (Web)</span>
                        <span>150 DPI (HD)</span>
                        <span>200 DPI (Crisp)</span>
                        <span>300 DPI (Original Print)</span>
                      </div>

                      {/* Quick DPI Preset Chips */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[
                          { dpi: 100, label: '100 DPI (Compact)' },
                          { dpi: 150, label: '150 DPI (HD Balance)' },
                          { dpi: 180, label: '180 DPI (Sharp)' },
                          { dpi: 200, label: '200 DPI (Ultra Sharp)' },
                          { dpi: 300, label: '300 DPI (Zero Loss)' },
                        ].map((preset) => (
                          <button
                            key={preset.dpi}
                            type="button"
                            onClick={() => {
                              setManualDpi(preset.dpi);
                              setCompressedPdfResult(null);
                            }}
                            className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg border transition-all cursor-pointer ${
                              manualDpi === preset.dpi
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Control 2: Quality Percentage */}
                    <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-300 flex items-center gap-1.5">
                          <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
                          Image & Text Quality
                        </span>
                        <span className="font-mono text-indigo-300 font-bold bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">
                          {manualQuality}%
                        </span>
                      </div>

                      <input
                        id="compress-manual-quality-slider"
                        type="range"
                        min="40"
                        max="95"
                        step="5"
                        value={manualQuality}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setManualQuality(val);
                          setCompressedPdfResult(null);
                        }}
                        className="w-full accent-indigo-500 cursor-pointer"
                      />

                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                        <span>40% (Compact)</span>
                        <span>70% (Standard)</span>
                        <span>85% (Recommended)</span>
                        <span>95% (Maximum Crisp)</span>
                      </div>

                      <div className="text-[11px] text-slate-400 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                        {qualityBadge.desc}
                      </div>
                    </div>
                  </div>

                  {/* Strategy and Metadata Options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 block">Compression Engine</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setManualStrategy('smart_resample');
                            setCompressedPdfResult(null);
                          }}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                            manualStrategy === 'smart_resample'
                              ? 'bg-indigo-600/20 border-indigo-500 text-white'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="block text-xs font-bold text-white">Smart HD Resample</span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">Bicubic anti-aliasing for scans & photos</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setManualStrategy('lossless_stream');
                            setCompressedPdfResult(null);
                          }}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                            manualStrategy === 'lossless_stream'
                              ? 'bg-indigo-600/20 border-indigo-500 text-white'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="block text-xs font-bold text-white">Pure Lossless</span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">Stream optimization (0% pixel change)</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl mt-auto">
                      <div>
                        <span className="text-xs font-bold text-white block">Clean Metadata & Bloat Streams</span>
                        <span className="text-[10px] text-slate-400 block">Safely removes redundant tags without touching any pixels</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={stripMetadata}
                        onChange={(e) => setStripMetadata(e.target.checked)}
                        className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* PIXEL QUALITY INSPECTOR (LIVE BEFORE / AFTER PREVIEW) */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-xs font-bold text-white">Pixel Quality & Sharpness Inspector (Page 1)</h3>
                    <span className="text-[10px] text-slate-400">Verify text clarity before downloading</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Zoom Selector */}
                    <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                      <button
                        type="button"
                        onClick={() => setPreviewZoom(100)}
                        className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer ${
                          previewZoom === 100 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        100%
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewZoom(150)}
                        className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer ${
                          previewZoom === 150 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        150% (Zoom)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewZoom(200)}
                        className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer ${
                          previewZoom === 200 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        200% (Pixel Check)
                      </button>
                    </div>

                    {/* View mode toggle */}
                    <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setPreviewViewType('sideBySide')}
                        className={`px-2.5 py-1 rounded cursor-pointer ${
                          previewViewType === 'sideBySide' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Side-by-Side
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewViewType('compressed')}
                        className={`px-2.5 py-1 rounded cursor-pointer ${
                          previewViewType === 'compressed' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Compressed
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleUpdatePreview}
                      disabled={isLoadingPreview}
                      className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingPreview ? 'animate-spin' : ''}`} />
                      Refresh Preview
                    </button>
                  </div>
                </div>

                {isLoadingPreview ? (
                  <div className="p-12 flex flex-col items-center justify-center gap-3 text-center bg-slate-950 rounded-xl border border-slate-800">
                    <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-slate-400 font-semibold">Generating high-fidelity page preview...</p>
                  </div>
                ) : previewData ? (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-auto max-h-[440px]">
                    {previewViewType === 'sideBySide' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Original */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1">
                            <span>Original (Uncompressed)</span>
                            <span className="text-[10px] text-slate-500">100% Vector Baseline</span>
                          </div>
                          <div
                            className="bg-white rounded-lg p-2 shadow overflow-auto flex items-center justify-center border border-slate-800"
                            style={{ minHeight: '260px' }}
                          >
                            <img
                              src={previewData.originalDataUrl}
                              alt="Original Preview"
                              className="max-w-none transition-transform duration-150"
                              style={{ width: `${previewZoom}%`, height: 'auto' }}
                            />
                          </div>
                        </div>

                        {/* Compressed with Selected Settings */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400 px-1">
                            <span>Optimized Output ({pdfMode === 'manual' ? `${manualDpi} DPI, ${manualQuality}%` : pdfMode})</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-300 rounded border border-emerald-500/20">
                              Clean Pixels
                            </span>
                          </div>
                          <div
                            className="bg-white rounded-lg p-2 shadow overflow-auto flex items-center justify-center border border-slate-800"
                            style={{ minHeight: '260px' }}
                          >
                            <img
                              src={previewData.compressedDataUrl}
                              alt="Optimized Preview"
                              className="max-w-none transition-transform duration-150"
                              style={{ width: `${previewZoom}%`, height: 'auto' }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="text-[11px] font-bold text-emerald-400 mb-2">
                          Optimized Preview at {previewZoom}% Zoom ({pdfMode === 'manual' ? `${manualDpi} DPI, ${manualQuality}% Quality` : pdfMode})
                        </div>
                        <div className="bg-white rounded-lg p-2 shadow overflow-auto max-w-full border border-slate-800">
                          <img
                            src={previewData.compressedDataUrl}
                            alt="Optimized Preview"
                            className="max-w-none transition-transform duration-150"
                            style={{ width: `${previewZoom}%`, height: 'auto' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                    Click 'Refresh Preview' to inspect the rendered page pixels.
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    Ready to Apply <span className="text-indigo-400 uppercase">{pdfMode}</span> Compression
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {pdfMode === 'manual'
                      ? `Using ${manualDpi} DPI resolution & ${manualQuality}% quality with bicubic pixel smoothing.`
                      : 'Fast client-side compaction without sending your document across the internet.'}
                  </p>
                  {progressStatus && (
                    <p className="text-xs text-indigo-400 font-semibold mt-2 animate-pulse flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-indigo-400" />
                      {progressStatus}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    id="compress-pdf-start-btn"
                    type="button"
                    onClick={handleCompressPdf}
                    disabled={isCompressingPdf}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isCompressingPdf ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Minimize2 className="w-4 h-4" />
                    )}
                    <span>{isCompressingPdf ? 'Compressing PDF...' : 'Compress PDF'}</span>
                  </button>

                  {compressedPdfResult && (
                    <button
                      id="compress-pdf-download-btn"
                      type="button"
                      onClick={handleDownloadCompressedPdf}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Optimized PDF</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Before/After Size Comparison Card */}
              {compressedPdfResult && (
                <div className="p-6 bg-slate-900/90 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
                  <div className="flex items-center gap-8">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-500">
                        Original Size
                      </span>
                      <span className="text-base font-extrabold text-slate-300">
                        {formatSize(compressedPdfResult.originalSize)}
                      </span>
                    </div>

                    <ArrowDown className="w-5 h-5 text-emerald-400 rotate-[-90deg] sm:rotate-0" />

                    <div>
                      <span className="block text-[10px] uppercase font-bold text-emerald-400">
                        Compressed Size
                      </span>
                      <span className="text-base font-extrabold text-emerald-300">
                        {formatSize(compressedPdfResult.compressedSize)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-bold text-xs">
                      {getSavings(
                        compressedPdfResult.originalSize,
                        compressedPdfResult.compressedSize
                      ) > 0
                        ? `-${getSavings(
                            compressedPdfResult.originalSize,
                            compressedPdfResult.compressedSize
                          )}% Smaller`
                        : 'Stream Optimized'}
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadCompressedPdf}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md"
                    >
                      Download Now
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* COMPRESS IMAGES TAB */}
      {compressTab === 'image' && (
        <div className="space-y-6">
          {/* Settings Bar */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-6 flex-wrap">
              {/* Quality Slider */}
              <div className="min-w-[180px]">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-400 font-bold">Quality</span>
                  <span className="font-mono text-indigo-400 font-bold">{quality}%</span>
                </div>
                <input
                  id="compress-img-quality"
                  type="range"
                  min="10"
                  max="95"
                  step="5"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Max Dimension */}
              <div>
                <span className="block text-xs text-slate-400 font-bold mb-1.5">
                  Max Resolution
                </span>
                <div className="flex items-center gap-1.5">
                  {[
                    { val: 1920, label: '1920px (FHD)' },
                    { val: 1280, label: '1280px (HD)' },
                    { val: 800, label: '800px (Web)' },
                  ].map((dim) => (
                    <button
                      key={dim.val}
                      type="button"
                      onClick={() => setMaxDimension(dim.val)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                        maxDimension === dim.val
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {dim.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label
                htmlFor="compress-image-upload"
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                {isCompressingImages ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>Upload & Compress Images</span>
                <input
                  id="compress-image-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>

              {compressedImages.length > 0 && (
                <button
                  id="compress-images-download-zip"
                  type="button"
                  onClick={handleDownloadAllImagesZip}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Archive className="w-4 h-4" />
                  <span>Download ZIP ({compressedImages.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Compressed Images List */}
          {compressedImages.length === 0 && (
            <div className="max-w-2xl mx-auto my-8">
              <label
                htmlFor="compress-image-upload-zone"
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all shadow-inner group"
              >
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-400 flex items-center justify-center transition-colors">
                  <ImageIcon className="w-7 h-7" />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-white">Upload Images to Compress</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Upload single or multiple JPG, PNG, or WebP pictures. Real-time before/after savings calculated instantly.
                  </p>
                </div>
                <input
                  id="compress-image-upload-zone"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {compressedImages.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>{compressedImages.length} Images Compressed</span>
                <button
                  type="button"
                  onClick={() => setCompressedImages([])}
                  className="text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                >
                  Clear List
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {compressedImages.map((img) => {
                  const savings = getSavings(img.originalSize, img.compressedSize);
                  return (
                    <div
                      key={img.id}
                      className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-4 shadow-sm"
                    >
                      <div className="w-20 h-20 bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800 flex-shrink-0">
                        <img
                          src={img.dataUrl}
                          alt={img.fileName}
                          className="max-h-full max-w-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{img.fileName}</p>
                        <div className="flex items-center gap-2 mt-1 text-[11px]">
                          <span className="text-slate-400 line-through">
                            {formatSize(img.originalSize)}
                          </span>
                          <span className="text-emerald-400 font-extrabold">
                            {formatSize(img.compressedSize)}
                          </span>
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                            -{savings}%
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          downloadBlob(img.blob, img.fileName);
                        }}
                        className="p-2 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                        title="Download compressed image"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
