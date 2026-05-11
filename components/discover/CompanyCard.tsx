"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Globe,
  Linkedin,
  ExternalLink,
  Loader2,
  UserRound,
  Users,
  Check,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { ApolloCompany, ApolloPerson } from "@/lib/apollo";
import { useCompanyEnrichment } from "@/hooks/useCompanyEnrichment";
import type { CompanyScoreResult } from "@/hooks/useCompanyEnrichment";
import type { ICP, CompanyAnalysis } from "@/lib/types";
import { CompanyLogo } from "./CompanyLogo";

/* ─── Constants ───────────────────────────────────────────────── */
const ACCENT  = "#7c6ef7";
const ACCENT2 = "#9585f9";

/* ─── Helpers ─────────────────────────────────────────────────── */
function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}

function displayName(person: ApolloPerson): string {
  const obfuscated = person.last_name?.includes("*");
  if (obfuscated || !person.last_name) return person.first_name;
  return `${person.first_name} ${person.last_name}`.trim();
}

function scoreBadge(score: number) {
  if (score >= 70) return { label: "Strong lead", bg: "rgba(22,163,74,0.12)",  color: "#16a34a" };
  if (score >= 40) return { label: "Good lead",   bg: "rgba(234,179,8,0.12)",  color: "#ca8a04" };
  return              { label: "Weak lead",        bg: "rgba(107,114,128,0.1)", color: "#6b7280" };
}

/* ─── ContactRow ──────────────────────────────────────────────── */
function ContactRow({
  person, companyName, onConnect, isConnecting, isConnected, isFailed,
}: {
  person:       ApolloPerson;
  companyName:  string;
  onConnect:    (person: ApolloPerson) => void;
  isConnecting: boolean;
  isConnected:  boolean;
  isFailed:     boolean;
}) {
  const fullName = displayName(person);
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 font-bold text-[10px] text-white"
        style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
      >
        {initials(fullName)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: "#131b2e" }}>
          {fullName}
          {person.title && <span className="font-normal text-muted-foreground"> · {person.title}</span>}
        </p>
        {person.city && <p className="text-[10px] text-muted-foreground truncate">{person.city}</p>}
      </div>
      {isConnected ? (
        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg"
              style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
          <Check className="w-3 h-3" /> Added
        </span>
      ) : isFailed ? (
        <button onClick={() => onConnect(person)}
          className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-lg border hover:opacity-80"
          style={{ borderColor: "rgba(239,68,68,0.4)", color: "#ef4444", background: "rgba(239,68,68,0.07)" }}>
          Retry
        </button>
      ) : (
        <button onClick={() => onConnect(person)} disabled={isConnecting}
          className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-lg border hover:bg-primary/5 disabled:opacity-50"
          style={{ borderColor: `${ACCENT}40`, color: ACCENT }}>
          {isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
        </button>
      )}
    </div>
  );
}

