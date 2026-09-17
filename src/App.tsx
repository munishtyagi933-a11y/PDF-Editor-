import React, { useState } from 'react';
import { Header } from './components/Header';
import { MergeTool } from './components/MergeTool';
import { SignTool } from './components/SignTool';
import { EditAnnotateTool } from './components/EditAnnotateTool';
import { OrganizeTool } from './components/OrganizeTool';
import { SplitTool } from './components/SplitTool';
import { WatermarkTool } from './components/WatermarkTool';
import { ImagesToPdfTool } from './components/ImagesToPdfTool';
import { PdfToImagesTool } from './components/PdfToImagesTool';
import { PdfToOfficeTool } from './components/PdfToOfficeTool';
import { WordConverterTool } from './components/WordConverterTool';
import { CompressTool } from './components/CompressTool';
import { PasswordTool } from './components/PasswordTool';
import { ExtractTool } from './components/ExtractTool';
import { AiAssistantModal } from './components/AiAssistantModal';
import { createSampleDocument } from './utils/pdfOperations';
import type { ToolMode } from './types';
import { ShieldCheck, Zap, Sparkles } from 'lucide-react';

export default function App() {
  const [activeMode, setActiveMode] = useState<ToolMode>('merge');
  const [activePdfBuffer, setActivePdfBuffer] = useState<ArrayBuffer | null>(null);
  const [activePdfName, setActivePdfName] = useState<string>('');
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);

  // Load sample contract for instant demonstration
  const handleLoadSample = async () => {
    try {
      const sampleBytes = await createSampleDocument();
      const safeBuffer = sampleBytes.buffer.slice(
        sampleBytes.byteOffset,
        sampleBytes.byteOffset + sampleBytes.byteLength
      );
      setActivePdfBuffer(safeBuffer);
      setActivePdfName('Munish_Services_Agreement_2026.pdf');
    } catch (e) {
      console.error('Failed to create sample document:', e);
    }
  };

  const handleDocumentLoaded = (buffer: ArrayBuffer, name: string) => {
    setActivePdfBuffer(buffer);
    setActivePdfName(name);
  };

  const handleReset = () => {
    setActivePdfBuffer(null);
    setActivePdfName('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Header with Navigation & Brand */}
      <Header
        activeMode={activeMode}
        onSelectMode={(mode) => setActiveMode(mode)}
        onLoadSample={handleLoadSample}
        onOpenAiAssistant={() => setIsAiModalOpen(true)}
        onReset={handleReset}
        hasLoadedDocument={!!activePdfBuffer}
        activeDocName={activePdfName}
      />

      {/* Main Tool Container */}
      <main className="flex-1">
        {activeMode === 'merge' && (
          <MergeTool
            onDocumentMerged={(buffer, name) => {
              setActivePdfBuffer(buffer);
              setActivePdfName(name);
            }}
          />
        )}

        {activeMode === 'sign' && (
          <SignTool
            currentPdfBuffer={activePdfBuffer}
            currentPdfName={activePdfName || 'Document.pdf'}
            onPdfLoaded={handleDocumentLoaded}
          />
        )}

        {activeMode === 'edit' && (
          <EditAnnotateTool
            currentPdfBuffer={activePdfBuffer}
            currentPdfName={activePdfName || 'Document.pdf'}
            onPdfLoaded={handleDocumentLoaded}
          />
        )}

        {activeMode === 'pdf2img' && (
          <PdfToImagesTool
            currentPdfBuffer={activePdfBuffer}
            currentPdfName={activePdfName || 'Document.pdf'}
            onPdfLoaded={handleDocumentLoaded}
          />
        )}

        {activeMode === 'pdf2word' && (
          <PdfToOfficeTool
            currentPdfBuffer={activePdfBuffer}
            currentPdfName={activePdfName || 'Document.pdf'}
            defaultFormat="word"
            onPdfLoaded={handleDocumentLoaded}
          />
        )}

        {activeMode === 'pdf2excel' && (
          <PdfToOfficeTool
            currentPdfBuffer={activePdfBuffer}
            currentPdfName={activePdfName || 'Document.pdf'}
            defaultFormat="excel"
            onPdfLoaded={handleDocumentLoaded}
          />
        )}

        {activeMode === 'pdf2ppt' && (
          <PdfToOfficeTool
            currentPdfBuffer={activePdfBuffer}
            currentPdfName={activePdfName || 'Document.pdf'}
            defaultFormat="ppt"
            onPdfLoaded={handleDocumentLoaded}
          />
        )}

        {(activeMode === 'word2pdf' || activeMode === 'word2img') && (
          <WordConverterTool />
        )}

        {activeMode === 'compress' && (
          <CompressTool
            currentPdfBuffer={activePdfBuffer}
            currentPdfName={activePdfName || 'Document.pdf'}
            onPdfLoaded={handleDocumentLoaded}
          />
        )}

        {activeMode === 'password' && (
          <PasswordTool
            currentPdfBuffer={activePdfBuffer}
            currentPdfName={activePdfName || 'Document.pdf'}
            onPdfLoaded={handleDocumentLoaded}
          />
        )}

        {activeMode === 'extract' && (
          <ExtractTool
            currentPdfBuffer={activePdfBuffer}
            currentPdfName={activePdfName || 'Document.pdf'}
            onPdfLoaded={handleDocumentLoaded}
          />
        )}

        {activeMode === 'organize' && (
          <OrganizeTool
            currentPdfBuffer={activePdfBuffer}
            currentPdfName={activePdfName || 'Document.pdf'}
            onPdfLoaded={handleDocumentLoaded}
          />
        )}

        {activeMode === 'split' && (
          <SplitTool
            currentPdfBuffer={activePdfBuffer}
            currentPdfName={activePdfName || 'Document.pdf'}
            onPdfLoaded={handleDocumentLoaded}
          />
        )}

        {activeMode === 'watermark' && (
          <WatermarkTool
            currentPdfBuffer={activePdfBuffer}
            currentPdfName={activePdfName || 'Document.pdf'}
            onPdfLoaded={handleDocumentLoaded}
          />
        )}

        {activeMode === 'img2pdf' && <ImagesToPdfTool />}
      </main>

      {/* AI Assistant Modal */}
      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        pdfBuffer={activePdfBuffer}
        docName={activePdfName || 'Active Document'}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/60 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-200">PDF Editor Pro</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              100% Client-Side Privacy
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Gemini 3.8 AI Assistant
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveMode('merge')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Merge
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('sign')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Sign
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('edit')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('watermark')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Watermark
            </button>
            <span className="text-slate-600">|</span>
            <span className="text-slate-500 font-mono">v1.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
