declare module 'pdf-parse/lib/pdf-parse.js' {
    type PdfParseResult = {
        text: string;
        numpages: number;
        numrender: number;
        info: Record<string, unknown>;
        metadata: unknown;
        version: string;
    };

    type PdfParseOptions = {
        pagerender?: (pageData: unknown) => Promise<string>;
        max?: number;
        version?: string;
    };

    export default function pdfParse(
        dataBuffer: Buffer | Uint8Array,
        options?: PdfParseOptions
    ): Promise<PdfParseResult>;
}

