"use client";

import { useState, useEffect } from "react";
import {
  Sheet, SheetContent, SheetTitle,
} from "@/components/ui/sheet";
import {
  ExternalLink, Mail, Copy, Check, Loader2,
  Building2, Users, TrendingUp, Zap, Target,
  ChevronDown, ChevronUp, X,
} from "lucide-react";
import type { ApolloPerson, ApolloPersonEnriched } from "@/lib/apollo";

const ACCENT  = "#7c6ef7";
const ACCENT2 = "#9585f9";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContactDetailSheetProps {
  person:    ApolloPerson | null;
  onClose:   () => void;
}

interface GeneratedEmail {
  subject: string;
  body:    string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function derivedLogoUrl(orgName: string | null): string | null {
  if (!orgName) return null;
  const slug = orgName
    .toLowerCase()
    .replace(/\s+(inc|llc|ltd|corp|limited|group|co)\.?$/i, "")
    .replace(/[^a-z0-9]/g, "");
  return `/api/logo?domain=${encodeURIComponent(slug + ".com")}`;
}

function scoreBar(score: number) {
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#94a3b8";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium" style={{ color }}>
          {score >= 75 ? "T1 — Strong fit" : score >= 50 ? "T2 — Good fit" : "T3 — Weak fit"}
        </span>
        <span className="font-bold" style={{ color }}>{score}</span>
      </div>
      <div className="h-2 rounded-full bg-black/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, background: `linear-gradient(90deg,${color}99,${color})` }}
        />
      </div>
    </div>
  );
}

