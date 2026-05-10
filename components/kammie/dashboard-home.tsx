"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ApolloCompany } from "@/lib/apollo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useKammie } from "./kammie-app";
import { typeLabels, contactMethodLabels } from "@/lib/types";
import type { Opportunity, ContactMethodType } from "@/lib/types";
import { deleteOpportunity, updateOpportunity } from "@/lib/actions";
import { toast } from "sonner";
import {
  Sparkles, Mail, Loader2, MapPin, Star, ExternalLink,
  Instagram, Send, ChevronRight, Heart, Compass, Trash2,
  Phone, Globe, MessageCircle, Linkedin, Facebook, FileText,
  MoreHorizontal, X, Maximize2, RefreshCw, Crosshair,
  Clock, ChevronDown, CheckCircle2,
} from "lucide-react";

/* ─── Constants ──────────────────────────────── */
const ACCENT      = "#7c6ef7";
const ACCENT2     = "#9585f9";
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/* ─── Helpers ────────────────────────────────── */
function photoUrl(ref: string | undefined | null, maxWidth = 400) {
  return ref ? `/api/places/photo?ref=${encodeURIComponent(ref)}&maxWidth=${maxWidth}` : null;
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Pull the neighbourhood / suburb from a location string */
function neighbourhood(loc: string | undefined): string {
  if (!loc) return "";
  const parts = loc.split(",").map(p => p.trim()).filter(Boolean);
  // "123 High St, Shoreditch, London, UK"  → parts[1] = "Shoreditch"
  // "Venue Name, London"                   → parts[1] = "London"
  return parts.length > 1 ? parts[1] : parts[0] ?? "";
}

/* ═══════════════════════════════════════════════
   MetricCard
═══════════════════════════════════════════════ */
function MetricCard({
  label,
  value,
  sub,
  highlight = false,
  trend,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
  trend?: number;          // positive = up, negative = down
  onClick?: () => void;
}) {
  return (
    <div
      className={`glass-card rounded-2xl p-4 flex flex-col gap-1.5 border border-white/60 ${onClick ? "cursor-pointer transition-transform hover:scale-[1.02] hover:shadow-md active:scale-[0.99]" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none">
        {label}
      </p>
      <div className="flex items-end gap-1.5">
        <p
          className="text-[26px] font-extrabold leading-none"
          style={{ color: highlight ? "#ef4444" : "#131b2e" }}
        >
          {value}
        </p>
        {trend !== undefined && trend !== 0 && (
          <span
            className="text-[11px] font-bold mb-0.5 leading-none"
            style={{ color: trend > 0 ? "#22c55e" : "#f87171" }}
          >
            {trend > 0 ? `↑${trend}` : `↓${Math.abs(trend)}`}
          </span>
        )}
      </div>
      {sub && (
        <p
          className="text-[10px] leading-tight"
          style={{ color: highlight && (typeof value === "number" ? value > 0 : parseInt(value) > 0) ? "#fca5a5" : undefined }}
        >
          <span className="text-muted-foreground">{sub}</span>
        </p>
      )}
      {onClick && (
        <p className="text-[10px] font-semibold mt-0.5" style={{ color: ACCENT }}>
          View →
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   VenueTile  (2 × 2 grid card)
═══════════════════════════════════════════════ */
function VenueTile({
  opportunity,
  onClick,
  onRefresh,
}: {
  opportunity: Opportunity;
  onClick: () => void;
  onRefresh: () => Promise<void>;
}) {
  const photo = photoUrl(opportunity.photoReference);
  const hood  = neighbourhood(opportunity.location);

  const isOverdue  = opportunity.status === "sent" &&
    Date.now() - new Date(opportunity.updatedAt).getTime() > TWO_DAYS_MS;
  const isFollowUp = opportunity.status === "follow_up_due";
  const isHot      = opportunity.priority === "high";

  return (
    <div
      className="glass-card glass-card-hover rounded-2xl overflow-hidden flex flex-col cursor-pointer border border-white/60"
      onClick={onClick}
    >
      {/* ── Photo ── */}
      <div className="relative h-[130px] shrink-0 bg-gradient-to-br from-violet-100 to-purple-50">
        {photo ? (
          <img
            src={photo}
            alt={opportunity.name}
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full fluid-gradient-subtle flex items-center justify-center">
            <MapPin className="w-7 h-7 text-primary/30" />
          </div>
        )}

        {/* Status badge — top-left */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {isHot && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shadow-sm"
              style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
            >
              🔥 Hot
            </span>
          )}
          {(isOverdue || isFollowUp) && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white shadow-sm">
              Follow-up
            </span>
          )}
        </div>

        {/* Rating — bottom-right */}
        {opportunity.rating && (
          <div className="absolute bottom-2 right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-sm">
            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
            <span className="text-[10px] font-bold text-white">
              {opportunity.rating.toFixed(1)}
            </span>
          </div>
        )}

        {/* AI source dot — top-right */}
        {opportunity.source === "aurora_ai" && (
          <div
            className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
            style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
          >
            <Sparkles className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>

      {/* ── Info ── */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="min-w-0">
          <h3
            className="font-bold text-xs leading-tight line-clamp-2"
            style={{ color: "#131b2e" }}
          >
            {opportunity.name}
          </h3>
          {hood && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{hood}</p>
          )}
        </div>

        {/* ── Action row ── */}
        <div className="flex items-center gap-1.5 mt-auto">
          <button
            onClick={e => { e.stopPropagation(); onClick(); }}
            className="flex-1 h-7 rounded-xl text-[11px] font-bold text-white flex items-center justify-center gap-1 transition-all active:scale-[0.97] hover:opacity-90"
            style={{
              background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`,
              boxShadow: `0 3px 10px rgba(124,110,247,0.28)`,
            }}
          >
            <Send className="w-2.5 h-2.5" />
            Send now
          </button>
          <button
            onClick={async e => {
              e.stopPropagation();
              await updateOpportunity(opportunity.id, { liked: !opportunity.liked });
              await onRefresh();
            }}
            className="w-7 h-7 rounded-xl glass-card border border-white/70 flex items-center justify-center transition-all hover:bg-primary/10"
          >
            <Heart
              className={`w-3 h-3 ${opportunity.liked ? "fill-primary text-primary" : "text-muted-foreground"}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   ActivityItem
═══════════════════════════════════════════════ */
type ActivityEvent = {
  id: string;
  type: "reply" | "sent" | "new";
  name: string;
  time: string;
};

const ACTIVITY_CONFIG: Record<ActivityEvent["type"], {
  icon: typeof Send;
  color: string;
  bg: string;
  label: (name: string) => string;
}> = {
  reply: {
    icon: MessageCircle,
    color: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    label: name => `Reply received from ${name}`,
  },
  sent: {
    icon: Send,
    color: ACCENT,
    bg: "rgba(124,110,247,0.12)",
    label: name => `Message sent to ${name}`,
  },
  new: {
    icon: Sparkles,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    label: name => `New lead found: ${name}`,
  },
};

function ActivityItem({ event }: { event: ActivityEvent }) {
  const cfg  = ACTIVITY_CONFIG[event.type];
  const Icon = cfg.icon;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: cfg.bg }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
      </div>
      <p className="flex-1 text-xs min-w-0 truncate">
        <span className="font-semibold" style={{ color: "#131b2e" }}>
          {cfg.label(event.name)}
        </span>
      </p>
      <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
        {relativeTime(event.time)}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Main Dashboard Home
═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   B2BSuggestedTile — Apollo ICP result on homepage
═══════════════════════════════════════════════ */
function B2BSuggestedTile({
  company,
  onDiscover,
}: {
  company: ApolloCompany;
  onDiscover: () => void;
}) {
  const [logoFailed, setLogoFailed] = useState(false);

  const domain = company.primary_domain
    ?? (company.website_url
      ? (() => { try { return new URL(company.website_url!).hostname.replace(/^www\./, ""); } catch { return null; } })()
      : null);

  const logoSrc = !logoFailed && (
    company.logo_url
      ? `/api/logo?url=${encodeURIComponent(company.logo_url)}`
      : domain
        ? `/api/logo?domain=${encodeURIComponent(domain)}`
        : null
  );

  const initStr = company.name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className="glass-card glass-card-hover rounded-2xl overflow-hidden flex flex-col cursor-pointer border border-white/60"
      onClick={onDiscover}
    >
      {/* Logo area */}
      <div className="relative h-[88px] shrink-0 bg-gradient-to-br from-violet-50 to-purple-50/30 flex items-center justify-center p-3">
        {logoSrc ? (
          <img
            src={logoSrc}
            alt={company.name}
            className="max-h-12 max-w-[140px] object-contain"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-base shrink-0"
            style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
          >
            {initStr}
          </div>
        )}
        {/* Suggested badge */}
        <span
          className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: `rgba(124,110,247,0.12)`, color: ACCENT }}
        >
          Suggested
        </span>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="min-w-0">
          <h3 className="font-bold text-xs leading-tight line-clamp-1" style={{ color: "#131b2e" }}>
            {company.name}
          </h3>
          {company.industry && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{company.industry}</p>
          )}
          {company.short_description && (
            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
              {company.short_description}
            </p>
          )}
        </div>

        <button
          onClick={e => { e.stopPropagation(); onDiscover(); }}
          className="mt-auto flex-1 h-7 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all active:scale-[0.97] border"
          style={{ color: ACCENT, borderColor: `${ACCENT}30` }}
        >
          View in Discover →
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   B2BLeadTile — company logo + name + CTA
═══════════════════════════════════════════════ */
function B2BLeadTile({
  opportunity,
  onClick,
  onRefresh,
}: {
  opportunity: Opportunity;
  onClick: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  const domain = opportunity.website
    ? (() => { try { return new URL(opportunity.website!).hostname.replace(/^www\./, ""); } catch { return null; } })()
    : null;

  const initStr = opportunity.name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className="glass-card glass-card-hover rounded-2xl overflow-hidden flex flex-col cursor-pointer border border-white/60"
      onClick={onClick}
    >
      {/* Logo area */}
      <div className="relative h-[88px] shrink-0 bg-gradient-to-br from-violet-50 to-purple-50/30 flex items-center justify-center p-3">
        {domain && !imgFailed ? (
          <img
            src={`/api/logo?domain=${encodeURIComponent(domain)}`}
            alt={opportunity.name}
            className="max-h-12 max-w-[140px] object-contain"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-base shrink-0"
            style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
          >
            {initStr}
          </div>
        )}

        {opportunity.priority === "high" && (
          <span
            className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shadow-sm"
            style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
          >
            🔥 Hot
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="min-w-0">
          <h3
            className="font-bold text-xs leading-tight line-clamp-2"
            style={{ color: "#131b2e" }}
          >
            {opportunity.name}
          </h3>
          {opportunity.contactTitle && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {opportunity.contactTitle}
            </p>
          )}
          {opportunity.whyGoodFit && (
            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
              {opportunity.whyGoodFit}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 mt-auto">
          <button
            onClick={e => { e.stopPropagation(); onClick(); }}
            className="flex-1 h-7 rounded-xl text-[11px] font-bold text-white flex items-center justify-center gap-1 transition-all active:scale-[0.97] hover:opacity-90"
            style={{
              background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`,
              boxShadow: `0 3px 10px rgba(124,110,247,0.28)`,
            }}
          >
            <Send className="w-2.5 h-2.5" />
            Reach out
          </button>
          <button
            onClick={async e => {
              e.stopPropagation();
              await updateOpportunity(opportunity.id, { liked: !opportunity.liked });
              await onRefresh();
            }}
            className="w-7 h-7 rounded-xl glass-card border border-white/70 flex items-center justify-center transition-all hover:bg-primary/10"
          >
            <Heart
              className={`w-3 h-3 ${opportunity.liked ? "fill-primary text-primary" : "text-muted-foreground"}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Main Dashboard Home
═══════════════════════════════════════════════ */
export function DashboardHome() {
  const { setActiveTab, profile, opportunities, refreshData, goToProfileSection, goToOutreachStage } = useKammie();

  const isB2B = !!(profile?.companyAnalysis || profile?.icp);

  const [selectedOpp,          setSelectedOpp]          = useState<Opportunity | null>(null);
  const [viewingOpp,            setViewingOpp]            = useState<Opportunity | null>(null);
  const [showAll,               setShowAll]               = useState(false);
  const [isOutreachDialogOpen,  setIsOutreachDialogOpen]  = useState(false);
  const [greeting,              setGreeting]              = useState("Welcome");
  const [emailConnected,        setEmailConnected]        = useState<boolean | null>(null);
  const [suggestedCompanies,    setSuggestedCompanies]    = useState<ApolloCompany[]>([]);
  const [loadingSuggestions,    setLoadingSuggestions]    = useState(false);

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12)      setGreeting("Good morning");
    else if (h < 17) setGreeting("Good afternoon");
    else             setGreeting("Good evening");
  }, []);

  useEffect(() => {
    fetch("/api/email/status")
      .then(r => r.json())
      .then(d => setEmailConnected(d.connected))
      .catch(() => setEmailConnected(false));
  }, []);

  // B2B: fetch ICP-matched company suggestions to show on homepage
  useEffect(() => {
    if (!isB2B || !profile?.icp) return;
    let cancelled = false;
    const load = async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch("/api/apollo/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ icp: profile.icp }),
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setSuggestedCompanies((data.companies ?? []).slice(0, 4));
        }
      } catch { /* non-fatal */ }
      finally { if (!cancelled) setLoadingSuggestions(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [isB2B, profile?.icp]);

  const now       = Date.now();
  const firstName = profile?.businessName?.split(" ")[0] || "";

  /* ── Metric: Sent this week ── */
  const sentThisWeek = opportunities.filter(o =>
    (o.status === "sent" || o.status === "follow_up_due" || o.status === "replied") &&
    now - new Date(o.updatedAt).getTime() < ONE_WEEK_MS
  ).length;

  const sentLastWeek = opportunities.filter(o =>
    (o.status === "sent" || o.status === "follow_up_due" || o.status === "replied") &&
    now - new Date(o.updatedAt).getTime() >= ONE_WEEK_MS &&
    now - new Date(o.updatedAt).getTime() < ONE_WEEK_MS * 2
  ).length;

  const sentTrend = sentThisWeek - sentLastWeek;

  /* ── Metric: Response rate ── */
  const totalSent    = opportunities.filter(o =>
    o.status === "sent" || o.status === "follow_up_due" || o.status === "replied"
  ).length;
  const totalReplied = opportunities.filter(o => o.status === "replied").length;
  const responseRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;

  /* ── Metric: Follow-ups due ── */
  const followUpsDue = opportunities.filter(o => o.status === "follow_up_due").length;
  const overdueCount = opportunities.filter(o =>
    o.status === "sent" && now - new Date(o.updatedAt).getTime() > TWO_DAYS_MS
  ).length;
  const totalFollowUps = followUpsDue + overdueCount;

  /* ── Metric: New leads ── */
  const newLeads       = opportunities.filter(o => o.status === "new" || o.status === "outreach_ready").length;
  const readyToContact = opportunities.filter(o => o.status === "outreach_ready").length;

  /* ── Venue tiles: photos-first for freelancers; priority-first for B2B ── */
  const venueTiles = [...opportunities]
    .sort((a, b) => {
      if (isB2B) {
        return ({ high: 3, medium: 2, low: 1 }[b.priority]) - ({ high: 3, medium: 2, low: 1 }[a.priority]);
      }
      const aScore = (a.photoReference ? 100 : 0) + ({ high: 3, medium: 2, low: 1 }[a.priority]);
      const bScore = (b.photoReference ? 100 : 0) + ({ high: 3, medium: 2, low: 1 }[b.priority]);
      return bScore - aScore;
    })
    .slice(0, 4);

  /* ── "Do this today" data ── */
  const overdueOpps = opportunities
    .filter(o => o.status === "sent" && now - new Date(o.updatedAt).getTime() > TWO_DAYS_MS)
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

  const topOverdue = overdueOpps[0] ?? null;

  const readyToSend = opportunities
    .filter(o => o.status === "outreach_ready" || o.status === "new")
    .sort((a, b) => (
      { high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]
    ));

  const visibleReady   = showAll ? readyToSend : readyToSend.slice(0, 3);
  const visibleOverdue = showAll ? overdueOpps  : (topOverdue ? [topOverdue] : []);
  const hiddenCount    = Math.max(0, readyToSend.length - 3) + Math.max(0, overdueOpps.length - 1);
  const hasAnything    = overdueOpps.length > 0 || readyToSend.length > 0;
  const todayCount     = visibleOverdue.length + visibleReady.length;

  /* ── Recent activity (last 3 meaningful events) ── */
  const recentActivity: ActivityEvent[] = [...opportunities]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8)
    .map(o => ({
      id:   o.id,
      type: (o.status === "replied"
              ? "reply"
              : (o.status === "sent" || o.status === "follow_up_due")
                ? "sent"
                : "new") as ActivityEvent["type"],
      name: o.name,
      time: o.updatedAt,
    }))
    .slice(0, 3);

  /* ── Opportunity detail view (full-page take-over) ── */
  if (viewingOpp) {
    return (
      <OpportunityDetailView
        opportunity={viewingOpp}
        onBack={() => setViewingOpp(null)}
        onRefresh={refreshData}
      />
    );
  }

  return (
    <div className="space-y-6">

      {/* ══════════════════════════════════════
          GREETING + 4 METRIC CARDS
      ══════════════════════════════════════ */}
      <div>
        {/* Greeting row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-extrabold leading-snug" style={{ color: "#131b2e" }}>
              {greeting}{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {hasAnything
                ? `${followUpsDue} follow-up${followUpsDue !== 1 ? 's' : ''} due, ${readyToContact} prospect${readyToContact !== 1 ? 's' : ''} ready to contact`
                : "You're all caught up — ready to find new leads"}
            </p>
          </div>
          {/* TODO: Daily Insight — wire to AI-generated briefing modal (top 3 actions) */}
        </div>

        {/* ── Connect email banner — shown only when email is not connected ── */}
        {emailConnected === false && (
          <div
            className="flex items-center justify-between gap-4 rounded-2xl px-5 py-4 mb-4 border border-[#c4bbfd]/40"
            style={{
              background: "linear-gradient(135deg, rgba(124,110,247,0.10) 0%, rgba(149,133,249,0.06) 100%)",
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                style={{ background: "linear-gradient(135deg,#7c6ef7,#9585f9)" }}
              >
                <Mail className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm text-muted-foreground leading-snug">
                <span className="font-bold" style={{ color: "#131b2e" }}>Connect your inbox</span>{" "}
                to start sending directly from Kammie — no copy-paste needed.
              </p>
            </div>
            <button
              onClick={() => goToProfileSection("email")}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#7c6ef7,#9585f9)" }}
            >
              Connect email
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Sent this week"
            value={sentThisWeek}
            trend={sentTrend}
            sub={sentLastWeek > 0 ? `vs ${sentLastWeek} last week` : "Your first reply is one send away"}
            onClick={() => goToOutreachStage("sent")}
          />
          <MetricCard
            label="Response rate"
            value={`${responseRate}%`}
            sub={
              totalReplied > 0
                ? `${totalReplied} ${totalReplied === 1 ? "reply" : "replies"} received`
                : "Replies will show here"
            }
            onClick={() => goToOutreachStage("replied")}
          />
          <MetricCard
            label="Follow-ups due"
            value={totalFollowUps}
            highlight={totalFollowUps > 0}
            sub={overdueCount > 0 ? `${overdueCount} overdue` : "All up to date"}
            onClick={() => goToOutreachStage("sent")}
          />
          <MetricCard
            label="New leads found"
            value={newLeads}
            sub={
              readyToContact > 0
                ? `${readyToContact} ready to contact`
                : "Discover more leads"
            }
            onClick={() => setActiveTab("discover")}
          />
        </div>
      </div>

      {/* ══════════════════════════════════════
          MAIN SPLIT: Venue Grid  |  Do This Today
      ══════════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row lg:gap-6 lg:items-start gap-5">

        {/* ── Left: 2×2 Venue Tiles ── */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* Section header */}
          <div className="flex items-center justify-between px-0.5">
            <h2 className="font-extrabold text-base" style={{ color: "#131b2e" }}>
              {isB2B
                ? (venueTiles.length > 0 ? "Saved companies" : "Suggested for you")
                : (profile?.icp ? "Suggested leads" : "Suggested venues")}
            </h2>
            <button
              className="text-xs font-bold hover:underline transition-colors"
              style={{ color: ACCENT }}
              onClick={() => setActiveTab("discover")}
            >
              See all →
            </button>
          </div>

          {/* ── B2B: saved leads OR ICP suggestions ── */}
          {isB2B ? (
            venueTiles.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {venueTiles.map(opp => (
                  <B2BLeadTile
                    key={opp.id}
                    opportunity={opp}
                    onClick={() => setViewingOpp(opp)}
                    onRefresh={refreshData}
                  />
                ))}
              </div>
            ) : loadingSuggestions ? (
              <div className="grid grid-cols-2 gap-3">
                {[0,1,2,3].map(i => (
                  <div key={i} className="glass-card rounded-2xl h-[160px] animate-pulse"
                       style={{ background: "rgba(124,110,247,0.05)" }} />
                ))}
              </div>
            ) : suggestedCompanies.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {suggestedCompanies.map(co => (
                  <B2BSuggestedTile
                    key={co.id}
                    company={co}
                    onDiscover={() => setActiveTab("discover")}
                  />
                ))}
              </div>
            ) : (
              <div className="glass-panel rounded-3xl p-10 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3 shadow-lg"
                     style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 8px 24px rgba(124,110,247,0.28)` }}>
                  <Compass className="w-7 h-7 text-white" />
                </div>
                <p className="font-bold text-sm mb-1" style={{ color: "#131b2e" }}>No suggestions yet</p>
                <p className="text-xs text-muted-foreground mb-4 max-w-[200px] mx-auto leading-relaxed">
                  Complete your ICP in your profile to get matched companies
                </p>
                <button onClick={() => goToProfileSection("my-profile")}
                  className="rounded-2xl font-bold text-white px-5 py-2 text-sm hover:opacity-90 transition-all"
                  style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
                  Set up ICP
                </button>
              </div>
            )
          ) : (
            /* ── Freelancer: venue tiles ── */
            venueTiles.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {venueTiles.map(opp => (
                  <VenueTile
                    key={opp.id}
                    opportunity={opp}
                    onClick={() => setViewingOpp(opp)}
                    onRefresh={refreshData}
                  />
                ))}
              </div>
            ) : (
              <div className="glass-panel rounded-3xl p-10 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3 shadow-lg"
                     style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 8px 24px rgba(124,110,247,0.28)` }}>
                  <Compass className="w-7 h-7 text-white" />
                </div>
                <p className="font-bold text-sm mb-1" style={{ color: "#131b2e" }}>
                  {profile?.icp ? "No prospects yet" : "No venues yet"}
                </p>
                <p className="text-xs text-muted-foreground mb-4 max-w-[200px] mx-auto leading-relaxed">
                  {profile?.icp
                    ? "Discover companies matching your ICP and start outreach"
                    : "Find your first opportunities and grow your business"}
                </p>
                <button onClick={() => setActiveTab("discover")}
                  className="rounded-2xl font-bold text-white px-5 py-2 text-sm hover:opacity-90 transition-all"
                  style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
                  Discover Opportunities
                </button>
              </div>
            )
          )}
        </div>

        {/* ── Right: "Do this today" sidebar (340 px) ── */}
        <div className="w-full lg:w-[340px] lg:shrink-0 space-y-3">

          {/* Section header */}
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-base" style={{ color: "#131b2e" }}>
                Do this today
              </h2>
              {todayCount > 0 && (
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `rgba(124,110,247,0.12)`, color: ACCENT }}
                >
                  {todayCount}
                </span>
              )}
            </div>
            {readyToSend.length > 0 && (
              <button
                className="text-xs font-bold hover:underline transition-colors"
                style={{ color: ACCENT }}
                onClick={() => setActiveTab("discover")}
              >
                Find more →
              </button>
            )}
          </div>

          {/* All caught up */}
          {!hasAnything && (
            <div className="glass-panel rounded-3xl p-6 text-center">
              <div
                className="w-11 h-11 mx-auto rounded-2xl flex items-center justify-center mb-3 shadow-md"
                style={{
                  background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`,
                  boxShadow: `0 6px 18px rgba(124,110,247,0.3)`,
                }}
              >
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-sm mb-1" style={{ color: "#131b2e" }}>
                All caught up!
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                No actions due. Kammie will surface new opportunities.
              </p>
            </div>
          )}

          {/* Overdue follow-up cards */}
          {visibleOverdue.map(opp => (
            <OverdueFollowUpCard
              key={opp.id}
              opportunity={opp}
              onClick={() => setViewingOpp(opp)}
            />
          ))}

          {/* Ready-to-send cards */}
          {visibleReady.map(opp => (
            <PriorityActionCard
              key={opp.id}
              opportunity={opp}
              onClick={() => setViewingOpp(opp)}
              onRefresh={refreshData}
            />
          ))}

          {/* Expand */}
          {hiddenCount > 0 && !showAll && (
            <button
              className="w-full py-3 text-sm font-bold text-center rounded-2xl glass-card glass-card-hover flex items-center justify-center gap-1.5 transition-all"
              style={{ color: ACCENT }}
              onClick={() => setShowAll(true)}
            >
              <ChevronDown className="w-4 h-4" />
              {hiddenCount} more {hiddenCount === 1 ? "opportunity" : "opportunities"} waiting
            </button>
          )}

          {showAll && hiddenCount > 0 && (
            <button
              className="w-full py-2.5 text-sm font-semibold text-center rounded-2xl glass-card glass-card-hover transition-all text-muted-foreground"
              onClick={() => setShowAll(false)}
            >
              Show less
            </button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
          RECENT ACTIVITY STRIP
      ══════════════════════════════════════ */}
      {recentActivity.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="font-extrabold text-sm" style={{ color: "#131b2e" }}>
              Recent activity
            </h2>
            <button
              className="text-xs font-bold hover:underline transition-colors"
              style={{ color: ACCENT }}
              onClick={() => setActiveTab("outreach")}
            >
              View all →
            </button>
          </div>
          <div className="glass-card rounded-2xl overflow-hidden border border-white/60 divide-y divide-white/40">
            {recentActivity.map((event, i) => (
              <ActivityItem key={event.id + "-" + i} event={event} />
            ))}
          </div>
        </div>
      )}

      {/* Outreach method dialog */}
      <OutreachMethodDialog
        opportunity={selectedOpp}
        isOpen={isOutreachDialogOpen}
        onClose={() => { setIsOutreachDialogOpen(false); setSelectedOpp(null); }}
        onSelectMethod={() => {
          setIsOutreachDialogOpen(false);
          setSelectedOpp(null);
          setActiveTab("outreach");
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Overdue Follow-Up Card — amber theme
═══════════════════════════════════════════════ */
function OverdueFollowUpCard({
  opportunity,
  onClick,
}: {
  opportunity: Opportunity;
  onClick: () => void;
}) {
  const days  = daysSince(opportunity.updatedAt);
  const thumb = photoUrl(opportunity.photoReference);

  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: "linear-gradient(135deg, rgba(251,191,36,0.10) 0%, rgba(245,158,11,0.06) 100%)",
        border: "1px solid rgba(251,191,36,0.35)",
        boxShadow: "0 2px 16px rgba(245,158,11,0.08)",
      }}
      onClick={onClick}
    >
      {/* Amber label bar */}
      <div className="px-4 pt-3 pb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: "rgba(245,158,11,0.15)" }}
          >
            <Clock className="w-3 h-3 text-amber-600" />
          </div>
          <span className="text-xs font-bold text-amber-700">Follow up overdue</span>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
          {days}d ago
        </span>
      </div>

      {/* Card body */}
      <div className="flex items-stretch mx-4 mb-4 gap-3">
        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 relative bg-amber-50">
          {thumb ? (
            <img
              src={thumb}
              alt={opportunity.name}
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MapPin className="w-5 h-5 text-amber-400" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5">
          <div>
            <h3 className="font-bold text-sm leading-tight truncate" style={{ color: "#131b2e" }}>
              {opportunity.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] text-muted-foreground">{typeLabels[opportunity.type]}</span>
              {opportunity.rating && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                    {opportunity.rating.toFixed(1)}
                  </span>
                </>
              )}
            </div>
            {opportunity.whyGoodFit && (
              <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 leading-relaxed">
                {opportunity.whyGoodFit}
              </p>
            )}
          </div>

          {/* CTA */}
          <button
            onClick={e => { e.stopPropagation(); onClick(); }}
            className="self-start inline-flex items-center gap-1.5 h-7 px-3 rounded-xl text-xs font-bold text-white transition-all active:scale-[0.97] hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #d97706, #f59e0b)",
              boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
            }}
          >
            <Send className="w-3 h-3" />
            Send follow-up
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Priority Action Card — violet theme
═══════════════════════════════════════════════ */
function PriorityActionCard({
  opportunity,
  onClick,
  onRefresh,
}: {
  opportunity: Opportunity;
  onClick: () => void;
  onRefresh: () => Promise<void>;
}) {
  const thumb = photoUrl(opportunity.photoReference);

  return (
    <div
      className="glass-card glass-card-hover rounded-2xl overflow-hidden cursor-pointer border-l-[3px]"
      style={{ borderLeftColor: ACCENT }}
      onClick={onClick}
    >
      <div className="flex items-stretch">
        {/* Thumbnail */}
        <div className="w-[72px] shrink-0 relative self-stretch min-h-[92px]">
          {thumb ? (
            <img
              src={thumb}
              alt={opportunity.name}
              className="w-full h-full object-cover absolute inset-0"
              onError={e => {
                const t = e.target as HTMLImageElement;
                t.style.display = "none";
                (t.nextElementSibling as HTMLElement)?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div className={`w-full h-full fluid-gradient-subtle flex items-center justify-center ${thumb ? "hidden" : ""}`}>
            <MapPin className="w-5 h-5 text-primary/40" />
          </div>
          {/* AI badge */}
          {opportunity.source === "aurora_ai" && (
            <div
              className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full flex items-center justify-center shadow-sm"
              style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
            >
              <Sparkles className="w-2 h-2 text-white" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 flex-1 min-w-0 flex flex-col gap-1.5">
          {/* Name + heart */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-sm leading-tight line-clamp-1" style={{ color: "#131b2e" }}>
              {opportunity.name}
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              {opportunity.priority === "high" && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: `rgba(124,110,247,0.12)`, color: ACCENT }}
                >
                  Hot
                </span>
              )}
              <button
                onClick={async e => {
                  e.stopPropagation();
                  await updateOpportunity(opportunity.id, { liked: !opportunity.liked });
                  await onRefresh();
                }}
                className="w-6 h-6 rounded-full flex items-center justify-center transition-colors bg-white/50 hover:bg-primary/10"
              >
                <Heart className={`w-3 h-3 ${opportunity.liked ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
            </div>
          </div>

          {/* Type + rating */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>{typeLabels[opportunity.type]}</span>
            {opportunity.rating && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  {opportunity.rating.toFixed(1)}
                </span>
              </>
            )}
          </div>

          {/* Why good fit */}
          {opportunity.whyGoodFit && (
            <p className="text-[11px] text-muted-foreground line-clamp-1 leading-relaxed">
              {opportunity.whyGoodFit}
            </p>
          )}

          {/* CTA */}
          <div className="mt-auto pt-0.5">
            <button
              onClick={e => { e.stopPropagation(); onClick(); }}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-xl text-xs font-bold text-white transition-all active:scale-[0.97] hover:opacity-90"
              style={{
                background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`,
                boxShadow: `0 4px 12px rgba(124,110,247,0.3)`,
              }}
            >
              <Send className="w-3 h-3" />
              Send now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Legacy Opportunity Action Card
   (kept for OutreachPage / other consumers)
═══════════════════════════════════════════════ */
function OpportunityActionCard({
  opportunity,
  onStartOutreach,
  onClick,
  onRefresh,
}: {
  opportunity: Opportunity;
  onStartOutreach: () => void;
  onClick: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [isEnriching, setIsEnriching] = useState(false);

  const handleReEnrich = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!opportunity.website) { toast.error("No website to enrich"); return; }
    setIsEnriching(true);
    try {
      const res  = await fetch("/api/re-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: opportunity.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Found ${data.contactMethodsAdded} contacts`);
        await onRefresh();
      } else {
        toast.error(data.error || "Failed to refresh");
      }
    } catch { toast.error("Failed to refresh contacts"); }
    finally { setIsEnriching(false); }
  };

  const hasWebsite     = opportunity.website || opportunity.contactMethods.some(c => c.type === "website");
  const hasContactForm = opportunity.contactForm || opportunity.contactMethods.some(c => c.type === "contact_form");
  const hasEmail       = opportunity.contactMethods.some(c => c.type === "email");
  const hasInstagram   = opportunity.contactMethods.some(c => c.type === "instagram");
  const hasPhone       = opportunity.contactMethods.some(c => c.type === "phone");
  const hasFacebook    = opportunity.contactMethods.some(c => c.type === "facebook");
  const hasLinkedin    = opportunity.contactMethods.some(c => c.type === "linkedin");
  const emailValue     = opportunity.contactMethods.find(c => c.type === "email")?.value;
  const instagramValue = opportunity.contactMethods.find(c => c.type === "instagram")?.value;
  const contactFormUrl = opportunity.contactForm?.url || opportunity.contactMethods.find(c => c.type === "contact_form")?.value;
  const contactFormLabel = opportunity.contactForm?.label || "Contact Form";
  const contactCount   = [hasWebsite, hasContactForm, hasEmail, hasInstagram, hasPhone, hasFacebook, hasLinkedin].filter(Boolean).length;
  const photo          = photoUrl(opportunity.photoReference);

  return (
    <div
      className="glass-card glass-card-hover rounded-2xl overflow-hidden cursor-pointer border-l-4"
      style={{ borderLeftColor: ACCENT }}
      onClick={onClick}
    >
      <div className="flex">
        {/* Thumbnail */}
        <div className="w-24 shrink-0 relative self-stretch min-h-[88px]">
          {photo
            ? <img src={photo} alt={opportunity.name} className="w-full h-full object-cover absolute inset-0"
                   onError={e => {
                     const t = e.target as HTMLImageElement;
                     t.style.display = "none";
                     t.nextElementSibling?.classList.remove("hidden");
                   }} />
            : null}
          <div className={`w-full h-full fluid-gradient-subtle flex items-center justify-center ${photo ? "hidden" : ""}`}>
            <MapPin className="w-6 h-6 text-primary/40" />
          </div>
          {opportunity.source === "aurora_ai" && (
            <div
              className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
              style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
            >
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-sm leading-tight line-clamp-1" style={{ color: "#131b2e" }}>
              {opportunity.name}
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              {opportunity.priority === "high" && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: `rgba(124,110,247,0.12)`, color: ACCENT }}
                >
                  Hot
                </span>
              )}
              <button
                onClick={async e => {
                  e.stopPropagation();
                  await updateOpportunity(opportunity.id, { liked: !opportunity.liked });
                  await onRefresh();
                }}
                className="w-6 h-6 rounded-full flex items-center justify-center transition-colors bg-white/50 hover:bg-primary/10"
              >
                <Heart className={`w-3 h-3 ${opportunity.liked ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
            <span>{typeLabels[opportunity.type]}</span>
            {opportunity.rating && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  {opportunity.rating.toFixed(1)}
                </span>
              </>
            )}
          </div>

          {(hasEmail || hasInstagram) && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground overflow-hidden">
              {hasEmail && emailValue && (
                <span className="flex items-center gap-1 truncate max-w-[110px]">
                  <Mail className="w-2.5 h-2.5 shrink-0 text-primary/60" />
                  <span className="truncate">{emailValue}</span>
                </span>
              )}
              {hasInstagram && instagramValue && !hasEmail && (
                <span className="flex items-center gap-1 truncate">
                  <Instagram className="w-2.5 h-2.5 shrink-0 text-pink-500" />
                  <span className="truncate">
                    {instagramValue.replace("https://instagram.com/", "@").replace("https://www.instagram.com/", "@")}
                  </span>
                </span>
              )}
            </div>
          )}

          {opportunity.whyGoodFit && (
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
              {opportunity.whyGoodFit}
            </p>
          )}

          {/* Action row */}
          <div className="flex flex-wrap gap-1.5 mt-auto pt-0.5">
            {hasContactForm && contactFormUrl && (
              <button
                onClick={e => { e.stopPropagation(); window.open(contactFormUrl, "_blank"); }}
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-bold text-white shadow-sm active:scale-[0.97]"
                style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
              >
                <FileText className="w-2.5 h-2.5" />
                {contactFormLabel.length > 12 ? "Apply" : contactFormLabel}
              </button>
            )}
            {hasWebsite && !hasContactForm && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  const u = opportunity.website || opportunity.contactMethods.find(c => c.type === "website")?.value;
                  if (u) window.open(u, "_blank");
                }}
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold glass-card border border-white/70 text-foreground"
              >
                <Globe className="w-2.5 h-2.5" />Web
              </button>
            )}
            {hasEmail && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  const em = opportunity.contactMethods.find(c => c.type === "email")?.value;
                  if (em) window.location.href = `mailto:${em}`;
                }}
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold glass-card border border-white/70 text-foreground"
              >
                <Mail className="w-2.5 h-2.5 text-primary/70" />Email
              </button>
            )}
            {hasInstagram && (
              <button
                title="Instagram"
                onClick={e => {
                  e.stopPropagation();
                  const ig = opportunity.contactMethods.find(c => c.type === "instagram")?.value;
                  if (ig) {
                    const h = ig.replace("@", "").replace("https://instagram.com/", "").replace("https://www.instagram.com/", "");
                    window.open(`https://instagram.com/${h}`, "_blank");
                  }
                }}
                className="w-6 h-6 rounded-full glass-card border border-white/70 flex items-center justify-center"
              >
                <Instagram className="w-3 h-3 text-pink-500" />
              </button>
            )}
            {hasFacebook && (
              <button
                title="Facebook"
                onClick={e => {
                  e.stopPropagation();
                  const fb = opportunity.contactMethods.find(c => c.type === "facebook")?.value;
                  if (fb) window.open(fb.startsWith("http") ? fb : `https://facebook.com/${fb}`, "_blank");
                }}
                className="w-6 h-6 rounded-full glass-card border border-white/70 flex items-center justify-center"
              >
                <Facebook className="w-3 h-3 text-blue-600" />
              </button>
            )}
            {hasLinkedin && (
              <button
                title="LinkedIn"
                onClick={e => {
                  e.stopPropagation();
                  const li = opportunity.contactMethods.find(c => c.type === "linkedin")?.value;
                  if (li) window.open(li.startsWith("http") ? li : `https://linkedin.com/company/${li}`, "_blank");
                }}
                className="w-6 h-6 rounded-full glass-card border border-white/70 flex items-center justify-center"
              >
                <Linkedin className="w-3 h-3 text-blue-700" />
              </button>
            )}
            {hasWebsite && (
              <button
                title="Refresh contacts"
                onClick={handleReEnrich}
                disabled={isEnriching}
                className="w-6 h-6 rounded-full glass-card border border-white/70 flex items-center justify-center"
              >
                <RefreshCw className={`w-3 h-3 text-muted-foreground ${isEnriching ? "animate-spin" : ""}`} />
              </button>
            )}
            {contactCount === 0 && !hasWebsite && (
              <button
                onClick={e => { e.stopPropagation(); onStartOutreach(); }}
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-bold text-white shadow-sm"
                style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
              >
                <Send className="w-2.5 h-2.5" />Outreach
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Outreach Method Dialog
═══════════════════════════════════════════════ */
function OutreachMethodDialog({
  opportunity,
  isOpen,
  onClose,
  onSelectMethod,
}: {
  opportunity: Opportunity | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectMethod: (m: string) => void;
}) {
  if (!opportunity) return null;

  const methods = [
    {
      id: "website",
      icon: ExternalLink,
      label: "Website Form",
      description: "Fill out their contact form",
      available: opportunity.website || opportunity.contactMethods.some(c => c.type === "contact_form"),
      action: () => {
        const u = opportunity.website || opportunity.contactMethods.find(c => c.type === "contact_form")?.value;
        if (u) window.open(u, "_blank");
      },
    },
    {
      id: "email",
      icon: Mail,
      label: "Email",
      description: "Send a professional email",
      available: opportunity.contactMethods.some(c => c.type === "email"),
      action: () => {
        const em = opportunity.contactMethods.find(c => c.type === "email")?.value;
        if (em) window.location.href = `mailto:${em}`;
      },
    },
    {
      id: "instagram",
      icon: Instagram,
      label: "Instagram DM",
      description: "Send a direct message",
      available: opportunity.contactMethods.some(c => c.type === "instagram"),
      action: () => {
        const ig = opportunity.contactMethods.find(c => c.type === "instagram")?.value;
        if (ig) {
          const h = ig.replace("@", "").replace("https://instagram.com/", "");
          window.open(`https://instagram.com/${h}`, "_blank");
        }
      },
    },
  ].filter(m => m.available);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-3xl glass-panel border-white/60">
        <DialogHeader>
          <DialogTitle className="font-bold" style={{ color: "#131b2e" }}>
            Choose Outreach Method
          </DialogTitle>
          <DialogDescription className="text-sm">
            How would you like to contact {opportunity.name}?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {methods.length > 0 ? methods.map(m => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => { m.action(); onSelectMethod(m.id); }}
                className="w-full flex items-center gap-4 p-3.5 rounded-2xl glass-card glass-card-hover border border-white/60 text-left"
              >
                <div className="w-10 h-10 rounded-xl fluid-gradient-subtle flex items-center justify-center shrink-0 border border-primary/10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "#131b2e" }}>{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
              </button>
            );
          }) : (
            <p className="text-sm text-center text-muted-foreground py-4">
              No contact methods available.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Contact icon helper ── */
function getContactMethodIcon(type: ContactMethodType) {
  const m: Partial<Record<ContactMethodType, typeof Mail>> = {
    email: Mail, phone: Phone, website: Globe, contact_form: FileText,
    instagram: Instagram, facebook: Facebook, linkedin: Linkedin, twitter: MessageCircle,
  };
  return m[type] || MoreHorizontal;
}

/* ═══════════════════════════════════════════════
   Opportunity Detail View
═══════════════════════════════════════════════ */
function OpportunityDetailView({
  opportunity,
  onBack,
  onRefresh,
}: {
  opportunity: Opportunity;
  onBack: () => void;
  onRefresh: () => Promise<void>;
}) {
  const { setActiveTab } = useKammie();
  const [isPending, startTransition] = useTransition();
  const [suggestedMessage, setSuggestedMessage] = useState<{
    subject: string; body: string; contactMethod: string;
  } | null>(null);
  const [isGenerating,     setIsGenerating]     = useState(false);
  const [messageError,     setMessageError]     = useState<string | null>(null);
  const [showImageLightbox, setShowImageLightbox] = useState(false);
  const [emailConnected,   setEmailConnected]   = useState<boolean | null>(null);
  const [isSending,        setIsSending]        = useState(false);
  const [sendSuccess,      setSendSuccess]      = useState(false);

  useEffect(() => {
    fetch("/api/email/status")
      .then(r => r.json())
      .then(d => setEmailConnected(d.connected))
      .catch(() => setEmailConnected(false));
  }, []);

  useEffect(() => {
    const gen = async () => {
      setIsGenerating(true); setMessageError(null);
      try {
        const ec = opportunity.contactMethods.find(c => c.type === "email");
        const ic = opportunity.contactMethods.find(c => c.type === "instagram");
        const cm = ec ? "email" : ic ? "instagram" : "email";
        const res = await fetch("/api/generate-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opportunityId: opportunity.id, contactMethod: cm }),
        });
        if (!res.ok) throw new Error("Failed");
        setSuggestedMessage(await res.json());
      } catch { setSuggestedMessage(null); }
      finally { setIsGenerating(false); }
    };
    gen();
  }, [opportunity.id, opportunity.contactMethods]);

  const photo = photoUrl(opportunity.photoReference, 800);

  const handleDelete = () => {
    if (!confirm("Delete this opportunity?")) return;
    startTransition(async () => {
      await deleteOpportunity(opportunity.id);
      await onRefresh();
      onBack();
    });
  };

  return (
    <>
      {showImageLightbox && photo && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setShowImageLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
            onClick={() => setShowImageLightbox(false)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={photo.replace("maxWidth=800", "maxWidth=1600")}
            alt={opportunity.name}
            className="max-w-full max-h-full object-contain p-4"
          />
        </div>
      )}

      <div className="flex flex-col min-h-[calc(100vh-8rem)] -mx-4 -mt-5">
        {/* Hero */}
        <div className="relative min-h-[45vh]">
          <button
            className="absolute inset-0 w-full cursor-pointer group"
            onClick={() => photo && setShowImageLightbox(true)}
          >
            {photo
              ? <img src={photo} alt={opportunity.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full" style={{ background: `linear-gradient(135deg,rgba(124,110,247,0.25) 0%,rgba(149,133,249,0.15) 100%)` }} />}
            <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/40 to-black/10" />
            {photo && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Maximize2 className="w-5 h-5 text-white" />
              </div>
            )}
          </button>

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <div className="flex items-center gap-2">
              {opportunity.source === "aurora_ai" && (
                <div
                  className="px-3 py-1.5 rounded-full text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
                  style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
                >
                  <Sparkles className="w-3 h-3" />AI Found
                </div>
              )}
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Hero content */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            <div className="flex items-center gap-2 mb-2">
              {opportunity.rating && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-white text-sm font-bold shadow-md">
                  <Star className="w-3.5 h-3.5 fill-white" />{opportunity.rating.toFixed(1)}
                </div>
              )}
              <Badge className="bg-white/90 text-foreground border-0 backdrop-blur-sm text-xs">
                {typeLabels[opportunity.type]}
              </Badge>
              {opportunity.priority === "high" && (
                <Badge
                  className="text-white border-0 text-xs"
                  style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
                >
                  Hot Lead
                </Badge>
              )}
            </div>
            <h1
              className="text-2xl font-extrabold leading-tight mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
              style={{ color: "#131b2e" }}
            >
              {opportunity.name}
            </h1>
            {opportunity.location && (
              <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <MapPin className="w-4 h-4" />
                {opportunity.location.split(",").slice(0, 2).join(",")}
              </p>
            )}
          </div>
        </div>

        {/* Detail body */}
        <div className="bg-white/30 backdrop-blur-sm px-4 py-5 space-y-4">
          {opportunity.whyGoodFit && (
            <div className="glass-panel rounded-2xl p-4 shimmer-ai">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Why it&apos;s a great fit
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{opportunity.whyGoodFit}</p>
            </div>
          )}

          {/* Contact scroll */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {opportunity.website && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 rounded-xl glass-card border-white/70"
                onClick={() => window.open(opportunity.website, "_blank")}
              >
                <Globe className="w-4 h-4 mr-1.5" />Website
              </Button>
            )}
            {opportunity.contactMethods.slice(0, 4).map(cm => {
              const Icon = getContactMethodIcon(cm.type);
              return (
                <Button
                  key={cm.id}
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-xl glass-card border-white/70"
                  onClick={() => {
                    if (cm.type === "email") window.location.href = `mailto:${cm.value}`;
                    else if (cm.type === "phone") window.location.href = `tel:${cm.value}`;
                    else if (cm.type === "instagram") {
                      const h = cm.value.replace("@", "").replace("https://instagram.com/", "");
                      window.open(`https://instagram.com/${h}`, "_blank");
                    } else if (cm.value.startsWith("http")) window.open(cm.value, "_blank");
                  }}
                >
                  <Icon className="w-4 h-4 mr-1.5" />{contactMethodLabels[cm.type]}
                </Button>
              );
            })}
          </div>

          {/* AI Message */}
          <div className="glass-panel ai-glow rounded-2xl p-4 shimmer-ai">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg fluid-gradient flex items-center justify-center">
                  <Mail className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-bold" style={{ color: "#131b2e" }}>
                  Your First Message
                </span>
              </div>
              {!isGenerating && suggestedMessage && (
                <button
                  className="text-xs font-semibold hover:underline text-primary"
                  onClick={() => {
                    setIsGenerating(true);
                    setSuggestedMessage(null);
                    fetch("/api/generate-message", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        opportunityId: opportunity.id,
                        contactMethod: suggestedMessage?.contactMethod || "email",
                        forceRegenerate: true,
                      }),
                    })
                      .then(r => r.json())
                      .then(d => setSuggestedMessage(d))
                      .catch(() => setMessageError("Could not regenerate"))
                      .finally(() => setIsGenerating(false));
                  }}
                >
                  Regenerate
                </button>
              )}
            </div>

            {isGenerating ? (
              <div className="flex items-center gap-3 py-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Crafting the perfect message…</span>
              </div>
            ) : suggestedMessage ? (
              <div className="space-y-2">
                {suggestedMessage.subject && (
                  <p className="text-xs text-muted-foreground">
                    Subject: <span className="font-medium" style={{ color: "#131b2e" }}>{suggestedMessage.subject}</span>
                  </p>
                )}
                <p className="text-sm leading-relaxed line-clamp-3" style={{ color: "#131b2e" }}>
                  {suggestedMessage.body}
                </p>
                <button className="text-xs font-medium hover:underline text-primary">
                  Read full message
                </button>
              </div>
            ) : messageError ? (
              <p className="text-sm text-muted-foreground py-2">{messageError}</p>
            ) : null}
          </div>
        </div>

        {/* Sticky CTA */}
        <div className="sticky bottom-0 glass-nav border-t border-white/50 px-4 py-3 space-y-2">
          {emailConnected === false && (
            <div className="flex items-center justify-between glass-card rounded-xl p-3 border border-white/60">
              <p className="text-sm text-muted-foreground">Connect email to send directly</p>
              <button
                className="rounded-xl text-white font-bold text-sm px-3 py-1.5"
                style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
                onClick={() => window.location.href = "/api/email/connect?provider=google"}
              >
                <Mail className="w-4 h-4 mr-1.5 inline" />Connect
              </button>
            </div>
          )}
          {sendSuccess && (
            <div className="bg-green-500/10 text-green-600 rounded-xl p-3 text-center text-sm font-semibold">
              Email sent! ✓
            </div>
          )}
          <div className="flex gap-3">
            <button
              disabled={!suggestedMessage || isGenerating || isPending || isSending || sendSuccess}
              className="flex-1 h-12 rounded-2xl font-bold text-white flex items-center justify-center gap-2 shadow-lg hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`,
                boxShadow: `0 8px 24px rgba(124,110,247,0.3)`,
              }}
              onClick={async () => {
                if (!suggestedMessage) return;
                const ec = opportunity.contactMethods.find(c => c.type === "email");
                const ic = opportunity.contactMethods.find(c => c.type === "instagram");
                if (emailConnected && ec) {
                  setIsSending(true);
                  try {
                    const res = await fetch("/api/email/send", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        to: ec.value,
                        toName: opportunity.name,
                        subject: suggestedMessage.subject,
                        body: suggestedMessage.body,
                        opportunityId: opportunity.id,
                      }),
                    });
                    if (res.ok) { setSendSuccess(true); await onRefresh(); }
                    else { const d = await res.json(); alert(d.error || "Failed to send"); }
                  } catch { alert("Failed to send email"); }
                  finally { setIsSending(false); }
                } else if (suggestedMessage.contactMethod === "instagram" && ic) {
                  const h = ic.value.replace("@", "").replace("https://instagram.com/", "");
                  navigator.clipboard.writeText(suggestedMessage.body);
                  window.open(`https://instagram.com/${h}`, "_blank");
                } else if (ec) {
                  window.location.href = `mailto:${ec.value}?subject=${encodeURIComponent(suggestedMessage.subject)}&body=${encodeURIComponent(suggestedMessage.body)}`;
                } else if (opportunity.website) {
                  navigator.clipboard.writeText(suggestedMessage.body);
                  window.open(opportunity.website, "_blank");
                }
              }}
            >
              {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {isSending ? "Sending…" : sendSuccess ? "Sent!" : "Send Message"}
            </button>
            <button
              disabled={isPending || sendSuccess}
              className="h-12 px-4 rounded-2xl glass-card border border-white/60 flex items-center justify-center"
              onClick={() => startTransition(async () => {
                await updateOpportunity(opportunity.id, { status: "outreach_ready" });
                await onRefresh();
                setActiveTab("outreach");
              })}
            >
              <Crosshair className="w-5 h-5 text-primary" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
