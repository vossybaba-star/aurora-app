"use client";

import { Sparkles, RefreshCw } from "lucide-react";
import { useAurora } from "./aurora-app";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function DashboardHeader() {
  const { profile, refreshData, isLoading } = useAurora();

  return (
    <header className="px-4 pt-4 pb-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold">Aurora</span>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-8 h-8"
            onClick={refreshData}
            disabled={isLoading}
          >
            {isLoading ? (
              <Spinner className="w-4 h-4" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
            {profile?.businessType?.charAt(0).toUpperCase() || "A"}
          </div>
        </div>
      </div>
    </header>
  );
}
