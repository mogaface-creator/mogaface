export type AssessmentItem = { title: string; description: string };

export type AssessmentCategory = { id: string; name: string; summary: string; items: AssessmentItem[] };

const GENERAL_COPY: Record<string, string> = {
  "First impression": "The immediate visual impression created by your features before a person knows you.",
  "Facial masculinity": "The degree of angularity, breadth, and other traditionally masculine visual cues.",
  "Facial femininity": "The degree of softness, delicacy, and other traditionally feminine visual cues.",
  "Facial averageness": "How closely facial traits align with common patterns within a relevant reference group.",
  "Facial proportions": "How facial parts are sized and spaced in relation to one another.",
  "Facial symmetry": "The visible correspondence between the left and right sides of the face.",
  "Perceived youthfulness": "The age impression created by facial structure, skin, and expression—not chronological age.",
  "Face shape": "The overall facial outline, such as oval, round, square, heart, or oblong.",
};

const BROW_COPY: Record<string, string> = {
  "Brow shape": "The overall curve or angle of the brow line.",
  "Brow thickness": "The visible top-to-bottom depth of each brow.",
  "Brow position": "How high or low the brows sit in relation to the eyes and forehead.",
  "Brow color": "The natural visual shade of brow hair in the source image.",
  "Brow fullness": "The apparent density and continuity of brow hair.",
  "Brow symmetry": "How closely the two brows match in height, shape, and fullness.",
  "Brow lift": "The vertical space between the brow and upper eyelid.",
  "Brow tilt": "Whether each brow reads as upward, level, or downward from inner to outer edge.",
  "Brow start point": "Where the brow begins closest to the centre of the face.",
  "Brow end point": "Where the brow tail finishes toward the outer eye area.",
  "Interbrow distance": "The visible space between both brows across the bridge of the nose.",
  "Tail length": "How far the outer brow extends beyond its arch.",
};

function visualReview(title: string, categoryName: string): AssessmentItem {
  const directCopy = GENERAL_COPY[title] ?? BROW_COPY[title];
  if (directCopy) return { title, description: directCopy };
  const lower = title.toLowerCase();
  const feature = categoryName.toLowerCase();
  if (lower.includes("symmetry")) return { title, description: "The visible balance between the left and right sides in the source photos." };
  if (lower.includes("shape") || lower.includes("contour")) return { title, description: `The overall outline and structural character of the ${feature} area.` };
  if (lower.includes("width") || lower.includes("height") || lower.includes("length") || lower.includes("size")) return { title, description: "Its visible scale and spacing in relation to neighbouring facial features." };
  if (lower.includes("color") || lower.includes("tone") || lower.includes("pigmentation")) return { title, description: "The visible colour characteristics and consistency shown in suitable lighting." };
  if (lower.includes("fullness") || lower.includes("volume") || lower.includes("projection")) return { title, description: "The apparent prominence and volume relative to the surrounding area." };
  if (lower.includes("texture") || lower.includes("smooth") || lower.includes("rough")) return { title, description: "The visible surface quality, variation, and detail preserved in the photo." };
  if (lower.includes("angle") || lower.includes("tilt") || lower.includes("rotation")) return { title, description: "The directional relationship visible from the supplied view or profile." };
  return { title, description: `How ${lower} presents as part of the overall ${feature} composition.` };
}

const category = (id: string, name: string, summary: string, titles: string[]): AssessmentCategory => ({
  id, name, summary, items: titles.map((title) => visualReview(title, name)),
});

