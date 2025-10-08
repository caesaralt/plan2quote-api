import { env } from '../config/env.js';
import { ReconciledLine } from './reconcile.js';

export interface PricedLine extends ReconciledLine {
  unitPriceExGst: number;
  unitPriceIncGst: number;
  lineTotalExGst: number;
  lineTotalIncGst: number;
}

export interface PricingSummary {
  lines: PricedLine[];
  subtotalExGst: number;
  subtotalIncGst: number;
  gstTotal: number;
  callOutFeeApplied: boolean;
}

const roundToCents = (value: number) => Math.round(value * 100) / 100;

export const applyPricing = (lines: ReconciledLine[]): PricingSummary => {
  const pricedLines = lines.map<PricedLine>((line) => {
    const basePrice = line.unitPriceExGst ?? 0;
    const marginMultiplier = 1 + env.DEFAULT_MARGIN_PERCENT / 100;
    const priceWithMargin = basePrice * marginMultiplier;
    const unitPriceExGst = roundToCents(priceWithMargin);
    const unitPriceIncGst = roundToCents(unitPriceExGst * (1 + line.gstRate));
    const lineTotalExGst = roundToCents(unitPriceExGst * line.quantity);
    const lineTotalIncGst = roundToCents(unitPriceIncGst * line.quantity);

    return {
      ...line,
      unitPriceExGst,
      unitPriceIncGst,
      lineTotalExGst,
      lineTotalIncGst,
      marginRuleApplied: line.marginRuleApplied ?? `default:${env.DEFAULT_MARGIN_PERCENT}`
    };
  });

  let subtotalExGst = pricedLines.reduce((acc, line) => acc + line.lineTotalExGst, 0);
  let subtotalIncGst = pricedLines.reduce((acc, line) => acc + line.lineTotalIncGst, 0);
  let callOutFeeApplied = false;

  if (env.MIN_CALLOUT_FEE_EX_GST > 0 && subtotalExGst < env.MIN_CALLOUT_FEE_EX_GST) {
    subtotalExGst = env.MIN_CALLOUT_FEE_EX_GST;
    subtotalIncGst = roundToCents(subtotalExGst * (1 + 0.1));
    callOutFeeApplied = true;
  }

  const gstTotal = roundToCents(subtotalIncGst - subtotalExGst);

  return {
    lines: pricedLines,
    subtotalExGst: roundToCents(subtotalExGst),
    subtotalIncGst: roundToCents(subtotalIncGst),
    gstTotal,
    callOutFeeApplied
  };
};
