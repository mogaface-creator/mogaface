/**
 * Resolves lead contact details and intake selections for PDF report generation
 * and email delivery.
 *
 * Checks Supabase public.leads first (by lead_id or analysis_id), and falls
 * back to the analysis record's embedded contact object if present.
 */

import { isSupabaseConfigured, supabaseRequest } from "../analysis-session/supabaseClient";
import type { AnalysisRecord } from "../analysis-session/types";

export interface ResolvedLead {
  name: string;
  email: string;
  phone: string;
  location: string;
  places: string[];
  dislikes: string[];
}

export async function resolveLeadData(params: {
  leadId?: string | null;
  analysisId?: string | null;
  record?: AnalysisRecord | null;
}): Promise<ResolvedLead> {
  const env = process.env as Record<string, string | undefined>;
  const configured = isSupabaseConfigured(env);

  let name = "";
  let email = "";
  let phone = "";
  let location = "";
  let places: string[] = [];
  let dislikes: string[] = [];

  if (configured) {
    let leadRow: Record<string, unknown> | null = null;

    if (params.leadId) {
      const res = await supabaseRequest(
        env,
        `/leads?id=eq.${encodeURIComponent(params.leadId)}&select=*&limit=1`,
        { method: "GET" },
      ).catch(() => null);

      if (res?.ok) {
        const rows = (await res.json()) as Record<string, unknown>[];
        if (rows[0]) leadRow = rows[0];
      }
    }

    if (!leadRow && params.analysisId) {
      const res = await supabaseRequest(
        env,
        `/leads?analysis_id=eq.${encodeURIComponent(params.analysisId)}&select=*&limit=1`,
        { method: "GET" },
      ).catch(() => null);

      if (res?.ok) {
        const rows = (await res.json()) as Record<string, unknown>[];
        if (rows[0]) leadRow = rows[0];
      }
    }

    if (leadRow) {
      if (typeof leadRow.name === "string") name = leadRow.name.trim();
      if (typeof leadRow.email === "string") email = leadRow.email.trim();
      if (typeof leadRow.phone === "string") phone = leadRow.phone.trim();
      if (typeof leadRow.location === "string") location = leadRow.location.trim();

      if (Array.isArray(leadRow.places)) {
        places = leadRow.places.map((p) => String(p));
      }

      if (Array.isArray(leadRow.dislikes)) {
        dislikes = leadRow.dislikes
          .map((d) => {
            if (typeof d === "string") return d;
            if (d && typeof d === "object" && "words" in d) return String((d as { words: unknown }).words);
            return "";
          })
          .filter(Boolean);
      }
    }
  }

  // Fallback to record.contact if not populated from leads table
  if (!name && params.record?.contact?.name) {
    name = params.record.contact.name.trim();
  }
  if (!email && params.record?.contact?.email) {
    email = params.record.contact.email.trim();
  }
  if (!phone && params.record?.contact?.phone) {
    phone = params.record.contact.phone.trim();
  }
  if (!location && params.record?.contact?.location) {
    location = params.record.contact.location.trim();
  }

  return {
    name: name || "Valued Client",
    email: email || "",
    phone: phone || "",
    location: location || "Clinic Consultation",
    places,
    dislikes,
  };
}
