"use client";

import { useAurora } from "./aurora-app";
import { signOut } from "@/lib/actions";
import { useTransition } from "react";
import {
  LayoutDashboard,
  Compass,
  Send,
  Users,
  Settings,
  Sparkles,
  LogOut,
  Zap,
} from "lucide-react";

/* ─── Constants ──────────────────────────────── */
const ACCENT  = "#7c6ef7";
const ACCENT2 = "#9585f9";

const navItems = [
  { id: "home",     label: "Overview",      icon: LayoutDashboard, description: "Your dashboard" },
  { id: "discover", label: "Find Leads",    icon: Compass,          description: "Discover opportunities" },
  { id: "outreach", label: "Outreach",      icon: Send,             description: "Campaigns & messages" },
  { id: "relationships", label: "Relationships", icon: Users, description: "Contacts & nurture" },
  { id: "profile",  label: "Settings",      icon: Settings,         description: "Profile & settings" },
];

export function SidebarNav() {
  const { activeTab, setActiveTab, profile, opportunities } = useAurora();
  const [isPending, startTransition] = useTransition();

  const stats = {
    new:  opportunities.filter(o => o.status === "new").length,
    sent: opportunities.filter(o => o.status === "sent" || o.status === "follow_up_due").length,
  };

  const handleSignOut = () => {
    startTransition(async () => { await signOut(); });
  };

  const initial = (profile?.businessName || profile?.businessType || "A").charAt(0).toUpperCase();

  return (
    /*
     * Responsive widths:
     *  md  (768–1023px) → w-16 (64px)  icon-only, tooltips on hover
     *  lg+ (≥1024px)   → w-[220px]    full labels + badges
     */
    <aside
      className="fixed left-0 top-0 h-full z-40 flex flex-col border-r border-white/40 shadow-2xl
                 w-16 lg:w-[220px] transition-[width] duration-300"
      style={{
        background: "rgba(255,255,255,0.34)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      {/* ── Logo ────────────────────────────────── */}
      <div className="px-[10px] lg:px-5 pt-5 pb-4 border-b border-white/30 flex items-center justify-center lg:justify-start lg:gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md shrink-0"
          style={{
            background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`,
            boxShadow: `0 4px 14px rgba(124,110,247,0.35)`,
          }}
        >
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        {/* Wordmark — desktop only */}
        <div className="hidden lg:block">
          <span className="font-extrabold text-base tracking-tight liquid-gradient-text block leading-tight">
            Aurora
          </span>
          <span className="text-[10px] text-muted-foreground font-medium">AI Outreach Engine</span>
        </div>
      </div>

      {/* ── Navigation ──────────────────────────── */}
      {/*
        overflow-visible on tablet so CSS tooltips can escape the sidebar edge.
        overflow-y-auto on desktop for many-item scroll support.
      */}
      <nav className="flex-1 px-1.5 lg:px-3 py-4 space-y-0.5 overflow-visible lg:overflow-y-auto">
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          const badge =
            item.id === "home"     && stats.new  > 0 ? stats.new  :
            item.id === "outreach" && stats.sent > 0 ? stats.sent :
            null;

          return (
            <div key={item.id} className="relative group">
              <button
                onClick={() => setActiveTab(item.id)}
                className={`relative w-full flex items-center justify-center lg:justify-start gap-3
                            lg:px-3 py-2.5 rounded-xl text-left transition-all duration-200
                            ${isActive
                              ? "font-bold"
                              : "text-muted-foreground hover:bg-white/30 hover:text-foreground"
                            }`}
                style={isActive ? {
                  background: `linear-gradient(135deg,rgba(124,110,247,0.13) 0%,rgba(149,133,249,0.07) 100%)`,
                  color: ACCENT,
                  boxShadow: `0 0 20px rgba(124,110,247,0.12)`,
                } : {}}
              >
                {/* ── Active left-pill — tablet + desktop ── */}
                {isActive && (
                  <span
                    className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                    style={{ background: ACCENT }}
                  />
                )}

                {/* ── Icon ── */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all
                              ${isActive ? "shadow-sm" : "group-hover:bg-white/40"}`}
                  style={isActive ? { background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` } : {}}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : ""}`} />
                </div>

                {/* ── Label + sub-label — desktop only ── */}
                <div className="hidden lg:block min-w-0 flex-1">
                  <p className={`text-sm leading-tight ${isActive ? "font-bold" : "font-medium"}`}>
                    {item.label}
                  </p>
                  {isActive && (
                    <p className="text-[10px] opacity-60 truncate">{item.description}</p>
                  )}
                </div>

                {/* ── Badge pill — desktop only ── */}
                {badge !== null && (
                  <span
                    className="hidden lg:inline-flex ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0"
                    style={{ background: ACCENT }}
                  >
                    {badge}
                  </span>
                )}

                {/* ── Badge dot — tablet only ── */}
                {badge !== null && (
                  <span
                    className="lg:hidden absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full border-2 border-white"
                    style={{ background: ACCENT }}
                  />
                )}
              </button>

              {/* ── Tooltip — tablet only (md to lg) ──────────────────────
                  Sits in a wrapping div so it can escape button's click area.
                  overflow-visible on <nav> means it won't be clipped.
              ───────────────────────────────────────────────────────── */}
              <div
                aria-hidden="true"
                className={`
                  hidden md:flex lg:hidden
                  absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 z-50
                  items-center gap-2 px-3 py-2 rounded-xl
                  text-xs font-bold text-white whitespace-nowrap
                  pointer-events-none shadow-xl
                  opacity-0 group-hover:opacity-100
                  -translate-x-1 group-hover:translate-x-0
                  transition-all duration-150 ease-out
                `}
                style={{ background: "#1a1a2e" }}
              >
                {/* Arrow pointing left */}
                <span
                  className="absolute right-full top-1/2 -translate-y-1/2 block w-0 h-0"
                  style={{
                    borderTop: "5px solid transparent",
                    borderBottom: "5px solid transparent",
                    borderRight: "5px solid #1a1a2e",
                  }}
                />
                {item.label}
                {badge !== null && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                    style={{ background: ACCENT }}
                  >
                    {badge}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── AI status indicator — desktop only ─── */}
      <div className="hidden lg:block mx-3 mb-3">
        <div className="glass-card rounded-2xl p-3 border border-white/60">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />
            <p className="text-xs font-bold" style={{ color: ACCENT }}>AI Outreach Active</p>
            {/* Live pulse */}
            <span className="ml-auto flex items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-600">Live</span>
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug mt-1.5">
            {profile?.businessType
              ? `Scanning for ${profile.businessType} leads`
              : "Set up your profile to unlock AI outreach"}
          </p>
        </div>
      </div>

      {/* ── Bottom actions ──────────────────────── */}
      <div className="px-1.5 lg:px-3 pb-4 pt-2 border-t border-white/30 space-y-0.5">

        {/* Sign out */}
        <div className="relative group">
          <button
            className="w-full flex items-center justify-center lg:justify-start gap-3
                       lg:px-3 py-2 rounded-xl text-muted-foreground
                       hover:bg-white/25 hover:text-foreground transition-all disabled:opacity-50"
            onClick={handleSignOut}
            disabled={isPending}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="hidden lg:block text-sm font-medium">
              {isPending ? "Signing out…" : "Sign out"}
            </span>
          </button>
          {/* Tablet tooltip */}
          <div
            aria-hidden="true"
            className="hidden md:flex lg:hidden
                       absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 z-50
                       items-center px-3 py-2 rounded-xl
                       text-xs font-bold text-white whitespace-nowrap
                       pointer-events-none shadow-xl
                       opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0
                       transition-all duration-150"
            style={{ background: "#1a1a2e" }}
          >
            <span className="absolute right-full top-1/2 -translate-y-1/2 block w-0 h-0"
                  style={{ borderTop:"5px solid transparent", borderBottom:"5px solid transparent", borderRight:"5px solid #1a1a2e" }} />
            {isPending ? "Signing out…" : "Sign out"}
          </div>
        </div>

        {/* ── User pill — desktop ── */}
        {profile && (
          <div className="hidden lg:flex items-center gap-2.5 px-3 py-2 mt-1 rounded-xl glass-card border border-white/50">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
            >
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: "#131b2e" }}>
                {profile.businessName || profile.businessType || "Your Business"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {profile.location?.split(",")[0] || "No location set"}
              </p>
            </div>
          </div>
        )}

        {/* ── User avatar — tablet ── */}
        {profile && (
          <div className="relative group lg:hidden flex justify-center py-1">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold cursor-default"
              style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
            >
              {initial}
            </div>
            {/* Tablet tooltip */}
            <div
              aria-hidden="true"
              className="hidden md:flex lg:hidden
                         absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 z-50
                         flex-col px-3 py-2 rounded-xl
                         text-xs text-white whitespace-nowrap
                         pointer-events-none shadow-xl
                         opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0
                         transition-all duration-150"
              style={{ background: "#1a1a2e" }}
            >
              <span className="absolute right-full top-1/2 -translate-y-1/2 block w-0 h-0"
                    style={{ borderTop:"5px solid transparent", borderBottom:"5px solid transparent", borderRight:"5px solid #1a1a2e" }} />
              <span className="font-bold">{profile.businessName || profile.businessType || "Your Business"}</span>
              {profile.location && (
                <span className="opacity-60 text-[10px] mt-0.5">{profile.location.split(",")[0]}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