function ContactsSkeleton() {
  return (
    <div className="space-y-2.5 animate-pulse">
      {[0, 1, 2].map(i => (
        <div key={i} className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gray-200 shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-2.5 bg-gray-200 rounded w-3/4" />
            <div className="h-2 bg-gray-100 rounded w-1/2" />
          </div>
          <div className="w-10 h-6 bg-gray-200 rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  );
}

function InlineAnalysisPanel({ result, accent }: { result: CompanyScoreResult; accent: string }) {
  const badge = scoreBadge(result.score);
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-bold text-sm" style={{ color: badge.color }}>{result.score}/100</span>
        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
              style={{ background: badge.bg, color: badge.color }}>{result.score_label}</span>
      </div>
      {result.why_good.length > 0 && (
        <ul className="space-y-0.5 text-muted-foreground leading-relaxed">
          {result.why_good.map((point, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span style={{ color: badge.color }} className="mt-0.5 shrink-0">•</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}
      {result.caution && (
        <p className="text-[10px] font-medium px-2 py-1.5 rounded-lg"
           style={{ background: "rgba(234,179,8,0.08)", color: "#b45309", borderLeft: "2px solid #fcd34d" }}>
          {result.caution}
        </p>
      )}
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
   CompanyCard
═══════════════════════════════════════════════════════════════ */
export interface CompanyCardProps {
  company:             ApolloCompany;
  roleId:              string;
  isSaved:             boolean;
  onSaved:             (companyId: string) => void;
  onToast:             (message: string, icon?: "sparkles" | "check") => void;
  userProfession:      string;
  userAbout:           string;
  userSpecialityTags:  string[];
  userLocation:        string;
  icp?:                ICP;
  companyAnalysis?:    CompanyAnalysis;
  /** Opens the full company detail sheet */
  onViewFull?:         (company: ApolloCompany, contacts: ApolloPerson[], suggestedAngle?: string | null) => void;
}

export function CompanyCard({
  company, roleId, isSaved, onSaved, onToast,
  userProfession, userAbout, userSpecialityTags, userLocation,
  icp, companyAnalysis, onViewFull,
}: CompanyCardProps) {

  const [people,        setPeople]        = useState<ApolloPerson[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [peopleFetched, setPeopleFetched] = useState(false);
  const [connectingId,  setConnectingId]  = useState<string | null>(null);
  const [connectedIds,  setConnectedIds]  = useState<Set<string>>(new Set());
  const [failedIds,     setFailedIds]     = useState<Set<string>>(new Set());
  const [saved,         setSaved]         = useState(isSaved);
  const [expanded,      setExpanded]      = useState(false);

  const { enrichCompany, enriching, result } = useCompanyEnrichment();

  // Auto-load ICP-matched contacts on mount
  useEffect(() => {
    if (peopleFetched || loadingPeople) return;
    let cancelled = false;
    const run = async () => {
      setLoadingPeople(true);
      try {
        const res = await fetch("/api/apollo/people", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            company_name: company.name,
            domain:       company.primary_domain ?? undefined,
            role_id:      roleId,
            icp:          icp ?? undefined,
          }),
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setPeople((data.people as ApolloPerson[]).slice(0, 3));
        }
      } catch { /* non-fatal */ }
      finally {
        if (!cancelled) { setLoadingPeople(false); setPeopleFetched(true); }
      }
    };
    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  // Auto-enrich on mount
  useEffect(() => {
    if (!result && !enriching) {
      enrichCompany(
        company.id, company, people,
        userProfession, userAbout, userSpecialityTags, userLocation,
        icp, companyAnalysis,
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  const handleConnect = useCallback(async (person: ApolloPerson) => {
    if (connectingId) return;
    setFailedIds(prev => { const n = new Set(prev); n.delete(person.id); return n; });
    setConnectingId(person.id);
    const payload = {
      name: company.name, type: "brand",
      location: company.city ?? company.country ?? "",
      website: company.website_url ?? undefined,
      source: "apollo", status: "outreach_ready", liked: true,
      contact_name:  displayName(person),
      contact_title: person.title  ?? null,
      contact_email: person.email  ?? null,
      whyGoodFit:    result?.suggested_angle ?? "",
    };
    try {
      const res = await fetch("/api/opportunities", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setConnectedIds(prev => new Set([...prev, person.id]));
        if (!saved) { setSaved(true); onSaved(company.id); }
        onToast(`${person.first_name} added to Outreach`, "check");
      } else {
        setFailedIds(prev => new Set([...prev, person.id]));
      }
    } catch {
      setFailedIds(prev => new Set([...prev, person.id]));
    } finally {
      setConnectingId(null);
    }
  }, [company, saved, onSaved, onToast, connectingId, result]);

  const domain = company.primary_domain
    ?? (company.website_url
      ? (() => { try { return new URL(company.website_url!).hostname.replace(/^www\./, ""); } catch { return null; } })()
      : null);

  const preScore = company.icp_score;
  const hasScore = result?.score != null;

  return (
    <div
      className="glass-card rounded-2xl overflow-hidden flex flex-col transition-all duration-200 cursor-pointer hover:shadow-md"
      style={{
        border:    saved ? "1.5px solid rgba(22,163,74,0.4)" : "1px solid rgba(255,255,255,0.6)",
        boxShadow: saved ? "0 4px 20px rgba(22,163,74,0.08)" : "0 2px 12px rgba(124,110,247,0.06)",
      }}
      onClick={() => onViewFull?.(company, people, result?.suggested_angle)}
    >
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <CompanyLogo name={company.name} domain={domain} logoUrl={company.logo_url} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold leading-tight line-clamp-2" style={{ color: "#131b2e" }}>
                {company.name}
              </p>
              {(hasScore ? result!.score : preScore) != null && (() => {
                const s = hasScore ? result!.score : preScore!;
                const b = scoreBadge(s);
                return (
                  <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                        style={{ background: b.bg, color: b.color }}>
                    {s}/100
                  </span>
                );
              })()}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {company.industry && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: `${ACCENT}12`, color: ACCENT }}>
                  {company.industry}
                </span>
              )}
              {company.decision_maker_reachable && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
                  DM ✓
                </span>
              )}
              {!company.decision_maker_reachable && company.champion_reachable && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(22,163,74,0.08)", color: "#16a34a" }}>
                  Champion ✓
                </span>
              )}
              {company.account_tier === "T1" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(124,110,247,0.1)", color: ACCENT }}>
                  T1
                </span>
              )}
            </div>
          </div>
        </div>

        {(company.city || company.country) && (
          <p className="text-[11px] text-muted-foreground mt-2">
            {[company.city, company.country].filter(Boolean).join(", ")}
          </p>
        )}

        {(result?.suggested_angle || company.recommended_angle) && (
          <div className="mt-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-[10px] font-semibold hover:opacity-70 transition-opacity"
              style={{ color: ACCENT }}
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Suggested angle
            </button>
            {expanded && (
              <div className="mt-1.5 px-2 py-1.5 rounded-lg"
                   style={{ background: `${ACCENT}08`, borderLeft: `2px solid ${ACCENT}30` }}>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {result?.suggested_angle ?? company.recommended_angle}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ICP Contacts (auto-loaded) ── */}
      <div className="px-4 py-3 border-t border-white/40 flex-1" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            <Users className="w-3 h-3" />
            ICP Contacts
          </div>
          {peopleFetched && (
            <button
              onClick={e => { e.stopPropagation(); onViewFull?.(company, people, result?.suggested_angle); }}
              className="flex items-center gap-1 text-[10px] font-semibold hover:opacity-80 transition-opacity"
              style={{ color: ACCENT }}
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {loadingPeople ? (
          <ContactsSkeleton />
        ) : people.length > 0 ? (
          <div className="divide-y divide-white/30">
            {people.map(person => (
              <ContactRow
                key={person.id}
                person={person}
                companyName={company.name}
                onConnect={handleConnect}
                isConnecting={connectingId === person.id}
                isConnected={connectedIds.has(person.id)}
                isFailed={failedIds.has(person.id)}
              />
            ))}
          </div>
        ) : peopleFetched ? (
          <div className="flex items-center gap-2 py-1">
            <UserRound className="w-4 h-4 shrink-0 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">
              No ICP contacts found —{" "}
              {company.linkedin_url ? (
                <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer"
                   className="underline hover:text-primary" onClick={e => e.stopPropagation()}>
                  search on LinkedIn
                </a>
              ) : "try LinkedIn"}
            </p>
          </div>
        ) : null}
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-2.5 border-t border-white/40 flex items-center justify-between"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          {domain && (
            <a href={company.website_url ?? `https://${domain}`} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors">
              <Globe className="w-3.5 h-3.5" />
              <span className="truncate max-w-[120px]">{domain}</span>
            </a>
          )}
          {company.linkedin_url && (
            <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer"
               className="text-muted-foreground hover:text-primary transition-colors">
              <Linkedin className="w-3.5 h-3.5" />
            </a>
          )}
          {company.twitter_url && (
            <a href={company.twitter_url} target="_blank" rel="noopener noreferrer"
               className="text-muted-foreground hover:text-primary transition-colors">
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        {enriching && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>

    </div>
  );
}
