/**
 * Turns the author's person-specific content into protocol pages. Pages the author cannot fill
 * are dropped (e.g. facial hair for someone with none to style); the fixed template stays the fallback.
 */
import type { Assessment } from "../assessment/types.ts";
import { replyOf } from "../assessment/clinicIntake.ts";
import type { AuthoredReport } from "./reportAuthor.ts";
import type { ProtocolPage, ProtocolBlock } from "./protocolContent.ts";

const b = (title: string, text: string): ProtocolBlock => ({ title, text });
/** Cuts to whole sentences so a card never ends mid-word. */
const brief = (t: string, max = 220) => {
  if (t.length <= max) return t;
  const cut = t.slice(0, max), i = cut.lastIndexOf(". ");
  return i > 60 ? cut.slice(0, i + 1) : `${cut.replace(/\s+\S*$/, "")}...`;
};
const inr = (n: number) => (n > 0 ? `Rs ${n.toLocaleString("en-IN")}` : "");
const HAIR_CARE: Record<string, string> = {
  curly: "Wash 2 times a week with a sulfate-free shampoo, condition every wash from mid-length to ends, detangle only when wet with fingers or a wide-tooth comb, and air-dry or diffuse on low heat. Scrunch in a light curl cream on damp hair.",
  coily: "Wash once a week with a sulfate-free shampoo, deep-condition after each wash, detangle only when wet and conditioned, and seal moisture with a light leave-in. Avoid heat and tight pulling.",
  wavy: "Wash 2 to 3 times a week with a sulfate-free shampoo, condition mid-length to ends, towel-dry by patting and air-dry. Scrunch a little sea-salt spray or light cream into damp hair.",
  straight: "Wash 2 to 3 times a week with a gentle shampoo, condition the ends only, and use a light styling cream or clay on towel-dried hair. Keep heat tools below 180 C.",
};

/** Estimates from height, weight, age and gender only; shown as estimates. */
export function bodyStats(a: Assessment | null | undefined): { label: string; value: string; sub?: string }[] {
  if (!a) return [];
  const h = a.clinicIntake.heightCm ?? a.profile.heightCm, w = a.clinicIntake.weightKg ?? a.profile.weightKg, age = a.profile.ageYears;
  if (!h || !w) return [];
  const out: { label: string; value: string; sub?: string }[] = [{ label: "HEIGHT", value: `${Math.round(h * 10) / 10} cm` }, { label: "WEIGHT", value: `${Math.round(w * 10) / 10} kg` }, { label: "BMI", value: (w / (h / 100) ** 2).toFixed(1) }];
  if (age) {
    const g = a.profile.genderPresentation, bmr = 10 * w + 6.25 * h - 5 * age + (g === "male" ? 5 : g === "female" ? -161 : -78);
    const act = replyOf(a.clinicIntake, "protocolActivity"), factor = act === "5plusPerWeek" ? 1.55 : act === "3to4PerWeek" ? 1.45 : 1.3;
    out.push({ label: "MAINTENANCE (EST.)", value: `${Math.round((bmr * factor) / 10) * 10} kcal`, sub: "Daily energy at your activity level" });
  }
  out.push({ label: "PROTEIN (EST.)", value: `${Math.round((w * 1.6) / 5) * 5} g`, sub: "Per day, 1.6 g per kg" });
  return out;
}

