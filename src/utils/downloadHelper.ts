/**
 * Safe client-side file download helper.
 * 
 * Critical: NEVER call URL.revokeObjectURL(url) synchronously immediately after a.click().
 * Doing so aborts downloads in Chromium/Edge/WebKit and mobile browsers before the download
 * stream finishes reading the blob, resulting in 0-byte or corrupted unopenable files.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  if (!blob || blob.size === 0) {
    console.error('downloadBlob error: Attempted to download an empty or null blob.', fileName);
    alert('Failed to download: The generated file is empty. Please try again.');
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();

  // Clean up DOM node
  setTimeout(() => {
    try {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    } catch {
      // ignore
    }
  }, 1000);

  // Keep the blob object URL alive for 60 seconds to allow slow browser download engines to complete
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }, 60000);
}

/**
 * Downloads a Uint8Array or ArrayBuffer as a named file
 */
export function downloadBytes(bytes: Uint8Array | ArrayBuffer, fileName: string, mimeType: string): void {
  const blob = new Blob([bytes], { type: mimeType });
  downloadBlob(blob, fileName);
}
