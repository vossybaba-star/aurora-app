"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { PlacesAutocomplete } from "./places-autocomplete";
import { useAurora } from "./aurora-app";
import { updateProfile, signOut } from "@/lib/actions";
import { toneLabels } from "@/lib/types";
import type { Tone, UserProfile } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  Sparkles, MapPin, Instagram, Check, X, Mail, LogOut,
  Zap, User, Bell, CreditCard, Plus, AlertTriangle,
  Trophy, Briefcase, Globe,
} from "lucide-react";

/* ─── Constants ─────────────────────────────── */
const ACCENT  = "#7c6ef7";
const ACCENT2 = "#9585f9";

type Section =
  | "my-profile" | "my-work" | "past-clients"
  | "email" | "outreach" | "notifications" | "billing";

const NAV_GROUPS: { label: string; items: { id: Section; label: string; icon: React.FC<{ className?: string }> }[] }[] = [
  {
    label: "Profile",
    items: [
      { id: "my-profile",   label: "My profile",   icon: User },
      { id: "my-work",      label: "My work",       icon: Briefcase },
      { id: "past-clients", label: "Past clients",  icon: Trophy },
    ],
  },
  {
    label: "Settings",
    items: [
      { id: "email",         label: "Email connection", icon: Mail },
      { id: "outreach",      label: "Outreach",          icon: Zap },
      { id: "notifications", label: "Notifications",     icon: Bell },
      { id: "billing",       label: "Billing",           icon: CreditCard },
    ],
  },
];

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
function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div>
        <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
        {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
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
   SECTION: My Profile
═══════════════════════════════════════════════ */
function MyProfileSection({
  profile,
  onSave,
  isPending,
}: {
  profile: UserProfile;
  onSave: (updates: Partial<UserProfile>) => void;
  isPending: boolean;
}) {
  const [bizName,     setBizName]     = useState(profile.businessName || "");
  const [profession,  setProfession]  = useState(profile.businessType || "");
  const [location,    setLocation]    = useState(profile.location || "");
  const [workRadius,  setWorkRadius]  = useState("");
  const [pitch,       setPitch]       = useState(profile.pitch || "");
  const [tags,        setTags]        = useState<string[]>([]);
  const [positioning, setPositioning] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState(profile.website || "");
  const [instagram,   setInstagram]   = useState(profile.instagram || "");

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
    onSave({
      businessName: bizName,
      businessType: profession,
      location,
      pitch,
      website: portfolioUrl,
      instagram,
    });
  };

  return (
    <div className="space-y-5">

      {/* ── Import from website banner ── */}
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
              Aurora reads your site and fills your bio, specialities, positioning, and tone automatically.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="url"
            value={importUrl}
            onChange={e => setImportUrl(e.target.value)}
            placeholder="https://yourwebsite.com"
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-white/50 bg-white/70
                       focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground"
            onKeyDown={e => { if (e.key === "Enter") handleImport(); }}
          />
          <button
            onClick={handleImport}
            disabled={isImporting || !importUrl.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white
                       disabled:opacity-50 transition-opacity hover:opacity-90 shrink-0"
            style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
          >
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

      {/* ── Identity fields ── */}
      <SectionCard>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Identity</p>
        <div className="space-y-4">
          <FieldRow label="Business name">
            <GlassInput value={bizName} onChange={setBizName} placeholder="e.g., Luna & Light Photography" />
          </FieldRow>
          <FieldRow label="Profession / type">
            <GlassInput value={profession} onChange={setProfession} placeholder="e.g., Wedding Photographer" />
          </FieldRow>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldRow label="Based in">
              <PlacesAutocomplete
                value={location}
                onChange={setLocation}
                placeholder="Your city or area"
                className="px-3 py-2.5 text-sm rounded-xl border border-white/50 bg-white/60
                           focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 w-full"
              />
            </FieldRow>
            <FieldRow label="Work radius" hint="Aurora uses this when finding leads">
              <GlassInput value={workRadius} onChange={setWorkRadius} placeholder="e.g., 50 miles, UK-wide" />
            </FieldRow>
          </div>
        </div>
      </SectionCard>

      {/* ── About you ── */}
      <SectionCard>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">About you</p>
        <p className="text-[11px] text-muted-foreground mb-3">Write in your own voice — Aurora uses this in emails</p>
        <textarea
          value={pitch}
          onChange={e => setPitch(e.target.value)}
          placeholder="Describe your style, what you specialise in, and what makes you different…"
          rows={5}
          className="w-full px-3 py-2.5 text-sm rounded-xl border border-white/50 bg-white/60 resize-none
                     focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground"
        />
      </SectionCard>

      {/* ── Speciality tags ── */}
      <SectionCard>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Speciality tags</p>
        <PillInput
          pills={tags}
          onAdd={v => setTags(t => [...t, v])}
          onRemove={v => setTags(t => t.filter(x => x !== v))}
          placeholder="e.g. Black weddings, Natural light, Documentary…"
        />
      </SectionCard>

      {/* ── Positioning ── */}
      <SectionCard>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Positioning</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {POSITIONING_OPTIONS.map(opt => {
            const isActive = positioning === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setPositioning(isActive ? "" : opt.id)}
                className="flex flex-col items-center gap-0.5 px-3 py-3 rounded-xl border text-center transition-all"
                style={isActive ? {
                  background: `linear-gradient(135deg,rgba(124,110,247,0.12),rgba(149,133,249,0.06))`,
                  borderColor: "rgba(124,110,247,0.4)",
                  color: ACCENT,
                } : {
                  background: "rgba(255,255,255,0.5)",
                  borderColor: "rgba(255,255,255,0.6)",
                }}
              >
                <span className={`text-sm font-bold ${isActive ? "" : "text-muted-foreground"}`}>{opt.label}</span>
                <span className="text-[10px] text-muted-foreground">{opt.sub}</span>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* ── Links ── */}
      <SectionCard>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Links</p>
        <div className="space-y-3">
          <FieldRow label="Portfolio / website">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="url"
                value={portfolioUrl}
                onChange={e => setPortfolioUrl(e.target.value)}
                placeholder="https://yourportfolio.com"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-white/50 bg-white/60
                           focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground"
              />
            </div>
          </FieldRow>
          <FieldRow label="Instagram">
            <div className="relative">
              <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={instagram}
                onChange={e => setInstagram(e.target.value)}
                placeholder="@yourhandle"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-white/50 bg-white/60
                           focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground"
              />
            </div>
          </FieldRow>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <SaveButton onClick={handleSave} isPending={isPending} />
      </div>
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
          Aurora prioritises leads from these categories when scanning for opportunities.
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
   SECTION: Past Clients
═══════════════════════════════════════════════ */
function PastClientsSection({ isPending }: { isPending: boolean }) {
  const [clients, setClients] = useState<string[]>([]);

  return (
    <div className="space-y-5">
      <SectionCard>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Past clients & venues</p>
        <p className="text-[11px] text-muted-foreground mb-4">
          Aurora mentions these as social proof when writing outreach emails.
        </p>
        <PillInput
          pills={clients}
          onAdd={v => setClients(c => [...c, v])}
          onRemove={v => setClients(c => c.filter(x => x !== v))}
          placeholder="e.g. The Shard, Claridge's Hotel, Vogue…"
          hint={undefined}
        />
      </SectionCard>

      {clients.length > 0 && (
        <div className="flex justify-end">
          <SaveButton onClick={() => toast.success("Past clients saved!")} isPending={isPending} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SECTION: Email Connection
═══════════════════════════════════════════════ */
function EmailSection() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    fetch("/api/email/status")
      .then(r => r.json())
      .then(d => setConnected(!!d.connected))
      .catch(() => setConnected(false));
  }, []);

  const handleConnect = () => { window.location.href = "/api/email/connect"; };
  const handleDisconnect = () => {
    toast("To disconnect your inbox, visit your email provider's app permissions.");
  };

  return (
    <div className="space-y-4">
      {connected ? (
        <SectionCard>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                 style={{ background: "rgba(34,197,94,0.12)" }}>
              <Mail className="w-5 h-5 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color: "#131b2e" }}>Inbox connected</p>
              <p className="text-xs text-muted-foreground">Aurora can send outreach directly from your address</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-emerald-600">Live</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/40">
            <button onClick={handleDisconnect}
              className="text-xs text-muted-foreground hover:text-red-500 transition-colors font-medium">
              Disconnect inbox
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
              Send outreach directly from Aurora using your own email address — no copy-paste needed.
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
            "Aurora uses Nylas to send from your real inbox — emails land in Sent.",
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
}: {
  profile: UserProfile;
  onSave: (updates: Partial<UserProfile>) => void;
  isPending: boolean;
}) {
  const [maxFollowUps,    setMaxFollowUps]    = useState(3);
  const [dailySendLimit, setDailySendLimit]  = useState(10);
  const [weekdaysOnly,   setWeekdaysOnly]    = useState(true);
  const [tone,           setTone]            = useState<Tone>(profile.tone || "friendly");
  const [oppsPerWeek,    setOppsPerWeek]     = useState(profile.opportunitiesPerWeek || 5);

  const handleSave = () => onSave({ tone, opportunitiesPerWeek: oppsPerWeek });

  return (
    <div className="space-y-5">

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
            <p className="text-sm font-semibold" style={{ color: "#131b2e" }}>Max follow-ups per lead</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Aurora stops after this many follow-ups with no reply</p>
          </div>
          <Stepper value={maxFollowUps} min={1} max={7} onChange={setMaxFollowUps} />
        </div>

        <div className="flex items-center justify-between border-t border-white/40 pt-4">
          <div>
            <p className="text-sm font-semibold" style={{ color: "#131b2e" }}>Daily send limit</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Maximum emails sent per day across all leads</p>
          </div>
          <Stepper value={dailySendLimit} min={1} max={50} onChange={setDailySendLimit} />
        </div>

        <div className="flex items-center justify-between border-t border-white/40 pt-4">
          <div>
            <p className="text-sm font-semibold" style={{ color: "#131b2e" }}>Leads per week</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">How many new leads Aurora finds each week</p>
          </div>
          <Stepper value={oppsPerWeek} min={1} max={20} onChange={setOppsPerWeek} />
        </div>

        <div className="flex items-center justify-between border-t border-white/40 pt-4">
          <div>
            <p className="text-sm font-semibold" style={{ color: "#131b2e" }}>Weekdays only</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Don't send emails on Saturday or Sunday</p>
          </div>
          <Toggle on={weekdaysOnly} onChange={setWeekdaysOnly} />
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
function NotificationsSection() {
  const [replyAlerts,    setReplyAlerts]    = useState(true);
  const [weeklySummary,  setWeeklySummary]  = useState(true);

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
            <p className="font-bold text-sm" style={{ color: "#131b2e" }}>Aurora Pro</p>
            <p className="text-xs text-muted-foreground">Active subscription</p>
          </div>
          <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full text-white"
                style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
            Active
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Billing management is coming soon. To manage your subscription, contact{" "}
          <a href="mailto:hello@auroraoutreach.com" className="underline" style={{ color: ACCENT }}>
            hello@auroraoutreach.com
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
            onClick={() => toast.error("Please email hello@auroraoutreach.com to request account deletion.")}
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
        {/* Name + profession */}
        <div>
          <p className="text-sm font-extrabold leading-tight" style={{ color: "#131b2e" }}>
            {profile.businessName || profile.businessType || "Your Business"}
          </p>
          {profile.businessName && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{profile.businessType}</p>
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
  const { profile, setProfile } = useAurora();
  const [isPending, startTransition] = useTransition();
  const [activeSection, setActiveSection] = useState<Section>("my-profile");

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  /* ── Completion metric ── */
  const completionItems = [
    { done: !!profile.businessName },
    { done: !!profile.location },
    { done: !!profile.pitch },
    { done: profile.opportunityTypes.length > 0 },
    { done: !!profile.website || !!profile.instagram },
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
      case "my-profile":   return <MyProfileSection profile={profile} onSave={handleSave} isPending={isPending} />;
      case "my-work":      return <MyWorkSection profile={profile} onSave={handleSave} isPending={isPending} />;
      case "past-clients": return <PastClientsSection isPending={isPending} />;
      case "email":        return <EmailSection />;
      case "outreach":     return <OutreachSection profile={profile} onSave={handleSave} isPending={isPending} />;
      case "notifications":return <NotificationsSection />;
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
