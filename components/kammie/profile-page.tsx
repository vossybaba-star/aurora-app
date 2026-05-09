"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PlacesAutocomplete } from "./places-autocomplete";
import { useKammie } from "./kammie-app";
import { updateProfile, signOut } from "@/lib/actions";
import { toneLabels } from "@/lib/types";
import type { Tone, UserProfile, CompanyAnalysis, ICP } from "@/lib/types";
import type { ApolloCompany } from "@/lib/apollo";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  Sparkles, MapPin, Instagram, Check, X, Mail, LogOut,
  Zap, User, Bell, CreditCard, Plus, AlertTriangle,
  Trophy, Briefcase, Globe, Building2, Linkedin,
} from "lucide-react";
import { RolePickerInline } from "@/components/profile/RolePickerInline";
import { getRoleById } from "@/lib/roles";

/* ─── Constants ─────────────────────────────── */
const ACCENT  = "#7c6ef7";
const ACCENT2 = "#9585f9";

type Section =
  | "my-profile" | "my-work" | "past-clients"
  | "email" | "outreach" | "notifications" | "billing";

function getNavGroups(isB2B: boolean) {
  return [
    {
      label: "Profile",
      items: [
        { id: "my-profile"   as Section, label: "My profile",  icon: User },
        ...(!isB2B ? [{ id: "my-work"      as Section, label: "My work",      icon: Briefcase }] : []),
        ...(!isB2B ? [{ id: "past-clients" as Section, label: "Past clients", icon: Trophy    }] : []),
      ],
    },
    {
      label: "Settings",
      items: [
        { id: "email"         as Section, label: "Email connection", icon: Mail },
        { id: "outreach"      as Section, label: "Outreach",          icon: Zap },
        { id: "notifications" as Section, label: "Notifications",     icon: Bell },
        { id: "billing"       as Section, label: "Billing",           icon: CreditCard },
      ],
    },
  ];
}

const POSITIONING_OPTIONS = [
  { id: "budget",    label: "Budget",      sub: "Value-focused" },
  { id: "mid",       label: "Mid-market",  sub: "Best of both" },
  { id: "premium",   label: "Premium",     sub: "High quality" },
  { id: "luxury",    label: "Luxury",      sub: "Ultra-high end" },
];

const OPP_TYPE_OPTIONS = [
  { value: "restaurant",      label: "Restaurants",       desc: "Cafes, bars, fine dining" },
  { value: "hotel",           label: "Hotels",            desc: "Hotels, resorts, B&Bs" },
  { value: "venue",           label: "Event Venues",      desc: "Wedding venues, event spaces" },
  { value: "wedding_planner", label: "Wedding Planners",  desc: "Wedding & event coordinators" },
  { value: "event_organiser", label: "Event Organisers",  desc: "Corporate events, festivals" },
  { value: "market",          label: "Markets",           desc: "Farmers markets, craft fairs" },
  { value: "agency",          label: "Agencies",          desc: "Creative, marketing, PR" },
  { value: "brand",           label: "Brands",            desc: "Product brands, startups" },
  { value: "publication",     label: "Publications",      desc: "Magazines, blogs, media" },
  { value: "retail",          label: "Retail Stores",     desc: "Shops, boutiques, galleries" },
  { value: "corporate",       label: "Corporate",         desc: "Office events, team building" },
  { value: "private",         label: "Private Events",    desc: "Birthdays, anniversaries" },
];

const TONES: Tone[] = ["friendly", "professional", "premium", "casual"];

/* ─── CompletionRing ────────────────────────── */
function CompletionRing({ percent, size = 56 }: { percent: number; size?: number }) {
  const r   = (size - 8) / 2;
  const cx  = size / 2;
  const cir = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90" style={{ display: "block" }}>
      <circle cx={cx} cy={cx} r={r} stroke="currentColor" strokeWidth="4"
        fill="none" className="text-muted/30" />
      <circle cx={cx} cy={cx} r={r} stroke={`url(#rg-${size})`} strokeWidth="4"
        fill="none" strokeLinecap="round"
        strokeDasharray={cir}
        strokeDashoffset={cir - (cir * percent) / 100} />
      <defs>
        <linearGradient id={`rg-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor={ACCENT} />
          <stop offset="100%" stopColor={ACCENT2} />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ─── Toggle switch ─────────────────────────── */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="relative w-10 h-5.5 rounded-full transition-colors shrink-0"
      style={{
        background: on ? `linear-gradient(135deg,${ACCENT},${ACCENT2})` : "rgba(0,0,0,0.12)",
        height: "22px",
      }}
    >
      <span
        className="absolute top-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-all"
        style={{ left: on ? "calc(100% - 19px)" : "3px" }}
      />
    </button>
  );
}

/* ─── PillInput — shared tag/client pill editor */
function PillInput({
  pills, onAdd, onRemove, placeholder, hint,
}: {
  pills: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder: string;
  hint?: string;
}) {
  const [input, setInput] = useState("");
  const commit = () => {
    const v = input.trim();
    if (v && !pills.includes(v)) onAdd(v);
    setInput("");
  };
  return (
    <div className="space-y-2.5">
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {pills.map(p => (
          <span key={p}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border"
            style={{ background: "rgba(124,110,247,0.08)", borderColor: "rgba(124,110,247,0.25)", color: ACCENT }}>
            {p}
            <button onClick={() => onRemove(p)} className="hover:text-red-500 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm rounded-xl border border-white/50 bg-white/60
                     focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground"
        />
        <button
          onClick={commit}
          disabled={!input.trim()}
          className="px-3 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-opacity"
          style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ─── Stepper control ───────────────────────── */
function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-8 h-8 rounded-xl border border-white/50 bg-white/60 flex items-center justify-center
                   text-lg font-bold disabled:opacity-30 hover:bg-white/80 transition-colors">
        −
      </button>
      <span className="w-8 text-center text-base font-bold" style={{ color: "#131b2e" }}>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-8 h-8 rounded-xl border border-white/50 bg-white/60 flex items-center justify-center
                   text-lg font-bold disabled:opacity-30 hover:bg-white/80 transition-colors">
        +
      </button>
    </div>
  );
}

/* ─── Section card wrapper ──────────────────── */
function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass-card rounded-2xl border border-white/60 p-5 ${className}`}>
      {children}
    </div>
  );
}

