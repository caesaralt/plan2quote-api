const TOKEN_REGEX = /[^a-z0-9]+/gi;

const normalise = (value) => value?.toLowerCase().replace(TOKEN_REGEX, ' ').replace(/\s+/g, ' ').trim() ?? '';

const tokenise = (value) => normalise(value).split(' ').filter(Boolean);

const jaccard = (aTokens, bTokens) => {
  if (aTokens.length === 0 || bTokens.length === 0) return 0;
  const setA = new Set(aTokens);
  const setB = new Set(bTokens);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = new Set([...aTokens, ...bTokens]).size;
  return union === 0 ? 0 : intersection / union;
};

const findBestTokenMatch = (raw, options) => {
  const tokens = tokenise(raw);
  let best = { index: -1, score: 0 };
  options.forEach((option, index) => {
    const score = jaccard(tokens, tokenise(option));
    if (score > best.score) {
      best = { index, score };
    }
  });
  return best;
};

export const reconcileLines = (parsed, catalogue, gstRate) => {
  const unresolved = [];

  const catalogueBySku = new Map();
  const catalogueByMpn = new Map();
  for (const item of catalogue) {
    if (item.sku) catalogueBySku.set(normalise(item.sku), item);
    if (item.mpn) catalogueByMpn.set(normalise(item.mpn), item);
  }

  const lines = parsed.map((line, index) => {
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
      unresolved.push({ lineIndex: index, reason: 'No catalogue data available', suggestions: [] });
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

    const best = findBestTokenMatch(normalisedRaw, options);

    if (best.index !== -1 && best.score >= 0.5) {
      const match = catalogue[best.index];
      return {
        sourceRaw: line.raw,
        simproItemId: match.id,
        matchedBy: 'fuzzy',
        confidence: best.score,
        description: match.description ?? match.name,
        quantity: line.quantity ?? 1,
        unit: line.unit ?? match.unit,
        unitPriceExGst: match.unitPriceExGst,
        gstRate
      };
    }

    const sortedSuggestions = options
      .map((name, idx) => ({ name, score: jaccard(tokenise(name), tokenise(normalisedRaw)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((entry) => entry.name);

    unresolved.push({ lineIndex: index, reason: 'No confident match', suggestions: sortedSuggestions });

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
