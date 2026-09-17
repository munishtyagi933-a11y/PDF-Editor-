import React, { useState, useRef, useEffect } from 'react';
import { X, PenLine, Type, Upload, Trash2, Check, Sparkles } from 'lucide-react';
import type { SignatureData } from '../types';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSignature: (sig: SignatureData) => void;
  defaultSignerName?: string;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onClose,
  onSaveSignature,
  defaultSignerName = 'Munish Tyagi',
}) => {
  const [activeTab, setActiveTab] = useState<'draw' | 'type' | 'upload'>('draw');
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [inkColor, setInkColor] = useState('#0f172a'); // default executive black
  const [lineWidth, setLineWidth] = useState(3);
  const [selectedFontStyle, setSelectedFontStyle] = useState(0);

  // Drawing canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Upload state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const colors = [
    { name: 'Executive Black', hex: '#0f172a' },
    { name: 'Legal Blue', hex: '#1e40af' },
    { name: 'Navy', hex: '#1e293b' },
  ];

  // Font styles for Typed Signatures
  const fontStyles = [
    { name: 'Executive Script', font: 'italic bold 42px "Brush Script MT", "Segoe Script", cursive' },
    { name: 'Modern Signature', font: 'italic 38px "Dancing Script", cursive, "Lucida Handwriting"' },
    { name: 'Classic Calligraphy', font: 'italic 36px "Zapfino", "Apple Chancery", cursive' },
    { name: 'Clean Formal', font: 'bold 34px "Georgia", serif' },
  ];

  useEffect(() => {
    if (isOpen && activeTab === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setHasDrawn(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = lineWidth;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    }
  };

  // Generate typed signature data URL
  const generateTypedSignatureDataUrl = (): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = fontStyles[selectedFontStyle].font;
    ctx.fillStyle = inkColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(signerName || 'Munish Tyagi', canvas.width / 2, canvas.height / 2);

    return canvas.toDataURL('image/png');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas to process image and remove near-white background
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Make pure white/light grey transparent
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (r > 220 && g > 220 && b > 220) {
            data[i + 3] = 0; // Alpha 0
          }
        }
        ctx.putImageData(imgData, 0, 0);
        setUploadedImage(canvas.toDataURL('image/png'));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    const dateStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    if (activeTab === 'draw') {
      if (!canvasRef.current || !hasDrawn) return;
      onSaveSignature({
        type: 'draw',
        dataUrl: canvasRef.current.toDataURL('image/png'),
        signerName: signerName || 'Munish Tyagi',
        dateString: dateStr,
      });
    } else if (activeTab === 'type') {
      const dataUrl = generateTypedSignatureDataUrl();
      onSaveSignature({
        type: 'type',
        dataUrl,
        signerName: signerName || 'Munish Tyagi',
        dateString: dateStr,
      });
    } else if (activeTab === 'upload') {
      if (!uploadedImage) return;
      onSaveSignature({
        type: 'upload',
        dataUrl: uploadedImage,
        signerName: signerName || 'Munish Tyagi',
        dateString: dateStr,
      });
    }
    onClose();
  };

  const isConfirmDisabled =
    (activeTab === 'draw' && !hasDrawn) ||
    (activeTab === 'type' && !signerName.trim()) ||
    (activeTab === 'upload' && !uploadedImage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <PenLine className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create Electronic Signature</h3>
              <p className="text-xs text-slate-400">PDF With Munish digital signing</p>
            </div>
          </div>
          <button
            id="sig-modal-close-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4">
          <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <button
              id="sig-tab-draw"
              type="button"
              onClick={() => setActiveTab('draw')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'draw'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PenLine className="w-3.5 h-3.5" />
              <span>Draw</span>
            </button>
            <button
              id="sig-tab-type"
              type="button"
              onClick={() => setActiveTab('type')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'type'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Type</span>
            </button>
            <button
              id="sig-tab-upload"
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Image</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 flex-1">
          {/* Signer Name Input (shared) */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Signer Full Name
            </label>
            <input
              id="sig-input-name"
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="e.g. Munish Tyagi"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Color & Stroke Selection */}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Ink Color</span>
            <div className="flex items-center gap-2">
              {colors.map((c) => (
                <button
                  id={`ink-color-${c.hex}`}
                  key={c.hex}
                  type="button"
                  onClick={() => setInkColor(c.hex)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                    inkColor === c.hex
                      ? 'border-indigo-400 scale-110 ring-2 ring-indigo-500/30'
                      : 'border-slate-600'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          {/* TAB 1: DRAW */}
          {activeTab === 'draw' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400">Sign within the box</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span>Width:</span>
                    {[2, 3, 5].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setLineWidth(w)}
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          lineWidth === w ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {w === 2 ? 'Fine' : w === 3 ? 'Med' : 'Bold'}
                      </button>
                    ))}
                  </div>
                  <button
                    id="sig-clear-canvas-btn"
                    type="button"
                    onClick={clearCanvas}
                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              <div className="border border-dashed border-slate-600 rounded-xl overflow-hidden bg-white/95 relative shadow-inner">
                <canvas
                  id="signature-draw-canvas"
                  ref={canvasRef}
                  width={460}
                  height={150}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-36 cursor-crosshair touch-none"
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-400/80 text-xs font-medium">
                    Draw your signature here with mouse or finger
                  </div>
                )}
                <div className="absolute bottom-2 right-2 text-[10px] text-slate-400 pointer-events-none">
                  ✕ Sign above line
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TYPE */}
          {activeTab === 'type' && (
            <div className="space-y-2">
              <span className="text-xs text-slate-400 block">Select a signature style</span>
              <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                {fontStyles.map((style, idx) => (
                  <div
                    key={style.name}
                    onClick={() => setSelectedFontStyle(idx)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer bg-white text-slate-900 flex items-center justify-between ${
                      selectedFontStyle === idx
                        ? 'border-indigo-600 ring-2 ring-indigo-500/40 shadow'
                        : 'border-slate-300 hover:border-indigo-400'
                    }`}
                  >
                    <span
                      style={{
                        font: style.font,
                        color: inkColor,
                        lineHeight: 1.2,
                      }}
                      className="text-2xl px-2"
                    >
                      {signerName || 'Munish Tyagi'}
                    </span>
                    {selectedFontStyle === idx && (
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: UPLOAD */}
          {activeTab === 'upload' && (
            <div>
              <label
                htmlFor="signature-file-input"
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/50 hover:bg-slate-800 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Upload className="w-8 h-8 text-indigo-400" />
                <span className="text-xs font-semibold text-slate-200">
                  Click to upload signature image (PNG, JPG)
                </span>
                <span className="text-[11px] text-slate-500">
                  White backgrounds will automatically be converted to transparent
                </span>
                <input
                  id="signature-file-input"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {uploadedImage && (
                <div className="mt-3 p-3 bg-white rounded-xl border border-slate-300 flex items-center justify-center">
                  <img
                    src={uploadedImage}
                    alt="Uploaded Signature"
                    className="max-h-24 object-contain"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-800/60 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            id="sig-cancel-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="sig-confirm-btn"
            type="button"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={`flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              isConfirmDisabled
                ? 'bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Apply Signature</span>
          </button>
        </div>
      </div>
    </div>
  );
};
