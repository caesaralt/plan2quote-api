import { logger } from './logger.js';

const cleanLine = (line) => line.replace(/\s+/g, ' ').trim();

export const parsePdf = async (buffer) => {
  let text = buffer.toString('utf8');
  if (!text.includes('\n') && buffer.toString('latin1').includes('\n')) {
    text = buffer.toString('latin1');
  }

  if (!text || text.length === 0) {
    logger.warn('PDF text extraction produced no content');
    return { lines: [], notes: [] };
  }

  const lines = text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line.length > 0)
    .map((line) => ({ raw: line, description: line, quantity: 1 }));

  logger.debug('Parsed PDF lines', { count: lines.length });

  return {
    lines,
    notes: []
  };
};
