export type ToolMode =
  | 'merge'
  | 'sign'
  | 'edit'
  | 'pdf2img'
  | 'pdf2word'
  | 'pdf2excel'
  | 'pdf2ppt'
  | 'word2pdf'
  | 'word2img'
  | 'compress'
  | 'extract'
  | 'password'
  | 'organize'
  | 'split'
  | 'watermark'
  | 'img2pdf';

export type AnnotationType =
  | 'text'
  | 'signature'
  | 'date'
  | 'stamp'
  | 'checkmark'
  | 'highlight'
  | 'redact';

export interface AnnotationItem {
  id: string;
  type: AnnotationType;
  pageIndex: number;
  /** X coordinate as percentage (0 - 100) of page width */
  xPercent: number;
  /** Y coordinate as percentage (0 - 100) of page height from top */
  yPercent: number;
  /** Width as percentage of page width */
  widthPercent: number;
  /** Height as percentage of page height */
  heightPercent: number;
  text?: string;
  fontSize?: number;
  color?: string;
  bgColor?: string;
  imageBase64?: string;
  isDate?: boolean;
}

export interface PdfFileItem {
  id: string;
  file?: File;
  name: string;
  size: number;
  pageCount: number;
  arrayBuffer: ArrayBuffer;
  thumbnailUrl?: string;
  rotation?: number;
}

export interface PageInfo {
  pageIndex: number;
  pageNumber: number;
  rotation: number;
  thumbnail?: string;
  isSelected?: boolean;
}

export interface SignatureData {
  type: 'draw' | 'type' | 'upload';
  dataUrl: string;
  signerName: string;
  dateString: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
