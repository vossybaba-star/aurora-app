/**
 * lib/scoring.ts
 *
 * Shared scoring logic used by both enrich-venue (full pipeline) and
 * find-opportunities (lightweight pre-score at discovery time).
 */

export interface AiAnalysis {
  wedding_relevance: number;
  cultural_relevance: number;
  photographer_opportunity: number;
  has_exclusive_photographer: boolean;
  contact_name: string | null;
  contact_email: string | null;
  venue_capacity: number | null;
  positioning_match: number;
  key_phrases_for_email: string[];
  why_good_lead: string;
  why_bad_lead: string | null;
  recommended_angle: string;
  confidence: "high" | "medium" | "low";
  venue_vibe_tags: string[];
}

export function calculateSignalScore(
  ai: AiAnalysis,
  rating: number | null,
  ratingCount: number | null,
  networkContactedCount: number
): { signal_score: number; score_breakdown: Record<string, number> } {
  const ratingScore = (() => {
    if (!rating) return 0;
    if (rating >= 4.5) return 25;
    if (rating >= 4.0) return 18;
    if (rating >= 3.5) return 10;
    return 3;
  })();

  const reviewScore = (() => {
    const rc = ratingCount ?? 0;
    if (rc >= 200) return 10;
    if (rc >= 100) return 7;
    if (rc >= 50)  return 4;
    return 0;
  })();

  const weddingScore      = Math.round((ai.wedding_relevance        / 100) * 25);
  const culturalScore     = Math.round((ai.cultural_relevance       / 100) * 20);
  const photographerScore = Math.round((ai.photographer_opportunity / 100) * 15);
  const positioningScore  = Math.round((ai.positioning_match        / 100) * 10);
  const exclusivePenalty  = ai.has_exclusive_photographer ? -40 : 0;
  const networkScore      = Math.min(networkContactedCount * 2, 10);

  const total = Math.max(
    0,
    Math.min(
      100,
      ratingScore + reviewScore + weddingScore + culturalScore +
      photographerScore + positioningScore + exclusivePenalty + networkScore
    )
  );

  return {
    signal_score: total,
    score_breakdown: {
      rating_score:                   ratingScore,
      review_volume_score:            reviewScore,
      wedding_relevance_score:        weddingScore,
      cultural_relevance_score:       culturalScore,
      photographer_opportunity_score: photographerScore,
      positioning_match_score:        positioningScore,
      exclusive_penalty:              exclusivePenalty,
      network_score:                  networkScore,
      total,
    },
  };
}

export function signalScoreToPriority(score: number): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}