function pill(label: string, accent = false) {
  return (
    <span
      key={label}
      className="px-2 py-0.5 rounded-full text-[11px] font-medium border"
      style={accent
        ? { background: `${ACCENT}14`, color: ACCENT, borderColor: `${ACCENT}30` }
        : { background: "rgba(0,0,0,0.04)", color: "#475569", borderColor: "rgba(0,0,0,0.08)" }}
    >
      {label}
    </span>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────

function Section({ title, icon, children, defaultOpen = true }: {
  title: string;
  icon:  React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-black/5 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-3 text-left"
      >
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#131b2e" }}>
          {icon}
          {title}
        </div>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ContactDetailSheet({ person, onClose }: ContactDetailSheetProps) {
  const open = !!person;

  const [enriched,       setEnriched]       = useState<ApolloPersonEnriched | null>(null);
  const [enrichLoading,  setEnrichLoading]  = useState(false);
  const [logoFailed,     setLogoFailed]     = useState(false);
  const [contactRole,    setContactRole]    = useState<"champion" | "decision_maker">("champion");
  const [angle,          setAngle]          = useState("");
  const [emailLoading,   setEmailLoading]   = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [emailError,     setEmailError]     = useState<string | null>(null);
  const [copied,         setCopied]         = useState(false);
  const [showFullEmail,  setShowFullEmail]  = useState(false);

  // Reset state when person changes
  useEffect(() => {
    setEnriched(null);
    setLogoFailed(false);
    setContactRole("champion");
    setAngle("");
    setGeneratedEmail(null);
    setEmailError(null);
    setCopied(false);
    setShowFullEmail(false);
  }, [person?.id]);

  // Fetch enrichment when sheet opens
  useEffect(() => {
    if (!person) return;
    let cancelled = false;
    const run = async () => {
      setEnrichLoading(true);
      try {
        const res = await fetch("/api/contacts/enrich", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            first_name:       person.first_name,
            last_name:        person.last_name,
            organization_name: person.organization_name,
          }),
        });
        const data = await res.json();
        if (!cancelled && data.person) setEnriched(data.person);
      } catch {
        // enrichment is best-effort
      } finally {
        if (!cancelled) setEnrichLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [person?.id]);

  const org = enriched?.organization ?? null;

  const handleGenerateEmail = async () => {
    if (!person) return;
    setEmailLoading(true);
    setEmailError(null);
    setGeneratedEmail(null);
    try {
      const res = await fetch("/api/contacts/generate-email", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          recipient_first_name: person.first_name,
          recipient_title:      enriched?.title ?? person.title,
          company_name:         org?.name ?? person.organization_name,
          company_description:  org?.short_description,
          company_industry:     org?.industry,
          contact_role:         contactRole,
          angle,
        }),
      });
      const data = await res.json();
      if (data.subject && data.body) {
        setGeneratedEmail(data);
        setShowFullEmail(true);
      } else {
        setEmailError(data.error || "Failed to generate email");
      }
    } catch {
      setEmailError("Something went wrong. Try again.");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedEmail) return;
    const text = `Subject: ${generatedEmail.subject}\n\n${generatedEmail.body}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!person) return null;

  const fullName  = [person.first_name, person.last_name].filter(Boolean).join(" ");
  const logoUrl   = derivedLogoUrl(org?.name ?? person.organization_name);

  return (
    <Sheet open={open} onOpenChange={isOpen => { if (!isOpen) onClose(); }}>
      <SheetContent
        side="bottom"
        className="p-0 rounded-t-3xl max-h-[92dvh] flex flex-col"
        style={{ background: "linear-gradient(160deg,#f0eeff 0%,#faf9ff 60%,#fff 100%)" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-8 h-1 rounded-full bg-black/10" />
        </div>

        {/* Screen-reader title (visually hidden) */}
        <SheetTitle className="sr-only">{fullName} — Contact Detail</SheetTitle>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 pb-8">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex items-start gap-4 pt-2 pb-5 border-b border-black/5">
            {/* Avatar: company logo > photo > initials */}
            <div className="shrink-0">
              {logoUrl && !logoFailed ? (
                <img
                  src={logoUrl}
                  alt={org?.name ?? person.organization_name ?? ""}
                  className="w-14 h-14 rounded-2xl border border-white/60 bg-white object-contain p-1 shadow-sm"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg text-white shadow-sm"
                  style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
                >
                  {fullName.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase()).join("")}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <h2 className="text-base font-bold truncate" style={{ color: "#131b2e" }}>{fullName}</h2>
              {(enriched?.title ?? person.title) && (
                <p className="text-[12px] text-muted-foreground truncate">{enriched?.title ?? person.title}</p>
              )}
              {(org?.name ?? person.organization_name) && (
                <p className="text-[13px] font-semibold truncate mt-0.5" style={{ color: ACCENT }}>
                  {org?.name ?? person.organization_name}
                </p>
              )}
              {person.city && (
                <p className="text-[11px] text-muted-foreground">{person.city}</p>
              )}
            </div>

            {/* Close */}
            <button onClick={onClose} className="shrink-0 mt-0.5 p-1.5 rounded-xl hover:bg-black/5 transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Quick links */}
          <div className="flex gap-2 pt-4 pb-2">
            {(enriched?.linkedin_url ?? person.linkedin_url) && (
              <a
                href={enriched?.linkedin_url ?? person.linkedin_url ?? ""}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border border-white/60 bg-white/50 hover:bg-white/80 transition-colors"
                style={{ color: ACCENT }}
              >
                <ExternalLink className="w-3 h-3" /> LinkedIn
              </a>
            )}
            {(enriched?.email ?? person.email) && (
              <a
                href={`mailto:${enriched?.email ?? person.email}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border border-white/60 bg-white/50 hover:bg-white/80 transition-colors"
                style={{ color: ACCENT }}
              >
                <Mail className="w-3 h-3" /> {enriched?.email ?? person.email}
              </a>
            )}
            {org?.website_url && (
              <a
                href={org.website_url}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border border-white/60 bg-white/50 hover:bg-white/80 transition-colors"
                style={{ color: ACCENT }}
              >
                <ExternalLink className="w-3 h-3" /> Website
              </a>
            )}
          </div>

          {/* ── Research Panel ───────────────────────────────────────────── */}
          <div className="mt-4 glass-card rounded-2xl border border-white/60 px-4 divide-y divide-black/5">

            {/* Company Intelligence */}
            <Section title="Company Intelligence" icon={<Building2 className="w-3.5 h-3.5" style={{ color: ACCENT }} />}>
              {enrichLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading company data…
                </div>
              ) : org ? (
                <div className="space-y-3">
                  {org.short_description && (
                    <p className="text-[12px] text-muted-foreground leading-relaxed">{org.short_description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {org.industry         && pill(org.industry)}
                    {org.estimated_num_employees && pill(`${org.estimated_num_employees.toLocaleString()} employees`)}
                    {org.latest_funding_stage    && pill(org.latest_funding_stage, true)}
                    {org.employee_count_6_month_growth != null && org.employee_count_6_month_growth > 0 &&
                      pill(`+${Math.round(org.employee_count_6_month_growth * 100)}% headcount growth`, true)}
                  </div>
                  {org.technology_names?.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Tech stack</p>
                      <div className="flex flex-wrap gap-1">
                        {org.technology_names.slice(0, 8).map(t => pill(t))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground">
                  No company data found — try viewing their LinkedIn for more context.
                </p>
              )}
            </Section>

            {/* Buying Signals */}
            {org && (org.latest_funding_stage || (org.employee_count_6_month_growth ?? 0) > 0 || org.technology_names?.length > 0) && (
              <Section title="Buying Signals" icon={<TrendingUp className="w-3.5 h-3.5" style={{ color: ACCENT }} />} defaultOpen={false}>
                <ul className="space-y-2 text-[12px]">
                  {org.latest_funding_stage?.toLowerCase().match(/seed|series [ab]/) && (
                    <li className="flex items-start gap-2">
                      <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#f59e0b" }} />
                      <span style={{ color: "#475569" }}>
                        <strong className="text-foreground">Early-stage funding</strong> — likely building out their stack and open to new tools.
                      </span>
                    </li>
                  )}
                  {org.latest_funding_stage?.toLowerCase().match(/series [cd]|growth|late/) && (
                    <li className="flex items-start gap-2">
                      <TrendingUp className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#22c55e" }} />
                      <span style={{ color: "#475569" }}>
                        <strong className="text-foreground">Growth-stage funding</strong> — scaling fast, efficiency-focused.
                      </span>
                    </li>
                  )}
                  {(org.employee_count_6_month_growth ?? 0) > 0.08 && (
                    <li className="flex items-start gap-2">
                      <Users className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: ACCENT }} />
                      <span style={{ color: "#475569" }}>
                        <strong className="text-foreground">Strong headcount growth</strong> — team is expanding, operational needs rising.
                      </span>
                    </li>
                  )}
                  {org.technology_names?.some(t =>
                    ["salesforce", "hubspot", "marketo", "pipedrive", "zendesk"].some(e => t.toLowerCase().includes(e))
                  ) && (
                    <li className="flex items-start gap-2">
                      <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#818cf8" }} />
                      <span style={{ color: "#475569" }}>
                        <strong className="text-foreground">Enterprise tech stack</strong> — already invests in tooling, integration-friendly.
                      </span>
                    </li>
                  )}
                </ul>
              </Section>
            )}
          </div>

          {/* ── Outreach Panel ───────────────────────────────────────────── */}
          <div className="mt-4 glass-card rounded-2xl border border-white/60 px-4 divide-y divide-black/5">

            <Section title="Outreach" icon={<Target className="w-3.5 h-3.5" style={{ color: ACCENT }} />}>

              {/* Role selector */}
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Contact type</p>
                  <div className="flex rounded-xl border border-white/60 overflow-hidden glass-card w-full">
                    {(["champion", "decision_maker"] as const).map(role => {
                      const active = contactRole === role;
                      return (
                        <button
                          key={role}
                          onClick={() => { setContactRole(role); setGeneratedEmail(null); setEmailError(null); }}
                          className="flex-1 py-2 text-xs font-semibold transition-all"
                          style={active
                            ? { background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, color: "white" }
                            : { color: "var(--muted-foreground)" }}
                        >
                          {role === "champion" ? "Champion" : "Decision Maker"}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {contactRole === "champion"
                      ? "Day-to-day user. Lead with workflow pain + ease of adoption."
                      : "Budget holder. Lead with ROI, strategic impact, clear ask."}
                  </p>
                </div>

                {/* Angle */}
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Outreach angle</p>
                  <textarea
                    value={angle}
                    onChange={e => setAngle(e.target.value)}
                    placeholder={`e.g. "${org?.latest_funding_stage ? "Just raised funding — congrats, timing your outreach here" : "You share a common challenge with clients I work with…"}"`}
                    rows={2}
                    className="w-full text-[12px] rounded-xl border border-white/60 bg-white/60 px-3 py-2 resize-none focus:outline-none focus:ring-1 placeholder:text-muted-foreground/50"
                    style={{ focusRing: ACCENT } as React.CSSProperties}
                  />
                </div>

                {/* Generate button */}
                <button
                  onClick={handleGenerateEmail}
                  disabled={emailLoading}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 4px 12px ${ACCENT}40` }}
                >
                  {emailLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Writing email…</>
                    : <><Mail className="w-4 h-4" /> {generatedEmail ? "Regenerate email" : "Generate first email"}</>}
                </button>

                {emailError && (
                  <p className="text-[12px] text-red-500 text-center">{emailError}</p>
                )}

                {/* Generated email */}
                {generatedEmail && (
                  <div className="rounded-2xl border border-white/60 bg-white/60 overflow-hidden">
                    {/* Subject */}
                    <div className="px-4 py-3 border-b border-black/5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Subject</p>
                      <p className="text-[12px] font-semibold" style={{ color: "#131b2e" }}>{generatedEmail.subject}</p>
                    </div>

                    {/* Body */}
                    <div className="px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Body</p>
                      <div className="relative">
                        <p className="text-[12px] leading-relaxed whitespace-pre-line" style={{ color: "#334155" }}>
                          {showFullEmail
                            ? generatedEmail.body
                            : generatedEmail.body.split("\n\n").slice(0, 2).join("\n\n") + "…"}
                        </p>
                        {!showFullEmail && (
                          <button
                            onClick={() => setShowFullEmail(true)}
                            className="mt-1 text-[11px] font-semibold"
                            style={{ color: ACCENT }}
                          >
                            Show full email
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="px-4 py-3 border-t border-black/5 flex gap-2">
                      <button
                        onClick={handleCopy}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border border-white/60 bg-white/40 hover:bg-white/70 transition-colors"
                        style={{ color: copied ? "#22c55e" : ACCENT }}
                      >
                        {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy email</>}
                      </button>
                      {(enriched?.linkedin_url ?? person.linkedin_url) && (
                        <a
                          href={enriched?.linkedin_url ?? person.linkedin_url ?? ""}
                          target="_blank" rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border border-white/60 bg-white/40 hover:bg-white/70 transition-colors"
                          style={{ color: ACCENT }}
                        >
                          <ExternalLink className="w-3 h-3" /> Open LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          </div>

          {/* 8-touch sequence teaser */}
          <div
            className="mt-4 rounded-2xl border px-4 py-3 flex items-start gap-3"
            style={{ background: `${ACCENT}08`, borderColor: `${ACCENT}20` }}
          >
            <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
              style={{ background: `${ACCENT}18` }}>
              <Zap className="w-3.5 h-3.5" style={{ color: ACCENT }} />
            </div>
            <div>
              <p className="text-[12px] font-semibold" style={{ color: "#131b2e" }}>8-touch sequence</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Full multi-channel cadence — email + LinkedIn over 30 days. Coming soon.
              </p>
            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}
