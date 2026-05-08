"use client";

/**
 * components/onboarding/RolePickerModal.tsx
 *
 * Three-step role picker used in onboarding and settings.
 *
 * Step 1 — Category grid (or search results if query is active)
 * Step 2 — Sub-role list within chosen category
 * Step 3 — Target market checkboxes (pre-ticked from defaultTargetMarkets)
 *
 * Usage — full-screen overlay (onboarding):
 *   <RolePickerModal overlay onComplete={handleComplete} />
 *
 * Usage — inline (settings):
 *   <RolePickerModal onComplete={handleComplete} initialRoleId="bridal_mua" />
 */

import { useState, useMemo, useCallback } from "react";
import { ArrowLeft, Search, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  ROLES,
  ROLES_BY_CATEGORY,
  ROLE_CATEGORY_LABELS,
  ROLE_CATEGORY_EMOJI,
  TARGET_MARKET_LABELS,
  getRoleById,
} from "@/lib/roles";
import type { RoleCategory, RoleConfig, TargetMarket } from "@/lib/roles";

// ── Brand constants ───────────────────────────────────────────────────────────
const ACCENT  = "#7c6ef7";
const ACCENT2 = "#9585f9";

// ── Ordered category list so grid is always deterministic ─────────────────────
const CATEGORIES: RoleCategory[] = [
  "creative_visual",
  "production_film",
  "events_hospitality",
  "business_professional",
  "wellness_personal",
  "tech_digital",
  "media_publishing",
  "other",
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface RolePickerModalProps {
  onComplete: (roleId: string, targetMarkets: string[]) => void;
  /** If true, wraps the picker in a fixed full-screen overlay */
  overlay?: boolean;
  initialRoleId?: string;
  initialTargetMarkets?: string[];
}

// ── Step type ─────────────────────────────────────────────────────────────────

type Step = "category" | "roles" | "markets";

// ─────────────────────────────────────────────────────────────────────────────

export function RolePickerModal({
  onComplete,
  overlay = false,
  initialRoleId,
  initialTargetMarkets,
}: RolePickerModalProps) {
  // ── State ──────────────────────────────────────────────────────────────────

  const [step,             setStep]            = useState<Step>("category");
  const [searchQuery,      setSearchQuery]     = useState("");
  const [activeCategory,   setActiveCategory]  = useState<RoleCategory | null>(null);
  const [selectedRole,     setSelectedRole]    = useState<RoleConfig | null>(
    initialRoleId ? (getRoleById(initialRoleId) ?? null) : null
  );
  const [selectedMarkets,  setSelectedMarkets] = useState<Set<string>>(
    new Set(initialTargetMarkets ?? [])
  );

  // ── Search — filters all roles across all categories ─────────────────────
  const trimmed = searchQuery.trim().toLowerCase();
  const searchResults: RoleConfig[] = useMemo(() => {
    if (!trimmed) return [];
    return ROLES.filter((r) => r.label.toLowerCase().includes(trimmed));
  }, [trimmed]);

  const isSearching = trimmed.length > 0;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCategoryClick = useCallback((cat: RoleCategory) => {
    setActiveCategory(cat);
    setSearchQuery("");
    setStep("roles");
  }, []);

  const handleRoleClick = useCallback((role: RoleConfig) => {
    setSelectedRole(role);
    // Pre-tick the role's default target markets, preserving any existing
    // selections the user may have made if they're coming back from step 3.
    setSelectedMarkets(new Set(role.defaultTargetMarkets));
    setStep("markets");
  }, []);

  const handleSearchRoleClick = useCallback((role: RoleConfig) => {
    setActiveCategory(role.category);
    handleRoleClick(role);
  }, [handleRoleClick]);

  const toggleMarket = useCallback((market: string) => {
    setSelectedMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(market)) {
        next.delete(market);
      } else {
        next.add(market);
      }
      return next;
    });
  }, []);

  const handleBack = useCallback(() => {
    if (step === "markets") {
      setStep("roles");
    } else if (step === "roles") {
      setStep("category");
      setActiveCategory(null);
    }
  }, [step]);

  const handleComplete = useCallback(() => {
    if (!selectedRole || selectedMarkets.size === 0) return;
    onComplete(selectedRole.id, Array.from(selectedMarkets));
  }, [selectedRole, selectedMarkets, onComplete]);

  // ── Inner content ─────────────────────────────────────────────────────────

  const content = (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="shrink-0 px-5 pt-5 pb-3 space-y-3">

        {/* Title row */}
        <div className="flex items-center gap-2">
          {step !== "category" && (
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-70"
              style={{ color: ACCENT }}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <div className="flex-1">
            {step === "category" && (
              <>
                <h2 className="text-lg font-extrabold tracking-tight" style={{ color: "#131b2e" }}>
                  What do you do?
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose your category to get started
                </p>
              </>
            )}
            {step === "roles" && activeCategory && (
              <>
                <h2 className="text-lg font-extrabold tracking-tight" style={{ color: "#131b2e" }}>
                  {ROLE_CATEGORY_EMOJI[activeCategory]}{" "}
                  {ROLE_CATEGORY_LABELS[activeCategory]}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pick the role that best describes your work
                </p>
              </>
            )}
            {step === "markets" && selectedRole && (
              <>
                <h2 className="text-lg font-extrabold tracking-tight" style={{ color: "#131b2e" }}>
                  Who do you want to reach?
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  We've pre-selected the best targets for a {selectedRole.label}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Search — only visible on step 1 */}
        {step === "category" && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search your role…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 pt-0.5">
          {(["category", "roles", "markets"] as Step[]).map((s, i) => (
            <div
              key={s}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: step === s ? "24px" : "8px",
                background: step === s
                  ? `linear-gradient(90deg, ${ACCENT}, ${ACCENT2})`
                  : step === "markets" && i < 2
                  ? `${ACCENT}60`
                  : step === "roles" && i < 1
                  ? `${ACCENT}60`
                  : "rgba(0,0,0,0.12)",
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2.5">

        {/* ─── Step 1: Category grid (or search results) ─── */}
        {step === "category" && (
          <>
            {isSearching ? (
              /* Search results — flat list */
              searchResults.length > 0 ? (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs text-muted-foreground font-medium px-0.5">
                    {searchResults.length} role{searchResults.length !== 1 ? "s" : ""} found
                  </p>
                  {searchResults.map((role) => (
                    <SearchResultRow
                      key={role.id}
                      role={role}
                      onClick={() => handleSearchRoleClick(role)}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    No roles match "<span className="font-semibold">{trimmed}</span>"
                  </p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-2 text-xs font-semibold transition-opacity hover:opacity-70"
                    style={{ color: ACCENT }}
                  >
                    Clear search
                  </button>
                </div>
              )
            ) : (
              /* Category grid */
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {CATEGORIES.map((cat) => {
                  const roles = ROLES_BY_CATEGORY[cat];
                  if (roles.length === 0) return null;
                  return (
                    <CategoryCard
                      key={cat}
                      category={cat}
                      roleCount={roles.length}
                      onClick={() => handleCategoryClick(cat)}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ─── Step 2: Sub-role list ─── */}
        {step === "roles" && activeCategory && (
          <div className="space-y-1.5 pt-1">
            {ROLES_BY_CATEGORY[activeCategory].map((role) => (
              <RoleRow
                key={role.id}
                role={role}
                isSelected={selectedRole?.id === role.id}
                onClick={() => handleRoleClick(role)}
              />
            ))}
          </div>
        )}

        {/* ─── Step 3: Target markets ─── */}
        {step === "markets" && selectedRole && (
          <div className="space-y-2 pt-1">
            {/* Role summary chip */}
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-1"
              style={{ background: `${ACCENT}14`, color: ACCENT }}
            >
              <span>{ROLE_CATEGORY_EMOJI[selectedRole.category]}</span>
              {selectedRole.label}
            </div>

            {/* All target markets as checkboxes — defaultTargetMarkets pre-ticked */}
            {(Object.keys(TARGET_MARKET_LABELS) as TargetMarket[]).map((market) => {
              const isDefault  = selectedRole.defaultTargetMarkets.includes(market);
              const isChecked  = selectedMarkets.has(market);
              return (
                <MarketCheckbox
                  key={market}
                  market={market}
                  label={TARGET_MARKET_LABELS[market]}
                  isChecked={isChecked}
                  isDefault={isDefault}
                  onToggle={() => toggleMarket(market)}
                />
              );
            })}

            <p className="text-[11px] text-muted-foreground pt-1">
              Pre-ticked targets are the best fit for your role. Add or remove any you like.
            </p>
          </div>
        )}
      </div>

      {/* ── Sticky footer — confirm button (step 3 only) ── */}
      {step === "markets" && (
        <div
          className="shrink-0 px-5 pb-5 pt-3 border-t border-white/30"
          style={{ background: "rgba(255,255,255,0.60)", backdropFilter: "blur(12px)" }}
        >
          <button
            onClick={handleComplete}
            disabled={selectedMarkets.size === 0}
            className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              background:  `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
              boxShadow:   selectedMarkets.size > 0 ? `0 4px 16px ${ACCENT}40` : "none",
            }}
          >
            <Check className="w-4 h-4" />
            Confirm — {selectedMarkets.size} target{selectedMarkets.size !== 1 ? "s" : ""} selected
          </button>
          {selectedMarkets.size === 0 && (
            <p className="text-[11px] text-center text-muted-foreground mt-2">
              Select at least one target market to continue
            </p>
          )}
        </div>
      )}
    </div>
  );

  // ── Overlay vs inline ─────────────────────────────────────────────────────

  if (overlay) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ background: "rgba(19,27,46,0.55)", backdropFilter: "blur(6px)" }}
      >
        <div
          className="glass-panel rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg flex flex-col overflow-hidden"
          style={{
            maxHeight: "92dvh",
            boxShadow: "0 24px 80px rgba(124,110,247,0.22), 0 8px 32px rgba(0,0,0,0.14)",
          }}
        >
          {content}
        </div>
      </div>
    );
  }

  // Inline (settings / wizard step without overlay)
  return (
    <div
      className="glass-card rounded-3xl overflow-hidden flex flex-col"
      style={{ maxHeight: "680px" }}
    >
      {content}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CategoryCard({
  category,
  roleCount,
  onClick,
}: {
  category: RoleCategory;
  roleCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="glass-card glass-card-hover rounded-2xl p-4 text-left flex flex-col gap-2 transition-all active:scale-[0.97]"
      style={{ borderTop: `2px solid ${ACCENT}22` }}
    >
      <span className="text-2xl leading-none" role="img" aria-label={ROLE_CATEGORY_LABELS[category]}>
        {ROLE_CATEGORY_EMOJI[category]}
      </span>
      <div>
        <p className="text-sm font-bold leading-snug" style={{ color: "#131b2e" }}>
          {ROLE_CATEGORY_LABELS[category]}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {roleCount} role{roleCount !== 1 ? "s" : ""}
        </p>
      </div>
    </button>
  );
}

function RoleRow({
  role,
  isSelected,
  onClick,
}: {
  role: RoleConfig;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl transition-all active:scale-[0.98]"
      style={{
        background:  isSelected
          ? `linear-gradient(135deg, ${ACCENT}18, ${ACCENT2}10)`
          : "rgba(255,255,255,0.55)",
        border:      `1.5px solid ${isSelected ? ACCENT + "60" : "rgba(255,255,255,0.60)"}`,
        boxShadow:   isSelected ? `0 2px 12px ${ACCENT}20` : "none",
      }}
    >
      <span
        className="text-sm font-semibold"
        style={{ color: isSelected ? ACCENT : "#131b2e" }}
      >
        {role.label}
      </span>
      {isSelected && (
        <span
          className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: ACCENT }}
        >
          <Check className="w-3 h-3 text-white" />
        </span>
      )}
    </button>
  );
}

function SearchResultRow({
  role,
  onClick,
}: {
  role: RoleConfig;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center justify-between gap-3 px-4 py-3 rounded-2xl glass-card glass-card-hover transition-all active:scale-[0.98]"
    >
      <div>
        <p className="text-sm font-semibold" style={{ color: "#131b2e" }}>
          {role.label}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {ROLE_CATEGORY_EMOJI[role.category]}{" "}
          {ROLE_CATEGORY_LABELS[role.category]}
        </p>
      </div>
      <ArrowLeft className="w-3.5 h-3.5 rotate-180 text-muted-foreground shrink-0" />
    </button>
  );
}

function MarketCheckbox({
  market,
  label,
  isChecked,
  isDefault,
  onToggle,
}: {
  market: string;
  label: string;
  isChecked: boolean;
  isDefault: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all active:scale-[0.98]"
      style={{
        background: isChecked
          ? `linear-gradient(135deg, ${ACCENT}12, ${ACCENT2}08)`
          : "rgba(255,255,255,0.45)",
        border: `1.5px solid ${isChecked ? ACCENT + "50" : "rgba(255,255,255,0.55)"}`,
      }}
    >
      {/* Custom checkbox */}
      <span
        className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all"
        style={{
          background: isChecked ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` : "rgba(0,0,0,0.06)",
          border:     isChecked ? "none" : "1.5px solid rgba(0,0,0,0.15)",
          boxShadow:  isChecked ? `0 2px 8px ${ACCENT}40` : "none",
        }}
      >
        {isChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </span>

      <span
        className="flex-1 text-sm font-medium leading-snug"
        style={{ color: isChecked ? "#131b2e" : "#64748b" }}
      >
        {label}
      </span>

      {/* "Recommended" pill — only on defaultTargetMarkets */}
      {isDefault && (
        <span
          className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: `${ACCENT}14`, color: ACCENT }}
        >
          Recommended
        </span>
      )}
    </button>
  );
}
