# ClinicNextFace / MogaFace: System Vision, Goals & Aesthetic Simulation Manifesto

## 1. Executive Summary & Core Mission

**ClinicNextFace** is an aesthetic medicine clinic specializing in non-surgical facial rejuvenation, dermatological health, facial contouring, and hair restoration.

**MogaFace** is the proprietary AI-powered digital consultation engine built for the clinic. Its primary objectives are:
1. **Frictionless Lead Capture**: Prospective patients upload their diagnostic portrait photos (and optional video) from mobile or desktop.
2. **Clinical-Grade Facial Assessment**: Automated anatomical analysis identifying specific concerns (acne, hyperpigmentation, double chin / submental fullness, tear troughs, forehead lines, scalp density).
3. **Medically Plausible "After" Simulation**: Generate a photorealistic visual demonstration of what realistic non-surgical treatments would achieve on *their exact face*.
4. **High-Converting Clinical Dossier**: Compile a bespoke 2-page Clinical Consultation PDF Report delivered to the user to convert digital inquiries into paid clinic appointments.

---

## 2. Fundamental Rules & Clinical Non-Negotiables

### Rule 1: Strict Identity Preservation (Zero Face-Swapping)
* **The patient must remain 100% undeniably themselves.**
* The AI must **NEVER** substitute the patient's face with a generic stock model, Bollywood actor, or altered persona.
* **Locked Anatomy**:
  * **Nose**: Exact same nasal bridge, tip, nostril width, and profile.
  * **Eyes & Brows**: Exact same inter-pupillary distance, eye shape, eyelid fold, and brow arch.
  * **Skeletal Structure**: Exact same skull geometry, cheekbone width, jaw angles, and chin projection.
* The simulation is an **enhancement of their existing features**, NOT a new human.

### Rule 2: Hair Authenticity Lock (No Hallucinated Hair)
* **Bald / Shaved Scalp**: If a patient is bald, balding, or shaved, the simulation **must keep them bald/shaved with a clean, healthy scalp**. Under no circumstances should the system hallucinate a pompadour, wig, or fake hair.
* **Hairline Restoration**: Only when hair restoration is explicitly requested, restore natural density along their *own* original hairline—never changing hair texture, curl pattern, or hairstyle.

### Rule 3: Achievable Non-Surgical Clinical Outcomes Only
The visual changes must strictly reflect what modern aesthetic medicine can achieve:
* **Dermal Clarity (Chemical Peels & Lasers)**: Eliminate acne pustules, papules, red spots, blemishes, and uneven tone.
* **Submental Debulking (Kybella / HIFU / Dermal Fillers)**: Reduce soft-tissue fullness under the chin (double chin) and firm the mandibular border along the patient's *own* jawline.
* **Tear Trough Softening (Hyaluronic Fillers)**: Lessen under-eye hollows, shadowing, and tired dark circles.
* **Neuromodulators (Botox / Dysport)**: Smooth dynamic horizontal forehead lines, glabellar frown lines (11s), and crow's feet.

### Rule 4: Photorealistic Skin Texture (No Plastic Wax Doll)
* Output must look like a **real, high-resolution DSLR photograph**, not a cartoon, CGI render, or heavy Instagram filter.
* Skin must retain **authentic pore texture, fine dermal grain, and natural specular lighting highlights**.
* **Zero Plastic Blur**: Never apply heavy airbrushing or porcelain-doll blurring.

### Rule 5: Complexion & Melanin Integrity (Zero Bleaching)
* The patient's natural skin tone and melanin depth (Indian, brown, tan, olive, deep) must be **strictly preserved**.
* **Never lighten, whiten, or bleach skin tone**.

---

## 3. Root Cause Analysis: Why Earlier Iterations Failed

| Generation Method | Observed Result | Why It Failed |
| :--- | :--- | :--- |
| **`gpt-image-2.5-sunburst`** | Bleached brown skin, washed out facial details, almost zero contouring. | Substandard image model with strong Western bias that tends to over-expose and lighten skin pigments. |
| **`chatgpt-image-latest` (Whole-image prompt)** | Placed a Bollywood pompadour on a bald patient, changed nose and eyes into a generic model. | Whole-image diffusion generates images from pure random noise. Without spatial landmark constraints, the model denoises toward its training dataset average for "attractive male", inherently altering bone structure and hair. |

---

## 4. Architectural Solutions for 100% Identity Lock

To completely eliminate identity drift and ensure surgical accuracy, we have two proven technical architectures:

