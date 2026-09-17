import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker source using a reliable CDN version matching pdfjs-dist
// or using unpkg / cdnjs
const PDFJS_VERSION = pdfjsLib.version || '3.11.174';

try {
  // @ts-ignore
  if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn('Could not set workerSrc directly, falling back:', e);
}

export { pdfjsLib };

/**
 * Render a specific page of a PDF ArrayBuffer to an HTMLCanvasElement
 */
export async function renderPdfPageToCanvas(
  pdfBuffer: ArrayBuffer,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  desiredWidth?: number,
  isCancelled?: () => boolean
): Promise<{ originalWidth: number; originalHeight: number; scale: number }> {
  // CRITICAL: Always slice/clone the ArrayBuffer before passing to pdfjsLib.
  // PDF.js worker transfers the buffer via postMessage which permanently detaches it.
  const bufferClone = pdfBuffer.slice(0);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bufferClone) });
  const pdfDoc = await loadingTask.promise;

  if (isCancelled && isCancelled()) {
    return { originalWidth: 0, originalHeight: 0, scale: 1 };
  }

  const page = await pdfDoc.getPage(pageNumber);

  const unscaledViewport = page.getViewport({ scale: 1 });
  const scale = desiredWidth ? desiredWidth / unscaledViewport.width : 1.5;
  const viewport = page.getViewport({ scale });

  // Use an isolated offscreen canvas for the PDF.js render pipeline.
  // This prevents: "Cannot use the same canvas during multiple render() operations"
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = Math.max(1, Math.floor(viewport.width));
  offscreenCanvas.height = Math.max(1, Math.floor(viewport.height));

  const offscreenCtx = offscreenCanvas.getContext('2d');
  if (!offscreenCtx) {
    throw new Error('Canvas 2D context not available');
  }

  const renderContext = {
    canvasContext: offscreenCtx,
    viewport: viewport,
  };

  // @ts-ignore
  const renderTask = page.render(renderContext);
  await renderTask.promise;

  if (isCancelled && isCancelled()) {
    return {
      originalWidth: unscaledViewport.width,
      originalHeight: unscaledViewport.height,
      scale,
    };
  }

  // Atomically blit the rendered offscreen canvas to the visible target canvas
  canvas.width = offscreenCanvas.width;
  canvas.height = offscreenCanvas.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreenCanvas, 0, 0);
  }

  return {
    originalWidth: unscaledViewport.width,
    originalHeight: unscaledViewport.height,
    scale,
  };
}

/**
 * Generate a data URL thumbnail for page 1 of a PDF
 */
export async function generatePdfThumbnail(
  pdfBuffer: ArrayBuffer,
  pageNumber = 1,
  thumbnailWidth = 200
): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    await renderPdfPageToCanvas(pdfBuffer, pageNumber, canvas, thumbnailWidth);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch (err) {
    console.error('Failed to generate thumbnail:', err);
    return '';
  }
}

/**
 * Extract all text from a PDF ArrayBuffer for AI reading & search
 */
export async function extractTextFromPdf(pdfBuffer: ArrayBuffer): Promise<string> {
  try {
    const bufferClone = pdfBuffer.slice(0);
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bufferClone) });
    const pdfDoc = await loadingTask.promise;
    let fullText = '';

    const maxPages = Math.min(pdfDoc.numPages, 30);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');
      fullText += `--- Page ${i} ---\n` + pageText + '\n\n';
    }

    return fullText.trim();
  } catch (err) {
    console.error('Text extraction error:', err);
    return 'Could not extract raw text from this document. It may contain scanned image pages.';
  }
}
