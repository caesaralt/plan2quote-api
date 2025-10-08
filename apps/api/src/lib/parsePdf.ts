import pdf from 'pdf-parse';
import { logger } from './logger.js';

export interface ParsedLine {
  raw: string;
  sku?: string;
  mpn?: string;
  brand?: string;
  description?: string;
  quantity: number;
  unit?: string;
  labourHours?: number;
  area?: string;
}

export interface ParsedQuote {
  customer?: {
    name?: string;
    abn?: string;
    email?: string;
    phone?: string;
    billingAddress?: string;
    siteAddress?: string;
  };
  project?: { title?: string; reference?: string; dueDate?: string };
  lines: ParsedLine[];
  notes?: string[];
}

export const parsePdf = async (buffer: Buffer): Promise<ParsedQuote> => {
  const { text } = await pdf(buffer);
  logger.debug('PDF raw text extracted', { length: text.length });

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map<ParsedLine>((line) => ({ raw: line, description: line, quantity: 1 }));

  return {
    lines,
    notes: []
  };
};
