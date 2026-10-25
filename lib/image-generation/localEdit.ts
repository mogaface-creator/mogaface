/** Source-anchored patch editing: untouched pixels always come from the original. */
import sharp from "sharp";
import { validLocalEditRegion, type LocalEditRegion } from "./localEditRegion.ts";
export async function prepareLocalEdit(source: Buffer, region: LocalEditRegion) {
  if (!validLocalEditRegion(region)) throw new Error("invalid_edit_region");
  const normalized = await sharp(source).rotate().removeAlpha().png().toBuffer();
  const { width, height } = await sharp(normalized).metadata();
  if (!width || !height) throw new Error("invalid_source");
  const rect = { left: Math.round(region.x * width), top: Math.round(region.y * height), width: Math.max(1, Math.floor(region.width * width)), height: Math.max(1, Math.floor(region.height * height)) };
  const side = Math.min(width, height, Math.max(64, Math.ceil(Math.max(rect.width * 1.5, rect.height * 3))));
  if (rect.width > side || rect.height > side) throw new Error("invalid_edit_region");
  const crop = { left: Math.max(0, Math.min(width - side, Math.round(rect.left + rect.width / 2 - side / 2))), top: Math.max(0, Math.min(height - side, Math.round(rect.top + rect.height / 2 - side / 2))), width: side, height: side };
  const image = await sharp(normalized).extract(crop).png().toBuffer();
  const cx = rect.left + rect.width / 2 - crop.left, cy = rect.top + rect.height / 2 - crop.top;
  // OpenAI mask: transparent pixels are editable, opaque pixels remain protected.
  const maskData = Buffer.alloc(side * side * 4, 255);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const distance = ((x - cx) / (rect.width / 2)) ** 2 + ((y - cy) / (rect.height / 2)) ** 2;
    if (distance < 1) maskData[(y * side + x) * 4 + 3] = 0;
  }
  const mask = await sharp(maskData, { raw: { width: side, height: side, channels: 4 } }).png().toBuffer();
  return { normalized, image, mask, crop, rect, width, height };
}
export async function compositeLocalEdit(prepared: Awaited<ReturnType<typeof prepareLocalEdit>>, candidate: Uint8Array): Promise<Buffer> {
  const { data: original } = await sharp(prepared.normalized).toColourspace("srgb").removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const candidatePatch = await sharp(candidate).resize(prepared.crop.width, prepared.crop.height, { fit: "fill" }).toColourspace("srgb").removeAlpha().blur(1.2).raw().toBuffer();
  const sourcePatch = await sharp(prepared.image).toColourspace("srgb").removeAlpha().blur(1.2).raw().toBuffer();
  const result = Buffer.from(original);
  const { rect, crop, width } = prepared;
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  // Transfer a small, bounded low-frequency correction. Keep original fine texture.
  for (let y = rect.top; y < Math.min(prepared.height, rect.top + rect.height); y++) {
    for (let x = rect.left; x < Math.min(width, rect.left + rect.width); x++) {
      const distance = Math.sqrt(((x - cx) / (rect.width / 2)) ** 2 + ((y - cy) / (rect.height / 2)) ** 2);
      if (distance >= 1) continue;
      const alpha = .35 * Math.min(1, (1 - distance) / .35);
      const patchIndex = ((y - crop.top) * crop.width + x - crop.left) * 3;
      const imageIndex = (y * width + x) * 3;
      for (let c = 0; c < 3; c++) {
        const delta = Math.max(-12, Math.min(12, (candidatePatch[patchIndex + c] - sourcePatch[patchIndex + c]) * alpha));
        result[imageIndex + c] = Math.max(0, Math.min(255, Math.round(original[imageIndex + c] + delta)));
      }
    }
  }
  return sharp(result, { raw: { width: prepared.width, height: prepared.height, channels: 3 } }).png().toBuffer();
}
