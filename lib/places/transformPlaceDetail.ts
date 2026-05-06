/**
 * lib/places/transformPlaceDetail.ts
 *
 * Pure transformation layer for Google Places API (New) place detail responses.
 * Reusable across find-opportunities, enrich-contact, and any future pipeline
 * step that receives a raw Places API (New) place object.
 *
 * NOTE — Reviews field:
 *   Google Places API (New) returns a maximum of 5 reviews per place.
 *   This is a hard Google platform limit, not a bug or a missing field.
 *   To use reviews your API key must have "Places API (New)" enabled in
 *   Google Cloud Console AND the "reviews" field included in the FieldMask.
 */

// ─── Exported types ──────────────────────────────────────────────────────────

export interface PlaceReview {
  author: string;    // authorAttribution.displayName
  rating: number;    // 1–5
  text: string;      // review.text.text
  time: string;      // publishTime — ISO 8601 string
  language: string;  // BCP-47 language code, e.g. "en"
}

export interface TransformedPlace {
  // ── Identity ──────────────────────────────────────────────────────────
  placeId: string;
  name: string;
  formattedAddress: string;

  // ── Basics (already handled by existing code — included for round-trip
  //    completeness and so enrich-contact can use the same type) ─────────
  rating: number | null;
  userRatingCount: number | null;
  websiteUri: string | null;
  phone: string | null;         // internationalPhoneNumber
  photoReference: string | null; // first photo resource name

  // ── New deep fields added by the AI engine migration ──────────────────
  priceLevel: number | null;
  // Integer 0–4 converted from PRICE_LEVEL_* enum string:
  //   0 = FREE, 1 = INEXPENSIVE, 2 = MODERATE, 3 = EXPENSIVE, 4 = VERY_EXPENSIVE

  editorialSummary: string | null;
  // Places API "editorialSummary.text" — a short editorial description Google
  // writes for notable places. Not available for all places.

  googleWebsiteUrl: string | null;
  // Explicit alias for websiteUri — kept separate so callers can distinguish
  // "website from Google" vs "website discovered by Firecrawl enrichment".

  fullReviews: PlaceReview[];
  // Up to 5 reviews. Empty array when reviews are unavailable or not returned.
}

// ─── Price level enum → integer mapping ──────────────────────────────────────

export const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE:           0,
  PRICE_LEVEL_INEXPENSIVE:    1,
  PRICE_LEVEL_MODERATE:       2,
  PRICE_LEVEL_EXPENSIVE:      3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// ─── Transform function ───────────────────────────────────────────────────────

/**
 * Transform a raw Places API (New) place object into a typed, normalized shape.
 * Accepts `any` because the Places API response is not typed by any official SDK.
 * All downstream consumers should use `TransformedPlace`.
 */
export function transformPlaceDetail(rawPlace: any): TransformedPlace {
  // Price level: API returns a string enum, we store as integer 0-4
  const priceLevelRaw: string | undefined = rawPlace.priceLevel;
  const priceLevel: number | null =
    priceLevelRaw != null && priceLevelRaw in PRICE_LEVEL_MAP
      ? PRICE_LEVEL_MAP[priceLevelRaw]
      : null;

  // Reviews: max 5 from Google — map to our flat structure
  const fullReviews: PlaceReview[] = (rawPlace.reviews ?? []).map(
    (review: any): PlaceReview => ({
      author:   review.authorAttribution?.displayName ?? 'Anonymous',
      rating:   typeof review.rating === 'number' ? review.rating : 0,
      text:     review.text?.text ?? '',
      time:     review.publishTime ?? '',
      language: review.originalText?.languageCode ?? 'en',
    })
  );

  return {
    placeId:          rawPlace.id ?? '',
    name:             rawPlace.displayName?.text ?? '',
    formattedAddress: rawPlace.formattedAddress ?? '',

    rating:           typeof rawPlace.rating === 'number' ? rawPlace.rating : null,
    userRatingCount:  typeof rawPlace.userRatingCount === 'number' ? rawPlace.userRatingCount : null,
    websiteUri:       rawPlace.websiteUri ?? null,
    phone:            rawPlace.internationalPhoneNumber ?? null,
    photoReference:   rawPlace.photos?.[0]?.name ?? null,

    priceLevel,
    editorialSummary: rawPlace.editorialSummary?.text ?? null,
    googleWebsiteUrl: rawPlace.websiteUri ?? null,
    fullReviews,
  };
}
