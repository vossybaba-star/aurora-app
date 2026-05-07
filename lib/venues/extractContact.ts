/**
 * lib/venues/extractContact.ts
 *
 * Regex-first contact extraction from crawled website markdown.
 * Fast, free, and runs before any Claude calls.
 * Used by both Tier 1 (global) and the background skip_ai tile pass.
 */

// ─── Instagram ────────────────────────────────────────────────────────────────

const NON_HANDLES = new Set([
  "p", "reel", "reels", "stories", "explore", "accounts",
  "tv", "ar", "about", "legal", "privacy", "help", "direct",
]);

export function extractInstagramRegex(markdown: string): {
  handle: string | null;
  url: string | null;
} {
  const match = markdown.match(
    /instagram\.com\/([a-zA-Z0-9][a-zA-Z0-9_.]{1,29})(?:[\s/?#"')\]]|$)/
  );
  if (!match) return { handle: null, url: null };

  const raw = match[1].replace(/\.$/, "");
  if (NON_HANDLES.has(raw.toLowerCase())) return { handle: null, url: null };

  return {
    handle: `@${raw}`,
    url:    `https://www.instagram.com/${raw}/`,
  };
}

// ─── Email ────────────────────────────────────────────────────────────────────

const EMAIL_RE = /\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/g;

// Classify email type from the local part
function classifyEmail(email: string): string {
  const local = email.split("@")[0].toLowerCase();
  if (/\b(book|booking|reserv|event|hire|enquir|enquiry)\b/.test(local)) return "booking";
  if (/\b(info|hello|contact|hola|general)\b/.test(local))               return "info";
  if (/\b(wed|wedding|bride|bridal)\b/.test(local))                       return "wedding";
  if (local.match(/^[a-z]+\.[a-z]+$/))                                    return "direct";
  return "other";
}

export function extractEmailRegex(markdown: string): {
  email: string | null;
  type: string | null;
} {
  const matches = [...markdown.matchAll(EMAIL_RE)].map(m => m[1]);
  if (!matches.length) return { email: null, type: null };

  // Priority: booking > direct > info > wedding > other
  const priority = ["booking", "direct", "wedding", "info", "other"];
  let best: { email: string; type: string } | null = null;

  for (const email of matches) {
    const type = classifyEmail(email);
    if (!best || priority.indexOf(type) < priority.indexOf(best.type)) {
      best = { email, type };
    }
  }

  return best ? { email: best.email, type: best.type } : { email: null, type: null };
}

// ─── Contact form ─────────────────────────────────────────────────────────────

const CONTACT_FORM_RE =
  /\[([^\]]*(?:contact|enquir|book|hire|get in touch)[^\]]*)\]\(([^)]+)\)/gi;

export function extractContactFormRegex(markdown: string, baseUrl?: string): {
  url: string | null;
  label: string | null;
} {
  const match = CONTACT_FORM_RE.exec(markdown);
  CONTACT_FORM_RE.lastIndex = 0; // reset stateful regex

  if (!match) return { url: null, label: null };

  let url = match[2];
  if (url.startsWith("/") && baseUrl) {
    try {
      url = new URL(url, baseUrl).href;
    } catch { /* keep as-is */ }
  }

  return { url, label: match[1] };
}

// ─── Combined prompt builder for Claude (gap-fill only) ──────────────────────

export function buildContactExtractionPrompt(
  markdown: string,
  venueName: string,
  missingFields: Array<"instagram" | "email" | "contact_form">
): string {
  const fieldList = missingFields
    .map(f => {
      if (f === "instagram")    return `"instagram_handle": string | null  — @handle format`;
      if (f === "email")        return `"contact_email": string | null, "contact_email_type": "booking" | "info" | "direct" | "wedding" | "other" | null`;
      if (f === "contact_form") return `"contact_form_url": string | null, "has_contact_form": boolean`;
      return "";
    })
    .join(",\n  ");

  return `Extract contact details for "${venueName}" from this website content.
Return ONLY valid JSON with these fields (null if not found):
{
  ${fieldList}
}

Website content:
${markdown.slice(0, 6000)}`;
}
