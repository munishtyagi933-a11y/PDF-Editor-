import {
  PDFDocument,
  rgb,
  StandardFonts,
  degrees,
} from 'pdf-lib';
import type { AnnotationItem } from '../types';

/**
 * Helper to convert Hex color to pdf-lib rgb values (0 - 1)
 */
function hexToRgb(hex: string) {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255 || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255 || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255 || 0;
  return rgb(r, g, b);
}

/**
 * Merge multiple PDF array buffers into a single PDF
 */
export async function mergePdfs(pdfBuffers: ArrayBuffer[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();

  for (const buffer of pdfBuffers) {
    const safeBuffer = buffer.slice(0);
    const pdf = await PDFDocument.load(safeBuffer, { ignoreEncryption: true });
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  return await mergedPdf.save();
}

/**
 * Split/Extract specified pages from a PDF
 */
export async function extractPagesFromPdf(
  pdfBuffer: ArrayBuffer,
  pageIndices: number[]
): Promise<Uint8Array> {
  const srcPdf = await PDFDocument.load(pdfBuffer.slice(0), { ignoreEncryption: true });
  const newPdf = await PDFDocument.create();

  const validIndices = pageIndices.filter(
    (idx) => idx >= 0 && idx < srcPdf.getPageCount()
  );

  const copiedPages = await newPdf.copyPages(srcPdf, validIndices);
  copiedPages.forEach((page) => newPdf.addPage(page));

  return await newPdf.save();
}

/**
 * Reorder, rotate, or delete pages in a PDF
 */
export async function organizePdf(
  pdfBuffer: ArrayBuffer,
  pagesConfig: { pageIndex: number; rotation: number }[]
): Promise<Uint8Array> {
  const srcPdf = await PDFDocument.load(pdfBuffer.slice(0), { ignoreEncryption: true });
  const newPdf = await PDFDocument.create();

  const indicesToCopy = pagesConfig.map((p) => p.pageIndex);
  const copiedPages = await newPdf.copyPages(srcPdf, indicesToCopy);

  copiedPages.forEach((page, i) => {
    const config = pagesConfig[i];
    const currentRotation = page.getRotation().angle;
    const additionalRotation = (config.rotation || 0) % 360;
    page.setRotation(degrees((currentRotation + additionalRotation) % 360));
    newPdf.addPage(page);
  });

  return await newPdf.save();
}

/**
 * Apply Watermark & Page numbers across all pages
 */
export async function addWatermarkAndPageNumbers(
  pdfBuffer: ArrayBuffer,
  options: {
    watermarkText?: string;
    watermarkOpacity?: number;
    watermarkColor?: string;
    includePageNumbers?: boolean;
    pageNumberFormat?: 'standard' | 'page_of_total';
    pageNumberPosition?: 'bottom-center' | 'bottom-right' | 'top-right';
  }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer.slice(0), { ignoreEncryption: true });
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;

  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();

    // 1. Watermark
    if (options.watermarkText && options.watermarkText.trim().length > 0) {
      const text = options.watermarkText.trim().toUpperCase();
      const fontSize = Math.min(width, height) * 0.12;
      const textWidth = helveticaBold.widthOfTextAtSize(text, fontSize);
      const textHeight = helveticaBold.heightAtSize(fontSize);
      const color = options.watermarkColor
        ? hexToRgb(options.watermarkColor)
        : rgb(0.65, 0.65, 0.7);
      const opacity = options.watermarkOpacity ?? 0.22;

      page.drawText(text, {
        x: width / 2 - (textWidth / 2) * Math.cos(Math.PI / 4),
        y: height / 2 - (textHeight / 2) * Math.sin(Math.PI / 4),
        size: fontSize,
        font: helveticaBold,
        color,
        opacity,
        rotate: degrees(45),
      });
    }

    // 2. Page Numbers
    if (options.includePageNumbers) {
      const pageNum = i + 1;
      const numText =
        options.pageNumberFormat === 'page_of_total'
          ? `Page ${pageNum} of ${totalPages}`
          : `${pageNum}`;

      const numFontSize = 10;
      const numWidth = helvetica.widthOfTextAtSize(numText, numFontSize);

      let x = width - numWidth - 36;
      let y = 24;

      if (options.pageNumberPosition === 'bottom-center') {
        x = (width - numWidth) / 2;
        y = 24;
      } else if (options.pageNumberPosition === 'top-right') {
        x = width - numWidth - 36;
        y = height - 30;
      }

      page.drawText(numText, {
        x,
        y,
        size: numFontSize,
        font: helvetica,
        color: rgb(0.35, 0.35, 0.4),
      });
    }
  }

  return await pdfDoc.save();
}

/**
 * Convert Image files to a single PDF
 */
