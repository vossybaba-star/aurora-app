"use client";

import { useAurora } from "./aurora-app";
import { Home, Compass, Send, Heart, User } from "lucide-react";

const navItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "discover", label: "Discover", icon: Compass },
  { id: "outreach", label: "Outreach", icon: Send },
  { id: "saved", label: "Saved", icon: Heart },
  { id: "profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const { activeTab, setActiveTab } = useAurora();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-2 pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 w-16 h-14 rounded-xl transition-colors ${
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
