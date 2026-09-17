import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Trash2,
  Move,
  Check,
} from 'lucide-react';
import { renderPdfPageToCanvas } from '../utils/pdfWorker';
import type { AnnotationItem } from '../types';

interface InteractiveCanvasEditorProps {
  pdfBuffer: ArrayBuffer;
  currentPageIndex: number;
  totalPageCount: number;
  onPageChange: (pageIndex: number) => void;
  annotations: AnnotationItem[];
  onUpdateAnnotation: (id: string, updates: Partial<AnnotationItem>) => void;
  onDeleteAnnotation: (id: string) => void;
  onCanvasClick?: (percentX: number, percentY: number) => void;
  interactiveMode?: 'select' | 'place_text' | 'place_sig' | 'place_date' | 'place_stamp' | 'place_highlight' | 'place_redact';
}

export const InteractiveCanvasEditor: React.FC<InteractiveCanvasEditorProps> = ({
  pdfBuffer,
  currentPageIndex,
  totalPageCount,
  onPageChange,
  annotations,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onCanvasClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [isLoadingPage, setIsLoadingPage] = useState<boolean>(true);
  const [selectedAnnotId, setSelectedAnnotId] = useState<string | null>(null);

  // Dragging state
  const [draggingAnnotId, setDraggingAnnotId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [initialAnnotPos, setInitialAnnotPos] = useState<{ xPercent: number; yPercent: number } | null>(null);

  // Render the current page onto the canvas
  useEffect(() => {
    let isCancelled = false;
    async function loadPage() {
      if (!canvasRef.current || !pdfBuffer) return;
      setIsLoadingPage(true);
      try {
        const containerWidth = containerRef.current?.clientWidth || 700;
        // Base width calibrated to zoom
        const targetWidth = Math.min(Math.max(containerWidth - 60, 480), 850) * zoomLevel;
        await renderPdfPageToCanvas(
          pdfBuffer,
          currentPageIndex + 1,
          canvasRef.current,
          targetWidth,
          () => isCancelled
        );
      } catch (err: any) {
        if (!isCancelled && err?.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', err);
        }
      } finally {
        if (!isCancelled) setIsLoadingPage(false);
      }
    }
    loadPage();

    return () => {
      isCancelled = true;
    };
  }, [pdfBuffer, currentPageIndex, zoomLevel]);

  // Handle clicking on canvas background to place pending item
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // ignore if clicked an annotation
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const percentX = (clickX / rect.width) * 100;
    const percentY = (clickY / rect.height) * 100;

    setSelectedAnnotId(null);
    if (onCanvasClick) {
      onCanvasClick(percentX, percentY);
    }
  };

  // Drag handlers
  const handleMouseDownOnAnnot = (
    e: React.MouseEvent<HTMLDivElement>,
    annot: AnnotationItem
  ) => {
    e.stopPropagation();
    setSelectedAnnotId(annot.id);
    setDraggingAnnotId(annot.id);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setInitialAnnotPos({ xPercent: annot.xPercent, yPercent: annot.yPercent });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingAnnotId || !dragStartPos || !initialAnnotPos || !canvasRef.current) return;
      const overlayRect = canvasRef.current.getBoundingClientRect();
      if (!overlayRect.width || !overlayRect.height) return;

      const deltaX = e.clientX - dragStartPos.x;
      const deltaY = e.clientY - dragStartPos.y;

      const deltaPercentX = (deltaX / overlayRect.width) * 100;
      const deltaPercentY = (deltaY / overlayRect.height) * 100;

      const newX = Math.max(0, Math.min(95, initialAnnotPos.xPercent + deltaPercentX));
      const newY = Math.max(0, Math.min(95, initialAnnotPos.yPercent + deltaPercentY));

      onUpdateAnnotation(draggingAnnotId, {
        xPercent: Math.round(newX * 10) / 10,
        yPercent: Math.round(newY * 10) / 10,
      });
    };

    const handleMouseUp = () => {
      setDraggingAnnotId(null);
      setDragStartPos(null);
      setInitialAnnotPos(null);
    };

    if (draggingAnnotId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingAnnotId, dragStartPos, initialAnnotPos, onUpdateAnnotation]);

  const pageAnnotations = annotations.filter((a) => a.pageIndex === currentPageIndex);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col items-center bg-slate-950/60 p-4 relative min-h-[550px] overflow-auto select-none"
    >
      {/* Zoom & Page Control Bar */}
      <div className="sticky top-2 z-20 flex items-center gap-3 bg-slate-900/90 border border-slate-700/80 px-4 py-2 rounded-xl shadow-xl backdrop-blur mb-4">
        {/* Page Nav */}
        <div className="flex items-center gap-1.5 border-r border-slate-700 pr-3">
          <button
            id="canvas-prev-page-btn"
            type="button"
            disabled={currentPageIndex <= 0}
            onClick={() => onPageChange(currentPageIndex - 1)}
            className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-semibold text-slate-200 min-w-[70px] text-center">
            Page {currentPageIndex + 1} / {totalPageCount}
          </span>

          <button
            id="canvas-next-page-btn"
            type="button"
            disabled={currentPageIndex >= totalPageCount - 1}
            onClick={() => onPageChange(currentPageIndex + 1)}
            className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <button
            id="canvas-zoom-out-btn"
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.15))}
            className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-medium text-slate-400 min-w-[42px] text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            id="canvas-zoom-in-btn"
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(1.8, z + 0.15))}
            className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Document View & Overlay Canvas */}
      <div className="relative shadow-2xl rounded-lg bg-white overflow-hidden border border-slate-300">
        {/* Loading Spinner */}
        {isLoadingPage && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-30 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* PDF Page Canvas */}
        <canvas ref={canvasRef} className="block pointer-events-none" />

        {/* Interactive Annotation Overlay */}
        <div
          id="canvas-interactive-overlay"
          onClick={handleOverlayClick}
          className="absolute inset-0 z-10 cursor-crosshair"
        >
          {pageAnnotations.map((annot) => {
            const isSelected = selectedAnnotId === annot.id;
            return (
              <div
                key={annot.id}
                id={`annot-item-${annot.id}`}
                onMouseDown={(e) => handleMouseDownOnAnnot(e, annot)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAnnotId(annot.id);
                }}
                className={`absolute group cursor-move transition-shadow ${
                  isSelected
                    ? 'ring-2 ring-indigo-500 shadow-lg'
                    : 'hover:ring-1 hover:ring-indigo-400'
                }`}
                style={{
                  left: `${annot.xPercent}%`,
                  top: `${annot.yPercent}%`,
                  width: `${annot.widthPercent}%`,
                  height: `${annot.heightPercent}%`,
                }}
              >
                {/* 1. SIGNATURE */}
                {annot.type === 'signature' && annot.imageBase64 && (
                  <div className="w-full h-full relative flex items-center justify-center p-1 bg-white/40 rounded border border-indigo-200/50">
                    <img
                      src={annot.imageBase64}
                      alt="Signature"
                      className="w-full h-full object-contain pointer-events-none"
                    />
                    <div className="absolute -bottom-3.5 left-0 right-0 text-center">
                      <span className="text-[9px] bg-slate-900/80 text-white px-1.5 py-0.2 rounded-full font-mono">
                        Signature
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. TEXT BOX */}
                {annot.type === 'text' && (
                  <div
                    className="w-full h-full p-1 rounded border border-slate-300 bg-white/85 flex items-center"
                    style={{ color: annot.color || '#0f172a' }}
                  >
                    <input
                      type="text"
                      value={annot.text || ''}
                      onChange={(e) => onUpdateAnnotation(annot.id, { text: e.target.value })}
                      className="w-full bg-transparent text-xs font-semibold focus:outline-none"
                      style={{ fontSize: `${annot.fontSize || 12}px` }}
                    />
                  </div>
                )}

                {/* 3. DATE STAMP */}
                {annot.type === 'date' && (
                  <div className="w-full h-full px-2 py-0.5 rounded border border-slate-300 bg-white/90 flex items-center justify-center text-[11px] font-mono text-slate-800 shadow-xs">
                    <span>{annot.text}</span>
                  </div>
                )}

                {/* 4. APPROVAL STAMP */}
                {annot.type === 'stamp' && (
                  <div
                    className="w-full h-full rounded border-2 border-dashed flex items-center justify-center font-bold tracking-widest text-xs uppercase shadow-sm bg-white/85"
                    style={{
                      borderColor: annot.color || '#dc2626',
                      color: annot.color || '#dc2626',
                    }}
                  >
                    {annot.text || 'APPROVED'}
                  </div>
                )}

                {/* 5. HIGHLIGHT */}
                {annot.type === 'highlight' && (
                  <div
                    className="w-full h-full rounded"
                    style={{
                      backgroundColor: annot.color || '#fef08a',
                      opacity: 0.45,
                    }}
                  />
                )}

                {/* 6. REDACTION / BLACKOUT */}
                {annot.type === 'redact' && (
                  <div className="w-full h-full bg-black rounded shadow-xs" />
                )}

                {/* 7. CHECKMARK */}
                {annot.type === 'checkmark' && (
                  <div className="w-full h-full flex items-center justify-center text-emerald-600 font-extrabold text-xl">
                    <Check className="w-full h-full" />
                  </div>
                )}

                {/* Action Floating Buttons when selected */}
                {isSelected && (
                  <div className="absolute -top-7 right-0 flex items-center gap-1 bg-slate-900 text-white rounded px-1.5 py-0.5 shadow-md text-[10px] z-30">
                    <span className="flex items-center gap-0.5 text-slate-300">
                      <Move className="w-2.5 h-2.5" /> Drag
                    </span>
                    <button
                      id={`delete-annot-${annot.id}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAnnotation(annot.id);
                      }}
                      className="p-0.5 text-rose-400 hover:text-rose-200 hover:bg-slate-800 rounded ml-1 cursor-pointer"
                      title="Delete element"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
