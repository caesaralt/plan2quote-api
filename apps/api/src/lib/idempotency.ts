import { createHash } from 'crypto';

export const computeDocumentHash = (buffer: Buffer, extraKey?: string) => {
  const hash = createHash('sha256');
  hash.update(buffer);
  if (extraKey) {
    hash.update(extraKey);
  }
  return hash.digest('hex');
};
