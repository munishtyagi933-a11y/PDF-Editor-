declare module 'mammoth' {
  export interface MammothResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  export function convertToHtml(input: {
    arrayBuffer?: ArrayBuffer;
    buffer?: Buffer;
    path?: string;
  }): Promise<MammothResult>;

  export function convertToMarkdown(input: {
    arrayBuffer?: ArrayBuffer;
    buffer?: Buffer;
    path?: string;
  }): Promise<MammothResult>;

  export function extractRawText(input: {
    arrayBuffer?: ArrayBuffer;
    buffer?: Buffer;
    path?: string;
  }): Promise<MammothResult>;
}

declare module '@pdfsmaller/pdf-encrypt-lite' {
  export interface EncryptOptions {
    ownerPassword?: string | null;
    userPassword?: string;
    permissions?: {
      printing?: 'highResolution' | 'lowResolution' | 'none';
      modifying?: boolean;
      copying?: boolean;
      annotating?: boolean;
      fillingForms?: boolean;
      contentAccessibility?: boolean;
      documentAssembly?: boolean;
    };
  }

  export function encryptPDF(
    pdfBytes: Uint8Array,
    userPassword?: string,
    ownerPasswordOrOptions?: string | EncryptOptions | null
  ): Promise<Uint8Array>;

  export class AlreadyEncryptedError extends Error {}
  export class PasswordEncodingError extends Error {}
}
