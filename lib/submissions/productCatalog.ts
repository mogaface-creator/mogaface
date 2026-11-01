/**
 * One list of products and indicative INR prices for the whole report. The author prompts must name products only from
 * here, so the same product has the same name and price on every page, and the toolkit page is built from the same list
 * (only the roles the report actually mentions). Prices are indicative; update this file, not the prompts.
 */
export interface CatalogProduct { name: string; priceInr: number; note: string }
export interface CatalogRole { role: string; category: string; label: string; mention: RegExp; budget: CatalogProduct; premium: CatalogProduct | null }

const p = (name: string, priceInr: number, note: string): CatalogProduct => ({ name, priceInr, note });

export const CATALOG: CatalogRole[] = [
  { role: "cleanser", category: "Cleansing and moisturiser", label: "Cleanser", mention: /cleanser/i, budget: p("Cetaphil Gentle Skin Cleanser", 429, "Mild, non-stripping daily cleanser"), premium: p("Kiehl's Ultra Facial Cleanser", 1150, "Gentle cleanser that keeps skin hydrated") },
  { role: "moisturiser", category: "Cleansing and moisturiser", label: "Moisturiser", mention: /moisturi[sz]/i, budget: p("Re'equil Oil-Free Moisturizer", 395, "Light, oil-free hydration"), premium: null },
  { role: "salicylic", category: "Targeted skincare", label: "Breakouts", mention: /salicylic/i, budget: p("Minimalist 2% Salicylic Acid Serum", 549, "Unclogs pores, calms breakouts"), premium: p("Paula's Choice 2% BHA Liquid Exfoliant", 3100, "Refines pores and texture") },
  { role: "arbutin", category: "Targeted skincare", label: "Dark marks", mention: /arbutin/i, budget: p("Minimalist 2% Alpha Arbutin Serum", 549, "Fades flat dark marks"), premium: p("The Ordinary Alpha Arbutin 2% + HA", 1155, "Fades flat dark marks") },
  { role: "niacinamide", category: "Targeted skincare", label: "Pores", mention: /niacinamide/i, budget: p("Minimalist 10% Niacinamide Serum", 599, "Refines the look of pores"), premium: p("The Ordinary Niacinamide 10% + Zinc 1%", 600, "Refines the look of pores") },
  { role: "retinol", category: "Targeted skincare", label: "Texture", mention: /retinol/i, budget: p("Minimalist 0.3% Retinol Serum", 599, "Smooths texture over weeks"), premium: p("The Ordinary Retinol 0.5% in Squalane", 875, "Smooths texture over weeks") },
  { role: "sunscreen", category: "Sunscreen", label: "Sunscreen", mention: /sunscreen/i, budget: p("Re'equil Ultra Matte Dry Touch Sunscreen SPF 50", 645, "Matte, broad spectrum"), premium: p("La Roche-Posay Anthelios XL SPF 50+", 2800, "High UVA and UVB protection") },
  { role: "eye", category: "Eye care", label: "Under-eye", mention: /eye cream|under-eye cream|caffeine/i, budget: p("The Ordinary Caffeine Solution 5% + EGCG", 900, "Helps puffiness and dark circles"), premium: p("Kiehl's Creamy Eye Treatment with Avocado", 2400, "Rich, soothing under-eye care") },
  { role: "shampoo", category: "Hair care", label: "Shampoo", mention: /shampoo/i, budget: p("Mamaearth Onion Shampoo", 310, "Gentle, sulfate-free cleanse"), premium: p("Kerastase Nutritive Bain Satin", 2400, "Nourishing shampoo for dry or unruly hair") },
  { role: "conditioner", category: "Hair care", label: "Conditioner", mention: /conditioner/i, budget: p("Mamaearth Onion Conditioner", 349, "Light, silicone-free conditioning"), premium: null },
  { role: "scalp", category: "Hair care", label: "Scalp serum", mention: /growth actives|scalp serum|hair serum/i, budget: p("Minimalist Hair Growth Actives Serum", 799, "Scalp serum for thinning areas"), premium: null },
  { role: "shave", category: "Grooming", label: "Shaving gel", mention: /shav(e|ing)/i, budget: p("Gillette Series Sensitive Shave Gel", 199, "Lower-irritation shave"), premium: null },
  { role: "aftershave", category: "Grooming", label: "Aftershave", mention: /aftershave|after-shave/i, budget: p("Nivea Men Sensitive After Shave Balm", 220, "Alcohol-free soothing balm"), premium: null },
];

/** The catalog as prompt text: the only product names and prices the author may use. */
export const CATALOG_PROMPT = CATALOG.map(c => `${c.label}: budget ${c.budget.name} (INR ${c.budget.priceInr}), ${c.premium ? `premium ${c.premium.name} (INR ${c.premium.priceInr})` : "no premium option"}`).join("; ");

/** The roles the written report actually mentions, grouped by category in catalog order. */
export function toolkitFor(text: string): { category: string; items: CatalogRole[] }[] {
  const groups: { category: string; items: CatalogRole[] }[] = [];
  for (const c of CATALOG) {
    if (!c.mention.test(text)) continue;
    const g = groups.find(x => x.category === c.category);
    if (g) g.items.push(c); else groups.push({ category: c.category, items: [c] });
  }
  return groups;
}
