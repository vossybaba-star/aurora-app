"use client";

import { useAurora } from "./aurora-app";
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
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl fluid-gradient flex items-center justify-center shadow-lg shadow-primary/25">
              <Spinner className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">Loading your data…</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case "home":
        return <DashboardHome />;
      case "discover":
        return <DiscoverPage />;
      case "opportunities":
      case "outreach":
        return <OutreachPage />;
      case "saved":
        return <SavedPage />;
      case "profile":
        return <ProfilePage />;
      default:
        return <DashboardHome />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col pb-20">
      <DashboardHeader />
      <main className="flex-1 px-4 py-5 max-w-xl mx-auto w-full">
        {renderContent()}
      </main>
      <BottomNav />
    </div>
  );
}
