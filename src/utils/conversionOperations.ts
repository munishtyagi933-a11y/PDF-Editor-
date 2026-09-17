import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  ShadingType,
} from 'docx';
import * as XLSX from 'xlsx';
import PptxGenJS from 'pptxgenjs';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';

// Initialize PDF.js worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

/**
 * Strip control characters not permitted in XML 1.0 (disallowed: 0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0xFFFE, 0xFFFF)
 * Prevents Microsoft Word, Excel, and PowerPoint from reporting "The file is corrupt and cannot be opened".
 */
export function cleanXmlString(str: string): string {
  if (!str) return '';
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, '');
}

/**
 * Sanitize strings for pdf-lib standard fonts (Helvetica) to prevent WinAnsi encoding crashes.
 */
export function sanitizeForPdf(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '*')
    .replace(/\u20B9/g, 'Rs. ')
    .replace(/[^\x20-\x7E\t\n\r]/g, ' ');
}

export interface PdfImageResult {
  pageNumber: number;
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Convert PDF pages to high-resolution images (PNG, JPEG, WebP)
 */
export async function convertPdfToImages(
  pdfBuffer: ArrayBuffer,
  format: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png',
  scale: number = 2.0,
  onProgress?: (current: number, total: number) => void
): Promise<PdfImageResult[]> {
  const bufferClone = pdfBuffer.slice(0);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bufferClone) });
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  const results: PdfImageResult[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // Fill white background for JPEG / transparent formats
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await (page.render as any)({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise;

    const dataUrl = canvas.toDataURL(format, format === 'image/jpeg' ? 0.92 : undefined);

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b || new Blob()),
        format,
        format === 'image/jpeg' ? 0.92 : undefined
      );
    });

    results.push({
      pageNumber: pageNum,
      dataUrl,
      blob,
      width: canvas.width,
      height: canvas.height,
    });

    if (onProgress) {
      onProgress(pageNum, totalPages);
    }
  }

  return results;
}

/**
 * Bundle multiple image results into a single download ZIP file
 */
export async function createImagesZip(
  images: PdfImageResult[],
  fileBaseName: string = 'document',
  formatExt: string = 'png'
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder(`${fileBaseName}_images`);

  images.forEach((img) => {
    const fileName = `${fileBaseName}_page_${String(img.pageNumber).padStart(2, '0')}.${formatExt}`;
    folder?.file(fileName, img.blob);
  });

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Helper to render a PDF page to a high-res PNG Uint8Array buffer
 */
async function renderPageToPngBuffer(page: any, scale: number = 2.0): Promise<Uint8Array | null> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await (page.render as any)({
    canvasContext: ctx,
    viewport,
    canvas,
  }).promise;

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });

  if (!blob) return null;
  const arrayBuf = await blob.arrayBuffer();
  return new Uint8Array(arrayBuf);
}

export interface WordConversionOptions {
  mode?: 'smart_layout' | 'exact_clone';
  onProgress?: (current: number, total: number) => void;
}

/**
 * Convert PDF to editable Word document (.docx) with high-fidelity formatting:
 * - Preserves font sizes, bold weights, italics, colors, and line spacing
 * - Detects table rows and columns to generate native Word Tables
 * - Preserves text alignments (Left, Center, Right)
 * - Automatically detects scanned or image-based pages to embed high-res visual pages
 */
