"use client";

import { RefreshCw, Sparkles, Bell } from "lucide-react";
import { useAurora } from "./aurora-app";
import { Spinner } from "@/components/ui/spinner";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  home:     { title: "Overview",      subtitle: "Your outreach at a glance" },
  discover: { title: "Find Leads",    subtitle: "Search and discover new opportunities" },
  outreach: { title: "Outreach",      subtitle: "Manage your campaigns and messages" },
  saved:    { title: "Relationships", subtitle: "Your saved contacts and leads" },
  profile:  { title: "Account",       subtitle: "Manage your profile and settings" },
};

export function DashboardHeader() {
  const { profile, refreshData, isLoading, activeTab } = useAurora();
  const page = pageTitles[activeTab] ?? pageTitles.home;

  return (
    <header className="glass-header sticky top-0 z-30 px-4 lg:px-8 py-3 lg:py-4">
      <div className="flex items-center justify-between">

        {/* Left — mobile: Aurora logo | desktop: page title */}
        <div>
          {/* Mobile logo (hidden on desktop) */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
                 style={{ background:"linear-gradient(135deg,#3525cd,#4f46e5)" }}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold tracking-tight liquid-gradient-text">Aurora</span>
          </div>

          {/* Desktop page title (hidden on mobile) */}
          <div className="hidden lg:block">
            <h1 className="text-xl font-extrabold tracking-tight" style={{ color:"#131b2e" }}>{page.title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{page.subtitle}</p>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Notification bell — desktop only */}
          <button className="hidden lg:flex w-9 h-9 items-center justify-center rounded-xl glass-card border border-white/60 text-muted-foreground hover:text-primary transition-colors">
            <Bell className="w-4 h-4" />
          </button>

          {/* Refresh */}
          <button
            className="w-9 h-9 flex items-center justify-center rounded-xl glass-card border border-white/60 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
            onClick={refreshData}
            disabled={isLoading}
          >
            {isLoading ? <Spinner className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
          </button>

          {/* Avatar */}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm"
               style={{ background:"linear-gradient(135deg,#3525cd,#4f46e5)" }}>
            {profile?.businessName?.charAt(0).toUpperCase() ||
             profile?.businessType?.charAt(0).toUpperCase() || "A"}
          </div>
        </div>
      </div>
    </header>
  );
}