/** Educational directory only. Counts are derived from rendered entries. */
export const ASSESSMENT_CATALOG: AssessmentCategory[] = [
  category("general", "General analysis", "Your face as a connected whole.", ["First impression", "Facial masculinity", "Facial femininity", "Facial averageness", "Facial proportions", "Facial symmetry", "Perceived youthfulness", "Face shape"]),
  category("jaw", "Jaw & mandible", "Structure, outline, and lower-face balance.", ["Jaw shape", "Jaw width", "Jaw length", "Jaw height", "Jaw angle", "Gonial angle", "Mandibular plane", "Jaw projection", "Jaw definition", "Jaw contour", "Jaw fullness", "Jawline contrast", "Jaw symmetry", "Jaw-to-face proportion", "Jaw-to-cheek ratio", "Jaw flare symmetry", "Ramus height", "Chin-to-jaw transition", "Submental contour", "Jaw-to-neck angle", "Lower-face width", "Lower-face harmony"]),
  category("skin", "Skin & pores", "Surface quality, tone, and visible skin characteristics.", ["Skin tone", "Skin undertone", "Skin smoothness", "Skin evenness", "Visible acne", "Acne scarring", "Hyperpigmentation", "Dark spot concentration", "Blemishes", "Redness", "Visible sun damage", "Pore visibility", "Pore size", "Fine lines", "Wrinkles", "Skin texture", "Surface roughness", "Non-acne scarring", "Vascular visibility", "Oiliness", "Dryness", "Hydration appearance", "Skin clarity", "Texture uniformity", "Forehead texture", "Cheek texture", "T-zone shine", "Under-eye skin texture"]),
  category("eyes", "Eyes & tear troughs", "Eye shape, surrounding structure, and under-eye appearance.", ["Eye shape", "Eye size", "Eye width", "Eye height", "Iris color", "Eye symmetry", "Upper eyelid exposure", "Upper eyelid fullness", "Lower eyelid contour", "Under-eye appearance", "Under-eye pigmentation", "Under-eye puffiness", "Under-eye hollowness", "Under-eye vascularity", "Under-eye support", "Eyelash fullness", "Eye depth", "Intercanthal distance", "Outer eye-corner tilt"]),
  category("cheeks", "Cheeks & midface", "Midface shape, projection, and soft-tissue balance.", ["Cheekbone projection", "Cheekbone shape", "Cheek definition", "Cheekbone position", "Cheek curve", "Midface width", "Midface length", "Midface fullness", "Malar prominence", "Submalar hollowing", "Cheek symmetry", "Cheek-to-jaw ratio", "Cheek-to-eye distance", "Nasolabial fold visibility", "Midface harmony", "Facial contour transition"]),
  category("eyebrows", "Eyebrows", "Brow form, placement, density, and natural direction.", ["Brow shape", "Brow thickness", "Brow position", "Brow color", "Brow fullness", "Brow symmetry", "Brow lift", "Brow tilt", "Brow start point", "Brow end point", "Interbrow distance", "Tail length"]),
  category("nose", "Nose", "Bridge, tip, base, and profile relationships.", ["Nose shape", "Nose width", "Nose length", "Nose projection", "Nasal bridge", "Radix depth", "Dorsal contour", "Tip shape", "Tip definition", "Alar width", "Nostril shape", "Nostril symmetry", "Columella alignment", "Septum alignment", "Tip rotation", "Nasofrontal angle", "Nasolabial angle", "Supratip break"]),
  category("lips", "Lips & philtrum", "Lip structure, expression, and facial proportion.", ["Lip shape", "Lip fullness", "Upper-to-lower lip ratio", "Cupid’s bow definition", "Lip width", "Lip height", "Lip-to-face proportion", "Lip projection", "Oral commissure tilt", "Philtrum shape", "Vermilion definition", "Lip smoothness", "Lip lines", "Natural lip color"]),
  category("chin", "Chin", "Chin form and its relationship to the lower face.", ["Chin shape", "Chin projection", "Chin width", "Chin height", "Chin contour", "Chin fullness", "Chin dimple", "Chin inclination", "Chin symmetry", "Chin-to-lip proportion", "Chin-to-jaw transition"]),
  category("smile", "Smile & dentition", "Smile shape, tooth display, and expression dynamics.", ["Smile shape", "Tooth display at full smile", "Tooth color", "Tooth alignment", "Smile symmetry", "Mouth-corner lift", "Tooth display at rest", "Gum visibility", "Smile width"]),
  category("neck", "Neck & posture", "Neck outline, posture, and jaw-to-neck relationship.", ["Cervicomental angle", "Neck contour", "Platysmal band visibility", "Head posture", "Neck length", "Jaw-to-neck separation", "Neck symmetry", "Shoulder-to-neck proportion"]),
  category("hair", "Hair & hairline", "Hair density and the way the hairline frames the face.", ["Hairline shape", "Hairline height", "Temple recession", "Hair density", "Hair texture", "Hair volume", "Part placement", "Facial-hair density", "Hair-to-face proportion", "Hairline symmetry"]),
];

export const ASSESSMENT_TOTAL = ASSESSMENT_CATALOG.reduce((total, item) => total + item.items.length, 0);
