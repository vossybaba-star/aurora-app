"use client";

import { useState, useEffect } from "react";
import {
  Sheet, SheetContent, SheetTitle,
} from "@/components/ui/sheet";
import {
  Globe, Linkedin, Loader2,
  Users, Mail, Copy, Check, UserRound, X, Sparkles,
  ExternalLink,
} from "lucide-react";
import type { ApolloCompany, ApolloPerson } from "@/lib/apollo";
import type { ICP, CompanyAnalysis } from "@/lib/types";
import { CompanyLogo } from "./CompanyLogo";

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

function findIcpItems(
  map: Record<string, string[]> | undefined,
  contactTitle: string | null,
): string[] {
  if (!map || !contactTitle) return [];
  const lower = contactTitle.toLowerCase();
  for (const [key, vals] of Object.entries(map)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return vals;
  }
  return Object.values(map)[0] ?? [];
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CompanyDetailSheetProps {
  company:             ApolloCompany | null;
  initialContacts?:    ApolloPerson[];
  initialPersonId?:    string;
  suggestedAngle?:     string | null;
  onClose:             () => void;
  icp?:                ICP;
  companyAnalysis?:    CompanyAnalysis;
  roleId?:             string;
  userProfession?:     string;
  userAbout?:          string;
  userSpecialityTags?: string[];
  userLocation?:       string;
}

// ── ContactRow ────────────────────────────────────────────────────────────────

function ContactRow({
  person, selected, onClick, onAdd, isAdding, isAdded, isFailed,
}: {
  person:   ApolloPerson;
  selected: boolean;
  onClick:  () => void;
  onAdd:    () => void;
  isAdding: boolean;
  isAdded:  boolean;
  isFailed: boolean;
}) {
  const name = displayName(person);
  return (
    <div
      className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl cursor-pointer transition-all"
      style={selected
        ? { background: `${ACCENT}10`, outline: `1.5px solid ${ACCENT}30` }
        : { background: "transparent" }}
      onClick={onClick}
    >
      <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 font-bold text-[10px] text-white"
           style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
        {initials(name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold truncate" style={{ color: "#131b2e" }}>{name}</p>
        {person.title && <p className="text-[10px] text-muted-foreground truncate">{person.title}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
        {isAdded ? (
          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
            <Check className="w-2.5 h-2.5" /> Added
          </span>
        ) : isFailed ? (
          <button onClick={onAdd}
            className="text-[10px] font-bold px-2 py-0.5 rounded-lg border"
            style={{ borderColor: "rgba(239,68,68,0.4)", color: "#ef4444", background: "rgba(239,68,68,0.07)" }}>
            Retry
          </button>
        ) : (
          <button onClick={onAdd} disabled={isAdding}
            className="text-[10px] font-bold px-2 py-0.5 rounded-lg border hover:bg-primary/5 disabled:opacity-50 transition-colors"
            style={{ borderColor: `${ACCENT}40`, color: ACCENT }}>
            {isAdding ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : "Add"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── EmailPanel (one-time email, no role selector) ─────────────────────────────

function EmailPanel({
  person, company, companyDescription, companyIndustry, suggestedAngle, personaType,
}: {
  person:             ApolloPerson;
  company:            ApolloCompany;
  companyDescription: string | null;
  companyIndustry:    string | null;
  suggestedAngle:     string | null;
  personaType:        "champion" | "decision_maker";
}) {
  const [angle,    setAngle]    = useState(suggestedAngle ?? "");
  const [loading,  setLoading]  = useState(false);
  const [email,    setEmail]    = useState<{ subject: string; body: string } | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [copied,   setCopied]   = useState(false);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    setEmail(null); setError(null); setCopied(false); setShowFull(false);
    setAngle(suggestedAngle ?? "");
  }, [person.id, suggestedAngle]);

  const generate = async () => {
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
          contact_role:         personaType,
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

  return (
    <div className="space-y-2.5">
      <textarea value={angle} onChange={e => setAngle(e.target.value)} rows={2}
        placeholder="e.g. Just raised funding — timing your outreach here…"
        className="w-full text-[11px] rounded-xl border border-white/60 bg-white/60 px-2.5 py-2 resize-none focus:outline-none placeholder:text-muted-foreground/50" />

      <button onClick={generate} disabled={loading}
        className="w-full py-2 rounded-xl text-[11px] font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-60 transition-opacity"
        style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 4px 12px ${ACCENT}40` }}>
        {loading
          ? <><Loader2 className="w-3 h-3 animate-spin" /> Writing…</>
          : <><Mail className="w-3 h-3" /> {email ? "Regenerate" : `Email ${person.first_name}`}</>}
      </button>

      {error && <p className="text-[11px] text-red-500 text-center">{error}</p>}

      {email && (
        <div className="rounded-2xl border border-white/60 bg-white/60 overflow-hidden">
          <div className="px-3 py-2 border-b border-black/5">
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground mb-0.5">Subject</p>
            <p className="text-[11px] font-semibold" style={{ color: "#131b2e" }}>{email.subject}</p>
          </div>
          <div className="px-3 py-2">
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1">Body</p>
            <p className="text-[11px] leading-relaxed whitespace-pre-line" style={{ color: "#334155" }}>
              {showFull ? email.body : email.body.split("\n\n").slice(0, 2).join("\n\n") + "…"}
            </p>
            {!showFull && (
              <button onClick={() => setShowFull(true)} className="mt-1 text-[10px] font-semibold" style={{ color: ACCENT }}>
                Show full
              </button>
            )}
          </div>
          <div className="px-3 py-2 border-t border-black/5 flex gap-2">
            <button onClick={copy}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[10px] font-semibold border border-white/60 bg-white/40 hover:bg-white/70 transition-colors"
              style={{ color: copied ? "#22c55e" : ACCENT }}>
              {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
            {person.linkedin_url && (
              <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer"
                 className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[10px] font-semibold border border-white/60 bg-white/40 hover:bg-white/70 transition-colors"
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

// ── SequencePanel ─────────────────────────────────────────────────────────────

const SEQUENCE_STEPS = [
  { step: 1, day: 1,  label: "Trigger hook"   },
  { step: 2, day: 3,  label: "Value add"      },
  { step: 3, day: 6,  label: "Social proof"   },
  { step: 4, day: 9,  label: "New angle"      },
  { step: 5, day: 12, label: "Question-led"   },
  { step: 6, day: 16, label: "Resource share" },
  { step: 7, day: 21, label: "Referral ask"   },
  { step: 8, day: 27, label: "Graceful exit"  },
];

const CHAMPION_DESCS = [
  "Lead with the research signal — recent news or trigger showing you did your homework.",
  "Connect your offering to a day-to-day workflow pain they'd feel.",
  "Name a peer company or role that got a result they'd want.",
  "Tackle a different pain — don't repeat step 2.",
  "Ask an open question that invites a reply.",
  "Share content that earns trust without a hard ask.",
  "Ask if there's someone better placed to chat.",
  "Low-pressure close — leave the door open.",
];

const DM_DESCS = [
  "Lead with the business signal — funding, growth, or strategic shift that creates timing.",
  "Frame your ROI in terms of revenue impact or cost reduction.",
  "Reference a comparable company outcome at the strategic level.",
  "Raise a risk or missed opportunity they're accountable for.",
  "Ask a direct question about their priority this quarter.",
  "Share a benchmark or data point relevant to their board metrics.",
  "Offer an intro to someone relevant to their goals.",
  "Final outreach — make it easy to either engage or pass.",
];

interface GeneratedStep {
  step:     number;
  day:      number;
  label:    string;
  preview:  string;
}

function SequencePanel({
  person, company, suggestedAngle,
}: {
  person:         ApolloPerson | null;
  company:        ApolloCompany;
  suggestedAngle: string | null;
}) {
  const [persona,    setPersona]    = useState<"champion" | "decision_maker">("champion");
  const [generating, setGenerating] = useState(false);
  const [steps,      setSteps]      = useState<GeneratedStep[] | null>(null);
  const [genError,   setGenError]   = useState<string | null>(null);

  // Reset generated steps when person or persona changes
  useEffect(() => { setSteps(null); setGenError(null); }, [person?.id, persona]);

  const staticDescs = persona === "champion" ? CHAMPION_DESCS : DM_DESCS;

  const generateSequence = async () => {
    if (!person) return;
    setGenerating(true); setSteps(null); setGenError(null);
    try {
      const res = await fetch("/api/contacts/generate-sequence", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name:         company.name,
          company_description:  company.short_description ?? null,
          company_industry:     company.industry ?? null,
          recipient_first_name: person.first_name,
          recipient_title:      person.title ?? null,
          angle:                suggestedAngle ?? "",
          persona_type:         persona,
        }),
      });
      const data = await res.json();
      if (data.steps) setSteps(data.steps);
      else setGenError(data.error ?? "Failed to generate sequence");
    } catch {
      setGenError("Something went wrong.");
    } finally {
      setGenerating(false);
    }
  };

  const displaySteps = steps
    ? SEQUENCE_STEPS.map((s, i) => ({ ...s, preview: steps[i]?.preview ?? staticDescs[i] }))
    : SEQUENCE_STEPS.map((s, i) => ({ ...s, preview: s.step === 1 && suggestedAngle ? suggestedAngle : staticDescs[i] }));

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3 space-y-3">
        {/* Persona toggle + generate button */}
        <div className="flex rounded-xl border border-white/60 overflow-hidden bg-white/30">
          {(["champion", "decision_maker"] as const).map(role => (
            <button key={role} onClick={() => setPersona(role)}
              className="flex-1 py-1.5 text-[10px] font-semibold transition-all"
              style={persona === role
                ? { background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, color: "white" }
                : { color: "var(--muted-foreground)" }}>
              {role === "champion" ? "Champion" : "DM"}
            </button>
          ))}
        </div>

        <button
          onClick={generateSequence}
          disabled={!person || generating}
          className="w-full py-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 border transition-all disabled:opacity-50"
          style={steps
            ? { borderColor: `${ACCENT}40`, color: ACCENT, background: `${ACCENT}08` }
            : { borderColor: `${ACCENT}40`, color: ACCENT, background: "white" }}
        >
          {generating
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
            : <><Sparkles className="w-3 h-3" /> {steps ? "Regenerate AI sequence" : "Generate AI sequence"}</>}
        </button>

        {genError && <p className="text-[10px] text-red-500 text-center">{genError}</p>}

        {/* Step timeline */}
        <div>
          {displaySteps.map((s, i) => (
            <div key={s.step} className="flex gap-2.5 items-start">
              <div className="shrink-0 flex flex-col items-center pt-0.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                  style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
                >
                  {s.step}
                </div>
                {i < displaySteps.length - 1 && (
                  <div className="w-px flex-1 min-h-[20px] bg-black/10 my-0.5" />
                )}
              </div>
              <div className="flex-1 pb-3">
                <div className="flex items-baseline justify-between gap-1 mb-0.5">
                  <p className="text-[11px] font-semibold" style={{ color: "#131b2e" }}>{s.label}</p>
                  <span className="text-[9px] text-muted-foreground shrink-0">Day {s.day}</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{s.preview}</p>
              </div>
            </div>
          ))}
        </div>

        {person && (
          <button
            className="w-full py-2.5 rounded-xl text-[11px] font-semibold text-white flex items-center justify-center gap-1.5"
            style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 4px 12px ${ACCENT}40` }}
          >
            <Mail className="w-3.5 h-3.5" /> Add {person.first_name} to sequence
          </button>
        )}

        {!person && (
          <p className="text-[10px] text-muted-foreground text-center py-1">
            Select a contact to generate sequence
          </p>
        )}
      </div>
    </div>
  );
}

// ── ContactResearchPanel ──────────────────────────────────────────────────────

function ContactResearchPanel({
  person, company, icp, suggestedAngle,
}: {
  person:         ApolloPerson | null;
  company:        ApolloCompany;
  icp?:           ICP;
  suggestedAngle: string | null;
}) {
  if (!person) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center gap-2">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
             style={{ background: `${ACCENT}12` }}>
          <UserRound className="w-5 h-5" style={{ color: ACCENT }} />
        </div>
        <p className="text-[12px] font-semibold" style={{ color: "#131b2e" }}>Select a contact</p>
        <p className="text-[11px] text-muted-foreground">Research and outreach appear here</p>
      </div>
    );
  }

  const name       = displayName(person);
  const isChampion = icp?.champions?.some(t => person.title?.toLowerCase().includes(t.toLowerCase()));
  const isDM       = icp?.decision_makers?.some(t => person.title?.toLowerCase().includes(t.toLowerCase()));
  const role       = isDM ? "Decision Maker" : isChampion ? "Champion" : null;
  const roleColor  = isDM ? ACCENT : "#16a34a";
  const personaType: "champion" | "decision_maker" = isDM ? "decision_maker" : "champion";

  const painPoints = findIcpItems(icp?.pain_points as Record<string, string[]> | undefined, person.title);
  const goals      = findIcpItems(icp?.goals      as Record<string, string[]> | undefined, person.title);
  const objections = findIcpItems(icp?.objections  as Record<string, string[]> | undefined, person.title);

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3 space-y-3">

        {/* Person header */}
        <div className="flex items-start gap-2.5 p-2.5 rounded-xl border border-white/60 bg-white/40">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm text-white"
               style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
            {initials(name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[13px] font-bold" style={{ color: "#131b2e" }}>{name}</p>
              {role && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{ background: `${roleColor}14`, color: roleColor }}>
                  {role}
                </span>
              )}
            </div>
            {person.title && <p className="text-[11px] text-muted-foreground">{person.title}</p>}
            {person.city  && <p className="text-[10px] text-muted-foreground">{person.city}</p>}
            {person.linkedin_url && (
              <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1 text-[10px] mt-1 hover:opacity-80 transition-opacity"
                 style={{ color: ACCENT }}>
                LinkedIn →
              </a>
            )}
          </div>
        </div>

        {/* ICP fit */}
        {company.icp_score != null && (
          <div className="p-2.5 rounded-xl border border-white/60 bg-white/30 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold" style={{ color: "#131b2e" }}>ICP Fit</span>
              <span className="font-bold" style={{ color: scoreColor(company.icp_score) }}>{company.icp_score}/100</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
              <div className="h-full rounded-full transition-all"
                   style={{ width: `${company.icp_score}%`, background: `linear-gradient(90deg,${scoreColor(company.icp_score)}99,${scoreColor(company.icp_score)})` }} />
            </div>
            {company.score_rationale && (
              <p className="text-[10px] text-muted-foreground">{company.score_rationale}</p>
            )}
          </div>
        )}

        {/* Prospect research */}
        {(painPoints.length > 0 || goals.length > 0 || objections.length > 0) && (
          <div className="p-2.5 rounded-xl border border-white/60 bg-white/30 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Prospect research</p>

            {painPoints.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold mb-1" style={{ color: "#131b2e" }}>Pain points</p>
                <ul className="space-y-0.5">
                  {painPoints.slice(0, 4).map((pt, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                      <span className="mt-0.5 shrink-0" style={{ color: ACCENT }}>•</span>
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {goals.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold mb-1" style={{ color: "#131b2e" }}>Goals</p>
                <ul className="space-y-0.5">
                  {goals.slice(0, 3).map((g, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                      <span className="mt-0.5 shrink-0" style={{ color: "#16a34a" }}>•</span>
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {objections.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold mb-1" style={{ color: "#131b2e" }}>Likely objections</p>
                <ul className="space-y-0.5">
                  {objections.slice(0, 2).map((o, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                      <span className="mt-0.5 shrink-0" style={{ color: "#f59e0b" }}>•</span>
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* One-time email */}
        <div className="p-2.5 rounded-xl border border-white/60 bg-white/30">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Mail className="w-3 h-3 shrink-0" style={{ color: ACCENT }} />
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: ACCENT }}>
              Email {person.first_name}
            </p>
          </div>
          <EmailPanel
            person={person}
            company={company}
            companyDescription={company.short_description ?? null}
            companyIndustry={company.industry ?? null}
            suggestedAngle={suggestedAngle}
            personaType={personaType}
          />
        </div>

      </div>
    </div>
  );
}

// ── Main sheet ────────────────────────────────────────────────────────────────

export function CompanyDetailSheet({
  company, initialContacts = [], initialPersonId, suggestedAngle: propAngle,
  onClose, icp, companyAnalysis, roleId,
  userProfession = "", userAbout = "", userSpecialityTags = [], userLocation = "",
}: CompanyDetailSheetProps) {

  const open = !!company;

  const [contacts,    setContacts]    = useState<ApolloPerson[]>(initialContacts);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allFetched,  setAllFetched]  = useState(false);
  const [selectedId,  setSelectedId]  = useState<string | null>(initialPersonId ?? null);
  const [addingId,    setAddingId]    = useState<string | null>(null);
  const [addedIds,    setAddedIds]    = useState<Set<string>>(new Set());
  const [failedIds,   setFailedIds]   = useState<Set<string>>(new Set());
  const [activeTab,   setActiveTab]   = useState<"contacts" | "research" | "sequence">("contacts");

  useEffect(() => {
    setContacts(initialContacts);
    setSelectedId(initialPersonId ?? null);
    setAllFetched(false);
    setAddedIds(new Set());
    setFailedIds(new Set());
    setActiveTab("contacts");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, initialPersonId]);

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
          contact_title: person.title  ?? null,
          contact_email: person.email  ?? null,
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

  const tier  = company.account_tier;
  // Use DB angle first, fall back to enrichment result passed from CompanyCard
  const angle = company.recommended_angle ?? propAngle ?? null;

  const icpTitles = [...(icp?.champions ?? []), ...(icp?.decision_makers ?? [])].map(t => t.toLowerCase());
  const sorted    = [...contacts].sort((a, b) => {
    const aMatch = icpTitles.some(t => a.title?.toLowerCase().includes(t));
    const bMatch = icpTitles.some(t => b.title?.toLowerCase().includes(t));
    return aMatch === bMatch ? 0 : aMatch ? -1 : 1;
  });

  const selectedPerson = contacts.find(c => c.id === selectedId) ?? null;

  const TABS = [
    { key: "contacts" as const, label: `Contacts${contacts.length > 0 ? ` (${contacts.length})` : ""}` },
    { key: "research" as const, label: selectedPerson ? selectedPerson.first_name : "Research" },
    { key: "sequence" as const, label: "Sequence" },
  ];

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

        {/* ── Company header ── */}
        <div className="px-4 pt-1 pb-3 border-b border-black/5 shrink-0">
          <div className="flex items-start gap-3 mb-2">
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
                {company.decision_maker_reachable && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium border"
                        style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a", borderColor: "rgba(22,163,74,0.25)" }}>
                    DM ✓
                  </span>
                )}
                {!company.decision_maker_reachable && company.champion_reachable && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium border"
                        style={{ background: "rgba(22,163,74,0.08)", color: "#16a34a", borderColor: "rgba(22,163,74,0.2)" }}>
                    Champion ✓
                  </span>
                )}
              </div>
              {(company.city || company.country) && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {[company.city, company.country].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <button onClick={onClose} className="shrink-0 p-1.5 rounded-xl hover:bg-black/5 transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Links */}
          <div className="flex gap-2 mb-2">
            {domain && (
              <a href={company.website_url ?? `https://${domain}`} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-white/60 bg-white/50 hover:bg-white/80 transition-colors"
                 style={{ color: ACCENT }}>
                <Globe className="w-3 h-3" /> Website
              </a>
            )}
            {company.linkedin_url && (
              <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-white/60 bg-white/50 hover:bg-white/80 transition-colors"
                 style={{ color: ACCENT }}>
                <Linkedin className="w-3 h-3" /> LinkedIn
              </a>
            )}
          </div>

          {/* Summary */}
          {company.short_description && (
            <p className="text-[12px] text-muted-foreground leading-relaxed mb-2">
              {company.short_description}
            </p>
          )}

          {/* Suggested angle */}
          {angle && (
            <div className="px-2.5 py-2 rounded-xl"
                 style={{ background: `${ACCENT}08`, borderLeft: `2px solid ${ACCENT}35` }}>
              <p className="text-[9px] font-bold uppercase tracking-wide mb-0.5" style={{ color: ACCENT }}>Suggested angle</p>
              <p className="text-[12px] leading-relaxed" style={{ color: "#334155" }}>{angle}</p>
            </div>
          )}
        </div>

        {/* ── Mobile tabs ── */}
        <div className="flex border-b border-black/5 shrink-0 md:hidden bg-white/20">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className="flex-1 py-2.5 text-[11px] font-semibold transition-colors truncate px-1"
              style={activeTab === t.key
                ? { color: ACCENT, borderBottom: `2px solid ${ACCENT}` }
                : { color: "var(--muted-foreground)" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── 3-column layout ── */}
        <div className="flex-1 overflow-hidden flex min-h-0">

          {/* Left — Contacts */}
          <div className={`flex flex-col border-r border-black/5 overflow-hidden ${
            activeTab !== "contacts" ? "hidden md:flex md:w-1/3" : "flex w-full md:w-1/3"
          }`}>
            <div className="px-3 py-2 border-b border-black/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Users className="w-3 h-3" />
                Contacts {contacts.length > 0 && `(${contacts.length})`}
              </div>
              {loadingMore && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex-1 overflow-y-auto px-1.5 py-1.5">
              {sorted.length === 0 && !loadingMore ? (
                <div className="flex items-center gap-2 px-3 py-3 text-[11px] text-muted-foreground">
                  <UserRound className="w-4 h-4 shrink-0" />
                  No contacts found.
                  {company.linkedin_url && (
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
                    onClick={() => {
                      const newId = person.id === selectedId ? null : person.id;
                      setSelectedId(newId);
                      if (newId) setActiveTab("research");
                    }}
                    onAdd={() => handleAdd(person)}
                    isAdding={addingId === person.id}
                    isAdded={addedIds.has(person.id)}
                    isFailed={failedIds.has(person.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Middle — Contact research */}
          <div className={`flex flex-col border-r border-black/5 overflow-hidden ${
            activeTab !== "research" ? "hidden md:flex md:w-1/3" : "flex w-full md:w-1/3"
          }`}>
            <div className="px-3 py-2 border-b border-black/5 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Research</p>
            </div>
            <ContactResearchPanel
              person={selectedPerson}
              company={company}
              icp={icp}
              suggestedAngle={angle}
            />
          </div>

          {/* Right — Sequence */}
          <div className={`flex flex-col overflow-hidden ${
            activeTab !== "sequence" ? "hidden md:flex md:w-1/3" : "flex w-full md:w-1/3"
          }`}>
            <div className="px-3 py-2 border-b border-black/5 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">8-Touch Sequence</p>
            </div>
            <SequencePanel
              person={selectedPerson}
              company={company}
              suggestedAngle={angle}
            />
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}
