"use client";

import { useState } from "react";
import { Check, ChevronLeft, Search, X } from "lucide-react";
import {
  ROLES,
  getRoleById,
  getRolesByCategory,
  ROLE_CATEGORY_LABELS,
  ROLE_CATEGORY_EMOJI,
  TARGET_MARKET_LABELS,
} from "@/lib/roles";
import type { RoleCategory, TargetMarket } from "@/lib/roles";
import { Spinner } from "@/components/ui/spinner";

/* ─── Constants ───────────────────────────────────────────────── */
const ACCENT  = "#7c6ef7";
const ACCENT2 = "#9585f9";

const ALL_CATEGORIES = Object.keys(ROLE_CATEGORY_LABELS) as RoleCategory[];

/**
 * Extra target markets to surface per category — shown un-ticked below the
 * role's defaultTargetMarkets so users can expand their scope if they want.
 * Must not overlap with any role's defaults (filtered at runtime anyway).
 */
const CATEGORY_EXTRA_MARKETS: Record<RoleCategory, TargetMarket[]> = {
  creative_visual:       ["corporate_clients", "music_entertainment", "retail_brands", "hospitality_hotels"],
  production_film:       ["corporate_clients", "editorial_magazines", "beauty_brands", "retail_brands"],
  events_hospitality:    ["corporate_clients", "music_entertainment", "retail_brands", "sport_wellness"],
  business_professional: ["enterprise_companies", "investors_vcs", "industry_press", "retail_brands"],
  wellness_personal:     ["beauty_brands", "editorial_magazines", "retail_brands", "hospitality_hotels"],
  tech_digital:          ["enterprise_companies", "investors_vcs", "industry_press", "co_founders_partners"],
  media_publishing:      ["beauty_brands", "corporate_clients", "retail_brands", "sport_wellness"],
  other:                 ["corporate_clients", "investors_vcs", "retail_brands", "co_founders_partners"],
};

type Step = "display" | "category" | "roles" | "markets";

export interface RolePickerInlineProps {
  currentRoleId?:       string;
  currentTargetMarkets?: string[];
  /**
   * Called after a successful PATCH so the parent can update its profile state.
   * Also receives businessType (= role label) for backward-compat with callers
   * that still read profile.businessType.
   */
  onSaved: (
    roleId:        string,
    roleCategory:  string,
    targetMarkets: string[],
    businessType:  string,
  ) => void;
}

