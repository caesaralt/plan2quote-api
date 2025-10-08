import { describe, expect, it } from 'vitest';
import { applyPricing } from '../src/lib/pricing.js';
import { env } from '../src/config/env.js';

describe('applyPricing', () => {
  it('applies default margin and gst', () => {
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

    const expectedUnit = 100 * (1 + env.DEFAULT_MARGIN_PERCENT / 100);
    expect(result.lines[0].unitPriceExGst).toBeCloseTo(expectedUnit, 2);
    expect(result.lines[0].unitPriceIncGst).toBeCloseTo(expectedUnit * 1.1, 2);
    expect(result.subtotalExGst).toBeCloseTo(expectedUnit * 2, 2);
    expect(result.subtotalIncGst).toBeCloseTo(expectedUnit * 2 * 1.1, 2);
  });
});