export function applyAuthor(template: ProtocolPage[], r: AuthoredReport, a: Assessment | null | undefined, opts: { realAge?: number | null; name: string }): ProtocolPage[] {
  const byId = new Map(template.map(p => [p.id, p]));
  const tpl = (id: string) => byId.get(id)!;
  const asked = (a ? replyOf(a.clinicIntake, "protocolHairTexture") : "") || a?.hair.texture || "";
  const texture = (r.hair.pattern || asked).toLowerCase();
  const page = (id: string, title: string, subtitle: string, blocks: ProtocolBlock[], extra: Partial<ProtocolPage> = {}): ProtocolPage =>
    ({ id, title, subtitle, blocks: blocks.filter(x => x.text.trim()), takeaway: "", ...extra });
  const pages: ProtocolPage[] = [];

  pages.push({ ...tpl("cover"), takeaway: "Your photographs and answers shaped every page: what we see, what to do about it and what to buy." });
  pages.push({ id: "index", title: "Contents", subtitle: "YOUR PROTOCOL AT A GLANCE", blocks: [], takeaway: "" }); // filled below once page numbers are known

  pages.push(page("overview", `${opts.name}'s protocol`, "CURRENT LOOK AND OPTIMAL LOOK", r.outcomes.map(o => b(o.title, o.text)), {
    region: "portrait", scope: r.scope, holding: brief(r.holding),
    ages: r.apparentAge && r.achievableAge && r.achievableAge < r.apparentAge ? { now: String(r.apparentAge), nowLabel: "LOOKS AROUND", achievable: String(r.achievableAge) } : undefined,
  }));

  pages.push(page("hair", "Hair and hairline", "YOUR STARTING POINT", [
    b("What we see", r.hair.summary + (r.hair.tags.length ? `\nTags: ${r.hair.tags.join(" / ")}` : "")),
    b("Hair care", texture === "bald" ? "Cleanse the scalp 2 to 3 times a week with a gentle shampoo and moisturise it; use sunscreen on exposed scalp outdoors." : HAIR_CARE[texture] || HAIR_CARE.wavy),
    b(`Hairline${r.hair.hairlineStage ? `: ${r.hair.hairlineStage}` : ""} (a description of shape, not a prediction)`, r.hair.hairline),
    b("If shedding is changing", "If hair is shedding more than usual or the part and temples are widening, see a dermatologist: the cause decides the treatment, and a haircut or a generated image cannot establish it."),
  ], { region: "hair" }));
  pages.push(page("haircut", "Your haircut", `${r.hair.cut.toUpperCase()}`, [b("Why this cut", r.hair.why), b("What to ask your barber for", r.hair.barber), b("How to style it", r.hair.styling)]));
  pages.push(page("eyes", "Eye area", "SHADOW, TEXTURE AND EXPRESSION", [b("Assessment", r.eyes.assessment), b("Under-eye care", r.eyes.care)], {
    region: "eyes", rows: r.eyes.features.map(f => ({ label: f.label.toUpperCase(), text: f.value })),
  }));
  pages.push(page("jaw", "Jaw and lower face", "STRUCTURE, SOFT TISSUE AND WHAT CHANGES IT", [b("Structure", r.jaw.structure), b("Fat and fluid", r.jaw.softTissue), ...r.jaw.methods.map((m, i) => b(`${String(i + 1).padStart(2, "0")} / ${m.title}`, m.text))], { region: "jaw" }));
  const browBlocks = [b("Brow plan", r.eyes.browPlan), b(`Frames that work for your ${r.faceShape || "face"} shape`, r.eyes.glasses)];
  const hasFacialHair = !!(r.facialHair.now || r.facialHair.plan);
  pages.push(page("facial-hair", hasFacialHair ? "Brows, glasses and facial hair" : "Eyebrows and glasses", hasFacialHair ? "THE FINISHING DETAILS" : `BROWS NOW: ${r.eyes.browShape.toUpperCase() || "NATURAL"}`,
    hasFacialHair ? [...browBlocks, b("Facial hair now", r.facialHair.now), b("Facial hair plan", r.facialHair.plan)] : browBlocks, hasFacialHair ? { region: "jaw" } : {}));
  pages.push(page("skin", "Skin", "CONDITION", [b("Condition", r.skin.condition), b("Skin type", r.skin.type), b("Rules that protect the results", "Patch-test any new product on a small area first. Add one new active at a time and wait two weeks before the next. Do not over-exfoliate. Wear SPF 30 or higher every morning; it protects every other step.")], { region: "skin" }));
  pages.push(page("skin-concerns", "Skin concerns", "WHAT WE SEE AND WHAT TO DO", r.skin.concerns.map(c => b(c.title, `${c.seen ? c.seen + "\n" : ""}${c.action}`))));
  if (r.clinic.length) pages.push(page("clinical", "Clinic options", "FOR DISCUSSION WITH A QUALIFIED CLINICIAN", r.clinic.map(c => b(`${c.area}: ${c.option}`, `${c.why}${c.downtime ? ` Typical downtime: ${c.downtime}.` : ""}`)).concat(b("Before any procedure", "A clinician must assess your history, medication, allergies and skin. These are options to discuss, not a prescription, and doing nothing is always an option."))));
  const video = tpl("facial-exercises");
  const stats = bodyStats(a);
  pages.push(page("nutrition", "Exercise, nutrition and diet", "HOW TRAINING AND EATING CHANGE HOW YOU LOOK", [b("Exercise", r.exercise), b("Nutrition", r.nutrition), b("What exercise cannot do", "Facial fat cannot be spot-reduced and bone shape does not change; overall body composition, posture and sleep are what show in the face.")], stats.length ? { stats } : {}));
  if (!/^No expression video was supplied/.test(video.blocks[0]?.text ?? "")) pages.push({ ...video, title: "Your expression video", takeaway: "" });
  pages.push(page("style", "Style profile", "FIT, COLOUR AND DAILY CONTEXT", [b("How clothes should fit you", r.style.fit), b("Colour palette", r.style.palette), b("Casual", r.style.casual), b("Smart", r.style.smart)]));
  if (r.toolkit.length) pages.push(page("toolkit", "Toolkit", "EVERYTHING THIS PROTOCOL ASKS FOR (INDICATIVE PRICES)", [], {
    rows: r.toolkit.flatMap(t => [
      { head: t.category.toUpperCase(), label: "BUDGET", title: t.budget.name, text: [inr(t.budget.priceInr), t.budget.note].filter(Boolean).join(". ") },
      ...(t.premium.name ? [{ label: "PREMIUM", title: t.premium.name, text: [inr(t.premium.priceInr), t.premium.note].filter(Boolean).join(". ") }] : []),
    ]),
  }));
  const list = (xs: { title: string; text: string }[]) => xs.map(x => `${x.title}: ${x.text}`).join("\n");
  pages.push(page("summary", "Summary and priorities", `FACE SHAPE: ${(r.faceShape || "see photos").toUpperCase()}`, [
    b("Strengths to keep", list(r.strengths)), b("What can improve", list(r.weaknesses)),
    ...r.priorities.map((p, i) => b(`${String(i + 1).padStart(2, "0")} / ${p.title}`, p.text)), b("Your potential", r.potential),
  ]));
  const sources = tpl("sources");
  sources.blocks = [...sources.blocks.filter(x => x.title === "Care guidance" || x.title === "General health guidance"),
    b("About this report", "Written by MogaFace's AI analysis of your photographs and answers; it describes what is visible and suggests what to do, and is not a medical diagnosis or treatment plan. The after photo is an illustration, not a predicted result. Scores and visual age are estimates, not measurements. Clinic options are categories to discuss with a qualified clinician, who must assess your history, medication, allergies and skin; no doses or device settings are given.")];
  pages.push({ ...sources, takeaway: "Thank you for choosing MogaFace. Bring this protocol to a clinician or stylist; update it when your goals change." });

  const groups: [string, string[]][] = [["Start here", ["overview"]], ["Hair", ["hair", "haircut"]], ["Face", ["eyes", "facial-hair", "jaw"]], ["Skin and clinic", ["skin", "skin-concerns", "clinical"]], ["Lifestyle", ["nutrition", "facial-exercises", "style", "toolkit"]], ["Close", ["summary", "sources"]]];
  const num = (id: string) => pages.findIndex(p => p.id === id) + 1;
  const idx = pages.find(p => p.id === "index")!;
  idx.blocks = groups.map(([g, ids]) => b(g, ids.filter(id => num(id) > 0).map(id => `${String(num(id)).padStart(2, "0")} / ${pages[num(id) - 1].title}`).join("\n"))).filter(x => x.text);
  return pages;
}