/* ─── Field row ─────────────────────────────── */
function FieldRow({ label, hint, incomplete, children }: { label: string; hint?: string; incomplete?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div>
        <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
        {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
        {incomplete && (
          <p className="text-[10px] mt-0.5 font-medium" style={{ color: ACCENT }}>
            Kammie uses this to personalise your outreach — the more detail the better.
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

/* ─── Text input (glassmorphism) ────────────── */
function GlassInput({
  value, onChange, placeholder, type = "text",
}: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 text-sm rounded-xl border border-white/50 bg-white/60
                 focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground"
    />
  );
}

/* ─── Save button ───────────────────────────── */
function SaveButton({ onClick, isPending, label = "Save changes" }: { onClick: () => void; isPending: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white
                 disabled:opacity-60 transition-opacity hover:opacity-90"
      style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
    >
      {isPending ? <Spinner className="w-4 h-4" /> : <Check className="w-4 h-4" />}
      {isPending ? "Saving…" : label}
    </button>
  );
}

/* ═══════════════════════════════════════════════
   CompanyPicker — always-visible company search
═══════════════════════════════════════════════ */
function CompanyPicker({
  currentName,
  currentDomain,
  onSaved,
}: {
  currentName?: string | null;
  currentDomain?: string | null;
  onSaved: (companyDomain: string, companyName: string, companyAnalysis: CompanyAnalysis, icp: ICP, website?: string, linkedin?: string) => void;
}) {
  const [query,        setQuery]        = useState("");
  const [selectedName, setSelectedName] = useState(currentName || currentDomain || "");
  const [suggestions,  setSuggestions]  = useState<ApolloCompany[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [analysing,    setAnalysing]    = useState(false);
  const [open,         setOpen]         = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const wrapperRef  = useRef<HTMLDivElement>(null);

  const isConfirmed = !!selectedName && !analysing;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced search (only when not in confirmed state)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch("/api/apollo/company-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query.trim() }),
        });
        const data = await res.json();
        const companies = data.companies ?? [];
        setSuggestions(companies);
        setOpen(companies.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleSelect = useCallback(async (company: ApolloCompany) => {
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    setSelectedName(company.name);
    setAnalysing(true);
    try {
      const res = await fetch("/api/analyze-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName:      company.name,
          domain:           company.primary_domain ?? undefined,
          websiteUrl:       company.website_url ?? undefined,
          shortDescription: company.short_description ?? undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSaved(
          company.primary_domain ?? company.name,
          company.name,
          data.analysis as CompanyAnalysis,
          data.icpSuggestion as ICP,
          company.website_url ?? undefined,
          company.linkedin_url ?? undefined,
        );
        toast.success(`Company set to ${company.name}`);
      } else {
        setSelectedName("");
        toast.error("Couldn't analyse company — try again");
      }
    } catch {
      setSelectedName("");
      toast.error("Couldn't analyse company — try again");
    } finally {
      setAnalysing(false);
    }
  }, [onSaved]);

  return (
    <div ref={wrapperRef} className="relative">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Your company</p>

      {/* Confirmed state — show badge + Change link */}
      {isConfirmed ? (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/50 bg-white/60">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold text-white"
               style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
            {selectedName.charAt(0).toUpperCase()}
          </div>
          <p className="flex-1 text-sm font-semibold" style={{ color: "#131b2e" }}>{selectedName}</p>
          <button onClick={() => { setSelectedName(""); setQuery(""); }}
            className="text-[11px] font-bold shrink-0" style={{ color: ACCENT }}>
            Change
          </button>
        </div>
      ) : (
        /* Search input */
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search your company name…"
            className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-white/50 bg-white/60
                       focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground"
          />
          {(searching || analysing) && (
            <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" />
          )}
        </div>
      )}

      {/* Analysing overlay */}
      {analysing && (
        <div className="flex items-center gap-2 mt-2 px-1">
          <Spinner className="w-3.5 h-3.5" />
          <p className="text-[11px] text-muted-foreground">Analysing company & building ICP…</p>
        </div>
      )}

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-1.5 left-0 right-0 rounded-2xl border border-white/60 shadow-xl overflow-hidden"
             style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)" }}>
          {suggestions.slice(0, 6).map(c => (
            <button
              key={c.id}
              onMouseDown={e => { e.preventDefault(); handleSelect(c); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#7c6ef7]/08 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold text-white"
                   style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "#131b2e" }}>{c.name}</p>
                {(c.primary_domain || c.industry) && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {[c.primary_domain, c.industry].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const B2B_ROLES = [
  { id: "founder",  label: "Founder / CEO" },
  { id: "sdr",      label: "SDR"           },
  { id: "ae",       label: "AE"            },
  { id: "marketer", label: "Marketer"      },
  { id: "vp_sales", label: "VP Sales"      },
  { id: "cs",       label: "CS Manager"    },
];

const B2B_TONE_OPTIONS: { id: CompanyAnalysis['tone']; label: string }[] = [
  { id: "professional", label: "Professional" },
  { id: "friendly",     label: "Friendly" },
  { id: "technical",    label: "Technical" },
  { id: "casual",       label: "Casual" },
];
const ICP_SIZE_OPTIONS = ["1-10", "11-50", "51-200", "201-1000", "1000+"];

/* ═══════════════════════════════════════════════
   SECTION: My Profile
═══════════════════════════════════════════════ */
function MyProfileSection({
  profile,
  onSave,
  onRoleSaved,
  isPending,
  isB2B,
  onCompanySaved,
}: {
  profile:         UserProfile;
  onSave:          (updates: Partial<UserProfile>) => void;
  onRoleSaved:     (roleId: string, roleCategory: string, targetMarkets: string[], businessType: string) => void;
  isPending:       boolean;
  isB2B:           boolean;
  onCompanySaved:  (domain: string, name: string, analysis: CompanyAnalysis, icp: ICP, website?: string, linkedin?: string) => void;
}) {
  const [bizName,     setBizName]     = useState(profile.businessName || "");
  const [location,    setLocation]    = useState(profile.location || "");
  const [workRadius,  setWorkRadius]  = useState(profile.workRadius || "");
  const [pitch,       setPitch]       = useState(profile.pitch || "");
  const [voiceSample, setVoiceSample] = useState(profile.voiceSample || "");
  const [voiceSaved,  setVoiceSaved]  = useState(!!(profile.voiceSample));
  const [tags,        setTags]        = useState<string[]>(profile.specialityTags || []);
  const [positioning, setPositioning] = useState(profile.positioning || "");
  const [portfolioUrl, setPortfolioUrl] = useState(profile.website || "");
  const [instagram,   setInstagram]   = useState(profile.instagram || "");
  const [linkedin,    setLinkedin]    = useState(profile.linkedin || "");
  const [b2bRole,     setB2bRole]     = useState(profile.businessType || "");

  // B2B — company analysis state (inlined from B2BWorkSection)
  const ca = profile.companyAnalysis;
  const ic = profile.icp;
  const [caDescription,     setCaDescription]     = useState(ca?.description       ?? "");
  const [caValueProp,       setCaValueProp]       = useState(ca?.value_proposition ?? "");
  const [caKeyFeatures,     setCaKeyFeatures]     = useState<string[]>(ca?.key_features ?? []);
  const [caTone,            setCaTone]            = useState<CompanyAnalysis['tone']>(ca?.tone ?? "professional");
  const [icpIndustries,     setIcpIndustries]     = useState<string[]>(ic?.industries   ?? []);
  const [icpSizes,          setIcpSizes]          = useState<string[]>(ic?.company_sizes ?? []);
  const [icpPersonas,       setIcpPersonas]       = useState<string[]>(ic?.personas      ?? []);
  const [icpPainPoints,     setIcpPainPoints]     = useState<string[]>(ic?.pain_points   ?? []);
  const [icpGeography,      setIcpGeography]      = useState<string[]>(ic?.geography     ?? []);

  const toggleIcpSize = (s: string) =>
    setIcpSizes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  // Import state
  const [importUrl,    setImportUrl]    = useState("");
  const [isImporting,  setIsImporting]  = useState(false);
  const [importedFlds, setImportedFlds] = useState<string[]>([]);

  const handleImport = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setIsImporting(true);
    setImportedFlds([]);
    try {
      const res = await fetch("/api/profile/import-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, businessType: profile.businessType }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      const filled: string[] = [];
      if (data.pitch)        { setPitch(data.pitch);             filled.push("About you"); }
      if (data.specialities) { setTags(data.specialities);       filled.push("Specialities"); }
      if (data.positioning)  { setPositioning(data.positioning); filled.push("Positioning"); }
      if (data.instagram)    { setInstagram(data.instagram);     filled.push("Instagram"); }
      setImportedFlds(filled);
      toast.success(filled.length ? `Filled ${filled.length} fields from your website` : "No profile info found — try editing manually");
    } catch {
      // Graceful fallback — populate a sample pitch scaffold
      const biz = profile.businessType || "your business";
      setPitch(`I'm a ${biz} based in ${profile.location || "your city"}.\n\nI specialise in [your speciality] and work with [types of clients].\n\n[Add 2–3 sentences about your style, approach, and what makes you different.]`);
      setImportedFlds(["About you (scaffold)"]);
      toast.success("Added a pitch template — edit it to make it yours");
    } finally {
      setIsImporting(false);
    }
  };

  const handleSave = () => {
    onSave(isB2B ? {
      location,
      website:      portfolioUrl,
      linkedin,
      businessType: b2bRole,
    } : {
      businessName:   bizName,
      location,
      pitch,
      website:        portfolioUrl,
      instagram,
      workRadius,
      specialityTags: tags,
      voiceSample,
      positioning,
    });
  };

  const handleSaveCompany = () => {
    onSave({
      companyAnalysis: { description: caDescription, value_proposition: caValueProp, key_features: caKeyFeatures, tone: caTone },
    });
  };

  const handleSaveIcp = () => {
    onSave({
      icp: { industries: icpIndustries, company_sizes: icpSizes, personas: icpPersonas, pain_points: icpPainPoints, geography: icpGeography },
    });
  };

  /* ── B2B layout ── */
  if (isB2B) return (
    <div className="space-y-5">
      <SectionCard>
        <div className="space-y-4">
          {/* Company picker — full width */}
          <CompanyPicker
            currentName={profile.companyAnalysis?.name || undefined}
            currentDomain={profile.companyDomain}
            onSaved={(domain, name, analysis, icp, website, linkedin) => {
              if (website) setPortfolioUrl(website);
              if (linkedin) setLinkedin(linkedin);
              onCompanySaved(domain, name, analysis, icp, website, linkedin);
            }}
          />

          {/* Your role — chip grid */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Your role</p>
            <div className="flex flex-wrap gap-2">
              {B2B_ROLES.map(r => {
                const isActive = b2bRole === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setB2bRole(isActive ? "" : r.id)}
                    className="px-3 py-1.5 rounded-full text-sm border font-medium transition-all"
                    style={isActive ? {
                      background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`,
                      borderColor: "transparent", color: "white",
                    } : {
                      background: "rgba(255,255,255,0.6)",
                      borderColor: "rgba(255,255,255,0.7)", color: "var(--muted-foreground)",
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Based in + Company website — 2 col */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldRow label="Based in">
              <PlacesAutocomplete
                value={location}
                onChange={setLocation}
                placeholder="Your city or area"
                className="py-2.5 text-sm rounded-xl border border-white/50 bg-white/60
                           focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 w-full"
              />
            </FieldRow>
            <FieldRow label="Company website">
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="url" value={portfolioUrl} onChange={e => setPortfolioUrl(e.target.value)}
                  placeholder="https://yourcompany.com"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-white/50 bg-white/60
                             focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground" />
              </div>
            </FieldRow>
          </div>

          {/* LinkedIn — full width */}
          <FieldRow label="LinkedIn">
            <div className="relative">
              <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={linkedin} onChange={e => setLinkedin(e.target.value)}
                placeholder="https://linkedin.com/in/yourprofile"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-white/50 bg-white/60
                           focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground" />
            </div>
          </FieldRow>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <SaveButton onClick={handleSave} isPending={isPending} />
      </div>

      {/* ── B2B: Company analysis + ICP ── */}
      <div className="mt-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
          {profile.companyAnalysis?.name || profile.companyDomain || "Your company"}
        </p>
        <SectionCard>
          <div className="space-y-4">
            <FieldRow label="Description" incomplete={!caDescription}>
              <textarea value={caDescription} onChange={e => setCaDescription(e.target.value)}
                placeholder="What does your company do? Who do you serve?"
                rows={3}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-white/50 bg-white/60 resize-none
                           focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground" />
            </FieldRow>
            <FieldRow label="Value proposition" incomplete={!caValueProp}>
              <GlassInput value={caValueProp} onChange={setCaValueProp}
                placeholder="e.g. We help sales teams book 3× more meetings with warm intros" />
            </FieldRow>
            <FieldRow label="Key features / capabilities">
              <PillInput pills={caKeyFeatures}
                onAdd={v => setCaKeyFeatures(f => [...f, v])}
                onRemove={v => setCaKeyFeatures(f => f.filter(x => x !== v))}
                placeholder="e.g. AI outreach, CRM sync, analytics…" />
            </FieldRow>
          </div>
        </SectionCard>
        <div className="flex justify-end mt-3">
          <SaveButton onClick={handleSaveCompany} isPending={isPending} label="Save company" />
        </div>
      </div>

      <div className="mt-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Your ideal customer (ICP)</p>
        <SectionCard>
          <div className="space-y-4">
            <FieldRow label="Target industries">
              <PillInput pills={icpIndustries}
                onAdd={v => setIcpIndustries(i => [...i, v])}
                onRemove={v => setIcpIndustries(i => i.filter(x => x !== v))}
                placeholder="e.g. SaaS, FinTech, E-commerce…" />
            </FieldRow>
            <FieldRow label="Company size">
              <div className="flex flex-wrap gap-2">
                {ICP_SIZE_OPTIONS.map(s => {
                  const isOn = icpSizes.includes(s);
                  return (
                    <button key={s} onClick={() => toggleIcpSize(s)}
                      className="px-3 py-1.5 rounded-full text-sm border font-medium transition-all"
                      style={isOn ? {
                        background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`,
                        borderColor: "transparent", color: "white",
                      } : {
                        background: "rgba(255,255,255,0.6)",
                        borderColor: "rgba(255,255,255,0.7)", color: "var(--muted-foreground)",
                      }}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </FieldRow>
            <FieldRow label="Decision-maker personas">
              <PillInput pills={icpPersonas}
                onAdd={v => setIcpPersonas(p => [...p, v])}
                onRemove={v => setIcpPersonas(p => p.filter(x => x !== v))}
                placeholder="e.g. VP Sales, Head of Marketing, Founder…" />
            </FieldRow>
            <FieldRow label="Pain points you solve">
              <PillInput pills={icpPainPoints}
                onAdd={v => setIcpPainPoints(p => [...p, v])}
                onRemove={v => setIcpPainPoints(p => p.filter(x => x !== v))}
                placeholder="e.g. Low reply rates, manual prospecting…" />
            </FieldRow>
            <FieldRow label="Geography">
              <PillInput pills={icpGeography}
                onAdd={v => setIcpGeography(g => [...g, v])}
                onRemove={v => setIcpGeography(g => g.filter(x => x !== v))}
                placeholder="e.g. UK, US, EMEA…" />
            </FieldRow>
          </div>
        </SectionCard>
        <div className="flex justify-end mt-3">
          <SaveButton onClick={handleSaveIcp} isPending={isPending} label="Save ICP" />
        </div>
      </div>
    </div>
  );

  /* ── Creative layout (unchanged) ── */
  return (
    <div className="space-y-5">

      {/* Import from website banner */}
      <div className="rounded-2xl p-4 border"
           style={{ background: "rgba(124,110,247,0.07)", borderColor: "rgba(124,110,247,0.22)" }}>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "#131b2e" }}>Import from your website</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Kammie reads your site and fills your bio, specialities, positioning, and tone automatically.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <input type="url" value={importUrl} onChange={e => setImportUrl(e.target.value)}
            placeholder="https://yourwebsite.com"
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-white/50 bg-white/70
                       focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground"
            onKeyDown={e => { if (e.key === "Enter") handleImport(); }} />
          <button onClick={handleImport} disabled={isImporting || !importUrl.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white
                       disabled:opacity-50 transition-opacity hover:opacity-90 shrink-0"
            style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
            {isImporting ? <Spinner className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            {isImporting ? "Importing…" : "Import"}
          </button>
        </div>
        {importedFlds.length > 0 && (
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground">Filled:</span>
            {importedFlds.map(f => (
              <span key={f} className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: "#16a34a" }}>
                <Check className="w-2.5 h-2.5" />{f}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Identity */}
      <SectionCard>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Identity</p>
        <div className="space-y-4">
          <FieldRow label="Business name" incomplete={!bizName}>
            <GlassInput value={bizName} onChange={setBizName} placeholder="e.g., Luna & Light Photography" />
          </FieldRow>
          <FieldRow label="Role">
            <RolePickerInline currentRoleId={profile.roleId} currentTargetMarkets={profile.targetMarkets} onSaved={onRoleSaved} />
          </FieldRow>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldRow label="Based in" incomplete={!location}>
              <PlacesAutocomplete value={location} onChange={setLocation} placeholder="Your city or area"
                className="px-3 py-2.5 text-sm rounded-xl border border-white/50 bg-white/60
                           focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 w-full" />
            </FieldRow>
            <FieldRow label="Work radius" incomplete={!workRadius}>
              <GlassInput value={workRadius} onChange={setWorkRadius} placeholder="e.g., 50 miles, UK-wide" />
            </FieldRow>
          </div>
        </div>
      </SectionCard>

      {/* About you */}
      <SectionCard>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">About you</p>
        <p className="text-[11px] text-muted-foreground">Write in your own voice — Kammie uses this in emails</p>
        {pitch.length < 30 && (
          <p className="text-[10px] font-medium mt-0.5 mb-3" style={{ color: ACCENT }}>
            Kammie uses this to personalise your outreach — the more detail the better.
          </p>
        )}
        {pitch.length >= 30 && <div className="mb-3" />}
        <textarea value={pitch} onChange={e => setPitch(e.target.value)}
          placeholder="Describe your style, what you specialise in, and what makes you different…"
          rows={5}
          className="w-full px-3 py-2.5 text-sm rounded-xl border border-white/50 bg-white/60 resize-none
                     focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground" />
      </SectionCard>

      {/* My writing voice */}
      <SectionCard>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">My writing voice</p>
        <p className="text-[11px] text-muted-foreground mb-3">
          Paste 1–2 emails you've previously sent to clients. Kammie will learn your tone and use it when drafting outreach.
        </p>
        {voiceSaved && !!voiceSample.trim() && (
          <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl"
               style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.2)" }}>
            <p className="text-[11px] font-semibold" style={{ color: "#16a34a" }}>
              Voice saved — Kammie will use this when drafting your emails
            </p>
            <button onClick={() => setVoiceSaved(false)}
              className="text-[11px] font-bold underline ml-3 shrink-0" style={{ color: ACCENT }}>
              Update
            </button>
          </div>
        )}
        {(!voiceSaved || !voiceSample.trim()) && (
          <>
            <textarea value={voiceSample}
              onChange={e => { setVoiceSample(e.target.value); setVoiceSaved(false); }}
              placeholder={"Paste an email you've sent before…\n\nHi [Name],\n\nI came across your venue and loved…"}
              rows={6}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-white/50 bg-white/60 resize-none
                         focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground mb-3" />
            <button onClick={() => { if (!voiceSample.trim()) return; onSave({ voiceSample }); setVoiceSaved(true); }}
              disabled={!voiceSample.trim() || isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white
                         disabled:opacity-40 transition-opacity hover:opacity-90"
              style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
              Save my voice
            </button>
          </>
        )}
      </SectionCard>

      {/* Speciality tags */}
      <SectionCard>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Speciality tags</p>
        {tags.length === 0 && (
          <p className="text-[10px] font-medium mt-0.5 mb-3" style={{ color: ACCENT }}>
            Kammie uses this to personalise your outreach — the more detail the better.
          </p>
        )}
        {tags.length > 0 && <div className="mb-3" />}
        <PillInput pills={tags} onAdd={v => setTags(t => [...t, v])} onRemove={v => setTags(t => t.filter(x => x !== v))}
          placeholder="e.g. Black weddings, Natural light, Documentary…" />
      </SectionCard>

      {/* Positioning */}
      <SectionCard>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Positioning</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {POSITIONING_OPTIONS.map(opt => {
            const isActive = positioning === opt.id;
            return (
              <button key={opt.id} onClick={() => setPositioning(isActive ? "" : opt.id)}
                className="flex flex-col items-center gap-0.5 px-3 py-3 rounded-xl border text-center transition-all"
                style={isActive ? {
                  background: `linear-gradient(135deg,rgba(124,110,247,0.12),rgba(149,133,249,0.06))`,
                  borderColor: "rgba(124,110,247,0.4)", color: ACCENT,
                } : { background: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.6)" }}>
                <span className={`text-sm font-bold ${isActive ? "" : "text-muted-foreground"}`}>{opt.label}</span>
                <span className="text-[10px] text-muted-foreground">{opt.sub}</span>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Links */}
      <SectionCard>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Links</p>
        <div className="space-y-3">
          <FieldRow label="Portfolio / website">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="url" value={portfolioUrl} onChange={e => setPortfolioUrl(e.target.value)}
                placeholder="https://yourportfolio.com"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-white/50 bg-white/60
                           focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground" />
            </div>
          </FieldRow>
          <FieldRow label="Instagram">
            <div className="relative">
              <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@yourhandle"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-white/50 bg-white/60
                           focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground" />
            </div>
          </FieldRow>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <SaveButton onClick={handleSave} isPending={isPending} />
      </div>

      {/* ── B2B: Company analysis + ICP (inlined, no separate tab) ── */}
      {isB2B && (
        <>
          <div className="mt-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Your company</p>
            <SectionCard>
              <div className="space-y-4">
                {profile.companyDomain && (
                  <FieldRow label="Company">
                    <p className="text-sm font-semibold" style={{ color: "#131b2e" }}>{profile.companyDomain}</p>
                  </FieldRow>
                )}
                <FieldRow label="Description" incomplete={!caDescription}>
                  <textarea
                    value={caDescription}
                    onChange={e => setCaDescription(e.target.value)}
                    placeholder="What does your company do? Who do you serve?"
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-white/50 bg-white/60 resize-none
                               focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground"
                  />
                </FieldRow>
                <FieldRow label="Value proposition" incomplete={!caValueProp}>
                  <GlassInput value={caValueProp} onChange={setCaValueProp}
                    placeholder="e.g. We help sales teams book 3× more meetings with warm intros" />
                </FieldRow>
                <FieldRow label="Key features / capabilities">
                  <PillInput pills={caKeyFeatures}
                    onAdd={v => setCaKeyFeatures(f => [...f, v])}
                    onRemove={v => setCaKeyFeatures(f => f.filter(x => x !== v))}
                    placeholder="e.g. AI outreach, CRM sync, analytics…" />
                </FieldRow>
                <FieldRow label="Brand tone">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {B2B_TONE_OPTIONS.map(opt => {
                      const isActive = caTone === opt.id;
                      return (
                        <button key={opt.id} onClick={() => setCaTone(opt.id)}
                          className="py-2.5 rounded-xl border text-sm font-bold transition-all"
                          style={isActive ? {
                            background: `linear-gradient(135deg,rgba(124,110,247,0.13),rgba(149,133,249,0.07))`,
                            borderColor: "rgba(124,110,247,0.4)", color: ACCENT,
                          } : {
                            background: "rgba(255,255,255,0.5)",
                            borderColor: "rgba(255,255,255,0.6)", color: "var(--muted-foreground)",
                          }}>
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </FieldRow>
              </div>
            </SectionCard>
            <div className="flex justify-end mt-3">
              <SaveButton onClick={handleSaveCompany} isPending={isPending} label="Save company" />
            </div>
          </div>

          <div className="mt-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Your ideal customer (ICP)</p>
            <SectionCard>
              <div className="space-y-4">
                <FieldRow label="Target industries">
                  <PillInput pills={icpIndustries}
                    onAdd={v => setIcpIndustries(i => [...i, v])}
                    onRemove={v => setIcpIndustries(i => i.filter(x => x !== v))}
                    placeholder="e.g. SaaS, FinTech, E-commerce…" />
                </FieldRow>
                <FieldRow label="Company size">
                  <div className="flex flex-wrap gap-2">
                    {ICP_SIZE_OPTIONS.map(s => {
                      const isOn = icpSizes.includes(s);
                      return (
                        <button key={s} onClick={() => toggleIcpSize(s)}
                          className="px-3 py-1.5 rounded-full text-sm border font-medium transition-all"
                          style={isOn ? {
                            background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`,
                            borderColor: "transparent", color: "white",
                          } : {
                            background: "rgba(255,255,255,0.6)",
                            borderColor: "rgba(255,255,255,0.7)", color: "var(--muted-foreground)",
                          }}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </FieldRow>
                <FieldRow label="Decision-maker personas">
                  <PillInput pills={icpPersonas}
                    onAdd={v => setIcpPersonas(p => [...p, v])}
                    onRemove={v => setIcpPersonas(p => p.filter(x => x !== v))}
                    placeholder="e.g. VP Sales, Head of Marketing, Founder…" />
                </FieldRow>
                <FieldRow label="Pain points you solve">
                  <PillInput pills={icpPainPoints}
                    onAdd={v => setIcpPainPoints(p => [...p, v])}
                    onRemove={v => setIcpPainPoints(p => p.filter(x => x !== v))}
                    placeholder="e.g. Low reply rates, manual prospecting…" />
                </FieldRow>
                <FieldRow label="Geography">
                  <PillInput pills={icpGeography}
                    onAdd={v => setIcpGeography(g => [...g, v])}
                    onRemove={v => setIcpGeography(g => g.filter(x => x !== v))}
                    placeholder="e.g. UK, US, EMEA…" />
                </FieldRow>
              </div>
            </SectionCard>
            <div className="flex justify-end mt-3">
              <SaveButton onClick={handleSaveIcp} isPending={isPending} label="Save ICP" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SECTION: My Work
═══════════════════════════════════════════════ */
function MyWorkSection({
  profile,
  onSave,
  isPending,
}: {
  profile: UserProfile;
  onSave: (updates: Partial<UserProfile>) => void;
  isPending: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(profile.opportunityTypes || []);

  const toggle = (v: string) =>
    setSelected(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]);

  return (
    <div className="space-y-5">
      <SectionCard>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
          What types of clients are you looking for?
        </p>
        <p className="text-[11px] text-muted-foreground mb-4">
          Kammie prioritises leads from these categories when scanning for opportunities.
        </p>
        <div className="flex flex-wrap gap-2">
          {OPP_TYPE_OPTIONS.map(opt => {
            const isOn = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border font-medium transition-all"
                style={isOn ? {
                  background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`,
                  borderColor: "transparent",
                  color: "white",
                } : {
                  background: "rgba(255,255,255,0.6)",
                  borderColor: "rgba(255,255,255,0.7)",
                  color: "var(--muted-foreground)",
                }}
              >
                {isOn && <Check className="w-3 h-3" />}
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">{selected.length} selected</p>
      </SectionCard>

      <div className="flex justify-end">
        <SaveButton onClick={() => onSave({ opportunityTypes: selected })} isPending={isPending} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SECTION: B2B Work (Company analysis + ICP)
═══════════════════════════════════════════════ */

function B2BWorkSection({
  profile,
  onSave,
  isPending,
}: {
  profile:   UserProfile;
  onSave:    (updates: Partial<UserProfile>) => void;
  isPending: boolean;
}) {
  const ca = profile.companyAnalysis;
  const ic = profile.icp;

  // Company analysis state
  const [description,       setDescription]      = useState(ca?.description       ?? "");
  const [valueProposition,  setValueProposition]  = useState(ca?.value_proposition ?? "");
  const [keyFeatures,       setKeyFeatures]       = useState<string[]>(ca?.key_features ?? []);
  const [caTone,            setCaTone]            = useState<CompanyAnalysis['tone']>(ca?.tone ?? "professional");

  // ICP state
  const [industries,  setIndustries]  = useState<string[]>(ic?.industries   ?? []);
  const [sizes,       setSizes]       = useState<string[]>(ic?.company_sizes ?? []);
  const [personas,    setPersonas]    = useState<string[]>(ic?.personas      ?? []);
  const [painPoints,  setPainPoints]  = useState<string[]>(ic?.pain_points   ?? []);
  const [geography,   setGeography]   = useState<string[]>(ic?.geography     ?? []);

  const toggleSize = (s: string) =>
    setSizes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const handleSaveCompany = () => {
    onSave({
      companyAnalysis: {
        description,
        value_proposition: valueProposition,
        key_features: keyFeatures,
        tone: caTone,
      },
    });
  };

  const handleSaveIcp = () => {
    onSave({
      icp: {
        industries,
        company_sizes: sizes,
        personas,
        pain_points: painPoints,
        geography,
      },
    });
  };

  return (
    <div className="space-y-6">

      {/* ── Card 1: Your company ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Your company</p>
        <div className="space-y-4">
          <SectionCard>
            <div className="space-y-4">
              {profile.companyDomain && (
                <FieldRow label="Company domain">
                  <p className="text-sm font-semibold" style={{ color: "#131b2e" }}>{profile.companyDomain}</p>
                </FieldRow>
              )}
              <FieldRow label="Description" incomplete={!description}>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What does your company do? Who do you serve?"
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-white/50 bg-white/60 resize-none
                             focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground"
                />
              </FieldRow>
              <FieldRow label="Value proposition" incomplete={!valueProposition}>
                <GlassInput
                  value={valueProposition}
                  onChange={setValueProposition}
                  placeholder="e.g. We help sales teams book 3× more meetings with warm intros"
                />
              </FieldRow>
              <FieldRow label="Key features / capabilities">
                <PillInput
                  pills={keyFeatures}
                  onAdd={v => setKeyFeatures(f => [...f, v])}
                  onRemove={v => setKeyFeatures(f => f.filter(x => x !== v))}
                  placeholder="e.g. AI outreach, CRM sync, analytics…"
                />
              </FieldRow>
              <FieldRow label="Brand tone">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {B2B_TONE_OPTIONS.map(opt => {
                    const isActive = caTone === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setCaTone(opt.id)}
                        className="py-2.5 rounded-xl border text-sm font-bold transition-all"
                        style={isActive ? {
                          background: `linear-gradient(135deg,rgba(124,110,247,0.13),rgba(149,133,249,0.07))`,
                          borderColor: "rgba(124,110,247,0.4)",
                          color: ACCENT,
                        } : {
                          background: "rgba(255,255,255,0.5)",
                          borderColor: "rgba(255,255,255,0.6)",
                          color: "var(--muted-foreground)",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </FieldRow>
            </div>
          </SectionCard>
          <div className="flex justify-end">
            <SaveButton onClick={handleSaveCompany} isPending={isPending} label="Save company" />
          </div>
        </div>
      </div>

      {/* ── Card 2: Your ideal customer (ICP) ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Your ideal customer (ICP)</p>
        <div className="space-y-4">
          <SectionCard>
            <div className="space-y-4">
              <FieldRow label="Target industries">
                <PillInput
                  pills={industries}
                  onAdd={v => setIndustries(i => [...i, v])}
                  onRemove={v => setIndustries(i => i.filter(x => x !== v))}
                  placeholder="e.g. SaaS, FinTech, E-commerce…"
                />
              </FieldRow>
              <FieldRow label="Company size">
                <div className="flex flex-wrap gap-2">
                  {ICP_SIZE_OPTIONS.map(s => {
                    const isOn = sizes.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() => toggleSize(s)}
                        className="px-3 py-1.5 rounded-full text-sm border font-medium transition-all"
                        style={isOn ? {
                          background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`,
                          borderColor: "transparent",
                          color: "white",
                        } : {
                          background: "rgba(255,255,255,0.6)",
                          borderColor: "rgba(255,255,255,0.7)",
                          color: "var(--muted-foreground)",
                        }}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </FieldRow>
              <FieldRow label="Decision-maker personas">
                <PillInput
                  pills={personas}
                  onAdd={v => setPersonas(p => [...p, v])}
                  onRemove={v => setPersonas(p => p.filter(x => x !== v))}
                  placeholder="e.g. VP Sales, Head of Marketing, Founder…"
                />
              </FieldRow>
              <FieldRow label="Pain points you solve">
                <PillInput
                  pills={painPoints}
                  onAdd={v => setPainPoints(p => [...p, v])}
                  onRemove={v => setPainPoints(p => p.filter(x => x !== v))}
                  placeholder="e.g. Low reply rates, manual prospecting…"
                />
              </FieldRow>
              <FieldRow label="Geography">
                <PillInput
                  pills={geography}
                  onAdd={v => setGeography(g => [...g, v])}
                  onRemove={v => setGeography(g => g.filter(x => x !== v))}
                  placeholder="e.g. UK, US, EMEA…"
                />
              </FieldRow>
            </div>
          </SectionCard>
          <div className="flex justify-end">
            <SaveButton onClick={handleSaveIcp} isPending={isPending} label="Save ICP" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SECTION: Past Clients
═══════════════════════════════════════════════ */
function PastClientsSection({
  profile, isPending, isB2B, onSave,
}: {
  profile: UserProfile; isPending: boolean; isB2B: boolean;
  onSave: (updates: Partial<UserProfile>) => void;
}) {
  const [clients, setClients] = useState<string[]>(profile.pastClients || []);

  return (
    <div className="space-y-5">
      <SectionCard>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
          {isB2B ? "Past clients & key accounts" : "Past clients & venues"}
        </p>
        <p className="text-[11px] text-muted-foreground mb-4">
          Kammie mentions these as social proof when writing outreach emails.
        </p>
        <PillInput
          pills={clients}
          onAdd={v => setClients(c => [...c, v])}
          onRemove={v => setClients(c => c.filter(x => x !== v))}
          placeholder={isB2B ? "e.g. Salesforce, HubSpot, a Fortune 500…" : "e.g. The Shard, Claridge's Hotel, Vogue…"}
          hint={undefined}
        />
      </SectionCard>

      <div className="flex justify-end">
        <SaveButton onClick={() => onSave({ pastClients: clients })} isPending={isPending} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SECTION: Email Connection
═══════════════════════════════════════════════ */
function EmailSection() {
  const [connected,     setConnected]     = useState(false);
  const [connectionId,  setConnectionId]  = useState<string | null>(null);
  const [isLoading,     setIsLoading]     = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch("/api/email/status")
      .then(r => r.json())
      .then(d => {
        setConnected(!!d.connected);
        setConnectionId(d.connections?.[0]?.id ?? null);
      })
      .catch(() => setConnected(false))
      .finally(() => setIsLoading(false));
  }, []);

  const handleConnect = () => { window.location.href = "/api/email/connect"; };

  const handleDisconnect = async () => {
    if (!connectionId) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/email/status", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      if (res.ok) {
        setConnected(false);
        setConnectionId(null);
        toast.success("Inbox disconnected");
      } else {
        toast.error("Failed to disconnect — try again");
      }
    } catch {
      toast.error("Failed to disconnect — try again");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <SectionCard>
          <div className="flex items-center gap-3">
            <Spinner className="w-5 h-5" />
            <p className="text-sm text-muted-foreground">Checking connection…</p>
          </div>
        </SectionCard>
      ) : connected ? (
        <SectionCard>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                 style={{ background: "rgba(34,197,94,0.12)" }}>
              <Mail className="w-5 h-5 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color: "#131b2e" }}>Inbox connected</p>
              <p className="text-xs text-muted-foreground">Kammie can send outreach directly from your address</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-emerald-600">Live</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/40">
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors font-medium disabled:opacity-50"
            >
              {disconnecting && <Spinner className="w-3 h-3" />}
              {disconnecting ? "Disconnecting…" : "Disconnect inbox"}
            </button>
          </div>
        </SectionCard>
      ) : (
        <div className="rounded-2xl p-5 text-white relative overflow-hidden"
             style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 8px 24px ${ACCENT}35` }}>
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full pointer-events-none"
               style={{ background: "rgba(255,255,255,0.10)" }} />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full pointer-events-none"
               style={{ background: "rgba(255,255,255,0.07)" }} />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                   style={{ background: "rgba(255,255,255,0.2)" }}>
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white/40" />
                <span className="text-xs font-bold opacity-75">Not connected</span>
              </div>
            </div>
            <p className="font-bold text-base mb-1">Connect your inbox</p>
            <p className="text-sm opacity-80 mb-4">
              Send outreach directly from Kammie using your own email address — no copy-paste needed.
            </p>
            <button onClick={handleConnect}
              className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
              style={{ background: "rgba(255,255,255,0.95)", color: ACCENT }}>
              Connect your inbox →
            </button>
          </div>
        </div>
      )}

      <SectionCard>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">About email connection</p>
        <ul className="space-y-2 text-[12px] text-muted-foreground">
          {[
            "Kammie uses Nylas to send from your real inbox — emails land in Sent.",
            "We never store your email password. You can revoke access any time.",
            "Works with Gmail, Outlook, and most IMAP-compatible providers.",
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-500" />{t}
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SECTION: Outreach settings
═══════════════════════════════════════════════ */
function OutreachSection({
  profile,
  onSave,
  isPending,
  isB2B,
}: {
  profile: UserProfile;
  onSave: (updates: Partial<UserProfile>) => void;
  isPending: boolean;
  isB2B?: boolean;
}) {
  const [tone,        setTone]        = useState<Tone>(profile.tone || "friendly");
  const [oppsPerWeek, setOppsPerWeek] = useState(profile.opportunitiesPerWeek || 5);
  const [voiceSample, setVoiceSample] = useState(profile.voiceSample || "");
  const [voiceSaved,  setVoiceSaved]  = useState(!!(profile.voiceSample));

  const handleSave = () => onSave({ tone, opportunitiesPerWeek: oppsPerWeek });

  return (
    <div className="space-y-5">

      {/* My writing voice — B2B only */}
      {isB2B && (
        <SectionCard>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">My writing voice</p>
          <p className="text-[11px] text-muted-foreground mb-3">
            Paste 1–2 sales emails you've previously sent. Kammie will learn your tone and use it when drafting outreach.
          </p>
          {voiceSaved && !!voiceSample.trim() && (
            <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl"
                 style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.2)" }}>
              <p className="text-[11px] font-semibold" style={{ color: "#16a34a" }}>
                Voice saved — Kammie will use this when drafting your emails
              </p>
              <button onClick={() => setVoiceSaved(false)}
                className="text-[11px] font-bold underline ml-3 shrink-0" style={{ color: ACCENT }}>
                Update
              </button>
            </div>
          )}
          {(!voiceSaved || !voiceSample.trim()) && (
            <>
              <textarea value={voiceSample}
                onChange={e => { setVoiceSample(e.target.value); setVoiceSaved(false); }}
                placeholder={"Paste a sales email you've sent before…\n\nHi [Name],\n\nI wanted to reach out about…"}
                rows={6}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-white/50 bg-white/60 resize-none
                           focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground mb-3" />
              <button onClick={() => { if (!voiceSample.trim()) return; onSave({ voiceSample }); setVoiceSaved(true); }}
                disabled={!voiceSample.trim() || isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white
                           disabled:opacity-40 transition-opacity hover:opacity-90"
                style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
                Save my voice
              </button>
            </>
          )}
        </SectionCard>
      )}

      {/* Tone */}
      <SectionCard>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Default email tone</p>
        <div className="grid grid-cols-2 gap-2">
          {TONES.map(t => {
            const isActive = tone === t;
            return (
              <button key={t} onClick={() => setTone(t)}
                className="py-3 rounded-xl border text-sm font-bold transition-all"
                style={isActive ? {
                  background: `linear-gradient(135deg,rgba(124,110,247,0.13),rgba(149,133,249,0.07))`,
                  borderColor: "rgba(124,110,247,0.4)",
                  color: ACCENT,
                } : {
                  background: "rgba(255,255,255,0.5)",
                  borderColor: "rgba(255,255,255,0.6)",
                  color: "var(--muted-foreground)",
                }}>
                {toneLabels[t]}
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Behaviour */}
      <SectionCard className="space-y-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Outreach behaviour</p>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: "#131b2e" }}>Leads per week</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">How many new leads Kammie finds each week</p>
          </div>
          <Stepper value={oppsPerWeek} min={1} max={20} onChange={setOppsPerWeek} />
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <SaveButton onClick={handleSave} isPending={isPending} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SECTION: Notifications
═══════════════════════════════════════════════ */
function NotificationsSection({
  profile, onSave, isPending,
}: {
  profile: UserProfile; onSave: (updates: Partial<UserProfile>) => void; isPending: boolean;
}) {
  const [replyAlerts,   setReplyAlerts]   = useState(profile.notificationReplyAlerts   ?? true);
  const [weeklySummary, setWeeklySummary] = useState(profile.notificationWeeklySummary ?? true);

  return (
    <div className="space-y-5">
      <SectionCard className="space-y-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email notifications</p>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: "#131b2e" }}>Reply alerts</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Get an email when a lead replies to your outreach</p>
          </div>
          <Toggle on={replyAlerts} onChange={setReplyAlerts} />
        </div>

        <div className="flex items-center justify-between border-t border-white/40 pt-4">
          <div>
            <p className="text-sm font-semibold" style={{ color: "#131b2e" }}>Weekly summary</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">A snapshot of your outreach performance every Monday</p>
          </div>
          <Toggle on={weeklySummary} onChange={setWeeklySummary} />
        </div>
      </SectionCard>
      <div className="flex justify-end">
        <SaveButton
          onClick={() => onSave({ notificationReplyAlerts: replyAlerts, notificationWeeklySummary: weeklySummary })}
          isPending={isPending}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SECTION: Billing
═══════════════════════════════════════════════ */
function BillingSection() {
  return (
    <div className="space-y-5">
      <SectionCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: "#131b2e" }}>Kammie</p>
            <p className="text-xs text-muted-foreground">Early access</p>
          </div>
          <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full text-white"
                style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
            Beta
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Billing management is coming soon. For any questions about your account, contact{" "}
          <a href="mailto:hello@kammie.com" className="underline" style={{ color: ACCENT }}>
            hello@kammie.com
          </a>
        </p>
      </SectionCard>

      {/* Danger zone */}
      <SectionCard>
        <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-3">Danger zone</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-red-600">Delete account</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Permanently removes all your data. This cannot be undone.</p>
          </div>
          <button
            onClick={() => toast.error("Please email hello@kammie.com to request account deletion.")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-red-600 border border-red-200
                       hover:bg-red-50 transition-colors shrink-0"
          >
            <AlertTriangle className="w-4 h-4" />
            Delete
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Sidebar profile card (desktop)
═══════════════════════════════════════════════ */
function SidebarCard({
  profile, completionPercent, completedCount, total,
}: {
  profile: UserProfile; completionPercent: number; completedCount: number; total: number;
}) {
  const initial = (profile.businessName || profile.businessType || "A").charAt(0).toUpperCase();
  return (
    <div className="glass-card rounded-2xl p-5 relative overflow-hidden border border-white/60">
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none"
           style={{ background: `${ACCENT}08` }} />
      <div className="relative z-10 flex flex-col items-center gap-3 text-center">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-extrabold shadow-lg"
             style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 8px 20px ${ACCENT}30` }}>
          {initial}
        </div>
        {/* Name + role */}
        <div>
          <p className="text-sm font-extrabold leading-tight" style={{ color: "#131b2e" }}>
            {profile.businessName || (profile.roleId ? getRoleById(profile.roleId)?.label : undefined) || profile.businessType || "Your Business"}
          </p>
          {profile.businessName && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {(profile.roleId ? getRoleById(profile.roleId)?.label : undefined) ?? profile.businessType}
            </p>
          )}
          {profile.location && (
            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-1">
              <MapPin className="w-3 h-3 shrink-0" />
              {profile.location.split(",")[0]}
            </p>
          )}
        </div>
        {/* Completion ring */}
        <div className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5"
             style={{ background: "rgba(124,110,247,0.06)" }}>
          <div className="relative shrink-0">
            <CompletionRing percent={completionPercent} size={48} />
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
                  style={{ color: ACCENT }}>
              {completionPercent}%
            </span>
          </div>
          <div className="text-left">
            <p className="text-xs font-bold" style={{ color: "#131b2e" }}>
              {completionPercent === 100 ? "Profile complete 🎉" : "Profile strength"}
            </p>
            <p className="text-[10px] text-muted-foreground">{completedCount}/{total} done</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════ */
export function ProfilePage() {
  const router = useRouter();
  const { profile, setProfile, profileSection } = useKammie();
  const [isPending, startTransition] = useTransition();
  const [activeSection, setActiveSection] = useState<Section>(profileSection as Section ?? "my-profile");

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  const isB2B = !!(profile.companyAnalysis || profile.icp);
  const NAV_GROUPS = getNavGroups(isB2B);

  /* ── Completion metric ── */
  const completionItems = [
    { done: !!profile.businessName },
    { done: !!profile.businessType },
    { done: !!profile.location },
    { done: (profile.pitch?.length ?? 0) >= 30 },
    { done: (profile.specialityTags?.length ?? 0) >= 1 },
    { done: !!profile.workRadius },
  ];
  const completedCount    = completionItems.filter(i => i.done).length;
  const completionPercent = Math.round((completedCount / completionItems.length) * 100);

  /* ── Save handler ── */
  const handleSave = (updates: Partial<UserProfile>) => {
    startTransition(async () => {
      const result = await updateProfile(updates as Parameters<typeof updateProfile>[0]);
      if (result.success) {
        setProfile({ ...profile, ...updates, updatedAt: new Date().toISOString() } as UserProfile);
        toast.success("Saved!");
      } else {
        toast.error(result.error || "Failed to save");
      }
    });
  };

  /* ── Role saved callback ── */
  const handleRoleSaved = (roleId: string, roleCategory: string, targetMarkets: string[], businessType: string) => {
    setProfile({ ...profile, roleId, roleCategory, targetMarkets, businessType } as UserProfile);
  };

  /* ── Company saved callback ── */
  const handleCompanySaved = (companyDomain: string, companyName: string, companyAnalysis: CompanyAnalysis, icp: ICP, website?: string, linkedin?: string) => {
    startTransition(async () => {
      const namedAnalysis = { ...companyAnalysis, name: companyName };
      const updates: Parameters<typeof updateProfile>[0] = {
        companyDomain,
        companyAnalysis: namedAnalysis,
        icp,
        ...(website  ? { website  } : {}),
        ...(linkedin ? { linkedin } : {}),
      } as Parameters<typeof updateProfile>[0];
      const result = await updateProfile(updates);
      if (result.success) {
        setProfile({
          ...profile,
          companyDomain,
          companyAnalysis: namedAnalysis,
          icp,
          ...(website  ? { website  } : {}),
          ...(linkedin ? { linkedin } : {}),
          updatedAt: new Date().toISOString(),
        } as UserProfile);
      } else {
        toast.error(result.error || "Failed to save company");
      }
    });
  };

  /* ── Sign out ── */
  const handleSignOut = () => {
    startTransition(async () => {
      await signOut();
      router.push("/");
      router.refresh();
    });
  };

  /* ── Active section renderer ── */
  const renderSection = () => {
    switch (activeSection) {
      case "my-profile":   return <MyProfileSection profile={profile} onSave={handleSave} onRoleSaved={handleRoleSaved} isPending={isPending} isB2B={isB2B} onCompanySaved={handleCompanySaved} />;
      case "my-work":      return isB2B
                             ? <B2BWorkSection profile={profile} onSave={handleSave} isPending={isPending} />
                             : <MyWorkSection profile={profile} onSave={handleSave} isPending={isPending} />;
      case "past-clients": return <PastClientsSection profile={profile} isPending={isPending} isB2B={isB2B} onSave={handleSave} />;
      case "email":        return <EmailSection />;
      case "outreach":     return <OutreachSection profile={profile} onSave={handleSave} isPending={isPending} isB2B={isB2B} />;
      case "notifications":return <NotificationsSection profile={profile} onSave={handleSave} isPending={isPending} />;
      case "billing":      return <BillingSection />;
    }
  };

  /* ── Active section label ── */
  const activeLabel = NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeSection)?.label ?? "";

  return (
    <div className="pb-10">

      {/* ── Mobile tab strip (hidden md+) ── */}
      <div className="md:hidden -mx-4 px-4 pb-4 mb-2 overflow-x-auto">
        <div className="flex gap-1.5 w-max">
          {NAV_GROUPS.flatMap(g => g.items).map(item => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all"
                style={isActive ? {
                  background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`,
                  color: "white",
                } : {
                  background: "rgba(255,255,255,0.5)",
                  border: "1px solid rgba(255,255,255,0.6)",
                  color: "var(--muted-foreground)",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Desktop two-panel layout ── */}
      <div className="flex gap-7 items-start">

        {/* ── Left column: sidebar card + nav ── */}
        <div className="hidden md:flex flex-col gap-4 w-[200px] shrink-0">

          {/* Profile card */}
          <SidebarCard
            profile={profile}
            completionPercent={completionPercent}
            completedCount={completedCount}
            total={completionItems.length}
          />

          {/* Nav */}
          <div className="glass-card rounded-2xl border border-white/60 p-3">
            {NAV_GROUPS.map(group => (
              <div key={group.label} className="mb-3 last:mb-0">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground px-2 mb-1">
                  {group.label}
                </p>
                {group.items.map(item => {
                  const Icon  = item.icon;
                  const isAct = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all mb-0.5"
                      style={isAct ? {
                        background: `linear-gradient(135deg,rgba(124,110,247,0.14),rgba(149,133,249,0.08))`,
                        color: ACCENT,
                        boxShadow: `0 0 0 1px rgba(124,110,247,0.25)`,
                      } : {}}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isAct ? "" : "text-muted-foreground"}`} />
                      <span className={isAct ? "" : "text-muted-foreground"}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}

            <div className="border-t border-white/40 mt-2 pt-2">
              <button
                onClick={handleSignOut}
                disabled={isPending}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold
                           text-muted-foreground hover:text-red-500 hover:bg-red-50/50 transition-all disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                Sign out
              </button>
            </div>
          </div>
        </div>

        {/* ── Right panel: active section ── */}
        <div className="flex-1 min-w-0">
          {/* Section heading */}
          <div className="mb-5">
            <h1 className="text-xl font-extrabold tracking-tight" style={{ color: "#131b2e" }}>
              {activeLabel}
            </h1>
          </div>
          {renderSection()}
        </div>
      </div>

      {/* ── Mobile section content (below tab strip) ── */}
      {/* The flex layout above already handles mobile via the tab strip */}

      {/* ── Mobile sign-out at bottom ── */}
      <div className="md:hidden mt-8">
        <button
          onClick={handleSignOut}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium
                     text-muted-foreground hover:text-red-500 border border-white/50 bg-white/30 transition-all"
        >
          {isPending ? <Spinner className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
          Sign out
        </button>
      </div>
    </div>
  );
}
