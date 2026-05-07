"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Globe,
  Linkedin,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  UserRound,
} from "lucide-react";
import type { ApolloCompany, ApolloPerson } from "@/lib/apollo";
import { useCompanyEnrichment } from "@/hooks/useCompanyEnrichment";
import type { CompanyScoreResult } from "@/hooks/useCompanyEnrichment";

/* ─── Constants ───────────────────────────────────────────────── */
const ACCENT  = "#7c6ef7";
const ACCENT2 = "#9585f9";

/* ─── Helpers ─────────────────────────────────────────────────── */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function scoreBadge(score: number) {
  if (score >= 70) return { label: "Strong lead", bg: "rgba(22,163,74,0.12)",  color: "#16a34a" };
  if (score >= 40) return { label: "Good lead",   bg: "rgba(234,179,8,0.12)",  color: "#ca8a04" };
  return              { label: "Weak lead",        bg: "rgba(107,114,128,0.1)", color: "#6b7280" };
}

/* ─── AvatarPill ──────────────────────────────────────────────── */
function AvatarPill({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs";
  return (
    <div
      className={`${sz} rounded-xl flex items-center justify-center shrink-0 font-bold text-white`}
      style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
    >
      {initials(name)}
    </div>
  );
}

/* ─── ContactRow ──────────────────────────────────────────────── */
function ContactRow({
  person,
  companyName,
  onConnect,
  isConnecting,
  isConnected,
}: {
  person:       ApolloPerson;
  companyName:  string;
  onConnect:    (person: ApolloPerson) => void;
  isConnecting: boolean;
  isConnected:  boolean;
}) {
  const fullName = `${person.first_name} ${person.last_name}`.trim();

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      {/* Avatar */}
      <AvatarPill name={fullName} size="sm" />

      {/* Name + title */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: "#131b2e" }}>
          {fullName}
          {person.title && (
            <span className="font-normal text-muted-foreground"> · {person.title}</span>
          )}
        </p>
        {person.city && (
          <p className="text-[10px] text-muted-foreground truncate">{person.city}</p>
        )}
      </div>

      {/* Connect button */}
      {isConnected ? (
        <span className="text-[10px] font-semibold px-2 py-1 rounded-lg"
              style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
          Saved
        </span>
      ) : (
        <button
          onClick={() => onConnect(person)}
          disabled={isConnecting}
          className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all
                     hover:bg-primary/5 disabled:opacity-50"
          style={{ borderColor: `${ACCENT}40`, color: ACCENT }}
        >
          {isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Connect"}
        </button>
      )}
    </div>
  );
}

