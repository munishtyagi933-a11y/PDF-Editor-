import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Send,
  FileText,
  AlertTriangle,
  Calendar,
  ListFilter,
  Bot,
  User,
  Copy,
  Check,
} from 'lucide-react';
import { extractTextFromPdf } from '../utils/pdfWorker';
import type { AiChatMessage } from '../types';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBuffer: ArrayBuffer | null;
  docName: string;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  pdfBuffer,
  docName,
}) => {
  const [extractedText, setExtractedText] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && pdfBuffer) {
      let isCancelled = false;
      setIsExtracting(true);
      extractTextFromPdf(pdfBuffer)
        .then((text) => {
          if (!isCancelled) {
            setExtractedText(text);
            setIsExtracting(false);
            if (messages.length === 0) {
              setMessages([
                {
                  id: 'intro',
                  role: 'assistant',
                  content: `Hello! I have analyzed **${docName}**. What would you like to know? You can ask me any question or click one of the quick analysis shortcuts below.`,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ]);
            }
          }
        })
        .catch((err) => {
          console.error(err);
          if (!isCancelled) setIsExtracting(false);
        });

      return () => {
        isCancelled = true;
      };
    }
  }, [isOpen, pdfBuffer, docName]);

  if (!isOpen) return null;

  const sendMessage = async (promptText: string, mode: 'summarize' | 'key_points' | 'qa' = 'qa') => {
    if (!promptText.trim() || isLoading) return;

    const userMsg: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          text: extractedText,
          mode,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze document');
      }

      const assistantMsg: AiChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.result || 'No response generated.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Error: ${err.message || 'Unable to connect to AI server. Please check GEMINI_API_KEY settings.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl h-[640px] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">AI Document Intelligence</h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                  Gemini 3.8
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-sm">
                Document: {docName}
              </p>
            </div>
          </div>
          <button
            id="ai-modal-close-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Action Pills */}
        <div className="px-6 py-2.5 bg-slate-800/60 border-b border-slate-800 flex flex-wrap gap-2">
          <button
            id="ai-quick-summary-btn"
            type="button"
            disabled={isLoading || isExtracting}
            onClick={() => sendMessage('Please give me an executive summary of this document.', 'summarize')}
            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-950/60 hover:bg-indigo-900/70 border border-indigo-700/60 rounded-lg text-xs font-semibold text-indigo-300 transition-colors cursor-pointer disabled:opacity-40"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Executive Summary</span>
          </button>

          <button
            id="ai-quick-keypoints-btn"
            type="button"
            disabled={isLoading || isExtracting}
            onClick={() =>
              sendMessage('Extract all critical dates, numerical terms, deadlines, and parties involved.', 'key_points')
            }
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition-colors cursor-pointer disabled:opacity-40"
          >
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            <span>Key Dates & Terms</span>
          </button>

          <button
            id="ai-quick-risk-btn"
            type="button"
            disabled={isLoading || isExtracting}
            onClick={() =>
              sendMessage('Scan this document for potential legal, commercial, or liability risks and termination clauses.')
            }
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition-colors cursor-pointer disabled:opacity-40"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Risk & Clauses Check</span>
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {isExtracting && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
              <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span>Reading and indexing PDF text...</span>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed relative group ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-800 border border-slate-700 text-slate-200'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

                {msg.role === 'assistant' && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(msg.content, msg.id)}
                    className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-slate-700/80 hover:bg-slate-600 text-slate-300 rounded cursor-pointer"
                    title="Copy to clipboard"
                  >
                    {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}

                <span className="block text-[10px] text-slate-400 mt-2 text-right">
                  {msg.timestamp}
                </span>
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 items-center">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-800 border border-slate-700 px-4 py-3 rounded-2xl flex items-center gap-2 text-xs text-slate-300">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse delay-75" />
                <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse delay-150" />
                <span className="ml-1">Analyzing document with Gemini...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(inputPrompt, 'qa');
            }}
            className="flex items-center gap-2"
          >
            <input
              id="ai-prompt-input"
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Ask anything about this PDF (e.g., What are the payment terms?)..."
              disabled={isLoading || isExtracting}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
            <button
              id="ai-send-btn"
              type="submit"
              disabled={!inputPrompt.trim() || isLoading || isExtracting}
              className="flex items-center justify-center w-10 h-10 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl shadow-md transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