export async function imagesToPdf(
  images: { dataUrl: string; name: string }[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  for (const imgItem of images) {
    let embeddedImg;
    if (imgItem.dataUrl.includes('image/png')) {
      embeddedImg = await pdfDoc.embedPng(imgItem.dataUrl);
    } else {
      embeddedImg = await pdfDoc.embedJpg(imgItem.dataUrl);
    }

    const { width, height } = embeddedImg;
    // Standard A4 or fit to image
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  return await pdfDoc.save();
}

/**
 * Apply annotations and signatures to a PDF
 */
export async function applyAnnotationsToPdf(
  pdfBuffer: ArrayBuffer,
  annotations: AnnotationItem[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer.slice(0), { ignoreEncryption: true });
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  for (const annot of annotations) {
    if (annot.pageIndex >= pages.length) continue;
    const page = pages[annot.pageIndex];
    const { width, height } = page.getSize();

    // Map percentage to PDF coordinate system (origin is bottom-left)
    const x = (annot.xPercent / 100) * width;
    const w = (annot.widthPercent / 100) * width;
    const h = (annot.heightPercent / 100) * height;
    const y = height - (annot.yPercent / 100) * height - h;

    if (annot.type === 'signature' && annot.imageBase64) {
      try {
        let signatureImg;
        if (annot.imageBase64.includes('image/png')) {
          signatureImg = await pdfDoc.embedPng(annot.imageBase64);
        } else {
          signatureImg = await pdfDoc.embedJpg(annot.imageBase64);
        }
        page.drawImage(signatureImg, {
          x,
          y,
          width: w,
          height: h,
        });
      } catch (err) {
        console.error('Failed to embed signature image:', err);
      }
    } else if (annot.type === 'text' || annot.type === 'date') {
      const textColor = annot.color ? hexToRgb(annot.color) : rgb(0.1, 0.1, 0.1);
      const fontSize = annot.fontSize || 13;
      page.drawText(annot.text || '', {
        x: x + 4,
        y: y + h - fontSize - 2,
        size: fontSize,
        font: annot.isDate ? helvetica : helveticaBold,
        color: textColor,
      });
    } else if (annot.type === 'stamp') {
      // Draw stamp bordered badge
      const stampColor = annot.color ? hexToRgb(annot.color) : rgb(0.85, 0.15, 0.15);
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        borderColor: stampColor,
        borderWidth: 2,
        color: rgb(1, 1, 1),
        opacity: 0.85,
      });
      const fontSize = Math.min(h * 0.45, 14);
      const text = annot.text || 'APPROVED';
      const textWidth = helveticaBold.widthOfTextAtSize(text, fontSize);
      page.drawText(text, {
        x: x + (w - textWidth) / 2,
        y: y + (h - fontSize) / 2,
        size: fontSize,
        font: helveticaBold,
        color: stampColor,
      });
    } else if (annot.type === 'highlight') {
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        color: annot.color ? hexToRgb(annot.color) : rgb(1, 0.95, 0.2),
        opacity: 0.38,
      });
    } else if (annot.type === 'redact') {
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        color: rgb(0.05, 0.05, 0.05),
        opacity: 1,
      });
    } else if (annot.type === 'checkmark') {
      const checkColor = annot.color ? hexToRgb(annot.color) : rgb(0.1, 0.65, 0.2);
      page.drawText('✓', {
        x: x + 2,
        y: y + 2,
        size: Math.min(w, h),
        font: helveticaBold,
        color: checkColor,
      });
    }
  }

  return await pdfDoc.save();
}

/**
 * Generate a realistic sample PDF (Service Agreement & NDA) for instant demonstration
 */
