"use client";

import { useAurora } from "./aurora-app";
import { LayoutDashboard, Compass, Send, Heart, User } from "lucide-react";

const navItems = [
  { id: "home",     label: "Home",         icon: LayoutDashboard },
  { id: "discover", label: "Discover",     icon: Compass },
  { id: "outreach", label: "Outreach",     icon: Send },
  { id: "saved",    label: "Saved",        icon: Heart },
  { id: "profile",  label: "Account",      icon: User },
];

export function BottomNav() {
  const { activeTab, setActiveTab } = useAurora();

  return (
    /* Hidden on lg+ screens — desktop uses sidebar instead */
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 glass-nav px-2 pb-safe z-40">
      <div className="flex items-center justify-around h-16">
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-2xl transition-all duration-200"
            >
              <div className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${isActive ? "shadow-sm" : ""}`}
                   style={isActive ? { background:"linear-gradient(135deg,#3525cd,#4f46e5)" } : {}}>
                <Icon className={`w-[18px] h-[18px] transition-all ${isActive ? "text-white stroke-[2.5]" : "text-muted-foreground"}`} />
              </div>
              <span className={`text-[9px] font-bold tracking-wide ${isActive ? "text-primary" : "text-muted-foreground/60"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
