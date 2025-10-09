import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DEFAULT_MARGIN_PERCENT = '15';
process.env.MIN_CALLOUT_FEE_EX_GST = '0';

const { applyPricing } = await import('../src/lib/pricing.js');

test('applyPricing applies default margin and gst', () => {
  const result = applyPricing([
    {
      sourceRaw: 'Test line',
      matchedBy: 'name',
      confidence: 1,
      description: 'Test line',
      quantity: 2,
      unitPriceExGst: 100,
      gstRate: 0.1
    }
  ]);

  const expectedUnit = 100 * (1 + Number(process.env.DEFAULT_MARGIN_PERCENT) / 100);
  assert.ok(Math.abs(result.lines[0].unitPriceExGst - expectedUnit) < 0.01);
  assert.ok(Math.abs(result.lines[0].unitPriceIncGst - expectedUnit * 1.1) < 0.01);
  assert.ok(Math.abs(result.subtotalExGst - expectedUnit * 2) < 0.01);
  assert.ok(Math.abs(result.subtotalIncGst - expectedUnit * 2 * 1.1) < 0.01);
});
