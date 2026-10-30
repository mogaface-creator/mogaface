/** Public UI choices only. Rendering instructions live in server modules. */
export const EDIT_LEVELS = ["preserve", "subtle", "balanced"] as const;
export type EditLevel = typeof EDIT_LEVELS[number];
export interface AppearanceControls { hair: EditLevel; skin: EditLevel; contour: EditLevel }
export const DEFAULT_APPEARANCE_CONTROLS: AppearanceControls = { hair: "balanced", skin: "balanced", contour: "subtle" };
export function parseAppearanceControls(value: unknown): AppearanceControls {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_appearance_controls");
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !["hair", "skin", "contour"].includes(k)) ||
      !["hair", "skin", "contour"].every(k => EDIT_LEVELS.includes(v[k] as EditLevel))) throw new Error("invalid_appearance_controls");
  return { hair: v.hair as EditLevel, skin: v.skin as EditLevel, contour: v.contour as EditLevel };
}
