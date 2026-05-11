"use client";

import { useState, useEffect } from "react";
import {
  Sheet, SheetContent, SheetTitle,
} from "@/components/ui/sheet";
import {
  Globe, Linkedin, ExternalLink, Loader2,
  Users, TrendingUp, Zap, Mail, Copy, Check,
  ArrowRight, UserRound, Target, X,
} from "lucide-react";
import type { ApolloCompany, ApolloPerson } from "@/lib/apollo";
import type { ICP, CompanyAnalysis } from "@/lib/types";
import { CompanyLogo, deriveOrgDomain } from "./CompanyLogo";

const ACCENT  = "#7c6ef7";
const ACCENT2 = "#9585f9";

// ── helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}

function displayName(p: ApolloPerson) {
  const obfuscated = p.last_name?.includes("*");
  if (obfuscated || !p.last_name) return p.first_name;
  return `${p.first_name} ${p.last_name}`.trim();
}

function scoreColor(score: number) {
  return score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#94a3b8";
}

function pill(label: string, accent = false) {
  return (
    <span key={label} className="px-2 py-0.5 rounded-full text-[11px] font-medium border"
      style={accent
        ? { background: `${ACCENT}14`, color: ACCENT, borderColor: `${ACCENT}30` }
        : { background: "rgba(0,0,0,0.04)", color: "#475569", borderColor: "rgba(0,0,0,0.08)" }}>
      {label}
    </span>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CompanyDetailSheetProps {
  company:           ApolloCompany | null;
  /** Initial contacts from the inline card (already fetched) */
  initialContacts?:  ApolloPerson[];
  /** If opened from a contact card — highlight / scroll to this person id */
  initialPersonId?:  string;
  onClose:           () => void;
  icp?:              ICP;
  companyAnalysis?:  CompanyAnalysis;
  roleId?:           string;
  userProfession?:   string;
  userAbout?:        string;
  userSpecialityTags?: string[];
  userLocation?:     string;
}

// ── ContactRow ────────────────────────────────────────────────────────────────

function ContactRow({
  person, selected, onClick, onAdd, isAdding, isAdded, isFailed,
}: {
  person:    ApolloPerson;
  selected:  boolean;
  onClick:   () => void;
  onAdd:     () => void;
  isAdding:  boolean;
  isAdded:   boolean;
  isFailed:  boolean;
}) {
  const name = displayName(person);
  return (
    <div
      className="flex items-center gap-3 py-2.5 px-3 rounded-xl cursor-pointer transition-all"
      style={selected
        ? { background: `${ACCENT}10`, outline: `1.5px solid ${ACCENT}30` }
        : { background: "transparent" }}
      onClick={onClick}
    >
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs text-white"
           style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
        {initials(name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold truncate" style={{ color: "#131b2e" }}>{name}</p>
        {person.title && <p className="text-[11px] text-muted-foreground truncate">{person.title}</p>}
        {person.city  && <p className="text-[10px] text-muted-foreground">{person.city}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
        {person.linkedin_url && (
          <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer"
             className="p-1.5 rounded-lg border border-white/60 bg-white/40 hover:bg-white/70 transition-colors"
             style={{ color: ACCENT }}>
            <Linkedin className="w-3 h-3" />
          </a>
        )}
        {isAdded ? (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg"
                style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
            <Check className="w-3 h-3" /> Added
          </span>
        ) : (
          <button onClick={onAdd} disabled={isAdding}
            className="text-[11px] font-bold px-2.5 py-1 rounded-lg border hover:bg-primary/5 disabled:opacity-50 transition-colors"
            style={{ borderColor: `${ACCENT}40`, color: ACCENT }}>
            {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Email generator ───────────────────────────────────────────────────────────

function EmailPanel({
  person, company, companyDescription, companyIndustry, suggestedAngle,
}: {
  person:             ApolloPerson | null;
  company:            ApolloCompany;
  companyDescription: string | null;
  companyIndustry:    string | null;
  suggestedAngle:     string | null;
}) {
  const [contactRole,  setContactRole]  = useState<"champion" | "decision_maker">("champion");
  const [angle,        setAngle]        = useState(suggestedAngle ?? "");
  const [loading,      setLoading]      = useState(false);
  const [email,        setEmail]        = useState<{ subject: string; body: string } | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [copied,       setCopied]       = useState(false);
  const [showFull,     setShowFull]     = useState(false);

  // Reset when person changes
  useEffect(() => {
    setEmail(null);
    setError(null);
    setCopied(false);
    setShowFull(false);
    setAngle(suggestedAngle ?? "");
  }, [person?.id, suggestedAngle]);

  const generate = async () => {
    if (!person) return;
    setLoading(true); setEmail(null); setError(null);
    try {
      const res = await fetch("/api/contacts/generate-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_first_name: person.first_name,
          recipient_title:      person.title,
          company_name:         company.name,
          company_description:  companyDescription,
          company_industry:     companyIndustry,
          contact_role:         contactRole,
          angle,
        }),
      });
      const data = await res.json();
      if (data.subject && data.body) setEmail(data);
      else setError(data.error ?? "Failed to generate email");
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!email) return;
    await navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  if (!person) {
    return (
      <div className="rounded-2xl border border-white/60 bg-white/30 p-4 text-center">
        <p className="text-[12px] text-muted-foreground">Select a contact above to generate a personalised email.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Role selector */}
      <div className="flex rounded-xl border border-white/60 overflow-hidden bg-white/30">
        {(["champion", "decision_maker"] as const).map(role => (
          <button key={role}
            onClick={() => { setContactRole(role); setEmail(null); }}
            className="flex-1 py-2 text-xs font-semibold transition-all"
            style={contactRole === role
              ? { background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, color: "white" }
              : { color: "var(--muted-foreground)" }}>
            {role === "champion" ? "Champion" : "Decision Maker"}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {contactRole === "champion"
          ? "Day-to-day user — lead with workflow pain and ease of adoption."
          : "Budget holder — lead with ROI, strategic impact, and a clear ask."}
      </p>

      {/* Angle field */}
      <textarea value={angle} onChange={e => setAngle(e.target.value)} rows={2}
        placeholder="e.g. Just raised funding — congrats, timing your outreach here…"
        className="w-full text-[12px] rounded-xl border border-white/60 bg-white/60 px-3 py-2 resize-none focus:outline-none placeholder:text-muted-foreground/50" />

      {/* Generate */}
      <button onClick={generate} disabled={loading}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity"
        style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 4px 12px ${ACCENT}40` }}>
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Writing…</>
          : <><Mail className="w-4 h-4" /> {email ? "Regenerate" : `Email ${person.first_name}`}</>}
      </button>
      {error && <p className="text-[12px] text-red-500 text-center">{error}</p>}

      {/* Email preview */}
      {email && (
        <div className="rounded-2xl border border-white/60 bg-white/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-black/5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Subject</p>
            <p className="text-[12px] font-semibold" style={{ color: "#131b2e" }}>{email.subject}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Body</p>
            <p className="text-[12px] leading-relaxed whitespace-pre-line" style={{ color: "#334155" }}>
              {showFull ? email.body : email.body.split("\n\n").slice(0, 2).join("\n\n") + "…"}
            </p>
            {!showFull && (
              <button onClick={() => setShowFull(true)} className="mt-1 text-[11px] font-semibold" style={{ color: ACCENT }}>
                Show full email
              </button>
            )}
          </div>
          <div className="px-4 py-3 border-t border-black/5 flex gap-2">
            <button onClick={copy}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border border-white/60 bg-white/40 hover:bg-white/70 transition-colors"
              style={{ color: copied ? "#22c55e" : ACCENT }}>
              {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
            {person.linkedin_url && (
              <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer"
                 className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border border-white/60 bg-white/40 hover:bg-white/70 transition-colors"
                 style={{ color: ACCENT }}>
                <ExternalLink className="w-3 h-3" /> LinkedIn
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main sheet ────────────────────────────────────────────────────────────────

export function CompanyDetailSheet({
  company, initialContacts = [], initialPersonId,
  onClose, icp, companyAnalysis, roleId,
  userProfession = "", userAbout = "", userSpecialityTags = [], userLocation = "",
}: CompanyDetailSheetProps) {

  const open = !!company;

  const [contacts,      setContacts]      = useState<ApolloPerson[]>(initialContacts);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [allFetched,    setAllFetched]    = useState(false);
  const [selectedId,    setSelectedId]    = useState<string | null>(initialPersonId ?? null);
  const [addingId,      setAddingId]      = useState<string | null>(null);
  const [addedIds,      setAddedIds]      = useState<Set<string>>(new Set());
  const [failedIds,     setFailedIds]     = useState<Set<string>>(new Set());

  // Sync when company or initial contacts change
  useEffect(() => {
    setContacts(initialContacts);
    setSelectedId(initialPersonId ?? null);
    setAllFetched(false);
    setAddedIds(new Set());
    setFailedIds(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, initialPersonId]);

  // Load full contact list (up to 20) when sheet opens
  useEffect(() => {
    if (!company || allFetched) return;
    let cancelled = false;
    const run = async () => {
      setLoadingMore(true);
      try {
        const res = await fetch("/api/apollo/people", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_name: company.name,
            domain:       company.primary_domain ?? undefined,
            role_id:      roleId,
            icp:          icp ?? undefined,
            per_page:     20,
          }),
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setContacts(data.people as ApolloPerson[]);
        }
      } catch { /* non-fatal */ }
      finally { if (!cancelled) { setLoadingMore(false); setAllFetched(true); } }
    };
    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  const handleAdd = async (person: ApolloPerson) => {
    if (addingId || !company) return;
    setFailedIds(prev => { const n = new Set(prev); n.delete(person.id); return n; });
    setAddingId(person.id);
    try {
      const res = await fetch("/api/opportunities", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: company.name, type: "brand",
          location: company.city ?? company.country ?? "",
          website: company.website_url ?? undefined,
          source: "apollo", status: "outreach_ready", liked: true,
          contact_name:  displayName(person),
          contact_title: person.title ?? null,
          contact_email: person.email ?? null,
        }),
      });
      if (res.ok) setAddedIds(prev => new Set([...prev, person.id]));
      else setFailedIds(prev => new Set([...prev, person.id]));
    } catch {
      setFailedIds(prev => new Set([...prev, person.id]));
    } finally {
      setAddingId(null);
    }
  };

  if (!company) return null;

  const domain = company.primary_domain
    ?? (company.website_url
      ? (() => { try { return new URL(company.website_url!).hostname.replace(/^www\./, ""); } catch { return null; } })()
      : null);

  const score     = company.icp_score;
  const color     = score != null ? scoreColor(score) : ACCENT;
  const tier      = company.account_tier;
  const angle     = company.recommended_angle ?? null;
  const rationale = company.score_rationale ?? null;

  const selectedPerson = contacts.find(c => c.id === selectedId) ?? null;

  // Sort: ICP-matched roles first
  const icpTitles = [...(icp?.champions ?? []), ...(icp?.decision_makers ?? [])].map(t => t.toLowerCase());
  const sorted    = [...contacts].sort((a, b) => {
    const aMatch = icpTitles.some(t => a.title?.toLowerCase().includes(t));
    const bMatch = icpTitles.some(t => b.title?.toLowerCase().includes(t));
    return aMatch === bMatch ? 0 : aMatch ? -1 : 1;
  });

  return (
    <Sheet open={open} onOpenChange={isOpen => { if (!isOpen) onClose(); }}>
      <SheetContent
        side="bottom"
        className="p-0 rounded-t-3xl max-h-[96dvh] flex flex-col"
        style={{ background: "linear-gradient(160deg,#f0eeff 0%,#faf9ff 60%,#fff 100%)" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-8 h-1 rounded-full bg-black/10" />
        </div>

        <SheetTitle className="sr-only">{company.name} — Company Detail</SheetTitle>

        <div className="flex-1 overflow-y-auto px-4 pb-10">

          {/* ── Header ── */}
          <div className="flex items-start gap-4 pt-2 pb-4 border-b border-black/5">
            <CompanyLogo name={company.name} domain={domain} logoUrl={company.logo_url} size="lg" />
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold leading-tight" style={{ color: "#131b2e" }}>{company.name}</h2>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {company.industry && pill(company.industry, true)}
                {company.estimated_num_employees && pill(`${company.estimated_num_employees.toLocaleString()} employees`)}
                {tier && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold border"
                        style={tier === "T1"
                          ? { background: `${ACCENT}14`, color: ACCENT, borderColor: `${ACCENT}30` }
                          : tier === "T2"
                            ? { background: "rgba(245,158,11,0.12)", color: "#f59e0b", borderColor: "rgba(245,158,11,0.3)" }
                            : { background: "rgba(148,163,184,0.12)", color: "#94a3b8", borderColor: "rgba(148,163,184,0.3)" }}>
                    {tier}
                  </span>
                )}
              </div>
              {(company.city || company.country) && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  {[company.city, company.country].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <button onClick={onClose} className="shrink-0 p-1.5 rounded-xl hover:bg-black/5 transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Quick links */}
          <div className="flex gap-2 pt-3">
            {domain && (
              <a href={company.website_url ?? `https://${domain}`} target="_blank" rel="noopener noreferrer"
                 className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border border-white/60 bg-white/50 hover:bg-white/80 transition-colors"
                 style={{ color: ACCENT }}>
                <Globe className="w-3 h-3" /> Website
              </a>
            )}
            {company.linkedin_url && (
              <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer"
                 className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border border-white/60 bg-white/50 hover:bg-white/80 transition-colors"
                 style={{ color: ACCENT }}>
                <Linkedin className="w-3 h-3" /> LinkedIn
              </a>
            )}
          </div>

          {/* ── Company summary ── */}
          {company.short_description && (
            <div className="mt-4">
              <p className="text-[12px] text-muted-foreground leading-relaxed">{company.short_description}</p>
            </div>
          )}

          {/* ── ICP score + rationale ── */}
          {score != null && (
            <div className="mt-4 glass-card rounded-2xl border border-white/60 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold" style={{ color: "#131b2e" }}>ICP Fit</span>
                <span className="font-bold" style={{ color }}>{score}/100</span>
              </div>
              <div className="h-2 rounded-full bg-black/5 overflow-hidden">
                <div className="h-full rounded-full transition-all"
                     style={{ width: `${score}%`, background: `linear-gradient(90deg,${color}99,${color})` }} />
              </div>
              {rationale && <p className="text-[11px] text-muted-foreground">{rationale}</p>}
            </div>
          )}

          {/* ── Outreach angle ── */}
          {angle && (
            <div className="mt-4 glass-card rounded-2xl border border-white/60 p-4"
                 style={{ background: `${ACCENT}06` }}>
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: ACCENT }}>
                  Suggested Angle
                </p>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: "#334155" }}>{angle}</p>
            </div>
          )}

          {/* ── Buying signals ── */}
          {(company.latest_funding_stage || (company.employee_count_6_month_growth ?? 0) > 0 || company.technology_names?.length) && (
            <div className="mt-4 glass-card rounded-2xl border border-white/60 px-4 py-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Buying Signals</p>
              {company.latest_funding_stage?.toLowerCase().match(/seed|series [ab]/) && (
                <div className="flex items-start gap-2 text-[12px]">
                  <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#f59e0b" }} />
                  <span style={{ color: "#475569" }}><strong className="text-foreground">Early-stage funding</strong> — open to new tools as they build out the stack.</span>
                </div>
              )}
              {company.latest_funding_stage?.toLowerCase().match(/series [cd]|growth|late/) && (
                <div className="flex items-start gap-2 text-[12px]">
                  <TrendingUp className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#22c55e" }} />
                  <span style={{ color: "#475569" }}><strong className="text-foreground">Growth-stage</strong> — scaling fast, efficiency is top of mind.</span>
                </div>
              )}
              {(company.employee_count_6_month_growth ?? 0) > 0.08 && (
                <div className="flex items-start gap-2 text-[12px]">
                  <Users className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: ACCENT }} />
                  <span style={{ color: "#475569" }}><strong className="text-foreground">+{Math.round((company.employee_count_6_month_growth ?? 0) * 100)}% headcount growth</strong> — operational capacity under pressure.</span>
                </div>
              )}
              {company.technology_names?.some(t => ["salesforce","hubspot","marketo","pipedrive"].some(e => t.toLowerCase().includes(e))) && (
                <div className="flex items-start gap-2 text-[12px]">
                  <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#818cf8" }} />
                  <span style={{ color: "#475569" }}><strong className="text-foreground">Enterprise tech stack</strong> — already invests in tooling, integration-ready.</span>
                </div>
              )}
            </div>
          )}

          {/* ── Contacts ── */}
          <div className="mt-4 glass-card rounded-2xl border border-white/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/40 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                Contacts {contacts.length > 0 && `(${contacts.length})`}
              </div>
              {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            </div>

            <div className="px-2 py-2">
              {sorted.length === 0 && !loadingMore ? (
                <div className="flex items-center gap-2 px-3 py-3 text-[12px] text-muted-foreground">
                  <UserRound className="w-4 h-4 shrink-0" />
                  No contacts found.{company.linkedin_url && (
                    <> <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer"
                          className="underline hover:text-primary">Search LinkedIn</a>.</>
                  )}
                </div>
              ) : (
                sorted.map(person => (
                  <ContactRow
                    key={person.id}
                    person={person}
                    selected={selectedId === person.id}
                    onClick={() => setSelectedId(person.id === selectedId ? null : person.id)}
                    onAdd={() => handleAdd(person)}
                    isAdding={addingId === person.id}
                    isAdded={addedIds.has(person.id)}
                    isFailed={failedIds.has(person.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Outreach / Email ── */}
          <div className="mt-4 glass-card rounded-2xl border border-white/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: ACCENT }}>
                {selectedPerson ? `Email ${selectedPerson.first_name}` : "AI Outreach Email"}
              </p>
            </div>
            <EmailPanel
              person={selectedPerson}
              company={company}
              companyDescription={company.short_description ?? null}
              companyIndustry={company.industry ?? null}
              suggestedAngle={angle}
            />
          </div>

          {/* ── Sequence teaser ── */}
          <div className="mt-4 rounded-2xl border px-4 py-3 flex items-start gap-3 mb-4"
               style={{ background: `${ACCENT}08`, borderColor: `${ACCENT}20` }}>
            <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
                 style={{ background: `${ACCENT}18` }}>
              <ArrowRight className="w-3.5 h-3.5" style={{ color: ACCENT }} />
            </div>
            <div>
              <p className="text-[12px] font-semibold" style={{ color: "#131b2e" }}>8-touch sequence</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Multi-channel cadence — email + LinkedIn over 30 days. Coming soon.
              </p>
            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}
