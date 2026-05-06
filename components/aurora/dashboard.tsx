"use client";

import { useAurora } from "./aurora-app";
import { SidebarNav } from "./sidebar-nav";
import { DashboardHeader } from "./dashboard-header";
import { DashboardHome } from "./dashboard-home";
import { OutreachPage } from "./outreach-page";
import { DiscoverPage } from "./discover-page";
import { SavedPage } from "./saved-page";
import { ProfilePage } from "./profile-page";
import { BottomNav } from "./bottom-nav";
import { Spinner } from "@/components/ui/spinner";

export function Dashboard() {
  const { activeTab, isLoading } = useAurora();

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25"
                 style={{ background:"linear-gradient(135deg,#3525cd,#4f46e5)" }}>
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
      case "profile":      return <ProfilePage />;
      default:             return <DashboardHome />;
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Desktop sidebar (lg+) ── */}
      <div className="hidden lg:block">
        <SidebarNav />
      </div>

      {/* ── Right column: header + scrollable content ── */}
      <div className="flex flex-col flex-1 min-h-screen lg:ml-64">

        {/* Sticky top bar */}
        <DashboardHeader />

        {/* Scrollable main */}
        <main className="flex-1 overflow-y-auto">
          {/* Mobile: compact padding + bottom-nav clearance */}
          {/* Desktop: generous padding, wider content */}
          <div className="px-4 py-5 lg:px-8 lg:py-8 pb-24 lg:pb-10 max-w-5xl mx-auto w-full">
            {renderContent()}
          </div>
        </main>

        {/* Mobile-only bottom nav */}
        <BottomNav />
      </div>
    </div>
  );
}
