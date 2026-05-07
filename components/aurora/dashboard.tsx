"use client";

import { useAurora } from "./aurora-app";
import { SidebarNav } from "./sidebar-nav";
import { DashboardHeader } from "./dashboard-header";
import { DashboardHome } from "./dashboard-home";
import { OutreachPage } from "./outreach-page";
import { DiscoverPage } from "./discover-page";
import { SavedPage } from "./saved-page";
import { RelationshipsPage } from "./relationships-page";
import { ProfilePage } from "./profile-page";
import { BottomNav } from "./bottom-nav";
import { FirstRunWizard } from "./first-run-wizard";
import { Spinner } from "@/components/ui/spinner";

export function Dashboard() {
  const { activeTab, profileNavKey, isLoading } = useAurora();

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25"
                 style={{ background:"linear-gradient(135deg,#7c6ef7,#9585f9)" }}>
              <Spinner className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">Loading…</p>
          </div>
        </div>
      );
    }
    switch (activeTab) {
      case "home":         return <DashboardHome />;
      case "discover":     return <DiscoverPage />;
      case "opportunities":
      case "outreach":     return <OutreachPage />;
      case "saved":        return <SavedPage />;
      case "relationships": return <RelationshipsPage />;
      case "profile":      return <ProfilePage key={profileNavKey} />;
      default:             return <DashboardHome />;
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* First-run wizard — renders as a fixed overlay, self-manages visibility via localStorage */}
      <FirstRunWizard />

      {/* ── Sidebar: icon-only at md (60px), full at lg (220px) ── */}
      <div className="hidden md:block">
        <SidebarNav />
      </div>

      {/* ── Right column: header + scrollable content ── */}
      <div className="flex flex-col flex-1 min-h-screen md:ml-16 lg:ml-[220px]">

        {/* Sticky top bar */}
        <DashboardHeader />

        {/* Scrollable main */}
        <main className="flex-1 overflow-y-auto">
          {/* Mobile: compact padding + bottom-nav clearance */}
          {/* Desktop: generous padding, wider content */}
          <div className="px-4 py-5 md:px-5 lg:px-8 lg:py-8 pb-24 md:pb-6 lg:pb-10 max-w-[1400px] mx-auto w-full">
            {renderContent()}
          </div>
        </main>

        {/* Mobile-only bottom nav */}
        <BottomNav />
      </div>
    </div>
  );
}
