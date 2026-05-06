"use client";

import { Sparkles, RefreshCw } from "lucide-react";
import { useAurora } from "./aurora-app";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function DashboardHeader() {
  const { profile, refreshData, isLoading } = useAurora();

  return (
    <header className="glass-header sticky top-0 z-40 px-4 py-3">
      <div className="flex items-center justify-between max-w-xl mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl fluid-gradient flex items-center justify-center shadow-sm shadow-primary/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-extrabold tracking-tight liquid-gradient-text">Aurora</span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-muted-foreground hover:text-primary hover:bg-primary/8 rounded-xl"
            onClick={refreshData}
            disabled={isLoading}
          >
            {isLoading ? (
              <Spinner className="w-4 h-4" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-xl fluid-gradient flex items-center justify-center text-xs font-bold text-white shadow-sm">
            {profile?.businessName?.charAt(0).toUpperCase() ||
             profile?.businessType?.charAt(0).toUpperCase() || "A"}
          </div>
        </div>
      </div>
    </header>
  );
}
