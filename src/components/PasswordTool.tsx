import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  Key,
  ShieldCheck,
  Download,
  Upload,
  Sparkles,
  Eye,
  EyeOff,
  FileCheck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { protectPdf, unlockPdf } from '../utils/conversionOperations';
import { createSampleDocument } from '../utils/pdfOperations';

interface PasswordToolProps {
  currentPdfBuffer?: ArrayBuffer | null;
  currentPdfName?: string;
  onPdfLoaded?: (buffer: ArrayBuffer, name: string) => void;
}

export const PasswordTool: React.FC<PasswordToolProps> = ({
  currentPdfBuffer,
  currentPdfName = 'Document.pdf',
  onPdfLoaded,
}) => {
  const [activeTab, setActiveTab] = useState<'protect' | 'unlock'>('protect');

  // Protect State
  const [protectBuffer, setProtectBuffer] = useState<ArrayBuffer | null>(null);
  const [protectDocName, setProtectDocName] = useState<string>(currentPdfName);
  const [userPassword, setUserPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showUserPassword, setShowUserPassword] = useState<boolean>(false);
  const [isProtecting, setIsProtecting] = useState<boolean>(false);
  const [protectedPdfBytes, setProtectedPdfBytes] = useState<Uint8Array | null>(null);

  // Unlock State
  const [unlockBuffer, setUnlockBuffer] = useState<ArrayBuffer | null>(null);
  const [unlockDocName, setUnlockDocName] = useState<string>('');
  const [unlockPassword, setUnlockPassword] = useState<string>('');
  const [showUnlockPassword, setShowUnlockPassword] = useState<boolean>(false);
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);
  const [unlockedPdfBytes, setUnlockedPdfBytes] = useState<Uint8Array | null>(null);
  const [unlockError, setUnlockError] = useState<string>('');

  useEffect(() => {
    if (currentPdfBuffer) {
      setProtectBuffer(currentPdfBuffer);
      setProtectDocName(currentPdfName);
      setProtectedPdfBytes(null);
    }
  }, [currentPdfBuffer, currentPdfName]);

  const handleProtectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await file.arrayBuffer();
    const safeBuffer = raw.slice(0);
    setProtectBuffer(safeBuffer);
    setProtectDocName(file.name);
    setProtectedPdfBytes(null);
    if (onPdfLoaded) onPdfLoaded(safeBuffer, file.name);
  };

  const handleUnlockFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await file.arrayBuffer();
    setUnlockBuffer(raw.slice(0));
    setUnlockDocName(file.name);
    setUnlockedPdfBytes(null);
    setUnlockError('');
  };

  const handleLoadSampleToProtect = async () => {
    try {
      const sample = await createSampleDocument();
      const safeBuffer = sample.buffer.slice(
        sample.byteOffset,
        sample.byteOffset + sample.byteLength
      );
      setProtectBuffer(safeBuffer);
      setProtectDocName('Confidential_Executive_Report.pdf');
      setProtectedPdfBytes(null);
      if (onPdfLoaded) onPdfLoaded(safeBuffer, 'Confidential_Executive_Report.pdf');
    } catch (e) {
      console.error(e);
    }
  };

  const handleProtect = async () => {
    if (!protectBuffer) return;
    if (!userPassword) {
      alert('Please enter a password to protect the PDF.');
      return;
    }
    if (userPassword !== confirmPassword) {
      alert('Passwords do not match. Please re-enter.');
      return;
    }

    setIsProtecting(true);
    try {
      const encrypted = await protectPdf(protectBuffer, userPassword);
      setProtectedPdfBytes(encrypted);

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      console.error(err);
      alert(`Protection failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProtecting(false);
    }
  };

  const handleDownloadProtected = () => {
    if (!protectedPdfBytes) return;
    const blob = new Blob([protectedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const base = protectDocName.replace(/\.pdf$/i, '');
    a.download = `${base}_protected.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUnlock = async () => {
    if (!unlockBuffer) return;
    if (!unlockPassword) {
      setUnlockError('Please enter the document password.');
      return;
    }

    setIsUnlocking(true);
    setUnlockError('');
    try {
      const decrypted = await unlockPdf(unlockBuffer, unlockPassword);
      setUnlockedPdfBytes(decrypted);

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      console.error(err);
      setUnlockError('Incorrect password or unable to decrypt this PDF. Please verify.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleDownloadUnlocked = () => {
    if (!unlockedPdfBytes) return;
    const blob = new Blob([unlockedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const base = unlockDocName.replace(/\.pdf$/i, '');
    a.download = `${base}_unlocked.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">PDF Password & Security</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Encrypt your PDF with a password or unlock protected files
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap items-center p-1 bg-slate-900 border border-slate-800 rounded-xl gap-1">
          <button
            id="pwd-tab-protect"
            type="button"
            onClick={() => setActiveTab('protect')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'protect'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-normal break-words">Protect PDF</span>
          </button>

          <button
            id="pwd-tab-unlock"
            type="button"
            onClick={() => setActiveTab('unlock')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'unlock'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Unlock className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-normal break-words">Unlock PDF</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PROTECT PDF */}
      {activeTab === 'protect' && (
        <div className="space-y-6">
          {!protectBuffer && (
            <div className="max-w-2xl mx-auto my-8">
              <label
                htmlFor="protect-pdf-upload"
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all shadow-inner group"
              >
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-400 flex items-center justify-center transition-colors">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-white">Upload PDF to Password Protect</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Secures document with strong encryption. Requires password to open.
                  </p>
                </div>
                <input
                  id="protect-pdf-upload"
                  type="file"
                  accept="application/pdf"
                  onChange={handleProtectFileUpload}
                  className="hidden"
                />
              </label>

              <div className="text-center mt-4">
                <button
                  id="protect-sample-btn"
                  type="button"
                  onClick={handleLoadSampleToProtect}
                  className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Or load sample document to test encryption
                </button>
              </div>
            </div>
          )}

          {protectBuffer && (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{protectDocName}</p>
                    <p className="text-[11px] text-slate-400">
                      Standard RC4 128-Bit Encryption
                    </p>
                  </div>
                </div>

                <label
                  htmlFor="protect-change-file"
                  className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer transition-colors"
                >
                  Change File
                  <input
                    id="protect-change-file"
                    type="file"
                    accept="application/pdf"
                    onChange={handleProtectFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Password Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Set User Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="protect-pwd-input"
                      type={showUserPassword ? 'text' : 'password'}
                      placeholder="Enter strong password"
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowUserPassword(!showUserPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showUserPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Confirm Password <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="protect-pwd-confirm"
                    type={showUserPassword ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none"
                  />
                </div>
              </div>

              {/* Security Badges */}
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center gap-3 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <span>
                  The password protects your document against unauthorized viewing. Keep this password safe as it cannot be recovered if forgotten.
                </span>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-[11px] text-slate-500">
                  {userPassword && confirmPassword && userPassword === confirmPassword ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                    </span>
                  ) : userPassword && confirmPassword ? (
                    <span className="text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    id="protect-action-btn"
                    type="button"
                    onClick={handleProtect}
                    disabled={isProtecting || !userPassword || userPassword !== confirmPassword}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isProtecting ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    <span>{isProtecting ? 'Encrypting PDF...' : 'Protect PDF Now'}</span>
                  </button>

                  {protectedPdfBytes && (
                    <button
                      id="protect-download-btn"
                      type="button"
                      onClick={handleDownloadProtected}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Protected PDF</span>
                    </button>
                  )}
                </div>
              </div>

              {protectedPdfBytes && (
                <div className="p-4 bg-emerald-950/40 border border-emerald-800/70 rounded-2xl flex items-center justify-between text-emerald-300 text-xs">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    <span>PDF successfully encrypted with password protection!</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadProtected}
                    className="underline font-bold hover:text-white cursor-pointer"
                  >
                    Download Now
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: UNLOCK / DECRYPT PDF */}
      {activeTab === 'unlock' && (
        <div className="space-y-6">
          {!unlockBuffer && (
            <div className="max-w-2xl mx-auto my-8">
              <label
                htmlFor="unlock-pdf-upload"
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all shadow-inner group"
              >
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-400 flex items-center justify-center transition-colors">
                  <Unlock className="w-7 h-7" />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-white">Upload Password-Protected PDF</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Enter the document password to permanently remove encryption and save a clean PDF.
                  </p>
                </div>
                <input
                  id="unlock-pdf-upload"
                  type="file"
                  accept="application/pdf"
                  onChange={handleUnlockFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {unlockBuffer && (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{unlockDocName}</p>
                    <p className="text-[11px] text-slate-400">
                      Enter the existing document password to unlock
                    </p>
                  </div>
                </div>

                <label
                  htmlFor="unlock-change-file"
                  className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer transition-colors"
                >
                  Change File
                  <input
                    id="unlock-change-file"
                    type="file"
                    accept="application/pdf"
                    onChange={handleUnlockFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Password Input */}
              <div className="max-w-md">
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Document Password
                </label>
                <div className="relative">
                  <input
                    id="unlock-pwd-input"
                    type={showUnlockPassword ? 'text' : 'password'}
                    placeholder="Enter document password"
                    value={unlockPassword}
                    onChange={(e) => {
                      setUnlockPassword(e.target.value);
                      setUnlockError('');
                    }}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showUnlockPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {unlockError && (
                <div className="p-3 bg-red-950/40 border border-red-800/70 rounded-xl flex items-center gap-2 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{unlockError}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  id="unlock-action-btn"
                  type="button"
                  onClick={handleUnlock}
                  disabled={isUnlocking || !unlockPassword}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isUnlocking ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )}
                  <span>{isUnlocking ? 'Decrypting...' : 'Unlock & Remove Password'}</span>
                </button>

                {unlockedPdfBytes && (
                  <button
                    id="unlock-download-btn"
                    type="button"
                    onClick={handleDownloadUnlocked}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Unlocked PDF</span>
                  </button>
                )}
              </div>

              {unlockedPdfBytes && (
                <div className="p-4 bg-emerald-950/40 border border-emerald-800/70 rounded-2xl flex items-center justify-between text-emerald-300 text-xs">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    <span>Password successfully removed! Clean unlocked PDF ready.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadUnlocked}
                    className="underline font-bold hover:text-white cursor-pointer"
                  >
                    Download PDF
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
