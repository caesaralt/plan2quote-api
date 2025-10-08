import { describe, expect, it } from 'vitest';
import { computeDocumentHash } from '../src/lib/idempotency.js';

describe('computeDocumentHash', () => {
  it('produces deterministic hashes', () => {
    const buffer = Buffer.from('hello world');
    const a = computeDocumentHash(buffer, 'foo');
    const b = computeDocumentHash(buffer, 'foo');
    expect(a).toEqual(b);
  });

  it('changes with extra key', () => {
    const buffer = Buffer.from('hello world');
    const a = computeDocumentHash(buffer, 'foo');
    const b = computeDocumentHash(buffer, 'bar');
    expect(a).not.toEqual(b);
  });
});
