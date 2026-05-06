"use client";

import { useAurora } from "./aurora-app";
import { signOut } from "@/lib/actions";
import { useTransition } from "react";
import {
  LayoutDashboard,
  Compass,
  Send,
  Heart,
  User,
  Sparkles,
  Mail,
  LogOut,
  HelpCircle,
  Settings,
  Zap,
} from "lucide-react";

const navItems = [
  { id: "home",     label: "Overview",      icon: LayoutDashboard, description: "Your dashboard" },
  { id: "discover", label: "Find Leads",    icon: Compass,          description: "Discover opportunities" },
  { id: "outreach", label: "Outreach",      icon: Send,             description: "Campaigns & messages" },
  { id: "saved",    label: "Relationships", icon: Heart,            description: "Saved contacts" },
  { id: "profile",  label: "Account",       icon: User,             description: "Profile & settings" },
];

export function SidebarNav() {
  const { activeTab, setActiveTab, profile, opportunities } = useAurora();
  const [isPending, startTransition] = useTransition();

  const stats = {
    new:  opportunities.filter(o => o.status === "new").length,
    sent: opportunities.filter(o => o.status === "sent").length,
  };

  const handleSignOut = () => {
    startTransition(async () => { await signOut(); });
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-64 flex flex-col z-40 border-r border-white/40 shadow-2xl"
           style={{ background: "rgba(255,255,255,0.28)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}>

      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-white/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md shadow-primary/30 shrink-0"
               style={{ background: "linear-gradient(135deg,#3525cd,#4f46e5)" }}>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight liquid-gradient-text block leading-tight">Aurora</span>
            <span className="text-[10px] text-muted-foreground font-medium">AI Outreach Engine</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group ${
                isActive
                  ? "border-r-4 border-primary font-bold shadow-lg"
                  : "text-muted-foreground hover:bg-white/25 hover:text-foreground"
              }`}
              style={isActive ? {
                background: "linear-gradient(135deg, rgba(53,37,205,0.12) 0%, rgba(180,19,109,0.06) 100%)",
                borderRightColor: "#3525cd",
                color: "#3525cd",
                boxShadow: "0 0 20px rgba(53,37,205,0.15)",
              } : {}}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                isActive ? "shadow-sm" : "group-hover:bg-white/40"
              }`}
              style={isActive ? { background:"linear-gradient(135deg,#3525cd,#4f46e5)" } : {}}>
                <Icon className={`w-4 h-4 ${isActive ? "text-white" : ""}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-sm leading-tight ${isActive ? "font-bold" : "font-medium"}`}>{item.label}</p>
                {isActive && <p className="text-[10px] opacity-70 truncate">{item.description}</p>}
              </div>
              {/* badge for new opps on Home */}
              {item.id === "home" && stats.new > 0 && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0"
                      style={{ background:"#3525cd" }}>{stats.new}</span>
              )}
              {item.id === "outreach" && stats.sent > 0 && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ background:"rgba(53,37,205,0.12)", color:"#3525cd" }}>{stats.sent}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Email connection status card */}
      <div className="mx-3 mb-3">
        <div className="glass-card rounded-2xl p-3 border border-white/60">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 shrink-0" style={{ color:"#3525cd" }} />
            <p className="text-xs font-bold" style={{ color:"#3525cd" }}>AI Outreach Active</p>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug mb-2.5">
            {profile?.businessType
              ? `Finding opportunities for ${profile.businessType}`
              : "Set up your profile to unlock AI outreach"}
          </p>
          <button
            onClick={() => setActiveTab("discover")}
            className="w-full py-1.5 rounded-xl text-[11px] font-bold text-white text-center hover:opacity-90 transition-all"
            style={{ background:"linear-gradient(135deg,#3525cd,#4f46e5)" }}
          >
            Find Opportunities
          </button>
        </div>
      </div>

      {/* Bottom links */}
      <div className="px-3 pb-4 pt-2 border-t border-white/30 space-y-0.5">
        <button
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-muted-foreground hover:bg-white/25 hover:text-foreground transition-all text-left"
          onClick={() => setActiveTab("profile")}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium">Settings</span>
        </button>
        <button
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-muted-foreground hover:bg-white/25 hover:text-foreground transition-all text-left"
          onClick={handleSignOut}
          disabled={isPending}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium">{isPending ? "Signing out…" : "Sign out"}</span>
        </button>

        {/* User pill */}
        {profile && (
          <div className="flex items-center gap-2.5 px-3 py-2 mt-1 rounded-xl glass-card border border-white/50">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                 style={{ background:"linear-gradient(135deg,#3525cd,#4f46e5)" }}>
              {(profile.businessName || profile.businessType || "A").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate" style={{ color:"#131b2e" }}>
                {profile.businessName || profile.businessType || "Your Business"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{profile.location?.split(",")[0] || "No location set"}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