### Pathway A: Landmark-Guided Inpainting Mask (Recommended)
* Use **MediaPipe Face Mesh** (already built into MogaFace) to create a protective binary mask:
  * **Protected Zone (Untouchable)**: Eyes, nose, mouth/lips, skull shape, and scalp/hair are locked 100% pixel-perfect.
  * **Active Inpainting Zones**: Only the skin blemish areas (for acne/hyperpigmentation clearance) and the lower jawline/chin boundary (for double-chin reduction) are modified.
* **Advantage**: The patient's core features physically *cannot* change because those pixels are directly copied from the original photo.

### Pathway B: Deterministic Anatomical Contouring (Plastic Surgery Software Model)
* Similar to clinical 3D simulation software (Crisalix / Vectra / Mirror):
  * Landmark vectors along the mandibular border and submental fat pocket are mathematically contracted by 10–15% using mesh warping.
  * Algorithmic skin blemish extraction and healing filters are applied directly to the dermal layer.
* **Advantage**: Zero AI hallucination, instantaneous processing, 100% mathematical guarantee of personal identity.

---

## 5. End-to-End User Experience & Flow

```mermaid
flowchart TD
    A["Patient Uploads Portrait (Mobile / Desktop)"] --> B["Client-Side Canvas Auto-Compression (<700KB)"]
    B --> C["GPT-4o Vision Diagnostic Scan"]
    C --> D["Identify Specific Clinical Needs (Acne, Double Chin, Tear Troughs, Scalp Status)"]
    D --> E["Identity-Locked Simulation Engine"]
    E --> F["Photorealistic After-Image (Same Person, Clear Skin, Tight Jawline, Zero Bleaching)"]
    F --> G["2-Page Clinical PDF Dossier Compiled"]
    G --> H["Instant On-Screen Visualizer + PDF Download + Email Delivery"]
```

---

## 6. Project Roadmap & Status

| Phase | Deliverable | Status |
| :--- | :--- | :--- |
| **M1: Test Lab** | `/test-lab` for zero-question direct photo/video testing | **Complete & Live** |
| **M2: Upgraded Model** | Switched from `gpt-image-2.5-sunburst` to `chatgpt-image-latest` | **Complete & Live** |
| **M3: Mobile 413 Fix** | Client-side auto-compression preventing Vercel 4.5MB payload limit | **Complete & Live** |
| **M4: Identity & Hair Lock** | Strict prompt rules for bald scalp and bone structure preservation | **Implemented & Live** |
| **M5: Landmark Masking** | Region-specific inpainting locking T-zone (eyes/nose/mouth) against all drift | **Next Implementation** |
| **M6: Consultation Dossier** | Luxury 2-page branded PDF consultation report | **Complete & Live** |

---

## 7. Confirmed Decisions & Architectural Specifications

Based on clinical alignment, the following three core decisions are finalized:

1. **Simulation Engine: Landmark-Guided Inpainting Masking**
   * **Mechanism**: Use MediaPipe Face Mesh landmarks to generate an immutable protection mask covering:
     * Full T-Zone (Inter-canthal distance, eye contours, pupils, eyebrows)
     * Nasal bridge, tip, and nostrils
     * Mouth shape, vermilion border, and lips
     * Skeletal framework and skull profile
   * **Inpainting Target**: The generative model is constrained strictly to the active mask layer:
     * Dermal blemishes, acne, hyperpigmentation on the cheeks/forehead
     * Submental contouring & mandibular line definition (double-chin reduction)
   * **Result**: Zero facial drift. The patient's core features are physically identical because those pixels originate directly from the source image.

2. **Hair & Scalp Policy: Strict Default Lock**
   * The patient's existing hairline, density, and haircut are strictly preserved by default (bald stays bald; shaved stays shaved).
   * Hairline restoration will only be simulated if the patient explicitly toggles a `"Simulate Hair Restoration"` option.

3. **Primary User Journey: Instant Visualizer Experience**
   * Promote the instant on-screen visualizer (proven in `/test-lab`) as the primary patient experience:
     1. Upload portrait/video with auto-compression.
     2. Instant anatomical scan & treatment calculation.
     3. Direct side-by-side interactive Before/After visualizer on screen.
     4. One-click 2-Page Clinical Consultation Dossier PDF download.

---

## 8. Immediate Implementation Steps

- [ ] **Step 1: MediaPipe Landmark Mask Generator**: Create an API utility to compute and composite the inpainting mask isolating skin blemishes and mandibular edge while locking eyes/nose/mouth.
- [ ] **Step 2: Inpainting Pipeline Integration**: Pipe the masked image to the simulation endpoint using inpainting mode (`image` + `mask` + clinical prompt).
- [ ] **Step 3: Hair Restoration Toggle**: Add a dedicated UI toggle to the consultation interface for optional hair simulation.
- [ ] **Step 4: Homepage Visualizer Upgrade**: Wire the instant Before/After visualizer directly into the primary patient intake flow.

