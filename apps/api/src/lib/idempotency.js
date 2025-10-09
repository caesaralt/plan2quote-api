import { createHash } from 'node:crypto';

export const computeDocumentHash = (buffer, extraKey) => {
  const hash = createHash('sha256');
  hash.update(buffer);
  if (extraKey) {
    hash.update(extraKey);
  }
  return hash.digest('hex');
};