/* ─── ContactsSkeleton ────────────────────────────────────────── */
function ContactsSkeleton() {
  return (
    <div className="space-y-2.5 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gray-200 shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-2.5 bg-gray-200 rounded w-3/4" />
            <div className="h-2 bg-gray-100 rounded w-1/2" />
          </div>
          <div className="w-14 h-6 bg-gray-200 rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  );
}

/* ─── InlineAnalysisPanel ─────────────────────────────────────── */
function InlineAnalysisPanel({ result, accent }: { result: CompanyScoreResult; accent: string }) {
  const badge = scoreBadge(result.score);

  return (
    <div className="space-y-2 text-xs">
      {/* Score + label */}
      <div className="flex items-center gap-2">
        <span className="font-bold text-sm" style={{ color: badge.color }}>{result.score}/100</span>
        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
              style={{ background: badge.bg, color: badge.color }}>{result.score_label}</span>
      </div>

      {/* Why good — bullet list */}
      {result.why_good.length > 0 && (
        <ul className="space-y-0.5 text-muted-foreground leading-relaxed list-none">
          {result.why_good.map((point, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span style={{ color: badge.color }} className="mt-0.5 shrink-0">•</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Caution */}
      {result.caution && (
        <p className="text-[10px] font-medium px-2 py-1.5 rounded-lg"
           style={{ background: "rgba(234,179,8,0.08)", color: "#b45309", borderLeft: "2px solid #fcd34d" }}>
          {result.caution}
        </p>
      )}

      {/* Suggested angle */}
      {result.suggested_angle && (
        <div className="px-2 py-1.5 rounded-lg"
             style={{ background: "rgba(124,110,247,0.06)", borderLeft: `2px solid ${accent}40` }}>
          <p className="text-[10px] font-semibold mb-0.5" style={{ color: accent }}>Suggested angle</p>
          <p className="text-muted-foreground">{result.suggested_angle}</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CompanyCard — Apollo-sourced lead card for MUA / startup personas
═══════════════════════════════════════════════════════════════ */
export interface CompanyCardProps {
  company:             ApolloCompany;
  persona:             "makeup_artist" | "startup_founder";
  isSaved:             boolean;
  onSaved:             (companyId: string) => void;
  onToast:             (message: string, icon?: "sparkles" | "check") => void;
  userProfession:      string;
  userAbout:           string;
  userSpecialityTags:  string[];
  userLocation:        string;
}

export function CompanyCard({
  company, persona, isSaved, onSaved, onToast,
  userProfession, userAbout, userSpecialityTags, userLocation,
}: CompanyCardProps) {

  /* ── Contacts state ─────────────────────────────────────────── */
  const [people,          setPeople]          = useState<ApolloPerson[]>([]);
  const [loadingPeople,   setLoadingPeople]   = useState(true);
  const [connectingId,    setConnectingId]    = useState<string | null>(null);
  const [connectedIds,    setConnectedIds]    = useState<Set<string>>(new Set());
  const [saved,           setSaved]           = useState(isSaved);

  /* ── Enrichment / expand state ──────────────────────────────── */
  const [isExpanded, setIsExpanded]  = useState(false);
  const { enrichCompany, enriching, result } = useCompanyEnrichment();

  /* ── Load contacts on mount ─────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingPeople(true);
      try {
        const res = await fetch("/api/apollo/people", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            company_name: company.name,
            domain:       company.primary_domain ?? undefined,
            persona,
          }),
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setPeople((data.people as ApolloPerson[]).slice(0, 3));
        }
      } catch { /* non-fatal */ }
      finally  { if (!cancelled) setLoadingPeople(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [company.name, company.primary_domain, persona]);

  /* ── Enrichment on expand ───────────────────────────────────── */
  useEffect(() => {
    if (isExpanded && !result && !enriching) {
      enrichCompany(
        company.id,
        company,
        people,
        userProfession,
        userAbout,
        userSpecialityTags,
        userLocation,
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  /* ── Connect handler ────────────────────────────────────────── */
  const handleConnect = useCallback(async (person: ApolloPerson) => {
    if (connectingId) return;
    setConnectingId(person.id);
    try {
      const res = await fetch("/api/opportunities", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:          company.name,
          type:          persona === "startup_founder" ? "agency" : "brand",
          location:      company.city ?? company.country ?? "",
          website:       company.website_url ?? undefined,
          source:        "apollo",
          status:        "outreach_ready",
          liked:         true,
          contact_name:  `${person.first_name} ${person.last_name}`.trim(),
          contact_title: person.title ?? undefined,
        }),
      });
      if (res.ok) {
        setConnectedIds((prev) => new Set([...prev, person.id]));
        if (!saved) {
          setSaved(true);
          onSaved(company.id);
        }
        onToast(`${person.first_name} added to Outreach`, "check");
      }
    } catch { /* non-fatal */ }
    finally { setConnectingId(null); }
  }, [company, persona, saved, onSaved, onToast, connectingId]);

  /* ── Derived ────────────────────────────────────────────────── */
  const domain   = company.primary_domain ?? (company.website_url ? new URL(company.website_url).hostname.replace(/^www\./, "") : null);
  const hasScore = result?.score != null;

  return (
    <div
      className="glass-card rounded-2xl overflow-hidden flex flex-col transition-all duration-200"
      style={{
        border:     saved ? "1.5px solid rgba(22,163,74,0.4)" : "1px solid rgba(255,255,255,0.6)",
        boxShadow:  saved ? "0 4px 20px rgba(22,163,74,0.08)" : "0 2px 12px rgba(124,110,247,0.06)",
      }}
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <AvatarPill name={company.name} />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold leading-tight line-clamp-2" style={{ color: "#131b2e" }}>
                {company.name}
              </p>
              {/* Score badge — shown once enrichment completes */}
              {hasScore && (() => {
                const b = scoreBadge(result!.score);
                return (
                  <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                        style={{ background: b.bg, color: b.color }}>
                    {result!.score}/100
                  </span>
                );
              })()}
              {/* Saved badge */}
              {saved && !hasScore && (
                <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
                  Saved
                </span>
              )}
            </div>

            {/* Industry tag */}
            {company.industry && (
              <span className="inline-block mt-0.5 text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: `${ACCENT}12`, color: ACCENT }}>
                {company.industry}
              </span>
            )}
          </div>
        </div>

        {/* Location */}
        {(company.city || company.country) && (
          <p className="text-[11px] text-muted-foreground mt-2">
            {[company.city, company.country].filter(Boolean).join(", ")}
          </p>
        )}

        {/* Short description */}
        {company.short_description && (
          <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
            {company.short_description}
          </p>
        )}
      </div>

      {/* ── Contacts section ──────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-white/40 flex-1">
        {loadingPeople ? (
          <ContactsSkeleton />
        ) : people.length > 0 ? (
          <div className="divide-y divide-white/30">
            {people.map((person) => (
              <ContactRow
                key={person.id}
                person={person}
                companyName={company.name}
                onConnect={handleConnect}
                isConnecting={connectingId === person.id}
                isConnected={connectedIds.has(person.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-2">
            <UserRound className="w-4 h-4 shrink-0 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">
              No key contacts found —{" "}
              {company.linkedin_url ? (
                <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer"
                   className="underline hover:text-primary transition-colors">
                  search on LinkedIn
                </a>
              ) : (
                "try searching manually"
              )}
            </p>
          </div>
        )}
      </div>

      {/* ── Footer: links + expand ────────────────────────────── */}
      <div className="px-4 py-2.5 border-t border-white/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {domain && (
            <a href={company.website_url ?? `https://${domain}`}
               target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
               onClick={(e) => e.stopPropagation()}>
              <Globe className="w-3.5 h-3.5" />
              <span className="truncate max-w-[120px]">{domain}</span>
            </a>
          )}
          {company.linkedin_url && (
            <a href={company.linkedin_url}
               target="_blank" rel="noopener noreferrer"
               className="text-muted-foreground hover:text-primary transition-colors"
               onClick={(e) => e.stopPropagation()}>
              <Linkedin className="w-3.5 h-3.5" />
            </a>
          )}
          {company.twitter_url && (
            <a href={company.twitter_url}
               target="_blank" rel="noopener noreferrer"
               className="text-muted-foreground hover:text-primary transition-colors"
               onClick={(e) => e.stopPropagation()}>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Expand toggle — triggers enrichment analysis */}
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
        >
          {enriching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* ── Enrichment panel (on expand) ──────────────────────── */}
      {isExpanded && (
        <div className="px-4 py-3 border-t border-white/40"
             style={{ background: "rgba(124,110,247,0.03)" }}>
          {enriching && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Analysing company…
            </div>
          )}
          {result && !enriching && (
            <InlineAnalysisPanel result={result} accent={ACCENT} />
          )}
        </div>
      )}
    </div>
  );
}
