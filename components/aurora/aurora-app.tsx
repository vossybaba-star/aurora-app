"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { LandingPage } from "./landing-page";
import { OnboardingFlow } from "./onboarding-flow";
import { Dashboard } from "./dashboard";
import type { UserProfile, Opportunity, OutreachMessage, FollowUpTask } from "@/lib/types";

type AppState = "landing" | "onboarding" | "dashboard";

interface AuroraContextType {
  appState: AppState;
  setAppState: (state: AppState) => void;
  userId: string | null;
  profile: UserProfile | null;
  setProfile: (profile: UserProfile | null) => void;
  opportunities: Opportunity[];
  setOpportunities: (opps: Opportunity[]) => void;
  outreachMessages: OutreachMessage[];
  setOutreachMessages: (msgs: OutreachMessage[]) => void;
  followUpTasks: FollowUpTask[];
  setFollowUpTasks: (tasks: FollowUpTask[]) => void;
  onboardingStep: number;
  setOnboardingStep: (step: number) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  refreshData: () => Promise<void>;
  isLoading: boolean;
}

const AuroraContext = createContext<AuroraContextType | undefined>(undefined);

export function useAurora() {
  const context = useContext(AuroraContext);
  if (context === undefined) {
    throw new Error("useAurora must be used within an AuroraProvider");
  }
  return context;
}

interface AuroraAppProps {
  initialState: AppState;
  userId: string | null;
}

export function AuroraApp({ initialState, userId }: AuroraAppProps) {
  const [appState, setAppState] = useState<AppState>(initialState);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [outreachMessages, setOutreachMessages] = useState<OutreachMessage[]>([]);
  const [followUpTasks, setFollowUpTasks] = useState<FollowUpTask[]>([]);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [activeTab, setActiveTab] = useState("home");
  const [isLoading, setIsLoading] = useState(false);

  const refreshData = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const [profileRes, oppsRes, msgsRes, tasksRes] = await Promise.all([
        fetch("/api/profile").then(r => r.json()),
        fetch("/api/opportunities").then(r => r.json()),
        fetch("/api/outreach-messages").then(r => r.json()),
        fetch("/api/follow-up-tasks").then(r => r.json()),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (oppsRes.data) setOpportunities(oppsRes.data);
      if (msgsRes.data) setOutreachMessages(msgsRes.data);
      if (tasksRes.data) setFollowUpTasks(tasksRes.data);
    } catch (error) {
      console.error("Failed to refresh data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load initial data when user is authenticated
  useEffect(() => {
    if (userId && appState === "dashboard") {
      refreshData();
    }
  }, [userId, appState]);

  const renderContent = () => {
    switch (appState) {
      case "landing":
        return <LandingPage />;
      case "onboarding":
        return <OnboardingFlow />;
      case "dashboard":
        return <Dashboard />;
      default:
        return <LandingPage />;
    }
  };

  return (
    <AuroraContext.Provider
      value={{
        appState,
        setAppState,
        userId,
        profile,
        setProfile,
        opportunities,
        setOpportunities,
        outreachMessages,
        setOutreachMessages,
        followUpTasks,
        setFollowUpTasks,
        onboardingStep,
        setOnboardingStep,
        activeTab,
        setActiveTab,
        refreshData,
        isLoading,
      }}
    >
      {renderContent()}
    </AuroraContext.Provider>
  );
}
