import React from 'react';
import {
  FileText,
  Layers,
  PenTool,
  FileEdit,
  Scissors,
  Stamp,
  RotateCw,
  Image as ImageIcon,
  Sparkles,
  FilePlus,
  RefreshCw,
  FileSpreadsheet,
  Minimize2,
  Lock,
  Search,
} from 'lucide-react';
import type { ToolMode } from '../types';

interface HeaderProps {
  activeMode: ToolMode;
  onSelectMode: (mode: ToolMode) => void;
  onLoadSample: () => void;
  onOpenAiAssistant: () => void;
  onReset: () => void;
  hasLoadedDocument: boolean;
  activeDocName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeMode,
  onSelectMode,
  onLoadSample,
  onOpenAiAssistant,
  onReset,
  hasLoadedDocument,
  activeDocName,
}) => {
  const navItems: { id: ToolMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'merge', label: 'Merge PDF', icon: Layers },
    { id: 'sign', label: 'Sign PDF', icon: PenTool },
    { id: 'edit', label: 'Edit & Annotate', icon: FileEdit },
    { id: 'pdf2img', label: 'PDF to Image', icon: ImageIcon },
    { id: 'pdf2word', label: 'PDF to Office', icon: FileSpreadsheet },
    { id: 'word2pdf', label: 'Word Converter', icon: FileText },
    { id: 'compress', label: 'Compress PDF & Img', icon: Minimize2 },
    { id: 'password', label: 'Password & Security', icon: Lock },
    { id: 'extract', label: 'Extract PDF', icon: Search },
    { id: 'organize', label: 'Organize Pages', icon: RotateCw },
    { id: 'split', label: 'Split & Extract', icon: Scissors },
    { id: 'watermark', label: 'Watermark', icon: Stamp },
    { id: 'img2pdf', label: 'Image to PDF', icon: ImageIcon },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-40">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-white">
                PDF Editor Pro
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                With Munish
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {activeDocName ? (
                <span className="text-slate-300 truncate max-w-xs inline-block align-bottom font-medium">
                  {activeDocName}
                </span>
              ) : (
                'Secure Client-Side Document Workspace'
              )}
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            id="header-load-sample-btn"
            type="button"
            onClick={onLoadSample}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 hover:text-white border border-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Load sample agreement for instant testing"
          >
            <FilePlus className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Try Sample PDF</span>
            <span className="sm:hidden">Sample</span>
          </button>

          <button
            id="header-ai-assistant-btn"
            type="button"
            onClick={onOpenAiAssistant}
            disabled={!hasLoadedDocument}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              hasLoadedDocument
                ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md shadow-indigo-500/25 hover:opacity-95'
                : 'bg-slate-800 text-slate-500 border border-slate-800 cursor-not-allowed'
            }`}
            title={hasLoadedDocument ? 'Ask AI, Summarize & Analyze document' : 'Load a document first to use AI'}
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>AI Insights</span>
          </button>

          {hasLoadedDocument && (
            <button
              id="header-reset-btn"
              type="button"
              onClick={onReset}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close current document"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Feature Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <nav className="flex flex-wrap items-center gap-1.5 sm:gap-2 py-2 border-t border-slate-800/60" aria-label="Tools">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMode === item.id;
            return (
              <button
                id={`nav-tab-${item.id}`}
                key={item.id}
                type="button"
                onClick={() => onSelectMode(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold leading-snug transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="whitespace-normal break-words">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
