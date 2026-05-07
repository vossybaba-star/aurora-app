"use client";

import { useAurora } from "./aurora-app";
import { LayoutDashboard, Compass, Send, Users, Settings } from "lucide-react";

const ACCENT  = "#7c6ef7";
const ACCENT2 = "#9585f9";

const navItems = [
  { id: "home",          label: "Home",       icon: LayoutDashboard },
  { id: "discover",      label: "Find Leads", icon: Compass },
  { id: "outreach",      label: "Outreach",   icon: Send },
  { id: "relationships", label: "People",     icon: Users },
  { id: "profile",       label: "Settings",   icon: Settings },
];

export function BottomNav() {
  const { activeTab, setActiveTab, opportunities } = useAurora();

  const outreachBadge = opportunities.filter(
    o => o.status === "sent" || o.status === "follow_up_due"
  ).length;

  return (
    /* Hidden on md+ screens — tablet/desktop uses sidebar instead */
    <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-nav px-2 pb-safe z-40">
      <div className="flex items-center justify-around h-16">
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          const badge = item.id === "outreach" && outreachBadge > 0 ? outreachBadge : null;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="relative flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-2xl transition-all duration-200"
            >
              <div
                className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${isActive ? "shadow-sm" : ""}`}
                style={isActive ? { background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` } : {}}
              >
                <Icon
                  className={`w-[18px] h-[18px] transition-all ${isActive ? "text-white stroke-[2.5]" : "text-muted-foreground"}`}
                />
              </div>
              <span
                className="text-[9px] font-bold tracking-wide"
                style={isActive ? { color: ACCENT } : { color: "rgba(100,100,120,0.6)" }}
              >
                {item.label}
              </span>

              {/* Badge dot */}
              {badge !== null && (
                <span
                  className="absolute top-1 right-1.5 w-[7px] h-[7px] rounded-full border-2 border-white"
                  style={{ background: ACCENT }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
