import { BaseScenario, type ScenarioConfig, type ScenarioContext } from '../BaseScenario.js';
import type { ScraperEngine } from '../../scraper/ScraperEngine.js';
import { PDFDocument } from 'pdf-lib';
import { env } from '../../config/env.js';

interface PdfMargins {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

interface HtmlToPdfInput {
  html: string;
  uploadUrl: string;
  pdfOptions?: {
    format?: 'A4' | 'Letter' | 'Legal';
    orientation?: 'portrait' | 'landscape';
    margins?: PdfMargins;
  };
}

interface HtmlToPdfOutput {
  success: boolean;
  fileSize: number;
  uploadedTo: string;
  pageCount: number;
  timestamp: string;
}

export class HtmlToPdfScenario extends BaseScenario<HtmlToPdfInput, HtmlToPdfOutput> {
  readonly config: ScenarioConfig = {
    action: 'html_to_pdf',
    name: 'HTML to PDF',
    description: 'Render self-contained HTML to PDF and upload to S3 presigned URL',
    maxConcurrent: 5,
    cooldownSeconds: 0,
    timeout: 60000,
    retries: 2,
    inputSchema: {
      type: 'object',
      required: ['html', 'uploadUrl'],
      properties: {
        html: {
          type: 'string',
          description: 'Self-contained HTML string (inline CSS, base64 images)',
        },
        uploadUrl: {
          type: 'string',
          format: 'uri',
          description: 'S3 presigned PUT URL for uploading the generated PDF',
        },
        pdfOptions: {
          type: 'object',
          description: 'PDF generation options (all optional with sensible defaults)',
          properties: {
            format: {
              type: 'string',
              enum: ['A4', 'Letter', 'Legal'],
              description: 'Paper format (default: A4)',
            },
            orientation: {
              type: 'string',
              enum: ['portrait', 'landscape'],
              description: 'Page orientation (default: portrait)',
            },
            margins: {
              type: 'object',
              description: 'Page margins in CSS units (default: 10mm on all sides)',
              properties: {
                top: { type: 'string', description: "Top margin (e.g., '10mm', '1in')" },
                right: { type: 'string', description: 'Right margin' },
                bottom: { type: 'string', description: 'Bottom margin' },
                left: { type: 'string', description: 'Left margin' },
              },
            },
          },
        },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['success', 'fileSize', 'uploadedTo', 'pageCount', 'timestamp'],
      properties: {
        success: { type: 'boolean', description: 'Whether PDF generation and upload succeeded' },
        fileSize: { type: 'number', description: 'PDF file size in bytes' },
        uploadedTo: { type: 'string', format: 'uri', description: 'The presigned URL used for upload' },
        pageCount: { type: 'number', description: 'Number of pages in the generated PDF' },
        timestamp: { type: 'string', format: 'date-time', description: 'Execution timestamp' },
      },
    },
    exampleInput: {
      html: '<html><body><h1>Hello World</h1><p>This is a test PDF.</p></body></html>',
      uploadUrl: 'https://s3.eu-central-003.hetzner.com/bucket/document.pdf?X-Amz-Algorithm=...',
      pdfOptions: {
        format: 'A4',
        orientation: 'portrait',
        margins: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      },
    },
  };

  protected validateInput(data: unknown): HtmlToPdfInput {
    const input = data as HtmlToPdfInput;

    if (!input.html || typeof input.html !== 'string' || input.html.trim().length === 0) {
      throw new Error('html is required and must be a non-empty string');
    }

    if (!input.uploadUrl || typeof input.uploadUrl !== 'string') {
      throw new Error('uploadUrl is required and must be a valid URL string');
    }

    try {
      new URL(input.uploadUrl);
    } catch {
      throw new Error('uploadUrl must be a valid URL');
    }

    if (input.pdfOptions) {
      const validFormats = ['A4', 'Letter', 'Legal'];
      if (input.pdfOptions.format && !validFormats.includes(input.pdfOptions.format)) {
        throw new Error(`format must be one of: ${validFormats.join(', ')}`);
      }

      const validOrientations = ['portrait', 'landscape'];
      if (input.pdfOptions.orientation && !validOrientations.includes(input.pdfOptions.orientation)) {
        throw new Error(`orientation must be one of: ${validOrientations.join(', ')}`);
      }
    }

    return input;
  }

  protected async run(
    engine: ScraperEngine,
    input: HtmlToPdfInput,
    _context: ScenarioContext
  ): Promise<HtmlToPdfOutput> {
    const page = engine.rawPage;
    if (!page) {
      throw new Error('Browser page not available');
    }

    if (!env.BROWSER_HEADLESS) {
      throw new Error('html_to_pdf scenario requires headless browser mode (set BROWSER_HEADLESS=true)');
    }

    // 1. Render HTML content
    await page.setContent(input.html, { waitUntil: 'load' });

    // 2. Build PDF options with defaults
    const margins = {
      top: input.pdfOptions?.margins?.top ?? '10mm',
      right: input.pdfOptions?.margins?.right ?? '10mm',
      bottom: input.pdfOptions?.margins?.bottom ?? '10mm',
      left: input.pdfOptions?.margins?.left ?? '10mm',
    };

    const format = input.pdfOptions?.format ?? 'A4';
    const landscape = input.pdfOptions?.orientation === 'landscape';

    // 3. Generate PDF
    const pdfBuffer = await page.pdf({
      format,
      landscape,
      margin: margins,
      printBackground: true,
    });

    // 4. Get page count
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();

    // 5. Upload to presigned URL
    const uploadBody = new Uint8Array(pdfBuffer);
    const uploadResponse = await fetch(input.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdfBuffer.length),
      },
      body: uploadBody,
    });

    if (!uploadResponse.ok) {
      const errorBody = await uploadResponse.text().catch(() => 'No response body');
      throw new Error(`Upload failed with HTTP ${uploadResponse.status}: ${errorBody}`);
    }

    // 6. Return result
    return {
      success: true,
      fileSize: pdfBuffer.length,
      uploadedTo: input.uploadUrl,
      pageCount,
      timestamp: new Date().toISOString(),
    };
  }
}
