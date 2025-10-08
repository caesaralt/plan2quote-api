import stringSimilarity from 'string-similarity';
import { ParsedLine } from './parsePdf.js';

export type MatchType = 'sku' | 'mpn' | 'name' | 'fuzzy' | 'unmatched';

export interface CatalogueItem {
  id: string;
  sku?: string;
  mpn?: string;
  name: string;
  description?: string;
  unitPriceExGst?: number;
  unit?: string;
}

export interface ReconciledLine {
  sourceRaw: string;
  simproItemId?: string;
  matchedBy: MatchType;
  confidence: number;
  description: string;
  quantity: number;
  unit?: string;
  unitPriceExGst?: number;
  labourHours?: number;
  labourRateExGst?: number;
  gstRate: number;
  marginRuleApplied?: string;
}

export interface ReconcileResult {
  lines: ReconciledLine[];
  unresolved: Array<{ lineIndex: number; reason: string; suggestions: string[] }>;
}

const TOKEN_REGEX = /[^a-z0-9]+/gi;

const normalise = (value?: string) =>
  value?.toLowerCase().replace(TOKEN_REGEX, ' ').replace(/\s+/g, ' ').trim() ?? '';

export const reconcileLines = (
  parsed: ParsedLine[],
  catalogue: CatalogueItem[],
  gstRate: number
): ReconcileResult => {
  const unresolved: ReconcileResult['unresolved'] = [];

  const catalogueBySku = new Map<string, CatalogueItem>();
  const catalogueByMpn = new Map<string, CatalogueItem>();
  for (const item of catalogue) {
    if (item.sku) catalogueBySku.set(normalise(item.sku), item);
    if (item.mpn) catalogueByMpn.set(normalise(item.mpn), item);
  }

  const lines = parsed.map<ReconciledLine>((line, index) => {
    const normalisedRaw = normalise(line.raw);

    if (line.sku) {
      const bySku = catalogueBySku.get(normalise(line.sku));
      if (bySku) {
        return {
          sourceRaw: line.raw,
          simproItemId: bySku.id,
          matchedBy: 'sku',
          confidence: 1,
          description: bySku.description ?? bySku.name,
          quantity: line.quantity ?? 1,
          unit: line.unit ?? bySku.unit,
          unitPriceExGst: bySku.unitPriceExGst,
          gstRate
        };
      }
    }

    if (line.mpn) {
      const byMpn = catalogueByMpn.get(normalise(line.mpn));
      if (byMpn) {
        return {
          sourceRaw: line.raw,
          simproItemId: byMpn.id,
          matchedBy: 'mpn',
          confidence: 0.95,
          description: byMpn.description ?? byMpn.name,
          quantity: line.quantity ?? 1,
          unit: line.unit ?? byMpn.unit,
          unitPriceExGst: byMpn.unitPriceExGst,
          gstRate
        };
      }
    }

    const options = catalogue.map((item) => item.name);
    if (options.length === 0) {
      unresolved.push({
        lineIndex: index,
        reason: 'No catalogue data available',
        suggestions: []
      });
      return {
        sourceRaw: line.raw,
        matchedBy: 'unmatched',
        confidence: 0,
        description: line.description ?? line.raw,
        quantity: line.quantity ?? 1,
        unit: line.unit,
        gstRate
      };
    }

    const { bestMatch, ratings } = stringSimilarity.findBestMatch(normalisedRaw, options);

    if (bestMatch.rating >= 0.78) {
      const match = catalogue[ratings.findIndex((rating) => rating === bestMatch)];
      return {
        sourceRaw: line.raw,
        simproItemId: match.id,
        matchedBy: 'fuzzy',
        confidence: bestMatch.rating,
        description: match.description ?? match.name,
        quantity: line.quantity ?? 1,
        unit: line.unit ?? match.unit,
        unitPriceExGst: match.unitPriceExGst,
        gstRate
      };
    }

    unresolved.push({
      lineIndex: index,
      reason: 'No confident match',
      suggestions: ratings
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 3)
        .map((rating) => options[ratings.indexOf(rating)])
    });

    return {
      sourceRaw: line.raw,
      matchedBy: 'unmatched',
      confidence: 0,
      description: line.description ?? line.raw,
      quantity: line.quantity ?? 1,
      unit: line.unit,
      gstRate
    };
  });

  return { lines, unresolved };
};
