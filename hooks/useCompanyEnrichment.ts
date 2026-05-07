"use client";

import { useState, useCallback } from "react";
import type { ApolloCompany, ApolloPerson } from "@/lib/apollo";

// ─── Exported types ───────────────────────────────────────────────────────────

export interface CompanyScoreResult {
  score:           number;
  score_label:     "Strong lead" | "Good lead" | "Weak lead";
  suggested_angle: string;
  caution:         string | null;
  why_good:        string[];
}

// ─── Module-level session cache ───────────────────────────────────────────────
// Keyed by company id. Same pattern as enrichmentCache in useVenueEnrichment.

const scoreCache = new Map<string, CompanyScoreResult>();

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCompanyEnrichment() {
  const [enriching, setEnriching] = useState(false);
  const [result, setResult]       = useState<CompanyScoreResult | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const enrichCompany = useCallback(
    async (
      companyId:           string,
      company:             ApolloCompany,
      contacts:            ApolloPerson[],
      userProfession:      string,
      userAbout:           string,
      userSpecialityTags:  string[],
      userLocation:        string,
    ) => {
      if (scoreCache.has(companyId)) {
        setResult(scoreCache.get(companyId)!);
        return;
      }

      setEnriching(true);
      setError(null);
      setResult(null);

      try {
        const res = await fetch("/api/apollo/score", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            company,
            contacts,
            user_profession:      userProfession,
            user_about:           userAbout,
            user_speciality_tags: userSpecialityTags,
            user_location:        userLocation,
          }),
        });

        if (!res.ok) {
          let msg = "Failed to score company";
          try { const e = await res.json(); msg = e.error || msg; } catch { /* ignore */ }
          throw new Error(msg);
        }

        const data: CompanyScoreResult = await res.json();
        scoreCache.set(companyId, data);
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to score company");
      } finally {
        setEnriching(false);
      }
    },
    []
  );

  const clearCache = useCallback((companyId: string) => {
    scoreCache.delete(companyId);
  }, []);

  return { enrichCompany, enriching, result, error, clearCache };
}
