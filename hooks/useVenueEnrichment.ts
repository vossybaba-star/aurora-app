/**
 * hooks/useVenueEnrichment.ts
 *
 * Client-side hook for on-demand venue AI enrichment.
 * Wraps /api/enrich-venue with a module-level session cache
 * (same pattern as igCache in discover-page) so repeated
 * card-opens don't trigger redundant API calls.
 */

"use client";

import { useState, useCallback } from "react";

// ─── Exported types ───────────────────────────────────────────────────────────

export interface VenueAiAnalysis {
  wedding_relevance:        number;
  cultural_relevance:       number;
  photographer_opportunity: number;
  has_exclusive_photographer: boolean;
  contact_name:             string | null;
  contact_email:            string | null;
  venue_capacity:           number | null;
  positioning_match:        number;
  key_phrases_for_email:    string[];
  why_good_lead:            string;
  why_bad_lead:             string | null;
  recommended_angle:        string;
  confidence:               "high" | "medium" | "low";
  venue_vibe_tags:          string[];
}

export interface VenueEnrichmentResult {
  status:            "complete" | "cached";
  signal_score:      number;
  score_breakdown:   Record<string, number>;
  ai_analysis:       VenueAiAnalysis;
  instagram_handle?: string | null;
  website_crawled?:  boolean;
  duration_ms?:      number;
}

// ─── Module-level session cache ───────────────────────────────────────────────
// Keyed by google_place_id. Persists across re-renders within the browser
// session — no network roundtrip if the user re-opens the same card.
// (Intentional: same pattern as igCache in discover-page.tsx)

const enrichmentCache = new Map<string, VenueEnrichmentResult>();

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVenueEnrichment() {
  const [enriching, setEnriching] = useState(false);
  const [result, setResult]       = useState<VenueEnrichmentResult | null>(null);
  const [error, setError]         = useState<string | null>(null);

  /**
   * Trigger enrichment for a venue.
   * Safe to call multiple times — returns from cache after the first call.
   */
  const enrichVenue = useCallback(
    async (
      placeId:    string,
      websiteUrl?: string | null,
      placeName?:  string
    ) => {
      // Client-side 48hr cache check (belt-and-braces on top of the server check)
      if (enrichmentCache.has(placeId)) {
        setResult(enrichmentCache.get(placeId)!);
        return;
      }

      setEnriching(true);
      setError(null);
      setResult(null);

      try {
        const res = await fetch("/api/enrich-venue", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            google_place_id: placeId,
            website_url:     websiteUrl ?? undefined,
            place_name:      placeName ?? undefined,
          }),
        });

        if (!res.ok) {
          let msg = "Failed to analyse venue";
          try {
            const err = await res.json();
            msg = err.error || msg;
          } catch { /* ignore parse error */ }
          throw new Error(msg);
        }

        const data: VenueEnrichmentResult = await res.json();
        enrichmentCache.set(placeId, data);
        setResult(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to analyse venue"
        );
      } finally {
        setEnriching(false);
      }
    },
    []
  );

  /** Clear cached result for a specific place (e.g. after saving to pipeline) */
  const clearCache = useCallback((placeId: string) => {
    enrichmentCache.delete(placeId);
  }, []);

  return { enrichVenue, enriching, result, error, clearCache };
}
