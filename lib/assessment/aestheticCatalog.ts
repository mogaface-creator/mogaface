/** Descriptive review catalog; inclusion does not claim automated assessment or clinical validity. */
export interface AssessmentCategory { id:string; name:string; items:readonly string[]; method:string; limits:string }
export const ASSESSMENT_CATEGORIES: readonly AssessmentCategory[] = [
  {
    "id": "general-analysis",
    "name": "General analysis",
    "items": [
      "First impression",
      "Facial masculinity",
      "Facial femininity",
      "Facial averageness",
      "Facial proportions",
      "Facial symmetry",
      "Perceived youthfulness",
      "Face shape"
    ],
    "method": "Whole-face proportions, visible balance and observer impressions.",
    "limits": "Reference-dependent perception is not a beauty score. No age, hormone or health conclusion is established."
  },
  {
    "id": "eyebrows",
    "name": "Eyebrows",
    "items": [
      "Brow shape",
      "Brow thickness",
      "Brow position",
      "Brow color",
      "Brow fullness",
      "Brow symmetry",
      "Brow lift",
      "Brow tilt",
      "Start point",
      "End point",
      "Interbrow distance",
      "Tail length",
      "Tail drop",
      "Hair direction"
    ],
    "method": "Brow outline, coverage, arch, endpoints and position relative to the eyes.",
    "limits": "Expression and grooming change visible position. Individual hair direction needs a sharp close-up."
  },
  {
    "id": "eyes",
    "name": "Eyes",
    "items": [
      "Eye shape",
      "Eye size",
      "Eye width",
      "Eye height",
      "Iris color",
      "Eyes symmetry",
      "Upper eyelid exposure",
      "Upper eyelid fullness",
      "Lower eyelid contour",
      "Under-eye health",
      "Under-eye pigmentation",
      "Under-eye puffiness",
      "Under-eye hollowness",
      "Under-eye vascularity",
      "Under-eye support",
      "Eyelash fullness",
      "Eyelash color",
      "Eye depth",
      "Intercanthal distance",
      "Interpupillary distance",
      "Inner eye corner shape",
      "Outer eye corner shape",
      "Scleral show",
      "Scleral color",
      "Limbal ring visibility",
      "Epicanthic fold"
    ],
    "method": "Eye openings, lid contours, spacing and the lower lid–cheek transition in resting and expressive views.",
    "limits": "Darkness may combine pigment, vessels and shadows. Photographs do not establish eye health or orbital support."
  },
  {
    "id": "nose",
    "name": "Nose",
    "items": [
      "Nose shape",
      "Nose width",
      "Bridge width",
      "Nose symmetry",
      "Nostril shape and balance",
      "Tip definition",
      "Nostril flare",
      "Tip projection",
      "Nose length",
      "Bridge height",
      "Nose bridge shape",
      "Columella alignment",
      "Septum alignment",
      "Tip rotation",
      "Nasofrontal angle",
      "Nasolabial angle",
      "Supratip break"
    ],
    "method": "Front, true profile and underside contours using explicitly defined landmarks.",
    "limits": "Internal septal alignment requires clinical examination. No millimeters without calibration."
  },
  {
    "id": "lips",
    "name": "Lips",
    "items": [
      "Lip shape",
      "Lip fullness",
      "Upper / lower lip ratio",
      "Cupid’s bow definition",
      "Lip width",
      "Lip height",
      "Lip-to-face proportion",
      "Lip projection",
      "Oral commissure tilt",
      "Philtrum shape",
      "Vermilion definition",
      "Smoothness",
      "Lip lines",
      "Gloss and hydration level",
      "Natural lip color",
      "Lip color contrast"
    ],
    "method": "Visible vermilion, borders, resting corners and profile relationships.",
    "limits": "Visible lip height is not three-dimensional volume. Facial hair and expression can obscure boundaries."
  },
  {
    "id": "cheeks",
    "name": "Cheeks",
    "items": [
      "Cheekbone projection",
      "Cheekbone shape",
      "Cheek definition",
      "Cheekbone position",
      "Cheek curve",
      "Cheek height",
      "Cheek peak position",
      "Mid-cheek fullness",
      "Under-cheek hollowing",
      "Cheekbone width",
      "Cheek volume balance",
      "Cheek-to-jaw balance",
      "Cheek-to-eye distance"
    ],
    "method": "Surface contours and fullness across front, oblique and smiling views.",
    "limits": "Photographic highlights do not locate a three-dimensional peak or isolate bone from soft tissue."
  },
  {
    "id": "jaw",
    "name": "Jaw",
    "items": [
      "Jaw shape [frontal]",
      "Jaw shape [side]",
      "Jawline definition",
      "Jaw width",
      "Jawline length",
      "Jaw height",
      "Jawline contrast",
      "Jaw symmetry",
      "Jaw-to-face proportion",
      "Jaw-to-cheek ratio",
      "Jaw flare symmetry"
    ],
    "method": "The external lower-face outline and jaw–neck transition in standardized views.",
    "limits": "Beard, soft tissue, lighting and pose obscure bone. Contour asymmetry does not diagnose a masseter condition."
  },
  {
    "id": "chin",
    "name": "Chin",
    "items": [
      "Chin shape",
      "Chin projection",
      "Chin width",
      "Chin height",
      "Chin contour",
      "Chin fullness",
      "Chin dimple",
      "Chin inclination"
    ],
    "method": "Visible chin outline, lip–chin transition and profile relationships.",
    "limits": "Frontal views cannot establish forward projection. Facial hair may make chin dimensions unassessable."
  },
  {
    "id": "smile",
    "name": "Smile",
    "items": [
      "Smile shape",
      "Tooth show [full smile]",
      "Tooth color",
      "Tooth alignment",
      "Smile symmetry",
      "Mouth corner lift",
      "Tooth show [rest]",
      "Gum visibility",
      "Smile width",
      "Lip line position",
      "Buccal corridors",
      "Duchenne activation",
      "Dynamic wrinkle formation"
    ],
    "method": "Resting and smiling lip, tooth and gum display, ideally supported by video.",
    "limits": "Still images cannot establish movement timing or emotional authenticity; dental shade and bite need appropriate assessment."
  },
  {
    "id": "neck",
    "name": "Neck",
    "items": [
      "Neck shape",
      "Neck definition",
      "Submental fat",
      "Neck firmness",
      "Neck taper",
      "Neck length",
      "Neck width",
      "Neck posture",
      "Skin texture & tone",
      "Muscle definition",
      "Adam’s apple visibility"
    ],
    "method": "External contour and posture in relaxed standardized views.",
    "limits": "Photos cannot measure mechanical firmness, body fat or muscle strength. Clothing often obscures landmarks."
  },
  {
    "id": "ears",
    "name": "Ears",
    "items": [
      "Ear shape",
      "Ear size",
      "Ear projection",
      "Ear angle",
      "Ear placement",
      "Ear height",
      "Ear width",
      "Ear symmetry",
      "Helix shape",
      "Antihelix shape",
      "Earlobe shape",
      "Ear bowl shape"
    ],
    "method": "External rim, lobe, placement and projection where unobscured.",
    "limits": "Perspective, hair and jewelry affect apparent dimensions; depth requires suitable views."
  },
  {
    "id": "skin",
    "name": "Skin",
    "items": [
      "Skin tone",
      "Skin undertone",
      "Skin smoothness",
      "Evenness",
      "Acne",
      "Acne scarring",
      "Hyperpigmentation",
      "Dark spot concentration",
      "Blemishes",
      "Redness",
      "Sun damage",
      "Pore visibility",
      "Pore size",
      "Fine lines",
      "Wrinkles",
      "Skin texture",
      "Roughness",
      "Scarring",
      "Vascular visibility",
      "Oiliness"
    ],
    "method": "Visible surface detail and color variation under consistent illumination.",
    "limits": "No diagnosis, skin-type inference or sun-damage attribution from shine or spots alone. Pores and scar geometry remain distinct."
  }
];
export const ASSESSMENT_CATALOG_COUNT = ASSESSMENT_CATEGORIES.reduce((sum, category)=>sum+category.items.length,0);
