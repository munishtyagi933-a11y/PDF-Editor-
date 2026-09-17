import React, { useState, useEffect } from 'react';
import {
  PenTool,
  Upload,
  Calendar,
  CheckCircle2,
  Download,
  Plus,
  FileText,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PDFDocument } from 'pdf-lib';
import { SignatureModal } from './SignatureModal';
import { InteractiveCanvasEditor } from './InteractiveCanvasEditor';
import { createSampleDocument, applyAnnotationsToPdf } from '../utils/pdfOperations';
import type { AnnotationItem, SignatureData } from '../types';

interface SignToolProps {
  currentPdfBuffer?: ArrayBuffer | null;
  currentPdfName?: string;
  onPdfLoaded?: (buffer: ArrayBuffer, name: string) => void;
}

export const SignTool: React.FC<SignToolProps> = ({
  currentPdfBuffer,
  currentPdfName = 'Document.pdf',
  onPdfLoaded,
}) => {
  const [activePdfBuffer, setActivePdfBuffer] = useState<ArrayBuffer | null>(null);
  const [docName, setDocName] = useState<string>(currentPdfName);
  const [pageCount, setPageCount] = useState<number>(1);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);

  // Signatures & annotations
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [savedSignature, setSavedSignature] = useState<SignatureData | null>(null);
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [activeStampMode, setActiveStampMode] = useState<
    'none' | 'signature' | 'date' | 'name' | 'checkmark'
  >('none');

  // Export state
  const [isProcessing, setIsProcessing] = useState(false);
  const [signedPdfBytes, setSignedPdfBytes] = useState<Uint8Array | null>(null);

  // Sync external buffer
  useEffect(() => {
    if (currentPdfBuffer) {
      loadBuffer(currentPdfBuffer, currentPdfName);
    }
  }, [currentPdfBuffer, currentPdfName]);

  // Create default signature for Munish Tyagi on mount
  useEffect(() => {
    if (!savedSignature) {
      // Generate default signature for Munish Tyagi
      const canvas = document.createElement('canvas');
      canvas.width = 460;
      canvas.height = 140;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = 'italic bold 44px "Brush Script MT", "Segoe Script", cursive';
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Munish Tyagi', canvas.width / 2, canvas.height / 2);
        setSavedSignature({
          type: 'type',
          dataUrl: canvas.toDataURL('image/png'),
          signerName: 'Munish Tyagi',
          dateString: new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
        });
      }
    }
  }, [savedSignature]);

  const loadBuffer = async (buffer: ArrayBuffer, name: string) => {
    try {
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      setActivePdfBuffer(buffer);
      setDocName(name);
      setPageCount(pdfDoc.getPageCount());
      setCurrentPageIndex(0);
      setAnnotations([]);
      setSignedPdfBytes(null);
      if (onPdfLoaded) {
        onPdfLoaded(buffer, name);
      }
    } catch (err) {
      console.error('Error loading PDF in SignTool:', err);
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
      await loadBuffer(safeBuffer, 'Munish_Services_Agreement.pdf');
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Canvas click to place active tool
  const handleCanvasClick = (percentX: number, percentY: number) => {
    if (activeStampMode === 'signature' && savedSignature) {
      const newAnnot: AnnotationItem = {
        id: `sig-${Date.now()}`,
        type: 'signature',
        pageIndex: currentPageIndex,
        xPercent: Math.max(0, percentX - 12),
        yPercent: Math.max(0, percentY - 4),
        widthPercent: 24,
        heightPercent: 8,
        imageBase64: savedSignature.dataUrl,
      };
      setAnnotations((prev) => [...prev, newAnnot]);
      setActiveStampMode('none');
    } else if (activeStampMode === 'date') {
      const todayStr = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const newAnnot: AnnotationItem = {
        id: `date-${Date.now()}`,
        type: 'date',
        isDate: true,
        pageIndex: currentPageIndex,
        xPercent: Math.max(0, percentX - 8),
        yPercent: Math.max(0, percentY - 2),
        widthPercent: 18,
        heightPercent: 4,
        text: todayStr,
        fontSize: 12,
      };
      setAnnotations((prev) => [...prev, newAnnot]);
      setActiveStampMode('none');
    } else if (activeStampMode === 'name') {
      const newAnnot: AnnotationItem = {
        id: `name-${Date.now()}`,
        type: 'text',
        pageIndex: currentPageIndex,
        xPercent: Math.max(0, percentX - 10),
        yPercent: Math.max(0, percentY - 2),
        widthPercent: 20,
        heightPercent: 4,
        text: savedSignature?.signerName || 'Munish Tyagi',
        fontSize: 13,
      };
      setAnnotations((prev) => [...prev, newAnnot]);
      setActiveStampMode('none');
    } else if (activeStampMode === 'checkmark') {
      const newAnnot: AnnotationItem = {
        id: `check-${Date.now()}`,
        type: 'checkmark',
        pageIndex: currentPageIndex,
        xPercent: Math.max(0, percentX - 3),
        yPercent: Math.max(0, percentY - 3),
        widthPercent: 6,
        heightPercent: 5,
      };
      setAnnotations((prev) => [...prev, newAnnot]);
      setActiveStampMode('none');
    }
  };

  // Quick 1-click add to center of page
  const addAnnotationDirectly = (type: 'signature' | 'date' | 'name' | 'checkmark') => {
    if (type === 'signature' && savedSignature) {
      const newAnnot: AnnotationItem = {
        id: `sig-${Date.now()}`,
        type: 'signature',
        pageIndex: currentPageIndex,
        xPercent: 52,
        yPercent: 78,
        widthPercent: 26,
        heightPercent: 9,
        imageBase64: savedSignature.dataUrl,
      };
      setAnnotations((prev) => [...prev, newAnnot]);
    } else if (type === 'date') {
      const todayStr = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const newAnnot: AnnotationItem = {
        id: `date-${Date.now()}`,
        type: 'date',
        isDate: true,
        pageIndex: currentPageIndex,
        xPercent: 54,
        yPercent: 88,
        widthPercent: 22,
        heightPercent: 4,
        text: todayStr,
        fontSize: 12,
      };
      setAnnotations((prev) => [...prev, newAnnot]);
    } else if (type === 'name') {
      const newAnnot: AnnotationItem = {
        id: `name-${Date.now()}`,
        type: 'text',
        pageIndex: currentPageIndex,
        xPercent: 52,
        yPercent: 73,
        widthPercent: 22,
        heightPercent: 4,
        text: savedSignature?.signerName || 'Munish Tyagi',
        fontSize: 13,
      };
      setAnnotations((prev) => [...prev, newAnnot]);
    } else if (type === 'checkmark') {
      const newAnnot: AnnotationItem = {
        id: `check-${Date.now()}`,
        type: 'checkmark',
        pageIndex: currentPageIndex,
        xPercent: 48,
        yPercent: 78,
        widthPercent: 6,
        heightPercent: 5,
      };
      setAnnotations((prev) => [...prev, newAnnot]);
    }
  };

  const handleUpdateAnnotation = (id: string, updates: Partial<AnnotationItem>) => {
    setAnnotations((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleDeleteAnnotation = (id: string) => {
    setAnnotations((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveAndExport = async () => {
    if (!activePdfBuffer) return;
    setIsProcessing(true);
    try {
      const signedBytes = await applyAnnotationsToPdf(activePdfBuffer, annotations);
      setSignedPdfBytes(signedBytes);

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      // Auto trigger download
      const blob = new Blob([signedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = docName.replace('.pdf', '');
      a.download = `${baseName}_signed.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error applying signature:', err);
      alert('Failed to sign the document. Please verify the document format.');
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
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Sign PDF Document</h2>
              <p className="text-xs text-slate-400">
                Place legally formatted electronic signatures, name stamps, and date marks onto any page
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          {!activePdfBuffer && (
            <button
              id="sign-load-sample-btn"
              type="button"
              onClick={handleLoadSample}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/80 rounded-xl transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Load Sample Contract</span>
            </button>
          )}

          {activePdfBuffer && (
            <button
              id="sign-export-btn"
              type="button"
              onClick={handleSaveAndExport}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              {isProcessing ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Finalize & Download Signed PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* If No PDF Loaded: Show Upload Banner */}
      {!activePdfBuffer && (
        <div className="max-w-2xl mx-auto my-12">
          <label
            htmlFor="sign-file-upload"
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all shadow-inner group"
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-400 flex items-center justify-center transition-colors">
              <Upload className="w-7 h-7" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-white">Upload PDF to Sign</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Drag and drop your PDF agreement or form here, or click to browse.
              </p>
            </div>
            <input
              id="sign-file-upload"
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Main Signing Workspace */}
      {activePdfBuffer && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Left Toolbar: Signature Elements */}
          <div className="lg:col-span-1 space-y-4">
            {/* Signature Card */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Your Signature
                </span>
                <button
                  id="sign-change-sig-btn"
                  type="button"
                  onClick={() => setIsSigModalOpen(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                >
                  Change
                </button>
              </div>

              {savedSignature && (
                <div className="bg-white p-3 rounded-xl border border-slate-300 flex items-center justify-center min-h-[70px]">
                  <img
                    src={savedSignature.dataUrl}
                    alt="Active Signature"
                    className="max-h-16 object-contain"
                  />
                </div>
              )}

              <p className="text-[11px] text-slate-400">
                Signer: <strong className="text-slate-200">{savedSignature?.signerName}</strong>
              </p>

              {/* Action: Drop onto PDF */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  id="sign-stamp-sig-btn"
                  type="button"
                  onClick={() => addAnnotationDirectly('signature')}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Signature</span>
                </button>
                <button
                  id="sign-stamp-date-btn"
                  type="button"
                  onClick={() => addAnnotationDirectly('date')}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  <span>+ Date Stamp</span>
                </button>
              </div>
            </div>

            {/* Quick Stamps Panel */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                Additional Fields
              </span>

              <button
                id="sign-add-name-field-btn"
                type="button"
                onClick={() => addAnnotationDirectly('name')}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/80 hover:bg-slate-800 text-xs font-medium text-slate-200 rounded-xl border border-slate-700/80 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Signer Full Name</span>
                </span>
                <span className="text-[10px] text-slate-400">Add</span>
              </button>

              <button
                id="sign-add-check-field-btn"
                type="button"
                onClick={() => addAnnotationDirectly('checkmark')}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/80 hover:bg-slate-800 text-xs font-medium text-slate-200 rounded-xl border border-slate-700/80 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Checkmark (✓)</span>
                </span>
                <span className="text-[10px] text-slate-400">Add</span>
              </button>
            </div>

            {/* Placed Elements Summary */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Applied Marks ({annotations.length})
                </span>
                {annotations.length > 0 && (
                  <button
                    id="sign-clear-all-marks-btn"
                    type="button"
                    onClick={() => setAnnotations([])}
                    className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {annotations.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  No elements placed yet. Click "+ Signature" or "+ Date Stamp" to place onto the document.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {annotations.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 bg-slate-800/60 rounded-lg text-xs text-slate-300"
                    >
                      <span className="capitalize">
                        {item.type === 'signature' ? 'Signature' : item.type} (Pg {item.pageIndex + 1})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteAnnotation(item.id)}
                        className="text-slate-400 hover:text-rose-400 text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Instruction Tip */}
            <div className="p-3.5 bg-indigo-950/30 border border-indigo-800/40 rounded-xl text-xs text-indigo-200/80 leading-relaxed">
              💡 <strong>Tip:</strong> Click and drag placed signatures or stamps directly on the document preview to position them perfectly.
            </div>
          </div>

          {/* Right: Interactive Document Viewer */}
          <div className="lg:col-span-3">
            <InteractiveCanvasEditor
              pdfBuffer={activePdfBuffer}
              currentPageIndex={currentPageIndex}
              totalPageCount={pageCount}
              onPageChange={setCurrentPageIndex}
              annotations={annotations}
              onUpdateAnnotation={handleUpdateAnnotation}
              onDeleteAnnotation={handleDeleteAnnotation}
              onCanvasClick={handleCanvasClick}
            />
          </div>
        </div>
      )}

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSigModalOpen}
        onClose={() => setIsSigModalOpen(false)}
        onSaveSignature={(sig) => setSavedSignature(sig)}
        defaultSignerName={savedSignature?.signerName || 'Munish Tyagi'}
      />
    </div>
  );
};
