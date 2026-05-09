"use client";

/**
 * components/onboarding/CompanySetupWizard.tsx
 *
 * 3-step B2B company onboarding wizard.
 *
 * Step 1 — Company search (Apollo autocomplete → analyse website)
 * Step 2 — Review / edit company analysis
 * Step 3 — Review / edit ICP
 *
 * Usage (full-screen overlay):
 *   <CompanySetupWizard onComplete={(domain, analysis, icp) => …} />
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft,
  Search,
  Building2,
  ChevronRight,
  Plus,
  X,
  Sparkles,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type { CompanyAnalysis, ICP } from "@/lib/types";
import type { ApolloCompany } from "@/lib/apollo";

// ── Brand ────────────────────────────────────────────────────────────────────
const ACCENT  = "#7c6ef7";
const ACCENT2 = "#9585f9";

// ── Size toggle options ───────────────────────────────────────────────────────
const SIZE_OPTIONS = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  onComplete: (companyDomain: string, analysis: CompanyAnalysis, icp: ICP) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** 1-2 initial avatar for a company name */
function initials(name: string) {
  const words = name.trim().split(/\s+/);
  return words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

/** Format employee count compactly */
function fmtSize(n: number | null) {
  if (!n) return null;
  if (n >= 1000) return `${Math.round(n / 1000)}k+`;
  return String(n);
}

// ── Chip ──────────────────────────────────────────────────────────────────────
function Chip({
  label,
  onRemove,
  accent,
}: {
  label: string;
  onRemove?: () => void;
  accent?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold border transition-colors"
      style={
        accent
          ? { background: `rgba(124,110,247,0.10)`, color: ACCENT, borderColor: `rgba(124,110,247,0.25)` }
          : { background: "rgba(0,0,0,0.04)", color: "#374151", borderColor: "rgba(0,0,0,0.08)" }
      }
    >
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 hover:opacity-70 transition-opacity"
          aria-label={`Remove ${label}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

// ── ChipEditor (editable list of chips + add input) ───────────────────────────
function ChipEditor({
  items,
  onChange,
  placeholder,
  accent,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  accent?: boolean;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setDraft("");
  };

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <Chip key={item} label={item} onRemove={() => remove(i)} accent={accent} />
      ))}
      <div className="flex items-center gap-1">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
            if (e.key === "Backspace" && !draft && items.length) remove(items.length - 1);
          }}
          placeholder={placeholder}
          className="rounded-full border px-3 py-1 text-xs outline-none focus:ring-2 transition-shadow"
          style={{ borderColor: "rgba(0,0,0,0.12)", minWidth: 100, focusRingColor: ACCENT }}
        />
        {draft && (
          <button
            onClick={add}
            className="w-6 h-6 rounded-full flex items-center justify-center text-white transition-opacity hover:opacity-80"
            style={{ background: ACCENT }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Progress dots (matching first-run-wizard style) ───────────────────────────
function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-1.5 rounded-full transition-all duration-300"
          style={{
            width:      i === step ? 24 : 8,
            background: i <= step
              ? `linear-gradient(90deg,${ACCENT},${ACCENT2})`
              : "rgba(0,0,0,0.12)",
          }}
        />
      ))}
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────
export function CompanySetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ── Step 1 state ──────────────────────────────────────────────────────────
  const [query,       setQuery]       = useState("");
  const [suggestions, setSuggestions] = useState<ApolloCompany[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [analysing,   setAnalysing]   = useState(false);
  const [partial,     setPartial]     = useState(false);
  const debounceRef                   = useRef<ReturnType<typeof setTimeout>>(null);

  // ── Shared state (populated after analyse-company) ────────────────────────
  const [selectedCompany, setSelectedCompany] = useState<ApolloCompany | null>(null);

  // ── Step 2 state ──────────────────────────────────────────────────────────
  const [description,      setDescription]      = useState("");
  const [valueProp,        setValueProp]         = useState("");
  const [keyFeatures,      setKeyFeatures]       = useState<string[]>([]);
  const [tone,             setTone]              = useState<CompanyAnalysis["tone"]>("professional");

  // ── Step 3 state ──────────────────────────────────────────────────────────
  const [industries,   setIndustries]   = useState<string[]>([]);
  const [companySizes, setCompanySizes] = useState<string[]>([]);
  const [personas,     setPersonas]     = useState<string[]>([]);
  const [painPoints,   setPainPoints]   = useState<string[]>([]);
  const [geography,    setGeography]    = useState<string[]>(["United Kingdom"]);

  // ── Debounced search ──────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch("/api/apollo/company-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query.trim() }),
        });
        const data = await res.json();
        setSuggestions(data.companies ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // ── Select company → analyse ──────────────────────────────────────────────
  const handleSelect = useCallback(async (company: ApolloCompany) => {
    setSelectedCompany(company);
    setSuggestions([]);
    setQuery(company.name);
    setAnalysing(true);

    try {
      const res = await fetch("/api/analyze-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName:       company.name,
          domain:            company.primary_domain ?? undefined,
          websiteUrl:        company.website_url ?? undefined,
          shortDescription:  company.short_description ?? undefined,
        }),
      });
      const data = await res.json();

      if (data.success) {
        const a: CompanyAnalysis = data.analysis;
        setDescription(a.description);
        setValueProp(a.value_proposition);
        setKeyFeatures(a.key_features ?? []);
        setTone(a.tone ?? "professional");

        const icp = data.icpSuggestion as ICP;
        setIndustries(icp.industries ?? []);
        setCompanySizes(icp.company_sizes ?? []);
        setPersonas(icp.personas ?? []);
        // pain_points is now Record<string,string[]> — flatten for wizard display
        setPainPoints(Object.values(icp.pain_points ?? {}).flat());
        setGeography(icp.geography?.length ? icp.geography : ["United Kingdom"]);

        setPartial(!!data.partial);
        setStep(2);
      } else {
        // Fallback: advance with empty fields so user can fill in manually
        setPartial(true);
        setStep(2);
      }
    } catch {
      setPartial(true);
      setStep(2);
    } finally {
      setAnalysing(false);
    }
  }, []);

  // ── Manual entry (no Apollo match) ───────────────────────────────────────
  const handleManualEntry = useCallback(async () => {
    if (!query.trim()) return;
    const domain = query.trim().replace(/^https?:\/\//, "").split("/")[0];
    const fakeCompany: ApolloCompany = {
      id: "manual",
      name: query.trim(),
      primary_domain: domain,
      website_url: `https://${domain}`,
      linkedin_url: null,
      twitter_url: null,
      industry: null,
      keywords: [],
      estimated_num_employees: null,
      city: null,
      country: null,
      short_description: null,
      phone: null,
    };
    await handleSelect(fakeCompany);
  }, [query, handleSelect]);

  // ── Step 3 → done ─────────────────────────────────────────────────────────
  const handleFinish = () => {
    const domain =
      selectedCompany?.primary_domain ??
      selectedCompany?.website_url?.replace(/^https?:\/\//, "").split("/")[0] ??
      "";

    const analysis: CompanyAnalysis = {
      description,
      value_proposition: valueProp,
      key_features: keyFeatures,
      tone,
    };

    const icp: ICP = {
      industries,
      company_sizes: companySizes,
      personas,
      pain_points: painPoints.length ? { General: painPoints } : {},
      geography,
    };

    onComplete(domain, analysis, icp);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(10,8,25,0.72)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-white/50 shadow-2xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.97)", maxHeight: "92vh", overflowY: "auto" }}
      >
        {/* Purple top bar */}
        <div className="h-1 w-full sticky top-0 z-10"
             style={{ background: `linear-gradient(90deg,${ACCENT},${ACCENT2})` }} />

        <div className="p-7 sm:p-9">
          {/* Header */}
          <div className="flex items-center justify-between mb-7">
            <div className="flex items-center gap-2.5">
              {step > 1 && (
                <button
                  onClick={() => setStep(step === 3 ? 2 : 1)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-black/[0.06] mr-1"
                >
                  <ArrowLeft className="w-4 h-4" style={{ color: "#131b2e" }} />
                </button>
              )}
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm shrink-0"
                style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-sm tracking-tight" style={{ color: "#131b2e" }}>
                Kammie
              </span>
            </div>

            <div className="flex items-center gap-3">
              <ProgressDots step={step - 1} total={3} />
              <span className="text-[11px] font-bold text-muted-foreground">{step} / 3</span>
            </div>
          </div>

          {/* ════════════════════════════
              STEP 1 — Company search
          ════════════════════════════ */}
          {step === 1 && (
            <>
              <h2 className="text-xl font-extrabold mb-1.5 leading-snug" style={{ color: "#131b2e" }}>
                Tell us about your company
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Search for your company — Kammie will analyse your website and build your outreach profile.
              </p>

              {/* Search input */}
              <div className="relative mb-2">
                <Search
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search your company name…"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border text-sm outline-none transition-shadow focus:ring-2"
                  style={{ borderColor: "rgba(0,0,0,0.12)" }}
                  autoFocus
                />
                {(searching || analysing) && (
                  <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Suggestions dropdown */}
              {suggestions.length > 0 && !analysing && (
                <div className="rounded-2xl border overflow-hidden mb-4"
                     style={{ borderColor: "rgba(0,0,0,0.08)", boxShadow: "0 4px 18px rgba(0,0,0,0.08)" }}>
                  {suggestions.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleSelect(c)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.03] border-b last:border-0"
                      style={{ borderColor: "rgba(0,0,0,0.06)" }}
                    >
                      {/* Avatar */}
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0"
                        style={{ background: `rgba(124,110,247,0.12)`, color: ACCENT }}
                      >
                        {initials(c.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: "#131b2e" }}>{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[c.primary_domain, c.industry, c.estimated_num_employees ? `${fmtSize(c.estimated_num_employees)} employees` : null]
                            .filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Analysing skeleton */}
              {analysing && (
                <div
                  className="rounded-2xl px-5 py-4 mb-4 flex items-center gap-3"
                  style={{ background: `rgba(124,110,247,0.07)`, border: `1px solid rgba(124,110,247,0.18)` }}
                >
                  <Loader2 className="w-5 h-5 animate-spin shrink-0" style={{ color: ACCENT }} />
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#131b2e" }}>
                      Analysing {selectedCompany?.name ?? query}…
                    </p>
                    <p className="text-xs text-muted-foreground">Reading website, extracting selling points</p>
                  </div>
                </div>
              )}

              {/* Manual entry fallback */}
              {query.trim().length >= 2 && suggestions.length === 0 && !searching && !analysing && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Can&apos;t find your company?</p>
                  <button
                    onClick={handleManualEntry}
                    className="w-full py-2.5 rounded-2xl text-sm font-semibold border transition-colors hover:bg-black/[0.03]"
                    style={{ borderColor: "rgba(0,0,0,0.12)", color: "#374151" }}
                  >
                    Continue with &ldquo;{query.trim()}&rdquo; →
                  </button>
                </div>
              )}
            </>
          )}

          {/* ════════════════════════════
              STEP 2 — Review analysis
          ════════════════════════════ */}
          {step === 2 && (
            <>
              <h2 className="text-xl font-extrabold mb-1 leading-snug" style={{ color: "#131b2e" }}>
                Review your company profile
              </h2>
              <p className="text-sm text-muted-foreground mb-5">
                Kammie extracted this from your website. Edit anything that&apos;s off.
              </p>

              {partial && (
                <div
                  className="flex items-start gap-2.5 rounded-2xl px-4 py-3 mb-5 text-xs"
                  style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.30)", color: "#92400e" }}
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <span>We couldn&apos;t fully scrape your site — please review and complete the details below.</span>
                </div>
              )}

              {/* Description */}
              <div className="mb-4">
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide text-muted-foreground">
                  What does your company do?
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="2-3 sentences about your company…"
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none resize-none transition-shadow focus:ring-2"
                  style={{ borderColor: "rgba(0,0,0,0.12)" }}
                />
              </div>

              {/* Value prop */}
              <div className="mb-4">
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide text-muted-foreground">
                  Headline value proposition
                </label>
                <input
                  value={valueProp}
                  onChange={e => setValueProp(e.target.value)}
                  placeholder="Your single most compelling benefit…"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-shadow focus:ring-2"
                  style={{ borderColor: "rgba(0,0,0,0.12)" }}
                />
              </div>

              {/* Key features */}
              <div className="mb-4">
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide text-muted-foreground">
                  Core features / capabilities
                </label>
                <ChipEditor
                  items={keyFeatures}
                  onChange={setKeyFeatures}
                  placeholder="Add feature…"
                  accent
                />
              </div>

              {/* Tone */}
              <div className="mb-6">
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide text-muted-foreground">
                  Brand tone
                </label>
                <div className="flex flex-wrap gap-2">
                  {(["professional", "casual", "technical", "friendly"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className="px-3.5 py-1.5 rounded-full text-xs font-semibold border capitalize transition-all"
                      style={
                        tone === t
                          ? { background: ACCENT, color: "#fff", borderColor: ACCENT }
                          : { background: "transparent", color: "#374151", borderColor: "rgba(0,0,0,0.12)" }
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setStep(3)}
                className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 4px 18px rgba(124,110,247,0.35)` }}
              >
                Looks right → Continue <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* ════════════════════════════
              STEP 3 — Review ICP
          ════════════════════════════ */}
          {step === 3 && (
            <>
              <h2 className="text-xl font-extrabold mb-1 leading-snug" style={{ color: "#131b2e" }}>
                Who are your ideal customers?
              </h2>
              <p className="text-sm text-muted-foreground mb-5">
                Kammie will use this to find and score the best prospects for you.
              </p>

              {/* Industries */}
              <div className="mb-4">
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide text-muted-foreground">
                  Target industries
                </label>
                <ChipEditor
                  items={industries}
                  onChange={setIndustries}
                  placeholder="Add industry…"
                  accent
                />
              </div>

              {/* Company sizes */}
              <div className="mb-4">
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide text-muted-foreground">
                  Company size
                </label>
                <div className="flex flex-wrap gap-2">
                  {SIZE_OPTIONS.map(size => {
                    const active = companySizes.includes(size);
                    return (
                      <button
                        key={size}
                        onClick={() =>
                          setCompanySizes(prev =>
                            active ? prev.filter(s => s !== size) : [...prev, size]
                          )
                        }
                        className="px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all"
                        style={
                          active
                            ? { background: ACCENT, color: "#fff", borderColor: ACCENT }
                            : { background: "transparent", color: "#374151", borderColor: "rgba(0,0,0,0.12)" }
                        }
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Personas */}
              <div className="mb-4">
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide text-muted-foreground">
                  Decision-maker personas
                </label>
                <ChipEditor
                  items={personas}
                  onChange={setPersonas}
                  placeholder="e.g. Head of Marketing…"
                  accent
                />
              </div>

              {/* Pain points */}
              <div className="mb-4">
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide text-muted-foreground">
                  Pain points you solve
                </label>
                <ChipEditor
                  items={painPoints}
                  onChange={setPainPoints}
                  placeholder="e.g. low outreach response rates…"
                />
              </div>

              {/* Geography */}
              <div className="mb-6">
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide text-muted-foreground">
                  Geography
                </label>
                <ChipEditor
                  items={geography}
                  onChange={setGeography}
                  placeholder="Add region or country…"
                />
              </div>

              <button
                onClick={handleFinish}
                disabled={industries.length === 0 && companySizes.length === 0}
                className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 4px 18px rgba(124,110,247,0.35)` }}
              >
                Save &amp; find leads <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