/* ═══════════════════════════════════════════════════════════════
   RolePickerInline
═══════════════════════════════════════════════════════════════ */
export function RolePickerInline({
  currentRoleId,
  currentTargetMarkets = [],
  onSaved,
}: RolePickerInlineProps) {

  const currentRole = currentRoleId ? getRoleById(currentRoleId) : undefined;

  const [step,              setStep]              = useState<Step>(currentRole ? "display" : "category");
  const [selectedCategory,  setSelectedCategory]  = useState<RoleCategory | null>(currentRole?.category ?? null);
  const [selectedRoleId,    setSelectedRoleId]    = useState<string | null>(currentRoleId ?? null);
  const [checkedMarkets,    setCheckedMarkets]    = useState<Set<TargetMarket>>(
    new Set(currentTargetMarkets as TargetMarket[])
  );
  const [search,            setSearch]            = useState("");
  const [saving,            setSaving]            = useState(false);

  const selectedRole = selectedRoleId ? getRoleById(selectedRoleId) : undefined;

  // Markets for step 3
  const defaultMarkets: TargetMarket[] = selectedRole?.defaultTargetMarkets ?? [];
  const extraMarkets: TargetMarket[]   = selectedRole
    ? (CATEGORY_EXTRA_MARKETS[selectedRole.category] ?? [])
        .filter((m) => !defaultMarkets.includes(m))
        .slice(0, 4)
    : [];

  // Search
  const searchQuery   = search.trim().toLowerCase();
  const searchResults = searchQuery
    ? ROLES.filter((r) => r.label.toLowerCase().includes(searchQuery))
    : [];

  /* ── Handlers ──────────────────────────────────────────────── */

  const handleCategoryClick = (cat: RoleCategory) => {
    setSelectedCategory(cat);
    setSearch("");
    setStep("roles");
  };

  const handleRoleClick = (roleId: string) => {
    const role = getRoleById(roleId);
    if (!role) return;
    setSelectedRoleId(roleId);
    // Always reset to the role's defaults so the user sees sensible pre-ticks
    setCheckedMarkets(new Set(role.defaultTargetMarkets));
    setStep("markets");
  };

  const handleSearchRoleClick = (roleId: string) => {
    const role = getRoleById(roleId);
    if (!role) return;
    setSelectedCategory(role.category);
    handleRoleClick(roleId);
  };

  const toggleMarket = (market: TargetMarket) =>
    setCheckedMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(market)) next.delete(market);
      else next.add(market);
      return next;
    });

  const handleSave = async () => {
    if (!selectedRoleId || !selectedRole) return;
    setSaving(true);
    try {
      const targetMarkets = Array.from(checkedMarkets);
      const res = await fetch("/api/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId:       selectedRoleId,
          roleCategory: selectedRole.category,
          targetMarkets,
          // Keep businessType in sync for backward-compat with outreach/AI features
          businessType: selectedRole.label,
        }),
      });
      if (res.ok) {
        onSaved(selectedRoleId, selectedRole.category, targetMarkets, selectedRole.label);
        setStep("display");
      }
    } finally {
      setSaving(false);
    }
  };

  /* ── DISPLAY ───────────────────────────────────────────────── */
  if (step === "display") {
    const role    = getRoleById(currentRoleId ?? "");
    const markets = currentTargetMarkets as TargetMarket[];
    return (
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight" style={{ color: "#131b2e" }}>
              {role?.label ?? "—"}
            </p>
            {role && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {ROLE_CATEGORY_EMOJI[role.category]}&nbsp;
                {ROLE_CATEGORY_LABELS[role.category]}
              </p>
            )}
          </div>
          <button
            onClick={() => { setSearch(""); setStep("category"); }}
            className="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors hover:bg-white/60"
            style={{ borderColor: `${ACCENT}40`, color: ACCENT }}
          >
            Edit
          </button>
        </div>

        {markets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {markets.slice(0, 6).map((m) => (
              <span
                key={m}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${ACCENT}12`, color: ACCENT }}
              >
                {TARGET_MARKET_LABELS[m] ?? m}
              </span>
            ))}
            {markets.length > 6 && (
              <span className="text-[10px] text-muted-foreground px-1 py-0.5">
                +{markets.length - 6} more
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ── CATEGORY + SEARCH ─────────────────────────────────────── */
  if (step === "category") {
    return (
      <div className="space-y-3">

        {/* Back to display (if a role was already set) */}
        {currentRole && (
          <button
            onClick={() => setStep("display")}
            className="flex items-center gap-1 text-xs font-bold"
            style={{ color: ACCENT }}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Cancel
          </button>
        )}

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your role…"
            className="w-full pl-9 pr-8 py-2.5 text-sm rounded-xl border border-white/50 bg-white/60
                       focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search results */}
        {searchQuery ? (
          <div className="space-y-1">
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 px-1">No roles match &ldquo;{search}&rdquo;</p>
            ) : (
              searchResults.map((role) => (
                <button
                  key={role.id}
                  onClick={() => handleSearchRoleClick(role.id)}
                  className="w-full text-left px-3 py-2.5 rounded-xl border transition-all hover:bg-white/60 active:scale-[0.99] flex items-center justify-between group"
                  style={{ background: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.6)" }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight" style={{ color: "#131b2e" }}>
                      {role.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {ROLE_CATEGORY_EMOJI[role.category]}&nbsp;{ROLE_CATEGORY_LABELS[role.category]}
                    </p>
                  </div>
                  <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground rotate-180 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))
            )}
          </div>

        ) : (
          /* Category grid */
          <div className="grid grid-cols-2 gap-2">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className="flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left hover:shadow-sm active:scale-[0.98]"
                style={{
                  background:   selectedCategory === cat ? `${ACCENT}12` : "rgba(255,255,255,0.45)",
                  borderColor:  selectedCategory === cat ? `${ACCENT}40` : "rgba(255,255,255,0.6)",
                }}
              >
                <span className="text-base leading-none shrink-0">{ROLE_CATEGORY_EMOJI[cat]}</span>
                <span className="text-[11px] font-bold leading-snug" style={{ color: "#131b2e" }}>
                  {ROLE_CATEGORY_LABELS[cat]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── ROLE LIST ─────────────────────────────────────────────── */
  if (step === "roles" && selectedCategory) {
    const roles = getRolesByCategory(selectedCategory);
    return (
      <div className="space-y-3">
        <button
          onClick={() => setStep("category")}
          className="flex items-center gap-1 text-xs font-bold"
          style={{ color: ACCENT }}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back
        </button>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {ROLE_CATEGORY_EMOJI[selectedCategory]}&nbsp;{ROLE_CATEGORY_LABELS[selectedCategory]}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Select your specific role</p>
        </div>

        <div className="space-y-1.5">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => handleRoleClick(role.id)}
              className="w-full text-left px-4 py-3 rounded-xl border transition-all hover:shadow-sm active:scale-[0.99] flex items-center justify-between"
              style={{ background: "rgba(255,255,255,0.45)", borderColor: "rgba(255,255,255,0.6)" }}
            >
              <span className="text-sm font-semibold" style={{ color: "#131b2e" }}>{role.label}</span>
              <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground rotate-180 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── TARGET MARKETS ────────────────────────────────────────── */
  if (step === "markets" && selectedRole) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setStep("roles")}
          className="flex items-center gap-1 text-xs font-bold"
          style={{ color: ACCENT }}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back
        </button>

        <div>
          <p className="text-sm font-bold" style={{ color: "#131b2e" }}>
            Who do you want to reach?
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aurora prioritises leads based on your targets. You can change this anytime.
          </p>
        </div>

        {/* Default markets — pre-ticked */}
        {defaultMarkets.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Recommended for {selectedRole.label}
            </p>
            {defaultMarkets.map((market) => (
              <MarketCheckbox
                key={market}
                market={market}
                checked={checkedMarkets.has(market)}
                onToggle={() => toggleMarket(market)}
                recommended
              />
            ))}
          </div>
        )}

        {/* Extra markets — un-ticked suggestions */}
        {extraMarkets.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              You might also target
            </p>
            {extraMarkets.map((market) => (
              <MarketCheckbox
                key={market}
                market={market}
                checked={checkedMarkets.has(market)}
                onToggle={() => toggleMarket(market)}
              />
            ))}
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving || checkedMarkets.size === 0}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white
                     disabled:opacity-60 transition-opacity hover:opacity-90"
          style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
        >
          {saving ? <Spinner className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          {saving
            ? "Saving…"
            : `Save — ${checkedMarkets.size} market${checkedMarkets.size !== 1 ? "s" : ""} selected`}
        </button>
      </div>
    );
  }

  return null;
}

/* ─── MarketCheckbox ───────────────────────────────────────────── */
function MarketCheckbox({
  market,
  checked,
  onToggle,
  recommended = false,
}: {
  market:      TargetMarket;
  checked:     boolean;
  onToggle:    () => void;
  recommended?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left"
      style={{
        background:  checked ? `${ACCENT}08` : "rgba(255,255,255,0.4)",
        borderColor: checked ? `${ACCENT}40` : "rgba(255,255,255,0.6)",
      }}
    >
      {/* Checkbox visual */}
      <div
        className="w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all"
        style={{
          background:  checked ? `linear-gradient(135deg,${ACCENT},${ACCENT2})` : "transparent",
          borderColor: checked ? ACCENT : "#d1d5db",
        }}
      >
        {checked && <Check className="w-2.5 h-2.5 text-white" />}
      </div>

      <span className="text-xs font-medium flex-1" style={{ color: "#131b2e" }}>
        {TARGET_MARKET_LABELS[market] ?? market}
      </span>

      {recommended && (
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
          style={{ background: `${ACCENT}15`, color: ACCENT }}
        >
          Recommended
        </span>
      )}
    </button>
  );
}
