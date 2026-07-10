export const DEFAULT_COST_RULES = {
  metal: { markupPct: 10 },
  manufacturing: { mode: "percentage" as const, pct: 10, perGram: 5 },
  plating: { Ring: 15, Earrings: 20, Necklace: 25, Bracelet: 20, Anklet: 15, Set: 30, Other: 10 },
  packaging: { fixed: 75 },
  transportation: { fixed: 0 },
  usdEgpRate: 50,
};

export type CostRules = typeof DEFAULT_COST_RULES;
