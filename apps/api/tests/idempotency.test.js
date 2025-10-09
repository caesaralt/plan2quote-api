import test from 'node:test';
import assert from 'node:assert/strict';

const { computeDocumentHash } = await import('../src/lib/idempotency.js');

test('computeDocumentHash produces deterministic hashes', () => {
  const buffer = Buffer.from('hello world');
  const a = computeDocumentHash(buffer, 'foo');
  const b = computeDocumentHash(buffer, 'foo');
  assert.equal(a, b);
});

test('computeDocumentHash changes with extra key', () => {
  const buffer = Buffer.from('hello world');
  const a = computeDocumentHash(buffer, 'foo');
  const b = computeDocumentHash(buffer, 'bar');
  assert.notEqual(a, b);
});
