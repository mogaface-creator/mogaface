/**
 * The 25-page MogaFace Glow-Up Protocol, rendered from person-specific authored content.
 * One page per topic, each with its own visual: cover and closing waves, score bars, haircut silhouette,
 * hairline-stage chart, brow shapes, glasses icons, anatomy illustrations, face-shape diagram.
 * Falls back to nothing: the caller uses the fixed template when there is no authored content.
 */
import { PDFDocument, StandardFonts, rgb, pushGraphicsState, popGraphicsState, moveTo, lineTo, appendBezierCurve, closePath, clip, endPath, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { GeneratePdfReportInput } from "./pdfReport.ts";
import type { AuthoredReport, BrowShape, GlassesStyle, HairlineStage } from "./reportAuthor.ts";
import { bodyTargets } from "./reportAuthor.ts";
import { REPORT_ILLUSTRATIONS, type ReportIllustration } from "./reportAssets.ts";
import { buildProtocolPages } from "./protocolContent.ts";
import { W, H, C, clean, wrap, jpeg, hex, type CropRegion } from "./pdfKit.ts";

const MX = 56, CWD = W - 2 * MX, BOTTOM = 84;
const DEEP = hex("#2a1740"), MID = hex("#6b4f8c"), SOFT = hex("#b9a6d2"), MIST = hex("#e8e0f0");

/** A block knows its height at a given width and font scale, and draws itself from a top-left origin going down. */
interface Blk { h(w: number, s: number): number; draw(p: PDFPage, x: number, top: number, w: number, s: number): void }
const BODY = 11.2, LH = 1.52;

function kit(font: PDFFont, bold: PDFFont, imgs: Map<string, PDFImage>) {
  const lines = (t: string, f: PDFFont, size: number, w: number) => wrap(t, f, size, w);
  const para = (t: string, o: { size?: number; color?: ReturnType<typeof rgb>; f?: PDFFont } = {}): Blk => {
    const size = o.size ?? BODY, f = o.f ?? font;
    return { h: (w, s) => lines(t, f, size * s, w).length * size * s * LH + 4, draw: (p, x, top, w, s) => { let y = top - size * s; for (const l of lines(t, f, size * s, w)) { p.drawText(l, { x, y, font: f, size: size * s, color: o.color ?? C.ink }); y -= size * s * LH; } } };
  };
  const gap = (n: number): Blk => ({ h: (_w, s) => n * s, draw: () => {} });
  const heading = (t: string): Blk => ({ h: () => 30, draw: (p, x, top) => { p.drawCircle({ x: x + 3, y: top - 11, size: 2.6, color: MID }); p.drawText(clean(t), { x: x + 14, y: top - 16, font: bold, size: 15.5, color: C.ink }); } });
  const sub = (t: string, x2?: string): Blk => ({ h: (w, s) => 20 * s + lines(x2 ?? "", font, BODY * s, w).length * BODY * s * LH + 10, draw: (p, x, top, w, s) => { p.drawText(clean(t), { x, y: top - 12 * s, font: bold, size: 12.6 * s, color: C.ink }); if (x2) para(x2).draw(p, x, top - 20 * s, w, s); } });
  const numbered = (n: number, t: string, body: string): Blk => ({ h: (w, s) => 22 * s + lines(body, font, BODY * s, w).length * BODY * s * LH + 8, draw: (p, x, top, w, s) => { p.drawText(String(n).padStart(2, "0"), { x, y: top - 12 * s, font: bold, size: 12.6 * s, color: MID }); p.drawText(clean(t), { x: x + 24, y: top - 12 * s, font: bold, size: 12.6 * s, color: C.ink }); para(body).draw(p, x, top - 20 * s, w, s); } });
  const bullet = (t: string): Blk => ({ h: (w, s) => lines(t, font, 10.6 * s, w - 16).length * 10.6 * s * LH + 5, draw: (p, x, top, w, s) => { p.drawCircle({ x: x + 4, y: top - 8 * s, size: 1.8, color: C.ink }); let y = top - 10.6 * s; for (const l of lines(t, font, 10.6 * s, w - 16)) { p.drawText(l, { x: x + 14, y, font, size: 10.6 * s, color: C.ink }); y -= 10.6 * s * LH; } } });
  const dash = (t: string): Blk => ({ h: (w, s) => lines(t, font, 10.6 * s, w - 20).length * 10.6 * s * LH + 6, draw: (p, x, top, w, s) => { p.drawLine({ start: { x, y: top - 6 * s }, end: { x: x + 9, y: top - 6 * s }, thickness: 0.8, color: MID }); let y = top - 10.6 * s; for (const l of lines(t, font, 10.6 * s, w - 20)) { p.drawText(l, { x: x + 18, y, font, size: 10.6 * s, color: C.ink }); y -= 10.6 * s * LH; } } });
  const roundRect = (w: number, h: number, r: number) => `M${r},0 H${w - r} Q${w},0 ${w},${r} V${h - r} Q${w},${h} ${w - r},${h} H${r} Q0,${h} 0,${h - r} V${r} Q0,0 ${r},0 Z`;
  const box = (t: string, body: string, fill = DEEP): Blk => ({
    h: (w, s) => 20 + 22 * s + lines(body, font, 10.6 * s, w - 32).length * 10.6 * s * LH + 6,
    draw: (p, x, top, w, s) => { const hh = 20 + 22 * s + lines(body, font, 10.6 * s, w - 32).length * 10.6 * s * LH + 6; p.drawSvgPath(roundRect(w, hh, 7), { x, y: top, color: fill }); p.drawCircle({ x: x + 16, y: top - 17, size: 2.4, color: C.white }); p.drawText(clean(t), { x: x + 24, y: top - 21, font: bold, size: 12 * s, color: C.white }); p.drawLine({ start: { x: x + 16, y: top - 29 * s }, end: { x: x + w - 16, y: top - 29 * s }, thickness: 0.5, color: SOFT }); let y = top - 29 * s - 10.6 * s - 7; for (const l of lines(body, font, 10.6 * s, w - 32)) { p.drawText(l, { x: x + 16, y, font, size: 10.6 * s, color: C.white }); y -= 10.6 * s * LH; } },
  });
  const chips = (tags: string[]): Blk => {
    const place = (w: number) => { const out: { t: string; x: number; row: number; cw: number }[] = []; let x = 0, row = 0; for (const t of tags) { const cw = bold.widthOfTextAtSize(clean(t), 9) + 22; if (x + cw > w && x > 0) { x = 0; row++; } out.push({ t, x, row, cw }); x += cw + 8; } return out; };
    return { h: w => (place(w).reduce((m, c) => Math.max(m, c.row), 0) + 1) * 30, draw: (p, x, top, w) => { for (const c of place(w)) { const y = top - c.row * 30; p.drawSvgPath(roundRect(c.cw, 22, 6), { x: x + c.x, y, color: MID }); p.drawText(clean(c.t), { x: x + c.x + 11, y: y - 15, font: bold, size: 9, color: C.white }); } } };
  };
  const rows = (items: { label: string; value: string }[]): Blk => ({
    h: (w, s) => items.reduce((sum, r) => sum + Math.max(28, lines(r.value, font, 10.6 * s, w - 112).length * 10.6 * s * LH + 14), 0),
    draw: (p, x, top, w, s) => { let y = top; for (const r of items) { const rh = Math.max(28, lines(r.value, font, 10.6 * s, w - 112).length * 10.6 * s * LH + 14); p.drawText(clean(r.label.toUpperCase()), { x, y: y - 17, font, size: 7.2, color: C.muted }); let ty = y - 17; for (const l of lines(r.value, font, 10.6 * s, w - 112)) { p.drawText(l, { x: x + 108, y: ty, font, size: 10.6 * s, color: C.ink }); ty -= 10.6 * s * LH; } p.drawLine({ start: { x, y: y - rh }, end: { x: x + w, y: y - rh }, thickness: 0.4, color: C.line }); y -= rh; } },
  });
  const photo = (key: string, w: number, h: number, caption?: string): Blk => ({ h: () => h + (caption ? 16 : 0) + 4, draw: (p, x, top) => { const im = imgs.get(key); if (im) { p.drawRectangle({ x, y: top - h, width: w, height: h, color: C.pale }); const sc = Math.min(w / im.width, h / im.height); p.drawImage(im, { x: x + (w - im.width * sc) / 2, y: top - h + (h - im.height * sc) / 2, width: im.width * sc, height: im.height * sc }); p.drawRectangle({ x, y: top - h, width: w, height: h, borderColor: C.line, borderWidth: 0.6 }); } if (caption) p.drawText(clean(caption), { x, y: top - h - 12, font, size: 7, color: C.muted }); } });
  const cols = (left: Blk[], right: Blk, rw: number, gapX = 22): Blk => ({
    h: (w, s) => Math.max(left.reduce((a, b) => a + b.h(w - rw - gapX, s), 0), right.h(rw, s)),
    draw: (p, x, top, w, s) => { let y = top; for (const b of left) { b.draw(p, x, y, w - rw - gapX, s); y -= b.h(w - rw - gapX, s); } right.draw(p, x + w - rw, top, rw, s); },
  });
  const grid = (items: Blk[], n = 2, gapX = 24): Blk => {
    const rowsOf = (): Blk[][] => { const r: Blk[][] = []; items.forEach((b, i) => { if (i % n === 0) r.push([]); r[r.length - 1].push(b); }); return r; };
    return { h: (w, s) => rowsOf().reduce((sum, r) => sum + Math.max(...r.map(b => b.h((w - gapX * (n - 1)) / n, s))), 0), draw: (p, x, top, w, s) => { const cw = (w - gapX * (n - 1)) / n; let y = top; for (const r of rowsOf()) { r.forEach((b, i) => b.draw(p, x + i * (cw + gapX), y, cw, s)); y -= Math.max(...r.map(b => b.h(cw, s))); } } };
  };
  const col = (blocks: Blk[]): Blk => ({ h: (w, s) => blocks.reduce((a, b) => a + b.h(w, s), 0), draw: (p, x, top, w, s) => { let y = top; for (const b of blocks) { b.draw(p, x, y, w, s); y -= b.h(w, s); } } });
  const quote = (t: string): Blk => ({ h: (w, s) => lines(t, font, 10.2 * s, w - 14).length * 10.2 * s * LH + 8, draw: (p, x, top, w, s) => { const hh = lines(t, font, 10.2 * s, w - 14).length * 10.2 * s * LH + 2; p.drawRectangle({ x, y: top - hh - 2, width: 2, height: hh, color: C.line }); let y = top - 10.2 * s; for (const l of lines(t, font, 10.2 * s, w - 14)) { p.drawText(l, { x: x + 12, y, font, size: 10.2 * s, color: C.muted }); y -= 10.2 * s * LH; } } });
  const custom = (h: number, draw: (p: PDFPage, x: number, top: number, w: number) => void): Blk => ({ h: () => h, draw: (p, x, top, w) => draw(p, x, top, w) });
  return { para, gap, heading, sub, numbered, bullet, dash, box, chips, rows, photo, cols, grid, col, quote, custom, roundRect };
}

const DIAGRAM = hex("#d9d1e3");
function drawFaceShape(p: PDFPage, cx: number, cy: number, shape: string) {
  const path: Record<string, string> = {
    oval: "M-30,0 A30,42 0 1 0 30,0 A30,42 0 1 0 -30,0 Z", round: "M-36,0 A36,36 0 1 0 36,0 A36,36 0 1 0 -36,0 Z", oblong: "M-27,0 A27,52 0 1 0 27,0 A27,52 0 1 0 -27,0 Z",
    square: "M-30,-36 H30 Q36,-36 36,-30 V30 Q36,40 26,40 H-26 Q-36,40 -36,30 V-30 Q-36,-36 -30,-36 Z",
    heart: "M-34,-18 Q-34,-42 0,-42 Q34,-42 34,-18 Q34,12 0,46 Q-34,12 -34,-18 Z", diamond: "M0,-46 Q28,-22 34,0 Q22,28 0,46 Q-22,28 -34,0 Q-28,-22 0,-46 Z",
  };
  p.drawSvgPath(path[shape] ?? path.oval, { x: cx, y: cy + 0, color: DIAGRAM });
  const dl = (a: [number, number], b: [number, number]) => p.drawLine({ start: { x: cx + a[0], y: cy - a[1] }, end: { x: cx + b[0], y: cy - b[1] }, thickness: 0.7, color: C.muted, dashArray: [3, 3] });
  dl([0, -58], [0, 58]); dl([-52, -22], [52, -22]); dl([-52, 12], [52, 12]);
}
const BROW_PATH: Record<BrowShape, string> = { straight: "M2,16 L54,12", "soft arch": "M2,18 Q26,4 54,14", "high arch": "M2,20 Q28,-6 54,18", angled: "M2,18 L28,4 L54,15", rounded: "M2,18 Q28,2 54,18" };
function drawBrowChart(p: PDFPage, x: number, top: number, w: number, now: BrowShape, target: BrowShape, font: PDFFont, bold: PDFFont) {
  const names = Object.keys(BROW_PATH) as BrowShape[], cw = (w - 8 * 4) / 5;
  names.forEach((n, i) => {
    const cx = x + i * (cw + 8), mark = n === now || n === target, y = top - 4;
    if (mark) p.drawRectangle({ x: cx, y: y - 88, width: cw, height: 88, color: n === now ? C.pale : C.white, borderColor: MID, borderWidth: 0.9 });
    p.drawSvgPath(BROW_PATH[n], { x: cx + (cw - 56) / 2, y: y - 14, borderColor: mark ? MID : SOFT, borderWidth: 5, color: undefined });
    p.drawEllipse({ x: cx + cw / 2, y: y - 50, xScale: 13, yScale: 6, color: mark ? SOFT : MIST });
    p.drawText(n.toUpperCase(), { x: cx + (cw - font.widthOfTextAtSize(n.toUpperCase(), 7.6)) / 2, y: y - 68, font, size: 7.6, color: C.muted });
    const tag = n === now && n === target ? "YOURS NOW" : n === now ? "YOURS NOW" : n === target ? "GROOM TOWARD" : "";
    if (tag) p.drawText(tag, { x: cx + (cw - bold.widthOfTextAtSize(tag, 6.2)) / 2, y: y - 80, font: bold, size: 6.2, color: MID });
  });
}
const HAIRLINE_Y: Record<HairlineStage, [number, number]> = { juvenile: [-4, -8], maturing: [-4, -13], mature: [-4, -17], "receded temples": [-15, -19], "thinning density": [-17, -23] };
const HAIRLINE_NOTE: Record<HairlineStage, string> = { juvenile: "Juvenile - low, rounded hairline with no recession.", maturing: "Maturing - the hairline has lifted slightly at the centre.", mature: "Mature - settled adult hairline with defined temple angles.", "receded temples": "Receded temples - the temple corners have moved back.", "thinning density": "Thinning density - coverage is reduced across the front or crown." };
function drawHairlineChart(p: PDFPage, x: number, top: number, w: number, current: HairlineStage, font: PDFFont, bold: PDFFont) {
  const stages = Object.keys(HAIRLINE_Y) as HairlineStage[], cw = w / 5;
  stages.forEach((st, i) => {
    const cx = x + i * cw + cw / 2, cy = top - 66, [ty, cyc] = HAIRLINE_Y[st], sel = st === current;
    if (sel) p.drawRectangle({ x: cx - cw / 2 + 8, y: top - 128, width: cw - 16, height: 124, color: C.white, borderColor: MID, borderWidth: 1 });
    p.drawSvgPath("M-22,0 A22,28 0 1 0 22,0 A22,28 0 1 0 -22,0 Z", { x: cx, y: cy + 4, color: sel ? MIST : hex("#eeeaf2") });
    p.drawSvgPath(`M-22,${ty} A22,28 0 0 1 22,${ty} Q0,${cyc} -22,${ty} Z`, { x: cx, y: cy + 4, color: st === "thinning density" ? SOFT : sel ? MID : hex("#6a6275") });
    p.drawText(st[0].toUpperCase() + st.slice(1), { x: cx - font.widthOfTextAtSize(st[0].toUpperCase() + st.slice(1), 8) / 2, y: top - 106, font, size: 8, color: C.ink });
    if (sel) p.drawText("YOURS", { x: cx - bold.widthOfTextAtSize("YOURS", 6.4) / 2, y: top - 119, font: bold, size: 6.4, color: MID });
  });
}
function drawGlasses(p: PDFPage, x: number, y: number, style: GlassesStyle) {
  const o = { x, y, borderColor: C.ink, borderWidth: 2, color: undefined } as const;
  const lens: Record<GlassesStyle, [string, string]> = {
    rectangle: ["M3,6 H38 Q40,6 40,8 V28 Q40,31 37,31 H6 Q3,31 3,28 V8 Q3,6 3,6 Z", "M52,6 H87 Q89,6 89,8 V28 Q89,31 86,31 H55 Q52,31 52,28 V8 Q52,6 52,6 Z"],
    square: ["M3,4 H38 V33 H3 Z", "M52,4 H87 V33 H52 Z"],
    round: ["M3,18 A18,15 0 1 0 39,18 A18,15 0 1 0 3,18 Z", "M51,18 A18,15 0 1 0 87,18 A18,15 0 1 0 51,18 Z"],
    wayfarer: ["M2,5 H40 L37,29 Q36,32 32,32 H9 Q5,32 4,28 Z", "M50,5 H88 L86,28 Q85,32 81,32 H58 Q54,32 53,29 Z"],
    browline: ["M2,5 H40 V17 Q40,32 21,32 Q2,32 2,17 Z", "M50,5 H88 V17 Q88,32 69,32 Q50,32 50,17 Z"],
    aviator: ["M3,8 Q21,2 39,8 Q41,29 24,33 Q6,31 3,8 Z", "M51,8 Q69,2 87,8 Q89,29 72,33 Q54,31 51,8 Z"],
  };
  p.drawSvgPath(lens[style][0], o); p.drawSvgPath(lens[style][1], o);
  p.drawSvgPath("M40,14 Q45,9 50,14", o); p.drawLine({ start: { x, y: y - 9 }, end: { x: x - 4, y: y - 5 }, thickness: 2, color: C.ink }); p.drawLine({ start: { x: x + 90, y: y - 9 }, end: { x: x + 94, y: y - 5 }, thickness: 2, color: C.ink });
}
function drawHeadSilhouette(p: PDFPage, x: number, top: number, length: "short" | "medium" | "long") {
  p.drawSvgPath("M0,150 Q12,118 50,112 Q88,118 100,150 Z", { x, y: top - 0, color: MIST });
  p.drawSvgPath("M42,96 H58 V114 H42 Z", { x, y: top, color: MIST });
  p.drawSvgPath("M22,56 A28,38 0 1 0 78,56 A28,38 0 1 0 22,56 Z", { x, y: top - 4, color: MIST });
  p.drawSvgPath("M17,52 A6,9 0 1 0 17,53 Z M83,52 A6,9 0 1 0 83,53 Z", { x, y: top, color: MIST });
  const caps: Record<string, string> = {
    short: "M23,48 Q22,14 50,12 Q78,14 77,48 Q72,34 62,30 Q50,34 38,30 Q28,34 23,48 Z",
    medium: "M20,56 Q16,8 50,6 Q84,8 80,56 Q76,40 68,32 Q60,40 50,31 Q40,40 32,32 Q24,40 20,56 Z",
    long: "M16,92 Q8,10 50,5 Q92,10 84,92 Q80,60 76,40 Q66,34 58,40 Q50,30 42,40 Q34,34 24,40 Q20,60 16,92 Z",
  };
  p.drawSvgPath(caps[length], { x, y: top - 4, color: MID });
}
/** One wave layer: an opaque band that fills downward (or upward when flipped); `phase` varies the curve so layers do not run parallel. */
function wave(p: PDFPage, yTop: number, color: ReturnType<typeof rgb>, phase = 0, flip = false) {
  const d = flip ? -1 : 1, a = phase % 2 === 0 ? 44 : 30, b = phase % 2 === 0 ? 34 : 46;
  p.drawSvgPath(`M0,${phase * -6} C150,${-a * d} 300,${a * d} 450,${phase * 5} S560,${-b * d} ${W},${10 * d} V${300 * d} H0 Z`, { x: 0, y: yTop, color });
}
/** Diagonal hatching clipped to the first wave's shape, like the textured top band of the reference cover. */
function hatchedWave(p: PDFPage, yTop: number, base: ReturnType<typeof rgb>) {
  wave(p, yTop, base, 0);
  const y = (v: number) => yTop - v;
  p.pushOperators(pushGraphicsState(), moveTo(0, y(0)), appendBezierCurve(150, y(-44), 300, y(44), 450, y(0)), appendBezierCurve(600, y(-44), 560, y(-34), W, y(10)), lineTo(W, y(120)), lineTo(0, y(120)), closePath(), clip(), endPath());
  for (let x = -120; x < W + 40; x += 7) p.drawLine({ start: { x, y: yTop + 60 }, end: { x: x + 70, y: yTop - 100 }, thickness: 0.7, color: C.white, opacity: 0.16 });
  p.pushOperators(popGraphicsState());
}
/** Small caps with letter spacing (pdf-lib has no tracking option). */
function spaced(p: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>, track = 2.2) {
  let cx = x; for (const ch of text) { p.drawText(ch, { x: cx, y, font, size, color }); cx += font.widthOfTextAtSize(ch, size) + track; }
}
const mix = (a: [number, number, number], b: [number, number, number], t: number) => rgb((a[0] + (b[0] - a[0]) * t) / 255, (a[1] + (b[1] - a[1]) * t) / 255, (a[2] + (b[2] - a[2]) * t) / 255);

export async function generateReportPdf(input: GeneratePdfReportInput & { author: AuthoredReport }): Promise<Uint8Array> {
  const { face: f, body } = input.author, name = clean(input.clientName);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold), mark = await doc.embedFont(StandardFonts.TimesRomanItalic);
  doc.setTitle(`MogaFace - ${name} - Glow-Up Protocol`); doc.setAuthor("MogaFace");
  const approved = (input.previewApproved === true || input.previewStatus === "quality_checked") && !!input.afterImageBytes;
  const date = input.dateStr || new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "long", year: "numeric" }).toUpperCase();
  const imgs = new Map<string, PDFImage>();
  const addPhoto = async (key: string, which: "now" | "after", region: CropRegion, w: number, h: number) => { imgs.set(key, await doc.embedJpg(await jpeg(which === "now" ? input.beforeImageBytes : input.afterImageBytes!, w / h, region, input.portraitGeometry))); return key; };
  const illu = async (k: ReportIllustration) => { const key = `ill-${k}`; if (!imgs.has(key)) imgs.set(key, await doc.embedJpg(Buffer.from(REPORT_ILLUSTRATIONS[k], "base64"))); return key; };
  const k = kit(font, bold, imgs);
  const targets = bodyTargets(input.assessment);
  const video = buildProtocolPages({ name, assessment: input.assessment, analysis: input.analysis }).find(pg => pg.id === "facial-exercises");
  const hasVideo = !!video && !/^No expression video was supplied/.test(video.blocks[0]?.text ?? "");

  // Photo pairs: with an approved after image show NOW and PROJECTED; otherwise one original.
  const pair = async (region: CropRegion, id: string, w: number, h: number): Promise<Blk> => {
    if (approved) { const gw = (w - 14) / 2, a = await addPhoto(`${id}-now`, "now", region, gw, h), b = await addPhoto(`${id}-after`, "after", region, gw, h); return k.custom(h + 22, (p, x, top) => { k.photo(a, gw, h, "NOW").draw(p, x, top, gw, 1); k.photo(b, gw, h, "PROJECTED").draw(p, x + gw + 14, top, gw, 1); }); }
    const a = await addPhoto(`${id}-now`, "now", region, w, h); return k.photo(a, w, h, "ORIGINAL PHOTO");
  };
  const stack = async (region: CropRegion, id: string, w: number, h: number): Promise<Blk> => {
    if (approved) { const a = await addPhoto(`${id}-now`, "now", region, w, h), b = await addPhoto(`${id}-after`, "after", region, w, h); return k.custom(2 * (h + 22), (p, x, top) => { k.photo(a, w, h, "NOW").draw(p, x, top, w, 1); k.photo(b, w, h, "PROJECTED").draw(p, x, top - h - 22, w, 1); }); }
    const a = await addPhoto(`${id}-now`, "now", region, w, h * 1.6); return k.photo(a, w, h * 1.6, "ORIGINAL PHOTO");
  };
  const illustrated = async (img: ReportIllustration, caption: string, size = 118) => k.photo(await illu(img), size, size, caption);

  type Draw = (p: PDFPage) => void;
  interface PageDef { id: string; chapter: string; title: string; subtitle?: string; blocks?: Blk[]; chrome?: boolean; custom?: Draw }
  const defs: PageDef[] = [];
  const add = (d: PageDef) => defs.push(d);
  const W2 = CWD;

  // 1 cover
  add({ id: "cover", chapter: "", title: "", chrome: false, custom: p => {
    const top0 = H * 0.5, strips = 48;
    for (let i = 0; i < strips; i++) p.drawRectangle({ x: 0, y: H - ((i + 1) * (H - top0)) / strips - 1, width: W, height: (H - top0) / strips + 2, color: mix([86, 60, 126], [44, 31, 68], i / strips) });
    hatchedWave(p, top0 + 20, hex("#43305f")); wave(p, top0 - 30, hex("#8f7da9"), 1); wave(p, top0 - 80, hex("#d6cde4"), 2); wave(p, top0 - 130, hex("#ffffff"), 3);
    p.drawText("Moga", { x: 70, y: H - 112, font, size: 32, color: C.white }); p.drawText("Face", { x: 70 + font.widthOfTextAtSize("Moga", 32), y: H - 112, font: bold, size: 32, color: C.white });
    p.drawText("GLOW-UP", { x: 70, y: H - 330, font: bold, size: 46, color: C.white }); p.drawText("PROTOCOL", { x: 70, y: H - 382, font, size: 46, color: C.white });
    spaced(p, "PREPARED FOR", 70, 232, 8, font, C.muted, 2.6);
    let fs = 36; while (font.widthOfTextAtSize(name, fs) > W - 140 && fs > 16) fs -= 1; p.drawText(name, { x: 70, y: 188, font, size: fs, color: C.ink });
    p.drawLine({ start: { x: 70, y: 166 }, end: { x: 134, y: 166 }, thickness: 1.5, color: MID });
    spaced(p, "MOGAFACE", 70, 140, 7.6, font, C.muted, 2.4); spaced(p, date, 180, 140, 7.6, font, C.muted, 2.4);
  } });
  // 2 disclaimer
  const narrow = (b: Blk, r = 0.88): Blk => ({ h: (w, s) => b.h(w * r, s), draw: (p, x, top, w, s) => b.draw(p, x, top, w * r, s) });
  add({ id: "disclaimer", chapter: "Disclaimer", title: "Disclaimer", blocks: [
    narrow(k.para("This protocol is an aesthetic and lifestyle advisory document. It is not medical advice, a diagnosis, or a treatment plan.", { size: 15 }), 0.84), k.gap(14),
    narrow(k.para("What follows is a personalised assessment of your appearance, based on the photographs, expression video and questionnaire you submitted, together with grooming, skincare, training, nutrition and styling guidance that follows from it. Everything recommended here is something you can do yourself.")), k.gap(8),
    narrow(k.para("It is not a medical or dermatological consultation. We do not diagnose conditions. The clinic options page lists categories of treatment only so you can discuss them with a qualified clinician, who must assess your history, medication, allergies and skin; no doses or device settings are given. If you have a skin, hair, joint or dietary condition, or take prescription medication, speak to a qualified professional before changing your routine.")), k.gap(8),
    narrow(k.para("Your photographs are read by an AI system. Lighting, camera angle and expression all affect what can be seen, and anything the photographs cannot show has been left unstated rather than guessed at. Treat the observations as a considered reading of your photographs, not a measurement of your face.")), k.gap(8),
    narrow(k.para("Projected images, scores and visual ages illustrate a realistic direction of change from consistent effort. They are not a promise of outcome. Results vary with genetics, consistency, age and starting point, and features that cannot change without surgery are identified as such throughout.")), k.gap(8),
    narrow(k.para("Product and supplement suggestions are based on your stated budget and the concerns found in your assessment; prices are indicative. We are not responsible for third-party products, and you should always patch-test anything new on a small area of skin first.")),
  ] });
  // 3 index placeholder (filled after page numbers are known)
  add({ id: "index", chapter: "Index", title: "Index" });
  // 4 protocol (hero)
  add({ id: "hero", chapter: `${name}'s Protocol`, title: `${name}'s Protocol` });
  const heroNow = await addPhoto("hero-now", "now", "portrait", (CWD - 14) / 2, 246), heroAfter = approved ? await addPhoto("hero-after", "after", "portrait", (CWD - 14) / 2, 246) : null;

  // 5 hair
  const hairCareGrid = k.grid(f.hair.care.map(c => k.sub(c.title, c.text)), 2);
  add({ id: "hair", chapter: "Hair", title: "Hair", blocks: [k.cols([k.heading("Hair and scalp"), k.para(f.hair.scalp), k.gap(10), k.chips(f.hair.tags)], await stack("hair", "hair", 236, 138), 236), k.gap(10), k.heading("Hair care"), hairCareGrid] });
  // 6 haircut
  add({ id: "haircut", chapter: "Hair", title: "Your Haircut", blocks: [
    k.cols([k.heading("Why this cut"), k.para(f.hair.why)], k.custom(190, (p, x, top, w) => { drawHeadSilhouette(p, x + (w - 100) / 2, top - 6, f.hair.cutLength); wrap(f.hair.cut.toUpperCase(), font, 7.6, w).slice(0, 2).forEach((l, n) => p.drawText(l, { x: x + (w - font.widthOfTextAtSize(l, 7.6)) / 2, y: top - 168 - n * 10, font, size: 7.6, color: C.muted })); }), 150),
    k.heading("What to ask your barber for"), k.para(f.hair.barber), k.heading("How to style it"), k.para(f.hair.styling), k.gap(8), k.box("Hair summary", f.hair.summary),
  ] });
  // 7 hairline
  add({ id: "hairline", chapter: "Hair", title: "Hairline", subtitle: "A description of shape, not a prediction", blocks: [
    k.custom(134, (p, x, top, w) => drawHairlineChart(p, x, top, w, f.hair.hairlineStage, font, bold)), k.gap(8),
    k.heading("Current stage"), k.para(HAIRLINE_NOTE[f.hair.hairlineStage], { f: bold }), k.para(f.hair.hairlineText), k.gap(6),
    k.heading("Protecting your density"), ...f.hair.protect.map(c => k.sub(c.title, c.text)),
  ] });
  // 8 eye area
  add({ id: "eyes", chapter: "Eye Area", title: "Eye Area", blocks: [
    await pair("eyes", "eyes", W2, 118), k.gap(8),
    k.grid([k.col([k.heading("Eye area features"), k.rows(f.eyes.features)]), k.col([k.heading("Assessment"), k.para(f.eyes.assessment)])], 2), k.gap(8),
    k.heading("Under-eye care"), k.grid(f.eyes.care.map(c => k.sub(c.title, c.text)), 2), k.gap(6), k.box("Summary", f.eyes.summary),
  ] });
  // 9 brows
  add({ id: "brows", chapter: "Eye Area", title: "Eyebrows", subtitle: "Your shape today, and the shape to groom toward", blocks: [
    k.custom(96, (p, x, top, w) => drawBrowChart(p, x, top, w, f.eyes.browNow, f.eyes.browTarget, font, bold)), k.gap(8),
    k.heading("What to do"), k.para(f.eyes.browWhat), k.heading("Grooming"), ...f.eyes.browSteps.map(c => k.sub(c.title, c.text)),
  ] });
  // 10 glasses
  add({ id: "glasses", chapter: "Eye Area", title: "Glasses", blocks: [
    k.heading("What suits your face"), k.para(f.eyes.glassesWhy), k.gap(4), k.heading("Frames that work for you"),
    ...f.eyes.frames.map((fr, i) => k.cols([k.numbered(i + 1, fr.style[0].toUpperCase() + fr.style.slice(1), fr.text)], k.custom(54, (p, x, top, w) => { drawGlasses(p, x + (w - 90) / 2, top - 6, fr.style); p.drawText(fr.style.toUpperCase(), { x: x + (w - font.widthOfTextAtSize(fr.style.toUpperCase(), 7.4)) / 2, y: top - 52, font, size: 7.4, color: C.muted }); }), 130)),
    k.gap(6), k.box("Eye area summary", f.eyes.summary),
  ] });
  // 11 jaw
  add({ id: "jaw", chapter: "Jaw", title: "Jaw", blocks: [
    await pair("jaw", "jaw", W2, 146), k.gap(8), k.heading("Structure"), k.para(f.jaw.structure), k.gap(2),
    k.cols([k.heading("Fat and fluid"), k.para(f.jaw.fatFluid)], await illustrated("jaw_fluid", "FLUID RETENTION ZONES", 168), 190),
  ] });
  // 12 defining the jaw
  add({ id: "jaw2", chapter: "Jaw", title: "Defining the Jaw", blocks: [k.heading("Corrective Methods"), ...f.jaw.methods.map((m, i) => k.numbered(i + 1, m.title, m.text)), k.gap(8), k.box("Jaw summary", f.jaw.summary)] });
  // 13 facial hair
  if (f.facialHair) add({ id: "facialhair", chapter: "Facial Hair", title: "Facial Hair", blocks: [
    k.cols([k.heading("Where you are now"), k.para(f.facialHair.now)], await (async () => { const a = await addPhoto("fh-now", "now", "jaw", 170, 108); return k.photo(a, 170, 108, "GROWTH PATTERN"); })(), 170),
    k.heading("Your plan"), k.para(f.facialHair.plan), k.heading("How to keep it"), ...f.facialHair.steps.map(c => k.sub(c.title, c.text)), k.gap(6), k.box("Facial hair summary", f.facialHair.summary),
  ] });
  // 14 skin
  add({ id: "skin", chapter: "Skin", title: "Skin", blocks: [
    k.cols([k.heading("Condition"), k.para(f.skin.condition)], await (async () => { const a = await addPhoto("skin-now", "now", "skin", 170, 170); return k.photo(a, 170, 170, "TEXTURE, MAGNIFIED"); })(), 170),
    ...f.skin.bullets.map(b => k.bullet(b)), k.bullet(f.skin.type), k.gap(6), k.heading("Rules that protect the results"),
    ...["Always patch-test a new product on a small area of skin before using it on your whole face.", "Introduce one new active ingredient at a time, and wait two weeks before adding another.", "Avoid over-exfoliating; reduce the frequency if you feel irritation, redness or dryness.", "Consistency matters more than intensity: regular, gentle use beats sporadic, aggressive use.", "Wear broad-spectrum sunscreen of SPF 30 or higher every morning; it protects every other step."].map(r => k.dash(r)),
    k.gap(8), k.box("Skin summary", f.skin.summary),
  ] });
  // 15 skin concerns
  add({ id: "concerns", chapter: "Skin", title: "Skin Concerns", blocks: f.skin.concerns.flatMap(c => [
    k.custom(24, (p, x, top) => p.drawText(clean(c.title), { x, y: top - 17, font: bold, size: 13, color: C.ink })),
    ...(c.seen ? [k.quote(c.seen)] : []),
    k.para(c.action), k.gap(8), k.custom(6, (p, x, top, w) => p.drawLine({ start: { x, y: top - 2 }, end: { x: x + w, y: top - 2 }, thickness: 0.4, color: C.line })), k.gap(8),
  ]) });
  // 16 clinic options (ours)
  if (f.clinic.length) add({ id: "clinic", chapter: "Clinic Options", title: "Clinic Options", subtitle: "For discussion with a qualified clinician", blocks: [
    ...f.clinic.map((c, i) => k.numbered(i + 1, `${c.area}: ${c.option}`, `${c.why}${c.downtime ? ` Typical downtime: ${c.downtime}.` : ""}`)), k.gap(8),
    k.box("Before any procedure", "A clinician must assess your history, medication, allergies and skin. These are categories to discuss, not a prescription, and doing nothing is always an option. No doses or device settings are given in this report."),
  ] });
  // exercise pages need body content
  if (body) {
    add({ id: "exercise", chapter: "Exercises", title: "Exercises", blocks: [
      k.heading("How training changes how you look"), k.para(body.exercise.intro), k.heading("Weight training"), k.para(body.exercise.weights), k.heading("Cardio"), k.para(body.exercise.cardio),
      ...body.exercise.bullets.map(b => k.dash(b)), k.gap(8), k.box("Expert training guidance", body.exercise.expert),
    ] });
    if (body.training.length) add({ id: "training", chapter: "Exercises", title: "Training Priorities", subtitle: "Ordered by what changes the head-and-shoulders view first", blocks: await Promise.all(body.training.map(async (t, i) => k.cols([k.numbered(i + 1, t.title, t.text)], await illustrated(t.image, t.image === "upper_back" ? "UPPER BACK" : t.image === "shoulders" ? "SHOULDERS" : "NECK", 110), 130))) });
    if (body.facialExercises.length) add({ id: "facialex", chapter: "Exercises", title: "Facial Exercises", subtitle: "Only movements with a real mechanical basis", blocks: [...await Promise.all(body.facialExercises.map(async t => k.cols([k.sub(t.title, t.text)], await illustrated(t.image, t.image === "tongue" ? "TONGUE POSTURE" : t.image === "chin_tuck" ? "CERVICAL SPINE" : "NECK", 100), 120))), k.gap(4), k.box("Exercise summary", body.exercise.summary)] });
    if (hasVideo && video) add({ id: "video", chapter: "Exercises", title: "Your Expression Video", subtitle: "Movement observations, not a diagnosis", blocks: video.blocks.map(bl => k.sub(bl.title, bl.text)) });
    const stats = targets ? [["HEIGHT", `${targets.heightCm} cm`, ""], ["WEIGHT", `${targets.weightKg} kg`, ""], ["BMI", String(targets.bmi), ""], ...(targets.maintenanceKcal ? [["MAINTENANCE", `${targets.maintenanceKcal} kcal`, "Daily energy at your activity level"], ["TARGET INTAKE", `${targets.targetKcal} kcal`, targets.targetKcal! < targets.maintenanceKcal ? "A slight deficit" : "At maintenance"]] : []), ["PROTEIN", `${targets.proteinG} g`, "Per day"], ["WATER", `${targets.waterMl} ml`, "Per day, minimum"]] : [];
    const statGrid: Blk[] = stats.length ? [k.custom(Math.ceil(stats.length / 4) * 64, (p, x, top, w) => { const gw = (w - 24) / 4; stats.forEach(([l, v, sb], i) => { const gx = x + (i % 4) * (gw + 8), gy = top - Math.floor(i / 4) * 64; p.drawSvgPath(k.roundRect(gw, 56, 5), { x: gx, y: gy, color: C.white, borderColor: C.line, borderWidth: 0.8 }); p.drawText(l, { x: gx + 9, y: gy - 14, font, size: 6.4, color: C.muted }); p.drawText(clean(v), { x: gx + 9, y: gy - 31, font: bold, size: 12.5, color: MID }); if (sb) p.drawText(clean(sb).slice(0, 44), { x: gx + 9, y: gy - 46, font, size: 5.6, color: C.muted }); }); }), k.gap(8)] : [];
    add({ id: "nutrition", chapter: "Nutrition & Diet", title: "Nutrition & Diet", blocks: [...statGrid, k.heading("Your approach"), k.para(body.nutrition.approach), k.heading("Dietary goals"), ...body.nutrition.goals.map((g, i) => k.numbered(i + 1, g.title, g.text)), ...(body.supplements.length ? [] : [k.gap(6), k.box("Nutrition summary", body.nutrition.summary)])] });
    if (body.supplements.length) add({ id: "supplements", chapter: "Nutrition & Diet", title: "Supplements", blocks: [
      k.custom(26 + body.supplements.length * 30, (p, x, top, w) => { const c = [0, w * 0.4, w * 0.7], cw2 = [w * 0.38, w * 0.28, w * 0.26], cut = (t: string, i: number) => { let o = clean(t); while (o.length > 3 && font.widthOfTextAtSize(o, 9.6) > cw2[i]) o = o.slice(0, -2); return o === clean(t) ? o : `${o.trimEnd()}...`; }; ["COMPOUND", "DOSE", "WHEN"].forEach((h, i) => p.drawText(h, { x: x + c[i], y: top - 10, font, size: 7.2, color: C.muted })); p.drawLine({ start: { x, y: top - 18 }, end: { x: x + w, y: top - 18 }, thickness: 0.6, color: C.ink }); body.supplements.forEach((sp, j) => { const y = top - 38 - j * 30; [sp.name, sp.dose, sp.when].forEach((t, i) => p.drawText(cut(t, i), { x: x + c[i], y, font, size: 9.6, color: C.ink })); p.drawLine({ start: { x, y: y - 10 }, end: { x: x + w, y: y - 10 }, thickness: 0.4, color: C.line }); }); }),
      k.gap(6), k.heading("Why each one"), ...body.supplements.map(sp => k.sub(sp.name, sp.why)), k.gap(4), k.para("Check with a doctor first if you take medication, are pregnant or have a medical condition. Doses are typical over-the-counter label ranges, not a prescription.", { size: 8.6, color: C.muted }), k.gap(6), k.box("Nutrition summary", body.nutrition.summary),
    ] });
    add({ id: "style", chapter: "Style Profile", title: "Style Profile", blocks: [
      k.cols([k.heading("How clothes should fit you"), k.para(body.style.fit)], await illustrated("mannequin", `${(body.style.bodyType || "Your build").toUpperCase()} PROPORTIONS`, 190), 200),
      k.heading("Colour palette"), k.para(body.style.palette), k.gap(6),
      k.grid([k.box("Casual Wardrobe", `${body.style.casual.title}: ${body.style.casual.text}`, hex("#3e2a5c")), k.box("Professional Attire", `${body.style.professional.title}: ${body.style.professional.text}`, hex("#3e2a5c"))], 2, 14), k.gap(6), k.box("Style summary", body.style.summary),
    ] });
    if (body.toolkit.length) add({ id: "toolkit", chapter: "Toolkit", title: "Toolkit", subtitle: "Everything the rest of this protocol asks for (indicative prices)", blocks: [k.custom(body.toolkit.length * (20 + 2 * 46), (p, x, top, w) => { let y = top; for (const t of body.toolkit) { p.drawRectangle({ x, y: y - 20, width: w, height: 20, color: C.pale }); p.drawText(clean(t.category.toUpperCase()), { x: x + 10, y: y - 14, font: bold, size: 7.6, color: C.ink }); y -= 20; for (const [lab, pr] of [["BUDGET", t.budget], ["PREMIUM", t.premium]] as const) { if (!pr.name) continue; p.drawText(lab, { x: x + 10, y: y - 15, font: bold, size: 6.8, color: MID }); p.drawText(clean(pr.name).slice(0, 62), { x: x + 98, y: y - 15, font: bold, size: 9.4, color: C.ink }); p.drawText(clean([pr.priceInr ? `Rs ${pr.priceInr.toLocaleString("en-IN")}` : "", pr.note].filter(Boolean).join(". ")).slice(0, 96), { x: x + 98, y: y - 29, font, size: 8.6, color: C.muted }); p.drawLine({ start: { x, y: y - 40 }, end: { x: x + w, y: y - 40 }, thickness: 0.4, color: C.line }); y -= 46; } } })] });
  }
  // summary + focus
  add({ id: "summary", chapter: "Summary", title: "Summary", blocks: [
    k.cols([k.heading("Where you are"), k.para(f.whereYouAre)], k.custom(150, (p, x, top, w) => { drawFaceShape(p, x + w / 2, top - 80, f.faceShape); p.drawText(f.faceShape.toUpperCase(), { x: x + (w - font.widthOfTextAtSize(f.faceShape.toUpperCase(), 8)) / 2, y: top - 146, font, size: 8, color: C.muted }); }), 150),
    k.gap(4), k.grid([
      k.col([k.heading("Strengths"), ...f.strengths.map(b => k.sub(b.title, b.text))]),
      k.col([k.heading("Weaknesses"), ...f.weaknesses.map(b => k.sub(b.title, b.text))]),
    ], 2),
  ] });
  add({ id: "focus", chapter: "Summary", title: "What to Focus On", blocks: [k.heading("Your priorities"), ...f.priorities.map((pr, i) => k.numbered(i + 1, pr.title, pr.text)), k.gap(6), k.heading("Your potential"), k.para(f.potential)] });
  add({ id: "closing", chapter: "", title: "", chrome: false, custom: p => {
    p.drawText("MogaFace", { x: 70, y: H - 120, font: bold, size: 28, color: DEEP });
    p.drawLine({ start: { x: 70, y: 470 }, end: { x: 140, y: 470 }, thickness: 1.5, color: MID });
    p.drawText("Thank you for choosing MogaFace.", { x: 70, y: 420, font, size: 30, color: C.ink }); p.drawText("We wish you the very best.", { x: 70, y: 390, font, size: 13, color: C.ink });
    wave(p, 330, hex("#d6cde4"), 2); wave(p, 284, hex("#8f7da9"), 1); hatchedWave(p, 238, hex("#43305f"));
    spaced(p, "MOGAFACE", 70, 58, 7.6, font, SOFT, 2.4);
  } });

  const total = defs.length;
  const chapters: { label: string; first: number }[] = [];
  for (const [i, d] of defs.entries()) if (d.chapter && d.id !== "index" && !chapters.some(c => c.label === d.chapter)) chapters.push({ label: d.chapter, first: i + 1 });

  for (const [i, d] of defs.entries()) {
    const p = doc.addPage([W, H]), no = i + 1;
    if (d.chrome === false) { d.custom?.(p); continue; }
    p.drawText("M", { x: 44, y: H - 46, font: mark, size: 24, color: MID });
    const tsz = 23; p.drawText(clean(d.title), { x: (W - font.widthOfTextAtSize(clean(d.title), tsz)) / 2, y: H - 80, font, size: tsz, color: C.ink });
    let top = H - 118;
    if (d.subtitle) { p.drawText(clean(d.subtitle), { x: (W - font.widthOfTextAtSize(clean(d.subtitle), 9.6)) / 2, y: H - 100, font, size: 9.6, color: C.muted }); top = H - 130; }
    p.drawLine({ start: { x: W / 2 - 28, y: top + (d.subtitle ? 6 : 14) }, end: { x: W / 2 + 28, y: top + (d.subtitle ? 6 : 14) }, thickness: 1.2, color: MID });
    top -= 12;
    p.drawLine({ start: { x: MX, y: 66 }, end: { x: W - MX, y: 66 }, thickness: 0.5, color: C.line });
    p.drawText(clean(`MogaFace Protocol - ${name} - ${d.title}`), { x: MX, y: 46, font, size: 7.8, color: C.muted });
    const pn = `${no} / ${total}`; p.drawText(pn, { x: W - MX - font.widthOfTextAtSize(pn, 8.4), y: 46, font, size: 8.4, color: C.muted });

    if (d.id === "index") {
      let y = top - 10; chapters.forEach((c, n) => { p.drawText(String(n + 1).padStart(2, "0"), { x: MX, y: y - 14, font, size: 9.4, color: MID }); p.drawText(clean(c.label), { x: MX + 54, y: y - 14, font, size: 13, color: C.ink }); const tw = font.widthOfTextAtSize(clean(c.label), 13), numW = font.widthOfTextAtSize(String(c.first), 9.4); p.drawLine({ start: { x: MX + 62 + tw, y: y - 11 }, end: { x: W - MX - numW - 10, y: y - 11 }, thickness: 0.5, color: C.line, dashArray: [1, 2] }); p.drawText(String(c.first), { x: W - MX - numW, y: y - 14, font, size: 9.4, color: C.muted }); p.drawLine({ start: { x: MX, y: y - 30 }, end: { x: W - MX, y: y - 30 }, thickness: 0.4, color: C.line }); y -= 44; });
      continue;
    }
    if (d.id === "hero") {
      const gw = (CWD - 14) / 2, ih = 246, iy = top - 4;
      for (const [x, label, key] of [[MX, "CURRENT LOOK", heroNow], ...(heroAfter ? [[MX + gw + 14, "OPTIMAL LOOK", heroAfter]] : [])] as [number, string, string][]) { p.drawRectangle({ x, y: iy - 26, width: gw, height: 26, color: hex("#1f1530") }); p.drawText(label, { x: x + (gw - bold.widthOfTextAtSize(label, 8.6)) / 2, y: iy - 17, font: bold, size: 8.6, color: C.white }); const im = imgs.get(key)!; p.drawImage(im, { x, y: iy - 26 - ih, width: gw, height: ih }); }
      if (!heroAfter) p.drawText("An illustrative after photo is not included with this report.", { x: MX + gw + 14, y: iy - 140, font, size: 8.6, color: C.muted });
      const cy = iy - 26 - ih - 14, ch = 246, hw = (CWD - 14) / 2;
      for (const x of [MX, MX + hw + 14]) p.drawSvgPath(k.roundRect(hw, ch, 6), { x, y: cy, color: C.white, borderColor: C.line, borderWidth: 0.8 });
      const oc = f.outcomes.slice(0, 5); p.drawText("PROTOCOL OUTCOMES", { x: MX + (hw - bold.widthOfTextAtSize("PROTOCOL OUTCOMES", 7.6)) / 2, y: cy - 18, font: bold, size: 7.6, color: C.ink });
      let ts = 8.8; const ol = (sz: number) => oc.map(o => wrap(o.text, font, sz, hw - 28)); while (ol(ts).reduce((a, l) => a + 14 + l.length * (ts + 2) + 6, 0) > ch - 36 && ts > 6.4) ts -= 0.2;
      let oy = cy - 38; oc.forEach((o, n) => { p.drawText(clean(o.title), { x: MX + 14, y: oy, font: bold, size: 9.6, color: C.ink }); oy -= 13; for (const l of ol(ts)[n]) { p.drawText(l, { x: MX + 14, y: oy, font, size: ts, color: C.ink }); oy -= ts + 2; } oy -= 6; });
      const rx = MX + hw + 14; p.drawText("SCOPE OF IMPROVEMENT", { x: rx + (hw - bold.widthOfTextAtSize("SCOPE OF IMPROVEMENT", 7.6)) / 2, y: cy - 18, font: bold, size: 7.6, color: C.ink });
      const tx = rx + 60, tw2 = hw - 60 - 46; let by = cy - 48;
      for (const sc of f.scope) { const nx = tx + tw2 * sc.now / 100, ax = tx + tw2 * sc.achievable / 100; p.drawText(clean(sc.area), { x: rx + 14, y: by - 3, font, size: 8.6, color: C.ink }); p.drawRectangle({ x: tx, y: by - 3, width: tw2, height: 6, color: C.line }); p.drawRectangle({ x: nx, y: by - 1.5, width: Math.max(0, ax - nx), height: 3, color: MID }); p.drawCircle({ x: nx, y: by, size: 3.8, color: C.white, borderColor: MID, borderWidth: 1 }); p.drawCircle({ x: ax, y: by, size: 3.8, color: MID }); p.drawText(`+${sc.achievable - sc.now}`, { x: tx + tw2 + 10, y: by - 3, font, size: 8.6, color: MID }); by -= 21.5; }
      p.drawCircle({ x: rx + hw / 2 - 40, y: by + 4, size: 3, color: C.white, borderColor: MID, borderWidth: 1 }); p.drawText("Now", { x: rx + hw / 2 - 32, y: by + 1, font, size: 7.4, color: C.muted }); p.drawCircle({ x: rx + hw / 2 + 8, y: by + 4, size: 3, color: MID }); p.drawText("Achievable", { x: rx + hw / 2 + 16, y: by + 1, font, size: 7.4, color: C.muted });
      by -= 16; p.drawLine({ start: { x: rx + 14, y: by }, end: { x: rx + hw - 14, y: by }, thickness: 0.5, color: C.line }); by -= 14;
      p.drawText("HOLDING", { x: rx + 14, y: by, font: bold, size: 7, color: C.muted }); by -= 13; for (const l of wrap(f.holding, font, 8.2, hw - 28).slice(0, Math.max(1, Math.floor((by - (cy - ch) - 12) / 11)))) { p.drawText(l, { x: rx + 14, y: by, font, size: 8.2, color: C.ink }); by -= 11; }
      if (f.apparentAge && f.achievableAge && f.achievableAge < f.apparentAge) {
        const ay = cy - ch - 10, bw = (CWD - 14) / 2;
        p.drawSvgPath(k.roundRect(bw, 58, 6), { x: MX, y: ay, color: C.white, borderColor: C.line, borderWidth: 0.9 }); p.drawText("LOOKS AROUND", { x: MX + (bw - font.widthOfTextAtSize("LOOKS AROUND", 8)) / 2, y: ay - 17, font, size: 8, color: C.muted }); p.drawText(String(f.apparentAge), { x: MX + (bw - bold.widthOfTextAtSize(String(f.apparentAge), 26)) / 2, y: ay - 47, font: bold, size: 26, color: C.ink });
        p.drawSvgPath(k.roundRect(bw, 58, 6), { x: MX + bw + 14, y: ay, color: DEEP }); p.drawText("ACHIEVABLE VISUAL AGE", { x: MX + bw + 14 + (bw - font.widthOfTextAtSize("ACHIEVABLE VISUAL AGE", 8)) / 2, y: ay - 17, font, size: 8, color: SOFT }); p.drawText(String(f.achievableAge), { x: MX + bw + 14 + (bw - bold.widthOfTextAtSize(String(f.achievableAge), 26)) / 2, y: ay - 47, font: bold, size: 26, color: C.white });
        p.drawText("Estimates of what consistent effort can realistically give; not measurements or a promise of results.", { x: MX, y: ay - 70, font, size: 6.8, color: C.muted });
      }
      continue;
    }
    const blocks = d.blocks ?? [], avail = top - BOTTOM;
    let s = 1.12; while (s > 0.72 && blocks.reduce((a, b) => a + b.h(CWD, s) + 6 * s, 0) > avail) s -= 0.03;
    // Content that still overflows at the minimum scale runs into the footer margin rather than failing the whole report.
    let y = top; for (const b of blocks) { b.draw(p, MX, y, CWD, s); y -= b.h(CWD, s) + 6 * s; }
  }
  return doc.save();
}