export async function createSampleDocument(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const times = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Page 1: Master Services Agreement
  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width: p1W, height: p1H } = page1.getSize();

  // Top header accent line
  page1.drawRectangle({
    x: 40,
    y: p1H - 45,
    width: p1W - 80,
    height: 4,
    color: rgb(0.25, 0.38, 0.95),
  });

  page1.drawText('MASTER CONSULTING & PROFESSIONAL SERVICES AGREEMENT', {
    x: 40,
    y: p1H - 75,
    size: 14,
    font: helveticaBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  page1.drawText('Document ID: MSA-2026-0982 • Prepared by Munish Tyagi', {
    x: 40,
    y: p1H - 95,
    size: 9.5,
    font: helvetica,
    color: rgb(0.4, 0.45, 0.55),
  });

  const bodyLines = [
    'This Professional Services Agreement (the "Agreement") is entered into as of September 16, 2026,',
    'by and between MUNISH SOLUTIONS INC. ("Provider") and the undersigned CLIENT ("Recipient").',
    '',
    '1. SCOPE OF SERVICES & DELIVERABLES',
    'Provider agrees to deliver comprehensive digital engineering, system architecture review, and PDF',
    'automation workflows as described in Schedule A. All work shall be performed in a professional manner,',
    'conforming to rigorous industry security and compliance standards.',
    '',
    '2. PAYMENT TERMS & SCHEDULE',
    'Payment for consulting retainers is due within fifteen (15) days of invoice date. Overdue amounts',
    'shall accrue interest at 1.5% per month or the statutory maximum rate allowable by law.',
    '',
    '3. CONFIDENTIALITY & PROPRIETARY RIGHTS',
    'All proprietary source code, trade secrets, data sets, and customer communications shall remain',
    'strictly confidential. Neither party shall disclose Confidential Information to third parties without',
    'prior explicit written authorization.',
    '',
    '4. TERM, TERMINATION & JURISDICTION',
    'This Agreement shall remain in effect for twelve (12) months. Either party may terminate with 30 days',
    'written notice. Governed under the commercial laws of the State of California.',
  ];

  let currentY = p1H - 135;
  for (const line of bodyLines) {
    if (line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.') || line.startsWith('4.')) {
      currentY -= 6;
      page1.drawText(line, {
        x: 40,
        y: currentY,
        size: 11,
        font: timesBold,
        color: rgb(0.15, 0.2, 0.35),
      });
      currentY -= 16;
    } else {
      page1.drawText(line, {
        x: 40,
        y: currentY,
        size: 10,
        font: times,
        color: rgb(0.2, 0.25, 0.3),
      });
      currentY -= 15;
    }
  }

  // Signature Block at Bottom of Page 1
  currentY -= 30;
  page1.drawRectangle({
    x: 40,
    y: currentY - 100,
    width: p1W - 80,
    height: 110,
    color: rgb(0.97, 0.98, 1),
    borderColor: rgb(0.8, 0.85, 0.95),
    borderWidth: 1,
  });

  page1.drawText('EXECUTION & SIGNATURES', {
    x: 55,
    y: currentY - 20,
    size: 10,
    font: helveticaBold,
    color: rgb(0.2, 0.3, 0.7),
  });

  // Left party (Provider)
  page1.drawText('PROVIDER: Munish Tyagi', {
    x: 55,
    y: currentY - 42,
    size: 9.5,
    font: helveticaBold,
    color: rgb(0.15, 0.2, 0.3),
  });
  page1.drawText('Signature: Munish Tyagi (Authorized Partner)', {
    x: 55,
    y: currentY - 60,
    size: 9,
    font: helvetica,
    color: rgb(0.3, 0.35, 0.45),
  });
  page1.drawText('Date: September 16, 2026', {
    x: 55,
    y: currentY - 78,
    size: 9,
    font: helvetica,
    color: rgb(0.4, 0.45, 0.55),
  });

  // Right party (Client - Place your signature here!)
  page1.drawText('CLIENT / RECIPIENT:', {
    x: 310,
    y: currentY - 42,
    size: 9.5,
    font: helveticaBold,
    color: rgb(0.15, 0.2, 0.3),
  });
  page1.drawText('[ PLACE SIGNATURE HERE ]', {
    x: 310,
    y: currentY - 60,
    size: 9,
    font: helveticaBold,
    color: rgb(0.8, 0.2, 0.2),
  });
  page1.drawText('Date: ________________________', {
    x: 310,
    y: currentY - 78,
    size: 9,
    font: helvetica,
    color: rgb(0.4, 0.45, 0.55),
  });

  // Page 2: Statement of Work & Acceptance
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  page2.drawRectangle({
    x: 40,
    y: p1H - 45,
    width: p1W - 80,
    height: 4,
    color: rgb(0.25, 0.38, 0.95),
  });

  page2.drawText('SCHEDULE A: STATEMENT OF WORK & MILESTONES', {
    x: 40,
    y: p1H - 75,
    size: 13,
    font: helveticaBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  const p2Lines = [
    'Milestone 1: PDF Merge & Manipulation Engine Core (Week 1 - Completed)',
    'Milestone 2: Electronic Signatures & Canvas Placement (Week 2 - Completed)',
    'Milestone 3: Page Reordering, Splitting, and Redaction (Week 3 - Completed)',
    'Milestone 4: AI Document Intelligence & Summary Integration (Week 4 - Completed)',
    '',
    'All deliverables have been tested and verified across modern browsers.',
    'Sign off below to confirm formal inspection and receipt of all deliverables.',
  ];

  let p2Y = p1H - 110;
  for (const line of p2Lines) {
    page2.drawText(line, {
      x: 40,
      y: p2Y,
      size: 10,
      font: line.includes('Milestone') ? helveticaBold : times,
      color: rgb(0.2, 0.25, 0.3),
    });
    p2Y -= 20;
  }

  // Stamp placement placeholder
  page2.drawRectangle({
    x: 40,
    y: p2Y - 80,
    width: 220,
    height: 60,
    borderColor: rgb(0.7, 0.75, 0.85),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.99),
  });
  page2.drawText('STAMP / APPROVAL AREA', {
    x: 55,
    y: p2Y - 50,
    size: 9,
    font: helveticaBold,
    color: rgb(0.5, 0.55, 0.65),
  });

  return await pdfDoc.save();
}