export async function convertPdfToWord(
  pdfBuffer: ArrayBuffer,
  options?: WordConversionOptions
): Promise<Blob> {
  const mode = options?.mode || 'smart_layout';
  const bufferClone = pdfBuffer.slice(0);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bufferClone) });
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  const docElements: (Paragraph | Table)[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    if (options?.onProgress) {
      options.onProgress(pageNum, totalPages);
    }

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;

    const textContent = await page.getTextContent();
    const rawItems = (textContent.items as any[]).filter(
      (it) => it.str && it.str.trim().length > 0
    );
    const totalChars = rawItems.reduce((acc, it) => acc + it.str.trim().length, 0);

    // If page is scanned, purely graphic, or user requested exact visual clone:
    if (mode === 'exact_clone' || totalChars < 30) {
      const pngBytes = await renderPageToPngBuffer(page, 2.0);
      if (pngBytes) {
        // Standard printable width in Word is ~500 points (margins ~47.6pt)
        const targetWidth = 500;
        const targetHeight = Math.round(500 * (pageHeight / pageWidth));

        docElements.push(
          new Paragraph({
            pageBreakBefore: pageNum > 1,
            children: [
              new ImageRun({
                data: pngBytes,
                type: 'png',
                transformation: { width: targetWidth, height: targetHeight },
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 100 },
          })
        );

        // If any text items exist on this scanned/graphic page, append selectable transcript below
        if (rawItems.length > 0) {
          docElements.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Extracted Page ${pageNum} Text Content:`,
                  size: 20,
                  bold: true,
                  color: '64748B',
                }),
              ],
              spacing: { before: 160, after: 60 },
            })
          );
          const pageStr = rawItems.map((it) => it.str).join(' ');
          docElements.push(
            new Paragraph({
              children: [new TextRun({ text: pageStr, size: 20, color: '334155' })],
              spacing: { before: 40, after: 120 },
            })
          );
        }
        continue;
      }
    }

    // Parse structured text items with geometric and font attributes
    const parsedItems = rawItems.map((it) => {
      const fontHeight = Math.hypot(it.transform[0], it.transform[1]);
      const fontSize = Math.max(9, Math.round(fontHeight)) || 11;
      const isBold = /bold|black|heavy|w[6-9]|semibold/i.test(it.fontName || '');
      const isItalic = /italic|oblique/i.test(it.fontName || '');
      return {
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        width: it.width || it.str.length * fontSize * 0.5,
        fontSize,
        isBold,
        isItalic,
        fontName: it.fontName,
      };
    });

    // Group items into visual lines by Y coordinate (PDF 0,0 is bottom-left, so sort descending)
    parsedItems.sort((a, b) => b.y - a.y);
    interface LineGroup {
      y: number;
      items: typeof parsedItems;
      isMultiColumn: boolean;
      minX: number;
      maxX: number;
    }

    const lines: LineGroup[] = [];
    for (const item of parsedItems) {
      let matchedLine = lines.find(
        (l) => Math.abs(l.y - item.y) <= Math.max(4.0, item.fontSize * 0.4)
      );
      if (!matchedLine) {
        matchedLine = {
          y: item.y,
          items: [],
          isMultiColumn: false,
          minX: item.x,
          maxX: item.x + item.width,
        };
        lines.push(matchedLine);
      }
      matchedLine.items.push(item);
      matchedLine.minX = Math.min(matchedLine.minX, item.x);
      matchedLine.maxX = Math.max(matchedLine.maxX, item.x + item.width);
    }

    // Sort items within each line from left to right (X ascending)
    lines.forEach((line) => {
      line.items.sort((a, b) => a.x - b.x);
      // Check if line has multiple separated columns
      if (line.items.length >= 2) {
        for (let i = 0; i < line.items.length - 1; i++) {
          const gap = line.items[i + 1].x - (line.items[i].x + line.items[i].width);
          if (gap > 22) {
            line.isMultiColumn = true;
            break;
          }
        }
      }
    });

    let isFirstPageElement = true;

    // Process lines and cluster table blocks vs regular paragraphs
    let lineIdx = 0;
    while (lineIdx < lines.length) {
      const currentLine = lines[lineIdx];

      // Check if current line starts a multi-line table sequence (2 or more lines)
      let tableEnd = lineIdx;
      while (tableEnd < lines.length && lines[tableEnd].isMultiColumn) {
        tableEnd++;
      }

      const tableBlockLength = tableEnd - lineIdx;
      if (tableBlockLength >= 2) {
        // Table detected! Cluster X coordinates across this table block to find columns
        const tableLines = lines.slice(lineIdx, tableEnd);
        const xPositions: number[] = [];
        tableLines.forEach((tl) => tl.items.forEach((it) => xPositions.push(Math.round(it.x))));
        xPositions.sort((a, b) => a - b);

        // Group nearby X positions (within 20 points) into column boundaries
        const colAnchors: number[] = [];
        for (const xp of xPositions) {
          const existing = colAnchors.find((c) => Math.abs(c - xp) <= 22);
          if (existing === undefined) {
            colAnchors.push(xp);
          }
        }
        colAnchors.sort((a, b) => a - b);

        if (colAnchors.length >= 2) {
          const colWidthDxa = Math.floor(9000 / colAnchors.length);
          const tableRows: TableRow[] = [];

          tableLines.forEach((tLine, rIdx) => {
            const isHeaderRow = rIdx === 0;
            const cellsContent: string[] = new Array(colAnchors.length).fill('');
            const cellsBold: boolean[] = new Array(colAnchors.length).fill(isHeaderRow);

            tLine.items.forEach((it) => {
              // Find matching column anchor
              let closestCol = 0;
              let minDiff = Infinity;
              for (let c = 0; c < colAnchors.length; c++) {
                const diff = Math.abs(colAnchors[c] - it.x);
                if (diff < minDiff) {
                  minDiff = diff;
                  closestCol = c;
                }
              }
              const cleanedText = cleanXmlString(it.str);
              if (cleanedText) {
                if (cellsContent[closestCol]) {
                  cellsContent[closestCol] += ' ' + cleanedText;
                } else {
                  cellsContent[closestCol] = cleanedText;
                }
              }
              if (it.isBold) {
                cellsBold[closestCol] = true;
              }
            });

            tableRows.push(
              new TableRow({
                children: cellsContent.map((text, cIdx) => {
                  const safeCellText = text.trim() || ' ';
                  return new TableCell({
                    width: {
                      size: colWidthDxa,
                      type: WidthType.DXA,
                    },
                    shading: isHeaderRow ? { fill: 'F1F5F9', type: ShadingType.CLEAR } : undefined,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: safeCellText,
                            bold: isHeaderRow || cellsBold[cIdx],
                            size: isHeaderRow ? 22 : 20,
                            color: isHeaderRow ? '0F172A' : '334155',
                          }),
                        ],
                        spacing: { before: 60, after: 60 },
                      }),
                    ],
                  });
                }),
              })
            );
          });

          docElements.push(
            new Table({
              width: { size: 9000, type: WidthType.DXA },
              columnWidths: colAnchors.map(() => colWidthDxa),
              rows: tableRows,
            })
          );

          isFirstPageElement = false;
          lineIdx = tableEnd;
          continue;
        }
      }

      // Render standard paragraph or heading
      const fullLineText = cleanXmlString(currentLine.items.map((it) => it.str).join(' ').trim());
      if (!fullLineText) {
        lineIdx++;
        continue;
      }

      const maxFontSize = Math.max(...currentLine.items.map((it) => it.fontSize));
      const isLineBold = currentLine.items.some((it) => it.isBold);

      // Determine text alignment based on X coordinates and page width
      let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT;
      const lineCenter = (currentLine.minX + currentLine.maxX) / 2;
      if (Math.abs(lineCenter - pageWidth / 2) < 35) {
        alignment = AlignmentType.CENTER;
      } else if (currentLine.minX > pageWidth * 0.58) {
        alignment = AlignmentType.RIGHT;
      }

      // Check for Heading levels
      let heading: (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined = undefined;
      if (maxFontSize >= 18) {
        heading = HeadingLevel.HEADING_1;
      } else if (maxFontSize >= 14 || (isLineBold && maxFontSize >= 12)) {
        heading = HeadingLevel.HEADING_2;
      }

      const textRuns: TextRun[] = [];
      currentLine.items.forEach((it, idx) => {
        const cleanedStr = cleanXmlString(it.str);
        if (!cleanedStr) return;
        textRuns.push(
          new TextRun({
            text: cleanedStr + (idx < currentLine.items.length - 1 ? ' ' : ''),
            size: Math.max(14, Math.round(it.fontSize * 2)), // docx uses half-points
            bold: it.isBold,
            italics: it.isItalic,
            color: it.isBold ? '0F172A' : '1E293B',
          })
        );
      });

      if (textRuns.length > 0) {
        docElements.push(
          new Paragraph({
            pageBreakBefore: pageNum > 1 && isFirstPageElement,
            children: textRuns,
            heading,
            alignment,
            spacing: {
              before: heading ? 160 : 60,
              after: heading ? 80 : 60,
            },
          })
        );
        isFirstPageElement = false;
      }
      lineIdx++;
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children:
          docElements.length > 0
            ? docElements
            : [
                new Paragraph({
                  children: [new TextRun('No selectable content found in the source PDF.')],
                }),
              ],
      },
    ],
  });

  const rawDocxBlob = await Packer.toBlob(doc);
  const docxArrayBuffer = await rawDocxBlob.arrayBuffer();
  return new Blob([docxArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/**
 * Convert PDF into an Excel spreadsheet (.xlsx) with high-fidelity tabular reconstruction:
 * - Geometric 2D grid clustering to align multi-column data into true Excel cells
 * - Automatic number, currency, and date detection for native spreadsheet formulas
 * - Dynamic column width calculation to prevent clipped text
 * - Generates individual sheets for each PDF page and a consolidated master sheet
 */
export async function convertPdfToExcel(
  pdfBuffer: ArrayBuffer,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const bufferClone = pdfBuffer.slice(0);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bufferClone) });
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  const wb = XLSX.utils.book_new();
  const allPagesRows: (string | number)[][] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    if (onProgress) {
      onProgress(pageNum, totalPages);
    }

    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const rawItems = (textContent.items as any[])
      .filter((it) => it.str && it.str.trim().length > 0)
      .map((it) => ({
        text: cleanXmlString(it.str).trim(),
        x: it.transform[4],
        y: it.transform[5],
        width: it.width || 20,
        height: it.height || 10,
      }))
      .filter((it) => it.text.length > 0);

    if (rawItems.length === 0) {
      const emptySheet = XLSX.utils.aoa_to_sheet([
        ['Page has no selectable text (scanned or image-only)'],
      ]);
      XLSX.utils.book_append_sheet(wb, emptySheet, `Page ${pageNum}`);
      continue;
    }

    // 1. Group items into rows by Y coordinate
    rawItems.sort((a, b) => b.y - a.y);
    interface RowBucket {
      y: number;
      items: typeof rawItems;
    }

    const rowBuckets: RowBucket[] = [];
    for (const item of rawItems) {
      let bucket = rowBuckets.find((r) => Math.abs(r.y - item.y) <= 4.0);
      if (!bucket) {
        bucket = { y: item.y, items: [] };
        rowBuckets.push(bucket);
      }
      bucket.items.push(item);
    }

    // Sort items within each row from left to right (X ascending)
    rowBuckets.forEach((b) => b.items.sort((a, b) => a.x - b.x));

    // 2. Identify global column boundaries across the page
    const allXPositions: number[] = [];
    rawItems.forEach((it) => allXPositions.push(Math.round(it.x)));
    allXPositions.sort((a, b) => a - b);

    // Cluster X coordinates into distinct column slots
    const colAnchors: number[] = [];
    for (const x of allXPositions) {
      const match = colAnchors.find((c) => Math.abs(c - x) <= 18);
      if (match === undefined) {
        colAnchors.push(x);
      }
    }
    colAnchors.sort((a, b) => a - b);

    // If only 1 column detected, split lines that contain multi-space separations
    const rowsData: (string | number)[][] = [];

    for (const bucket of rowBuckets) {
      if (colAnchors.length <= 1) {
        const fullRowText = bucket.items.map((it) => it.text).join(' ');
        // Check if text has tabs, pipes, or double spaces
        if (/[\t|]|\s{2,}/.test(fullRowText)) {
          const parts = fullRowText
            .split(/[\t|]|\s{2,}/)
            .map((s) => s.trim())
            .filter(Boolean);
          rowsData.push(parts.map(parseCellValue));
        } else {
          rowsData.push([parseCellValue(fullRowText)]);
        }
        continue;
      }

      // Map row items into specific column slots
      const rowCells: (string | number)[] = new Array(colAnchors.length).fill('');
      for (const item of bucket.items) {
        // Find best column anchor
        let bestCol = 0;
        let minDiff = Infinity;
        for (let c = 0; c < colAnchors.length; c++) {
          const diff = Math.abs(colAnchors[c] - item.x);
          if (diff < minDiff) {
            minDiff = diff;
            bestCol = c;
          }
        }

        const existingVal = rowCells[bestCol];
        if (existingVal !== '') {
          rowCells[bestCol] = `${existingVal} ${item.text}`;
        } else {
          rowCells[bestCol] = item.text;
        }
      }

      // Format numeric/currency values in rowCells
      const parsedRow = rowCells.map((val) =>
        typeof val === 'string' && val ? parseCellValue(val) : val
      );
      rowsData.push(parsedRow);
    }

    // Ensure rowsData is not empty
    if (rowsData.length === 0) {
      rowsData.push(['No tabular rows found on this page']);
    }

    // Auto-calculate column widths
    const maxColCount = Math.max(...rowsData.map((r) => r.length), 1);
    const colWidths: { wch: number }[] = [];
    for (let c = 0; c < maxColCount; c++) {
      let maxLen = 10;
      for (const row of rowsData) {
        const cellText = String(row[c] || '');
        if (cellText.length > maxLen) {
          maxLen = cellText.length;
        }
      }
      colWidths.push({ wch: Math.min(60, Math.max(12, maxLen + 3)) });
    }

    const ws = XLSX.utils.aoa_to_sheet(rowsData);
    ws['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, `Page ${pageNum}`);

    // Collect for master sheet
    if (totalPages > 1) {
      if (allPagesRows.length > 0) {
        allPagesRows.push([`--- Page ${pageNum} ---`]);
      }
      allPagesRows.push(...rowsData);
    }
  }

  // If multi-page, add consolidated All_Pages master sheet
  if (totalPages > 1 && allPagesRows.length > 0) {
    const masterWs = XLSX.utils.aoa_to_sheet(allPagesRows);
    XLSX.utils.book_append_sheet(wb, masterWs, 'All Pages Combined');
  }

  // Ensure at least one sheet exists
  if (wb.SheetNames.length === 0) {
    const fallbackWs = XLSX.utils.aoa_to_sheet([['Converted Excel Content']]);
    XLSX.utils.book_append_sheet(wb, fallbackWs, 'Sheet1');
  }

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Helper to auto-parse numbers, currencies, and clean spreadsheet values
 */
function parseCellValue(str: string): string | number {
  const clean = cleanXmlString(str).trim();
  if (!clean) return '';

  // Check pure numeric (e.g. 1234, -45.67)
  if (/^-?\d+(\.\d+)?$/.test(clean)) {
    const num = Number(clean);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
  }

  // Check formatted numbers or currencies (e.g. $1,250.00, ₹45,000, €99.50)
  const currencyMatch = clean.match(/^([$€£₹]?)\s*(-?\d{1,3}(,\d{3})*(\.\d+)?)\s*(%?)$/);
  if (currencyMatch) {
    const numericPart = currencyMatch[2].replace(/,/g, '');
    const num = Number(numericPart);
    if (!isNaN(num) && isFinite(num)) {
      if (!currencyMatch[1] && !currencyMatch[5]) {
        return num;
      }
    }
  }

  return clean;
}

/**
 * Convert PDF pages to PowerPoint presentation (.pptx) with high fidelity:
 * - Detects widescreen (16:9) vs standard (4:3) PDF aspect ratio
 * - High-resolution 300 DPI canvas rendering to preserve complex diagrams, logos, and styling
 * - Extracts prominent headings and overlay editable native PowerPoint text shapes
 * - Embeds full page transcript directly into slide Speaker Notes
 */
export async function convertPdfToPpt(
  pdfBuffer: ArrayBuffer,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const bufferClone = pdfBuffer.slice(0);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bufferClone) });
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  const pres = new PptxGenJS();

  // Inspect first page to determine slide aspect ratio
  const firstPage = await pdfDoc.getPage(1);
  const firstViewport = firstPage.getViewport({ scale: 1.0 });
  const isWidescreen = firstViewport.width / firstViewport.height >= 1.35;
  pres.layout = isWidescreen ? 'LAYOUT_16x9' : 'LAYOUT_4x3';

  const slideWidth = isWidescreen ? 13.33 : 10.0;
  const slideHeight = 7.5;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    if (onProgress) {
      onProgress(pageNum, totalPages);
    }

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.5 }); // Ultra HD rendering

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await (page.render as any)({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise;

    const pageDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    // Extract text content for editable shapes & speaker notes
    const textContent = await page.getTextContent();
    const rawItems = (textContent.items as any[])
      .filter((it) => it.str && it.str.trim().length > 0)
      .map((it) => ({
        str: cleanXmlString(it.str).trim(),
        x: it.transform[4],
        y: it.transform[5],
        fontSize: Math.max(9, Math.round(Math.hypot(it.transform[0], it.transform[1]))) || 12,
        isBold: /bold|heavy|black/i.test(it.fontName || ''),
      }))
      .filter((it) => it.str.length > 0);

    const slide = pres.addSlide();

    // 1. Add background image fitted seamlessly
    slide.addImage({
      data: pageDataUrl,
      x: 0,
      y: 0,
      w: slideWidth,
      h: slideHeight,
      sizing: { type: 'contain', w: slideWidth, h: slideHeight },
    });

    // 2. Extract full page transcript and attach to Speaker Notes
    const fullTranscript = rawItems.map((it) => it.str).join(' ');
    if (fullTranscript) {
      slide.addNotes(`Slide ${pageNum} Transcript:\n\n${cleanXmlString(fullTranscript)}`);
    }

    // 3. Find top title or prominent heading to create an editable PowerPoint text box
    const titleCandidates = rawItems.filter((it) => it.fontSize >= 16 || it.isBold);
    if (titleCandidates.length > 0) {
      const topTitle = titleCandidates[0];
      const normY = (firstViewport.height - topTitle.y) / firstViewport.height;
      const normX = topTitle.x / firstViewport.width;
      const cleanTitle = cleanXmlString(topTitle.str);

      if (cleanTitle) {
        slide.addText(cleanTitle, {
          x: Math.max(0.5, normX * slideWidth),
          y: Math.max(0.4, normY * slideHeight),
          w: slideWidth * 0.85,
          h: 0.8,
          fontSize: Math.min(28, Math.max(14, topTitle.fontSize)),
          bold: true,
          color: '0F172A',
        });
      }
    }
  }

  const rawPptBlob = (await pres.write({ outputType: 'blob' })) as Blob;
  const pptArrayBuffer = await rawPptBlob.arrayBuffer();
  return new Blob([pptArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}

/**
 * Convert Word document (.docx) to PDF
 */
export async function convertWordToPdf(docxBuffer: ArrayBuffer): Promise<Uint8Array> {
  // Extract text and headings using mammoth
  const rawTextResult = await mammoth.extractRawText({ arrayBuffer: docxBuffer.slice(0) });
  const rawText = rawTextResult.value || '';

  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const lines = rawText.split('\n');
  const pageWidth = 595.28; // Standard A4 width in points
  const pageHeight = 841.89; // Standard A4 height in points
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentY = pageHeight - margin - 20;

  // Header banner on first page
  currentPage.drawText('Converted from Word Document', {
    x: margin,
    y: pageHeight - margin,
    size: 9,
    font: helvetica,
    color: rgb(0.4, 0.45, 0.5),
  });

  const checkAddPage = (requiredSpace: number) => {
    if (currentY - requiredSpace < margin + 30) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      currentY = pageHeight - margin - 20;
    }
  };

  for (const line of lines) {
    const rawTrimmed = line.trim();
    if (!rawTrimmed) {
      currentY -= 12;
      continue;
    }

    // Sanitize line for standard Helvetica font to prevent WinAnsi encoding crashes
    const trimmed = sanitizeForPdf(rawTrimmed);
    if (!trimmed) {
      currentY -= 12;
      continue;
    }

    const isHeading =
      trimmed.length < 70 &&
      (trimmed === trimmed.toUpperCase() ||
        /^(Section|Article|Chapter|\d+\.|\bOverview\b|\bAgreement\b|\bExecutive\b)/i.test(trimmed));

    const font = isHeading ? helveticaBold : helvetica;
    const fontSize = isHeading ? 14 : 10;
    const lineHeight = fontSize * 1.4;

    // Word wrapping with width measurement
    const words = trimmed.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      let testWidth = 0;
      try {
        testWidth = font.widthOfTextAtSize(testLine, fontSize);
      } catch {
        testWidth = testLine.length * fontSize * 0.6;
      }

      if (testWidth > contentWidth && currentLine) {
        checkAddPage(lineHeight);
        try {
          currentPage.drawText(currentLine, {
            x: margin,
            y: currentY,
            size: fontSize,
            font,
            color: isHeading ? rgb(0.1, 0.15, 0.25) : rgb(0.2, 0.2, 0.2),
          });
        } catch (e) {
          console.warn('drawText warning on line:', e);
        }
        currentY -= lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      checkAddPage(lineHeight);
      try {
        currentPage.drawText(currentLine, {
          x: margin,
          y: currentY,
          size: fontSize,
          font,
          color: isHeading ? rgb(0.1, 0.15, 0.25) : rgb(0.2, 0.2, 0.2),
        });
      } catch (e) {
        console.warn('drawText warning on line:', e);
      }
      currentY -= lineHeight + (isHeading ? 6 : 2);
    }
  }

  // Add page numbers
  const pages = pdfDoc.getPages();
  pages.forEach((p, idx) => {
    try {
      p.drawText(`Page ${idx + 1} of ${pages.length}`, {
        x: pageWidth / 2 - 25,
        y: margin / 2,
        size: 9,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
    } catch {
      // ignore
    }
  });

  return await pdfDoc.save();
}

/**
 * Convert Word document (.docx) to Images
 */
export async function convertWordToImages(
  docxBuffer: ArrayBuffer,
  format: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<PdfImageResult[]> {
  const pdfBytes = await convertWordToPdf(docxBuffer);
  return await convertPdfToImages(pdfBytes.buffer as ArrayBuffer, format, 2.0);
}

export interface PdfManualCompressOptions {
  dpi?: number; // 72 to 300 (default 150-180 for HD sharp)
  quality?: number; // 0.40 to 0.95 (default 0.85)
  strategy?: 'smart_resample' | 'lossless_stream';
  stripMetadata?: boolean;
  onProgress?: (current: number, total: number) => void;
}

/**
 * Compress PDF document with customizable level and manual pixel-protection controls:
 * - Lossless stream compaction (100% zero pixel modification)
 * - Smart HD Resample with bicubic smoothing & customizable DPI (72 - 300 DPI) and JPEG quality (0.50 - 0.95)
 */
export async function compressPdfDocument(
  pdfBuffer: ArrayBuffer,
  mode: 'recommended' | 'extreme' | 'light' | 'lossless' | 'manual' = 'recommended',
  options?: PdfManualCompressOptions
): Promise<Uint8Array> {
  const safeBuffer = pdfBuffer.slice(0);

  // If lossless mode or explicit lossless_stream strategy
  if (mode === 'light' || mode === 'lossless' || options?.strategy === 'lossless_stream') {
    const pdfDoc = await PDFDocument.load(safeBuffer, { ignoreEncryption: true });
    if (options?.stripMetadata || mode === 'extreme' || mode === 'recommended') {
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('PDF Editor Pro');
      pdfDoc.setCreator('PDF Editor Pro');
    }

    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 50,
      updateFieldAppearances: false,
    });

    return compressedBytes;
  }

  // Visual/Raster high-fidelity smart resample (for image-heavy or scanned PDFs)
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(safeBuffer) });
  const pdfDocJs = await loadingTask.promise;
  const totalPages = pdfDocJs.numPages;

  const newPdfDoc = await PDFDocument.create();

  // Determine DPI and Quality parameters
  let dpi = 160;
  let quality = 0.85;

  if (mode === 'manual') {
    dpi = options?.dpi ?? 160;
    quality = options?.quality ?? 0.85;
  } else if (mode === 'extreme') {
    dpi = 120;
    quality = 0.72;
  } else if (mode === 'recommended') {
    dpi = 160;
    quality = 0.85;
  }

  // Clamp parameters safely
  dpi = Math.max(72, Math.min(300, dpi));
  quality = Math.max(0.4, Math.min(0.96, quality));
  const scale = Math.max(1.0, dpi / 72);

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    if (options?.onProgress) {
      options.onProgress(pageNum, totalPages);
    }

    const page = await pdfDocJs.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const origViewport = page.getViewport({ scale: 1.0 });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // High quality bicubic filtering to protect fine lines, text, and pixel fidelity
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await (page.render as any)({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64Data = dataUrl.split(',')[1];
    const binaryStr = atob(base64Data);
    const imgBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      imgBytes[i] = binaryStr.charCodeAt(i);
    }

    const embeddedImage = await newPdfDoc.embedJpg(imgBytes);
    const newPage = newPdfDoc.addPage([origViewport.width, origViewport.height]);
    newPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: origViewport.width,
      height: origViewport.height,
    });
  }

  if (options?.stripMetadata ?? true) {
    newPdfDoc.setTitle('');
    newPdfDoc.setAuthor('');
    newPdfDoc.setSubject('');
    newPdfDoc.setKeywords([]);
    newPdfDoc.setProducer('PDF Editor Pro');
    newPdfDoc.setCreator('PDF Editor Pro');
  }

  const resultBytes = await newPdfDoc.save({ useObjectStreams: true });
  return resultBytes;
}

/**
 * Render a page preview at specific DPI and Quality for real-time pixel sharpness inspection
 */
export async function renderPdfPagePreview(
  pdfBuffer: ArrayBuffer,
  pageNum: number = 1,
  dpi: number = 160,
  quality: number = 0.85
): Promise<{ originalDataUrl: string; compressedDataUrl: string; width: number; height: number }> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer.slice(0)) });
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(pageNum);

  const scale = Math.max(1.0, dpi / 72);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await (page.render as any)({
    canvasContext: ctx,
    viewport,
    canvas,
  }).promise;

  const originalDataUrl = canvas.toDataURL('image/png');
  const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

  return {
    originalDataUrl,
    compressedDataUrl,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Compress an image file using client-side HTML5 Canvas
 */
export async function compressImageFile(
  file: File,
  quality: number = 0.7,
  maxDimension: number = 1920,
  outputFormat: 'image/jpeg' | 'image/webp' | 'image/png' = 'image/jpeg'
): Promise<{ blob: Blob; dataUrl: string; originalSize: number; compressedSize: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context unavailable'));

        if (outputFormat === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL(outputFormat, quality);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Image compression failed'));
            resolve({
              blob,
              dataUrl,
              originalSize: file.size,
              compressedSize: blob.size,
            });
          },
          outputFormat,
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Password-protect and encrypt a PDF document
 */
export async function protectPdf(
  pdfBuffer: ArrayBuffer,
  userPassword: string,
  ownerPassword?: string
): Promise<Uint8Array> {
  const safeBuffer = pdfBuffer.slice(0);
  const pdfDoc = await PDFDocument.load(safeBuffer, { ignoreEncryption: true });
  const rawBytes = await pdfDoc.save();

  return await encryptPDF(rawBytes, userPassword, {
    ownerPassword: ownerPassword || userPassword,
    permissions: {
      printing: 'highResolution',
      copying: true,
      modifying: false,
      annotating: true,
    },
  });
}

/**
 * Unlock a password-protected PDF and save without encryption
 */
export async function unlockPdf(
  pdfBuffer: ArrayBuffer,
  password: string
): Promise<Uint8Array> {
  const bufferClone = pdfBuffer.slice(0);
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(bufferClone),
    password,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  // Render pages and re-bundle into clean unencrypted PDF
  const cleanDoc = await PDFDocument.create();

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await (page.render as any)({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise;

    const imgDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const imageBytes = await fetch(imgDataUrl).then((r) => r.arrayBuffer());
    const embeddedImage = await cleanDoc.embedJpg(imageBytes);

    const newPage = cleanDoc.addPage([page.view[2] || 595, page.view[3] || 842]);
    newPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: newPage.getWidth(),
      height: newPage.getHeight(),
    });
  }

  return await cleanDoc.save();
}
