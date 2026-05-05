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
        <div className="flex items-center justify-center py-12">
          <Spinner className="w-8 h-8" />
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
      <main className="flex-1 px-4 py-4">
        {renderContent()}
      </main>
      <BottomNav />
    </div>
  );
}
