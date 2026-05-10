"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useKammie } from "./kammie-app";
import { typeLabels } from "@/lib/types";
import type { OpportunityType } from "@/lib/types";
import {
  Search,
  MapPin,
  Star,
  Heart,
  Loader2,
  Filter,
  Sparkles,
  ExternalLink,
  Grid3X3,
  Map as MapIcon,
  Instagram,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Mail,
  FileText,
  Copy,
  Check,
  Building2,
  Users,
  UserSearch,
  X,
} from "lucide-react";
import { useVenueEnrichment } from "@/hooks/useVenueEnrichment";
import type { VenueEnrichmentResult } from "@/hooks/useVenueEnrichment";
import { CompanyCard } from "@/components/discover/CompanyCard";
import type { ApolloCompany, ApolloPerson } from "@/lib/apollo";
import { getRoleById } from "@/lib/roles";

/* ─── Constants ──────────────────────────────── */
const ACCENT  = "#7c6ef7";
const ACCENT2 = "#9585f9";

// Module-level cache: placeIds we've already attempted Instagram lookup for.
// Persists across re-renders so navigating back doesn't re-fire.
const igFetchedIds = new Set<string>();

type ViewMode = "grid" | "map";

type Persona = "photographer" | "mua" | "startup" | "other";

function getPersona(businessType: string | undefined): Persona {
  const bt = (businessType || "").toLowerCase().trim();
  if (!bt) return "other";
  if (
    bt.includes("photo") || bt.includes("videograph") ||
    bt.includes("cinemat") || bt.includes("film maker") ||
    bt.includes("filmmaker")
  ) return "photographer";
  if (
    bt.includes("makeup") || bt.includes("make-up") ||
    bt.includes("mua") || bt.includes("beauty") ||
    bt.includes("beauty artist") || bt.includes("hair artist") ||
    bt.includes("hair stylist") || bt.includes("hair & makeup") ||
    bt.includes("bridal") || bt.includes("glam") ||
    bt.includes("artist") && (bt.includes("hair") || bt.includes("beauty") || bt.includes("make"))
  ) return "mua";
  if (
    bt.includes("founder") || bt.includes("startup") ||
    bt.includes("start-up") || bt.includes("entrepreneur") ||
    bt.includes("saas") || bt.includes("ceo")
  ) return "startup";
  return "other";
}

/**
 * Resolves the best role_id to send to Apollo, in priority order:
 *  1. profile.roleId — only if it maps to a known entry in lib/roles.ts
 *     (guards against legacy generic strings like "mua" that predate the role picker)
 *  2. businessType detection — derives a specific sub-role from the free-text field
 */
function resolveRoleId(
  roleId: string | undefined,
  businessType: string | undefined
): string | null {
  // Only trust roleId if it actually resolves to a known role config
  if (roleId && getRoleById(roleId)) return roleId;

  // roleId absent or unrecognised (e.g. legacy "mua" / "makeup_artist") —
  // map businessType to the most broadly useful sub-role
  const persona = getPersona(businessType);
  if (persona === "mua")          return "commercial_mua";
  if (persona === "startup")      return "startup_founder_b2b";
  if (persona === "photographer") return "wedding_photographer";
  return null;
}

function getSearchPrompts(businessType: string | undefined, isB2B?: boolean, icpIndustries?: string[]): string[] {
  if (isB2B) {
    const fromIcp = (icpIndustries ?? []).slice(0, 6);
    return fromIcp.length >= 2
      ? fromIcp
      : ["SaaS & software", "Fintech", "E-commerce", "Marketing agencies", "Healthcare tech", "Professional services"];
  }
  switch (getPersona(businessType)) {
    case "photographer":
      return ["Wedding venues", "Luxury hotels", "Event planners", "Florists", "Caterers"];
    case "mua":
      return ["Brands", "PR agencies", "Fashion agencies", "Bridal boutiques", "Salons"];
    case "startup":
      return ["Accelerators", "VCs", "Enterprise companies", "Tech agencies", "Co-working spaces"];
    default:
      return ["Wedding venues", "Hotels", "Event planners", "Restaurants", "Corporate", "Agencies"];
  }
}

function getSearchPlaceholder(businessType: string | undefined, isB2B?: boolean): string {
  if (isB2B) return "Search companies or tap a suggestion…";
  switch (getPersona(businessType)) {
    case "photographer": return "Search venues and event suppliers…";
    case "mua":          return "Search beauty brands and agencies…";
    case "startup":      return "Search business contacts and companies…";
    default:             return "Search venues or tap a suggestion…";
  }
}

/* ─── Place shape (from API) ────────────────── */
interface Place {
  id: string;
  name: string;
  address?: string;
  rating?: number;
  ratingCount?: number;
  photoReference?: string;
  website?: string;
  types?: string[];
}

/* ─── Simple toast ───────────────────────────── */
interface ToastState {
  id: number;
  message: string;
  icon?: "sparkles" | "check";
}

function ToastNotification({
  toast,
  onDismiss,
}: {
  toast: ToastState;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className="fixed bottom-6 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl"
      style={{
        background:     "rgba(255,255,255,0.95)",
        backdropFilter: "blur(16px)",
        border:         "1px solid rgba(124,110,247,0.20)",
        boxShadow:      `0 8px 32px rgba(124,110,247,0.18)`,
        maxWidth:       "320px",
      }}
    >
      {toast.icon === "sparkles" ? (
        <Sparkles className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
      ) : (
        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
      )}
      <p className="text-sm font-semibold" style={{ color: "#131b2e" }}>
        {toast.message}
      </p>
    </div>
  );
}

/* ─── DiscoverPage ───────────────────────────── */
export function DiscoverPage() {
  const { profile, opportunities, refreshData, setActiveTab, goToProfileSection } = useKammie();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [sortBy, setSortBy] = useState<"score" | "rating" | "newest">("score");
  const [scoreMap, setScoreMap] = useState<Map<string, number>>(new Map());
  const [isSearching, setIsSearching] = useState(false);
  const [isFinding, setIsFinding] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState(new Set<string>());
  const [expandedPlaceId, setExpandedPlaceId] = useState<string | null>(null);
  const [findResult, setFindResult] = useState<{ count: number; message: string } | null>(null);
  const [nearbyLocation, setNearbyLocation] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [lastTextQuery, setLastTextQuery] = useState<string | null>(null);
  const [igMap, setIgMap] = useState<Map<string, string>>(new Map());
  const [apolloCompanies,      setApolloCompanies]      = useState<ApolloCompany[]>([]);
  const [apolloError,          setApolloError]          = useState<string | null>(null);
  const [savedApolloIds,       setSavedApolloIds]       = useState(new Set<string>());
  const [isLoadingApollo,      setIsLoadingApollo]      = useState(false);
  // B2B search mode + filters
  const [searchMode,           setSearchMode]           = useState<"companies" | "contacts">("companies");
  const [filterIndustry,       setFilterIndustry]       = useState("");
  const [filterLocation,       setFilterLocation]       = useState("");
  const [filterSize,           setFilterSize]           = useState("");
  const [contactCompany,       setContactCompany]       = useState("");
  const [contactTitle,         setContactTitle]         = useState("");
  const [contactLocation,      setContactLocation]      = useState("");
  const [apolloContacts,       setApolloContacts]       = useState<ApolloPerson[]>([]);
  const [isLoadingContacts,    setIsLoadingContacts]    = useState(false);
  const [contactsError,        setContactsError]        = useState<string | null>(null);
  const [contactsSearched,     setContactsSearched]     = useState(false);
  const toastCounter = useRef(0);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Keep savedIds in sync with the global opportunities list
  useEffect(() => {
    const ids = new Set(opportunities.map((o) => o.googlePlaceId).filter(Boolean) as string[]);
    setSavedIds(ids);
  }, [opportunities]);

  // Build a placeId → instagram-handle map from already-saved opportunities
  // (contact_methods were populated by find-opportunities or enrich-venue)
  // Zero API cost — comes straight from global state.
  const savedInstagramMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const opp of opportunities) {
      if (!opp.googlePlaceId) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ig = (opp as any).contactMethods?.find(
        (c: { type: string; value: string }) => c.type === "instagram"
      );
      if (ig?.value) map.set(opp.googlePlaceId, ig.value);
    }
    return map;
  }, [opportunities]);

  useEffect(() => {
    const load = async () => {
      setIsLoadingInitial(true);
      try {
        const res = await fetch("/api/places/search");
        const data = await res.json();
        if (data.places) {
          setSearchResults(data.places);
          setNearbyLocation(data.location || "");
          setNextPageToken(data.nextPageToken || null);
          setLastTextQuery(data.textQuery || null);
          // Background: fetch Instagram handles for visible tiles
          fetchInstagramBatch(data.places).catch(() => {});
        }
      } catch (e) {
        console.error("Failed to load venues:", e);
      } finally {
        setIsLoadingInitial(false);
      }
    };
    load();
  }, []);

  const isB2B = !!(profile?.companyAnalysis || profile?.icp);

  // Load Apollo companies — ICP mode (B2B) takes priority over role-based (freelancer)
  useEffect(() => {
    if (searchMode === "contacts") return; // contacts handled separately
    const icp     = profile?.icp;
    const roleId  = resolveRoleId(profile?.roleId, profile?.businessType);

    // Neither ICP nor role — use Google Places (photographer flow)
    if (!icp && !roleId) return;

    let cancelled = false;
    const load = async () => {
      setIsLoadingApollo(true);
      setApolloError(null);
      try {
        let requestBody: Record<string, unknown>;

        if (icp || isB2B) {
          // ── B2B / ICP mode — pass filters alongside ICP ─────────────────
          const filters = {
            industry: filterIndustry || undefined,
            location: filterLocation || undefined,
            size:     filterSize     || undefined,
          };
          requestBody = { icp: icp ?? {}, company_analysis: profile?.companyAnalysis, filters };
        } else {
          // ── Freelancer / role-based mode ────────────────────────────────
          const userTargetMarkets = profile?.targetMarkets ?? [];
          const role = roleId ? getRoleById(roleId) : undefined;
          const effectiveTargetMarkets =
            userTargetMarkets.length > 0
              ? userTargetMarkets
              : (role?.defaultTargetMarkets ?? []);
          requestBody = { role_id: roleId, target_markets: effectiveTargetMarkets };
        }

        const res = await fetch("/api/apollo/companies", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(requestBody),
        });
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json();
            if (data.error) {
              setApolloError(data.error);
            } else {
              setApolloCompanies(data.companies ?? []);
            }
          } else {
            const text = await res.text().catch(() => "");
            console.error("[apollo] companies fetch failed:", res.status, text);
            setApolloError(`API error (${res.status})`);
          }
        }
      } catch (err) {
        console.error("[apollo] companies fetch error:", err);
        if (!cancelled) setApolloError("Network error — check connection");
      } finally {
        if (!cancelled) setIsLoadingApollo(false);
      }
    };
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.icp, profile?.roleId, profile?.businessType, profile?.targetMarkets, searchMode, filterIndustry, filterLocation, filterSize]);

  // Load Apollo contacts (B2B contacts mode)
  const fetchContacts = useCallback(async () => {
    if (!contactCompany && !contactTitle && !contactLocation) return;
    setIsLoadingContacts(true);
    setContactsError(null);
    setContactsSearched(true);
    try {
      const res = await fetch("/api/apollo/contacts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          company:  contactCompany  || undefined,
          title:    contactTitle    || undefined,
          location: contactLocation || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setApolloContacts(data.contacts ?? []);
      } else {
        setContactsError("Could not load contacts — try different filters");
      }
    } catch (err) {
      console.error("[apollo] contacts fetch error:", err);
      setContactsError("Network error — check your connection");
    } finally {
      setIsLoadingContacts(false);
    }
  }, [contactCompany, contactTitle, contactLocation]);

  // Infinite scroll
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !nextPageToken) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0, rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextPageToken]);

  const loadMore = async () => {
    if (isLoadingMore) return;
    const token = nextPageToken;
    if (!token) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery || undefined, location: profile?.location, pageToken: token, textQuery: lastTextQuery || undefined }),
      });
      const data = await res.json();
      if (data.places && data.places.length > 0) {
        setSearchResults((prev) => [...prev, ...data.places]);
      }
      setNextPageToken(data.nextPageToken || null);
    } catch (e) {
      console.error("Load more failed:", e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleAISearch = async () => {
    setIsFinding(true);
    setFindResult(null);
    try {
      const response = await fetch("/api/find-opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery || undefined, type: selectedType !== "all" ? selectedType : undefined }),
      });
      const data = await response.json();
      if (data.success) {
        await refreshData();
        if (data.created > 0) setActiveTab("home");
        else setFindResult({ count: 0, message: data.message || "No new opportunities found." });
      } else {
        setFindResult({ count: 0, message: data.error || "Failed to find opportunities" });
      }
    } catch {
      setFindResult({ count: 0, message: "Something went wrong. Please try again." });
    } finally {
      setIsFinding(false);
    }
  };

  const handleSearch = async (query?: string) => {
    const q = query !== undefined ? query : searchQuery;
    if (!q || !q.trim()) return;
    setIsSearching(true);
    setNextPageToken(null);
    try {
      const response = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, location: profile?.location, type: selectedType !== "all" ? selectedType : undefined }),
      });
      const data = await response.json();
      if (data.places) {
        setSearchResults(data.places);
        setNextPageToken(data.nextPageToken || null);
        setLastTextQuery(data.textQuery || null);
        fetchInstagramBatch(data.places).catch(() => {});
      }
    } catch {
      console.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  // Called by DiscoverCard after a successful save
  const handleSaved = useCallback((placeId: string) => {
    setSavedIds((prev) => new Set([...prev, placeId]));
    // Silent refresh — don't show the global loading spinner which would unmount DiscoverPage
    refreshData(true).catch(() => {});
  }, [refreshData]);

  const handleApolloSaved = useCallback((companyId: string) => {
    setSavedApolloIds((prev) => new Set([...prev, companyId]));
    refreshData(true).catch(() => {});
  }, [refreshData]);

  // Background Instagram handle fetch — Firecrawl only, no Claude (skip_ai=true).
  // Processes 3 venues at a time; uses module-level igFetchedIds to avoid duplicates.
  const fetchInstagramBatch = useCallback(async (places: Place[]) => {
    const unfetched = places.filter(
      (p) => p.website && !igFetchedIds.has(p.id) && !savedInstagramMap.has(p.id)
    );
    // Cap at 12 to limit Firecrawl spend per page load
    const todo = unfetched.slice(0, 12);
    for (let i = 0; i < todo.length; i += 3) {
      const batch = todo.slice(i, i + 3);
      await Promise.allSettled(
        batch.map(async (venue) => {
          igFetchedIds.add(venue.id);
          try {
            const res = await fetch("/api/enrich-venue", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                google_place_id: venue.id,
                website_url:     venue.website,
                place_name:      venue.name,
                skip_ai:         true,
              }),
            });
            if (res.ok) {
              const d = await res.json();
              if (d.instagram_handle) {
                setIgMap((prev) => new Map([...prev, [venue.id, d.instagram_handle]]));
              }
            }
          } catch { /* non-fatal */ }
        })
      );
    }
  }, [savedInstagramMap]);

  const showToast = useCallback((message: string, icon: ToastState["icon"] = "sparkles") => {
    const id = ++toastCounter.current;
    setToast({ id, message, icon });
  }, []);

  const handleScoreReady = useCallback((placeId: string, score: number) => {
    setScoreMap((prev) => {
      if (prev.get(placeId) === score) return prev;
      const next = new Map(prev);
      next.set(placeId, score);
      return next;
    });
  }, []);

  const sortedResults = useMemo(() => {
    const arr = [...searchResults];
    if (sortBy === "rating") {
      arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (sortBy === "newest") {
      // Preserve insertion order (searchResults is already newest-last from API pagination,
      // reverse so newest-found comes first)
      arr.reverse();
    } else {
      // Kammie Score: scored cards by descending score, unscored at bottom in original order
      const scored   = arr.filter((p) => scoreMap.has(p.id));
      const unscored = arr.filter((p) => !scoreMap.has(p.id));
      scored.sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0));
      return [...scored, ...unscored];
    }
    return arr;
  }, [searchResults, sortBy, scoreMap]);

  const opportunityTypes = ["all", "venue", "event_organiser", "market", "wedding_planner", "agency", "brand", "publication"];

  const mapQuery = searchResults.length > 0
    ? searchResults.slice(0, 5).map((p) => p.name).join(" ")
    : `event venues near ${profile?.location || nearbyLocation || "London UK"}`;

  const mapSrc = `https://www.google.com/maps/embed/v1/search?key=AIzaSyA1kVerq-mvYsWmObYOTEWZPm4vUbcgmlY&q=${encodeURIComponent(mapQuery)}`;

  /* ── Sticky search + filter bar ── */
  const SearchBar = (
    <div className="space-y-2 sticky top-0 z-10 pb-2"
         style={{ background: 'rgba(242,240,254,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>

      {/* ── B2B mode toggle ── */}
      {isB2B && (
        <div className="space-y-2">
          {/* Companies / Contacts switch */}
          <div className="flex rounded-xl border border-white/60 overflow-hidden glass-card w-fit">
            {(["companies", "contacts"] as const).map(mode => (
              <button key={mode}
                onClick={() => setSearchMode(mode)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition-colors"
                style={searchMode === mode ? { background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, color: "white" } : { color: "var(--muted-foreground)" }}>
                {mode === "companies" ? <Building2 className="w-3.5 h-3.5" /> : <UserSearch className="w-3.5 h-3.5" />}
                {mode === "companies" ? "Companies" : "Contacts"}
              </button>
            ))}
          </div>

          {/* Company filters */}
          {searchMode === "companies" && (
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <input value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)}
                  placeholder="Industry"
                  className="pl-3 pr-7 py-1.5 text-xs rounded-xl border border-white/60 bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 w-32"
                />
                {filterIndustry && <button onClick={() => setFilterIndustry("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-muted-foreground" /></button>}
              </div>
              <div className="relative">
                <input value={filterLocation} onChange={e => setFilterLocation(e.target.value)}
                  placeholder="Location"
                  className="pl-3 pr-7 py-1.5 text-xs rounded-xl border border-white/60 bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 w-32"
                />
                {filterLocation && <button onClick={() => setFilterLocation("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-muted-foreground" /></button>}
              </div>
              <select value={filterSize} onChange={e => setFilterSize(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-white/60 bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30">
                <option value="">Any size</option>
                {["1-10","11-50","51-200","201-1000","1000+"].map(s => <option key={s} value={s}>{s} employees</option>)}
              </select>
            </div>
          )}

          {/* Contact filters */}
          {searchMode === "contacts" && (
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <input value={contactCompany} onChange={e => setContactCompany(e.target.value)}
                  placeholder="Company"
                  className="pl-3 pr-7 py-1.5 text-xs rounded-xl border border-white/60 bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 w-32"
                />
                {contactCompany && <button onClick={() => setContactCompany("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-muted-foreground" /></button>}
              </div>
              <div className="relative">
                <input value={contactTitle} onChange={e => setContactTitle(e.target.value)}
                  placeholder="Title / role"
                  className="pl-3 pr-7 py-1.5 text-xs rounded-xl border border-white/60 bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 w-32"
                />
                {contactTitle && <button onClick={() => setContactTitle("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-muted-foreground" /></button>}
              </div>
              <div className="relative">
                <input value={contactLocation} onChange={e => setContactLocation(e.target.value)}
                  placeholder="Location"
                  className="pl-3 pr-7 py-1.5 text-xs rounded-xl border border-white/60 bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 w-32"
                />
                {contactLocation && <button onClick={() => setContactLocation("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-muted-foreground" /></button>}
              </div>
              <button onClick={fetchContacts}
                disabled={isLoadingContacts || (!contactCompany && !contactTitle && !contactLocation)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-40"
                style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
                {isLoadingContacts ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserSearch className="w-3 h-3" />}
                Search
              </button>
            </div>
          )}
        </div>
      )}
      {/* Search input row */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          {isSearching
            ? <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
            : <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          }
          <Input
            placeholder={getSearchPlaceholder(profile?.businessType, isB2B)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10"
          />
        </div>
      </div>

      {/* Suggestion chips */}
      <div className="flex flex-wrap gap-1.5">
        {getSearchPrompts(profile?.businessType, isB2B, profile?.icp?.industries).map((prompt) => {
          const isActive = isB2B ? filterIndustry === prompt : searchQuery === prompt;
          return (
            <button
              key={prompt}
              onClick={() => {
                if (isB2B) {
                  // Set industry filter — Apollo useEffect re-fires automatically
                  setFilterIndustry((prev) => prev === prompt ? "" : prompt);
                } else {
                  setSearchQuery(prompt);
                  handleSearch(prompt);
                }
              }}
              className={`px-3 py-1 text-xs rounded-full border font-semibold transition-all ${
                isActive
                  ? "text-white border-transparent shadow-sm"
                  : "glass-card border-white/60 text-foreground hover:border-primary/30"
              }`}
              style={isActive ? { background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 2px 8px ${ACCENT}40` } : {}}
            >
              {prompt}
            </button>
          );
        })}
      </div>

      {/* Filter + view toggle row */}
      <div className="flex items-center gap-2">
        {!isB2B && (
          <Select value={selectedType} onValueChange={(v) => setSelectedType(v)}>
            <SelectTrigger className="w-[130px] shrink-0">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {opportunityTypes.filter((t) => t !== "all").map((type) => (
                <SelectItem key={type} value={type}>
                  {typeLabels[type as OpportunityType] || type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as "score" | "rating" | "newest")}>
          <SelectTrigger className="w-[150px] shrink-0">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Kammie Score</SelectItem>
            <SelectItem value="rating">Rating</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex rounded-xl border border-white/60 overflow-hidden shrink-0 glass-card">
          <button
            onClick={() => setViewMode("grid")}
            className={`px-3 py-2 flex items-center transition-colors ${viewMode === "grid" ? "text-white" : "hover:bg-white/30 text-muted-foreground"}`}
            style={viewMode === "grid" ? { background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` } : {}}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={`px-3 py-2 flex items-center transition-colors ${viewMode === "map" ? "text-white" : "hover:bg-white/30 text-muted-foreground"}`}
            style={viewMode === "map" ? { background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` } : {}}
          >
            <MapIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="lg:hidden">
          <h1 className="text-xl font-extrabold tracking-tight">Discover</h1>
          <p className="text-xs text-muted-foreground">Find your next opportunity</p>
        </div>
        <div className="hidden lg:block" />
        {/* AI Find — always top-right */}
        <button
          onClick={handleAISearch}
          disabled={isFinding}
          className="rounded-2xl font-bold text-white px-4 py-2 text-sm flex items-center gap-1.5 shadow-md hover:opacity-90 transition-all active:scale-[0.97] disabled:opacity-60"
          style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 4px 12px ${ACCENT}40` }}
        >
          {isFinding ? <><Loader2 className="w-4 h-4 animate-spin" />Finding…</> : <><Sparkles className="w-4 h-4" />AI Find</>}
        </button>
      </div>

      {!profile?.businessType && (
        <button
          onClick={() => goToProfileSection("my-profile")}
          className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-80"
          style={{ background: `${ACCENT}14`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
        >
          <span>Tell Kammie what you do →</span>
        </button>
      )}

      {findResult && (
        <div className={`glass-card rounded-2xl p-3 text-sm font-medium ${findResult.count > 0 ? "border-primary/20 text-primary" : "text-muted-foreground"}`}>
          {findResult.message}
        </div>
      )}

      {/* ── Sticky search + filters ── */}
      {SearchBar}

      {/* ════════════════════════════════
          GRID VIEW
      ════════════════════════════════ */}
      {viewMode === "grid" && (
        <div className="space-y-4">
          {isLoadingInitial ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                     style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 8px 24px ${ACCENT}40` }}>
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                </div>
                <p className="text-sm text-muted-foreground">{isB2B ? "Finding companies for you…" : "Finding leads near you…"}</p>
              </div>
            </div>
          ) : searchResults.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? `${searchResults.length} results for "${searchQuery}"`
                  : `${searchResults.length} leads near ${nearbyLocation || "you"}`}
              </p>

              {/* B2B contacts mode */}
              {isB2B && searchMode === "contacts" && (
                isLoadingContacts ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching contacts…
                    </div>
                  </div>
                ) : contactsError ? (
                  <div className="glass-panel rounded-3xl p-8 text-center space-y-2">
                    <p className="text-sm font-semibold text-amber-600 flex items-center justify-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      {contactsError}
                    </p>
                  </div>
                ) : apolloContacts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {apolloContacts.map(person => (
                      <ContactCard key={person.id} person={person} />
                    ))}
                  </div>
                ) : (
                  <div className="glass-panel rounded-3xl p-8 text-center">
                    <UserSearch className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm text-muted-foreground">
                      {contactsSearched
                        ? "No contacts found — try different filters"
                        : "Enter a company, role, or location above to search contacts"}
                    </p>
                  </div>
                )
              )}

              {/* Responsive card grid: 1 col mobile / 2 col tablet / 3 col desktop */}
              {(!isB2B || searchMode === "companies") && (() => {
                const resolvedRoleId = resolveRoleId(profile?.roleId, profile?.businessType);
                const useApollo = resolvedRoleId !== null || isB2B;
                if (useApollo) {
                  if (isLoadingApollo) {
                    return (
                      <div className="flex items-center justify-center py-8">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Finding companies…
                        </div>
                      </div>
                    );
                  }
                  if (apolloError) {
                    return (
                      <div className="glass-panel rounded-3xl p-8 text-center space-y-2">
                        <p className="text-sm font-semibold text-amber-600 flex items-center justify-center gap-1.5">
                          <AlertTriangle className="w-4 h-4" />
                          Apollo connection issue
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Could not load companies. Please check that your Apollo API key is valid in your Vercel environment variables.
                        </p>
                      </div>
                    );
                  }
                  if (apolloCompanies.length === 0) {
                    return (
                      <div className="glass-panel rounded-3xl p-8 text-center">
                        <p className="text-sm text-muted-foreground">No companies found. Try a different search.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {apolloCompanies.map((company) => (
                        <CompanyCard
                          key={company.id}
                          company={company}
                          roleId={resolvedRoleId}
                          isSaved={savedApolloIds.has(company.id)}
                          onSaved={handleApolloSaved}
                          onToast={showToast}
                          userProfession={profile?.businessType ?? ""}
                          userAbout={profile?.pitch ?? ""}
                          userSpecialityTags={profile?.specialityTags ?? []}
                          userLocation={profile?.location ?? ""}
                          icp={profile?.icp}
                          companyAnalysis={profile?.companyAnalysis}
                        />
                      ))}
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sortedResults.map((place) => (
                      <DiscoverCard
                        key={place.id}
                        place={place}
                        isSaved={savedIds.has(place.id)}
                        savedInstagram={savedInstagramMap.get(place.id) ?? null}
                        igHandle={igMap.get(place.id) ?? null}
                        onSaved={handleSaved}
                        onToast={showToast}
                        selectedType={selectedType}
                        isExpanded={expandedPlaceId === place.id}
                        onToggle={() =>
                          setExpandedPlaceId(
                            expandedPlaceId === place.id ? null : place.id
                          )
                        }
                        onScoreReady={handleScoreReady}
                      />
                    ))}
                  </div>
                );
              })()}

              {/* Infinite scroll sentinel + load more button */}
              <div ref={loadMoreRef} className="py-4 flex flex-col items-center gap-2">
                {isLoadingMore && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {(apolloCompanies.length > 0 || profile?.icp) ? "Loading more prospects…" : "Loading more venues…"}
                  </div>
                )}
                {!isLoadingMore && nextPageToken && (
                  <Button variant="outline" size="sm" onClick={loadMore} className="text-xs rounded-xl">
                    {(apolloCompanies.length > 0 || profile?.icp) ? "Load more prospects" : "Load more venues"}
                  </Button>
                )}
                {!isLoadingMore && !nextPageToken && searchResults.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {(apolloCompanies.length > 0 || profile?.icp) ? "All prospects loaded" : "All venues loaded"}
                  </p>
                )}
              </div>
            </>
          ) : !isSearching ? (
            <div className="glass-panel rounded-3xl p-8 text-center">
              <div className="w-14 h-14 rounded-3xl flex items-center justify-center mx-auto mb-3"
                   style={{ background: `rgba(124,110,247,0.10)` }}>
                <MapPin className="w-7 h-7" style={{ color: `${ACCENT}80` }} />
              </div>
              <h3 className="font-semibold mb-2" style={{ color: "#131b2e" }}>
                {profile?.icp ? "No Prospects Found" : "No Venues Found"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {profile?.icp
                  ? "Try adjusting your ICP in your profile settings"
                  : "Try a different search or update your location in your profile."}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* ════════════════════════════════
          MAP VIEW
      ════════════════════════════════ */}
      {viewMode === "map" && (
        <>
          {/* Desktop: 30/70 side-by-side split */}
          <div className="hidden lg:flex gap-4" style={{ height: "calc(100vh - 320px)", minHeight: "480px" }}>

            {/* Left 30% — scrollable card list */}
            <div className="w-[30%] shrink-0 overflow-y-auto space-y-3 pr-1">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                {searchResults.length} leads
              </p>
              {searchResults.slice(0, 12).map((place) => (
                <DiscoverCardCompact
                  key={place.id}
                  place={place}
                  isSaved={savedIds.has(place.id)}
                  savedInstagram={savedInstagramMap.get(place.id) ?? null}
                  igHandle={igMap.get(place.id) ?? null}
                  onSaved={handleSaved}
                  onToast={showToast}
                  selectedType={selectedType}
                />
              ))}
            </div>

            {/* Right 70% — map */}
            <div className="flex-1 rounded-2xl overflow-hidden border border-white/40 shadow-sm">
              <iframe
                title="Venue map"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={mapSrc}
              />
            </div>
          </div>

          {/* Mobile / tablet: stacked */}
          <div className="lg:hidden space-y-3">
            <div className="rounded-2xl overflow-hidden border border-white/40" style={{ height: "55vmax", minHeight: "260px", maxHeight: "480px" }}>
              <iframe
                title="Venue map"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={mapSrc}
              />
            </div>
            <p className="text-sm text-muted-foreground">{searchResults.length} leads</p>
            {searchResults.slice(0, 5).map((place) => (
              <DiscoverCard
                key={place.id}
                place={place}
                isSaved={savedIds.has(place.id)}
                savedInstagram={savedInstagramMap.get(place.id) ?? null}
                igHandle={igMap.get(place.id) ?? null}
                onSaved={handleSaved}
                onToast={showToast}
                selectedType={selectedType}
                isExpanded={expandedPlaceId === place.id}
                onToggle={() =>
                  setExpandedPlaceId(
                    expandedPlaceId === place.id ? null : place.id
                  )
                }
              />
            ))}
          </div>
        </>
      )}

      {/* ── Toast ── */}
      {toast && (
        <ToastNotification
          key={toast.id}
          toast={toast}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   Vertical venue card — grid view
   Full-width photo (160px) + details + AI analysis
════════════════════════════════════════════════ */
interface DiscoverCardProps {
  place:           Place;
  isSaved:         boolean;
  savedInstagram:  string | null;
  igHandle?:       string | null;
  onSaved:         (placeId: string) => void;
  onToast:         (message: string, icon?: "sparkles" | "check") => void;
  selectedType:    string;
  isExpanded?:     boolean;
  onToggle?:       () => void;
  onScoreReady?:   (placeId: string, score: number) => void;
}

/* ═══════════════════════════════════════════════
   ContactCard — B2B people search result
═══════════════════════════════════════════════ */
function ContactCard({ person }: { person: ApolloPerson }) {
  const [imgFailed, setImgFailed] = useState(false);
  const displayLastName = person.last_name?.includes("*") ? "" : person.last_name ?? "";
  const fullName = [person.first_name, displayLastName].filter(Boolean).join(" ");
  return (
    <div className="glass-card rounded-2xl border border-white/60 p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        {/* Avatar / photo */}
        {person.photo_url && !imgFailed ? (
          <img src={person.photo_url} alt={fullName}
            className="w-10 h-10 rounded-xl object-cover shrink-0"
            onError={() => setImgFailed(true)} />
        ) : (
          <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center font-bold text-sm text-white"
               style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
            {fullName.split(" ").slice(0,2).map(w => w[0]?.toUpperCase()).join("")}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: "#131b2e" }}>{fullName}</p>
          {person.title && <p className="text-[11px] text-muted-foreground truncate">{person.title}</p>}
          {person.organization_name && (
            <p className="text-[11px] font-medium truncate" style={{ color: ACCENT }}>{person.organization_name}</p>
          )}
          {person.city && <p className="text-[10px] text-muted-foreground">{person.city}</p>}
        </div>
      </div>
      <div className="flex gap-2">
        {person.linkedin_url && (
          <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold border border-white/60 bg-white/40 hover:bg-white/70 transition-colors"
            style={{ color: ACCENT }}>
            <ExternalLink className="w-3 h-3" /> LinkedIn
          </a>
        )}
        {person.email && (
          <a href={`mailto:${person.email}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold border border-white/60 bg-white/40 hover:bg-white/70 transition-colors"
            style={{ color: ACCENT }}>
            <Mail className="w-3 h-3" /> Email
          </a>
        )}
      </div>
    </div>
  );
}

function DiscoverCard({
  place, isSaved, savedInstagram, igHandle, onSaved, onToast, selectedType,
  isExpanded = false, onToggle, onScoreReady,
}: DiscoverCardProps) {
  const { profile: dcProfile } = useKammie();
  const isB2BCard = !!(dcProfile?.companyAnalysis || dcProfile?.icp);
  const photoUrl = place.photoReference
    ? `/api/places/photo?ref=${encodeURIComponent(place.photoReference)}&maxWidth=600`
    : null;

  const [isSaving, setIsSaving]       = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);

  const { enrichVenue, enriching, result, error } = useVenueEnrichment();

  // Instagram: saved DB value > background tile fetch > full enrichment result
  const instagramHandle =
    savedInstagram ||
    igHandle ||
    result?.instagram_handle ||
    null;

  // Trigger enrichment when card is expanded for the first time
  useEffect(() => {
    if (isExpanded && !result && !enriching) {
      enrichVenue(place.id, place.website, place.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, place.id]);

  // Report score to parent so the grid can sort by Kammie Score
  useEffect(() => {
    if (result?.signal_score != null) {
      onScoreReady?.(place.id, result.signal_score);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.signal_score]);

  // ── Save to Pipeline ────────────────────────────────────────────────────────
  const handleSaveClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaving || isSaved || saveSuccess) return;

    setIsSaving(true);
    try {
      // Save the opportunity (basic fields only — AI data is written by enrich-venue)
      const res = await fetch("/api/opportunities", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:           place.name,
          type:           selectedType !== "all" ? selectedType : "venue",
          location:       place.address,
          googlePlaceId:  place.id,
          rating:         place.rating,
          ratingCount:    place.ratingCount,
          photoReference: place.photoReference,
          website:        place.website,
          source:         "manual_search",
          status:         "outreach_ready",
          liked:          true,
          // Pass signal score so priority is derived correctly
          signalScore:    result?.signal_score ?? null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      const opportunityId: string = data.id;

      if (opportunityId) {
        // Always trigger the enrichment pipeline — it owns the AI write path and
        // auto-triggers generate-sequence. enrich-venue has a 48hr cache so if
        // the card was already expanded it will skip re-analysis and just trigger copy gen.
        fetch("/api/enrich-venue", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            google_place_id: place.id,
            website_url:     place.website,
            place_name:      place.name,
          }),
        }).catch(() => {});
      }

      setSaveSuccess(true);
      onSaved(place.id);
      onToast("Added to Outreach — Kammie is writing your email sequence", "sparkles");
    } catch (err) {
      console.error("[DiscoverCard] Save failed:", err);
      setSaveError("Couldn't save — tap to retry");
      setIsSaving(false);
    }
  };

  // Signal score badge — shown on card image after enrichment
  const scoreBadge = result
    ? result.signal_score >= 70
      ? { label: "⚡ Strong", bg: "#dcfce7", color: "#15803d" }
      : result.signal_score >= 40
      ? { label: "◆ Good", bg: "#fef9c3", color: "#a16207" }
      : null
    : null;

  return (
    <div
      className="glass-card rounded-2xl overflow-hidden flex flex-col cursor-pointer transition-all"
      style={{ borderTop: `3px solid ${ACCENT}` }}
      onClick={onToggle}
    >

      {/* Photo — full width, 160px tall */}
      <div className="relative w-full shrink-0" style={{ height: "160px" }}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={place.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
               style={{ background: `linear-gradient(135deg,rgba(124,110,247,0.10),rgba(149,133,249,0.05))` }}>
            <MapPin className="w-10 h-10" style={{ color: `${ACCENT}40` }} />
          </div>
        )}

        {/* Rating badge */}
        {place.rating && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-lg text-white text-xs font-semibold"
               style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}>
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            {place.rating.toFixed(1)}
            {place.ratingCount && (
              <span className="opacity-75 text-[10px]">({place.ratingCount})</span>
            )}
          </div>
        )}

        {/* Signal score badge — shown after enrichment */}
        {scoreBadge && (
          <div
            className="absolute top-2 left-2 px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1"
            style={{ background: scoreBadge.bg, color: scoreBadge.color }}
          >
            {scoreBadge.label}
          </div>
        )}

        {/* Saved indicator */}
        {(isSaved || saveSuccess) && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-white text-[10px] font-bold"
               style={{ background: `${ACCENT}cc`, backdropFilter: "blur(4px)" }}>
            ✓ Saved
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3 gap-1.5">

        {/* Name + expand toggle */}
        <div className="flex items-start justify-between gap-1">
          <h3 className="font-bold text-sm leading-snug line-clamp-2 flex-1" style={{ color: "#131b2e" }}>
            {place.name}
          </h3>
          <span className="shrink-0 mt-0.5 text-muted-foreground">
            {isExpanded
              ? <ChevronUp className="w-3.5 h-3.5" />
              : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </div>

        {/* Address */}
        {place.address && (
          <p className="text-xs text-muted-foreground line-clamp-1 flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" />
            {place.address}
          </p>
        )}

        {/* Instagram handle — from saved contact_methods or enrichment result */}
        {instagramHandle && (
          <button
            className="flex items-center gap-1 text-xs font-medium w-fit transition-opacity hover:opacity-75"
            style={{ color: "#e1306c" }}
            onClick={(e) => {
              e.stopPropagation();
              window.open(
                `https://instagram.com/${instagramHandle.replace("@", "")}`,
                "_blank"
              );
            }}
          >
            <Instagram className="w-3 h-3" />
            {instagramHandle}
          </button>
        )}

        {/* Website link */}
        {place.website && (
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
            onClick={(e) => {
              e.stopPropagation();
              window.open(place.website, "_blank");
            }}
          >
            <ExternalLink className="w-3 h-3" />
            Website
          </button>
        )}

        {/* Save button — pinned at bottom */}
        <div className="mt-auto pt-2 space-y-1">
          {isSaved || saveSuccess ? (
            <div className="w-full py-2 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5"
                 style={{ color: ACCENT, background: `${ACCENT}12` }}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Added to Outreach
            </div>
          ) : (
            <button
              onClick={handleSaveClick}
              disabled={isSaving}
              className="w-full py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 active:scale-[0.97] flex items-center justify-center gap-1.5 disabled:opacity-70"
              style={{ background: `linear-gradient(135deg,${ACCENT},#9585f9)`, boxShadow: `0 2px 10px ${ACCENT}35` }}
            >
              {isSaving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Adding to Outreach…</>
              ) : (
                <><Heart className="w-3.5 h-3.5" />{saveError ? "Retry" : "Save to Outreach"}</>
              )}
            </button>
          )}
          {saveError && !isSaved && !saveSuccess && (
            <p className="text-[10px] text-red-500 text-center">{saveError}</p>
          )}
        </div>
      </div>

      {/* ── AI Analysis panel — shown when card is expanded ── */}
      {isExpanded && (
        <div
          className="border-t border-white/30 px-3 py-3 space-y-2.5"
          onClick={(e) => e.stopPropagation()}
        >

          {/* Loading state */}
          {enriching && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: ACCENT }} />
                <span className="text-xs font-semibold" style={{ color: ACCENT }}>
                  {isB2BCard ? "Kammie is researching this company…" : "Kammie is researching this venue…"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5 pl-6">
                <p>· Checking their website</p>
                {isB2BCard ? (
                  <>
                    <p>· Analysing company fit</p>
                    <p>· Scoring against your ICP</p>
                  </>
                ) : (
                  <>
                    <p>· Analysing reviews</p>
                    <p>· Scoring fit</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Non-blocking error */}
          {error && !enriching && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              {error}
            </p>
          )}

          {/* Analysis result */}
          {result && !enriching && (
            <VenueAnalysisPanel result={result} accent={ACCENT} />
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   VenueAnalysisPanel — renders the AI enrichment result inside a card
──────────────────────────────────────────────────────────────────────────── */
function VenueAnalysisPanel({
  result,
  accent,
}: {
  result: VenueEnrichmentResult;
  accent: string;
}) {
  const ai = result.ai_analysis;
  const score = result.signal_score;
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Prefer top-level fields (regex-extracted), fall back to Claude's ai_analysis
  const contactEmail   = result.contact_email   ?? ai.contact_email   ?? null;
  const contactFormUrl = result.contact_form_url ?? null;

  const scoreBadge =
    score >= 70
      ? { bg: "#dcfce7", color: "#15803d", label: "Strong lead" }
      : score >= 40
      ? { bg: "#fef9c3", color: "#a16207", label: "Worth trying" }
      : { bg: "#f1f5f9", color: "#64748b", label: "Weak lead" };

  return (
    <div className="space-y-2">

      {/* Signal score badge */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Kammie Score</span>
        <div className="flex items-center gap-1.5">
          <span
            className="px-2 py-0.5 rounded-lg text-xs font-bold"
            style={{ background: scoreBadge.bg, color: scoreBadge.color }}
          >
            {score}/100
          </span>
          <span className="text-[10px] text-muted-foreground">{scoreBadge.label}</span>
        </div>
      </div>

      {/* Contact intel — email and/or enquiry form found on their website */}
      {(contactEmail || contactFormUrl) && (
        <div className="rounded-xl p-2.5 space-y-1.5" style={{ background: 'rgba(124,110,247,0.06)', border: '1px solid rgba(124,110,247,0.15)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: accent }}>
            Contact found
          </p>
          {contactEmail && (
            <div className="flex items-center gap-2 group">
              <Mail className="w-3 h-3 shrink-0" style={{ color: accent }} />
              <a
                href={`mailto:${contactEmail}`}
                className="text-xs font-medium flex-1 truncate hover:underline"
                style={{ color: '#131b2e' }}
                onClick={e => e.stopPropagation()}
              >
                {contactEmail}
              </a>
              <button
                onClick={e => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(contactEmail).catch(() => {});
                  setCopiedEmail(true);
                  setTimeout(() => setCopiedEmail(false), 2000);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
              >
                {copiedEmail
                  ? <Check className="w-3 h-3 text-green-500" />
                  : <Copy className="w-3 h-3 text-muted-foreground" />}
              </button>
            </div>
          )}
          {contactFormUrl && (
            <div className="flex items-center gap-2">
              <FileText className="w-3 h-3 shrink-0 text-amber-500" />
              <a
                href={contactFormUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium hover:underline"
                style={{ color: '#131b2e' }}
                onClick={e => e.stopPropagation()}
              >
                Enquiry form
              </a>
              <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
            </div>
          )}
        </div>
      )}

      {/* Exclusive photographer warning */}
      {ai.has_exclusive_photographer && (
        <div
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl"
          style={{ background: "#fff1f2", border: "1px solid #fecdd3" }}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: "#e11d48" }} />
          <p className="text-xs font-medium" style={{ color: "#be123c" }}>
            May have an exclusive photographer arrangement
          </p>
        </div>
      )}

      {/* Why good lead */}
      {ai.why_good_lead && (
        <p className="text-xs text-muted-foreground leading-relaxed">{ai.why_good_lead}</p>
      )}

      {/* Why bad lead (amber warning) */}
      {ai.why_bad_lead && (
        <p
          className="text-xs leading-relaxed flex items-start gap-1"
          style={{ color: "#92400e" }}
        >
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-amber-500" />
          {ai.why_bad_lead}
        </p>
      )}

      {/* Recommended angle */}
      {ai.recommended_angle && (
        <div
          className="rounded-xl p-2.5"
          style={{
            background:  `${accent}0d`,
            borderLeft:  `2px solid ${accent}50`,
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: accent }}>
            Suggested angle
          </p>
          <p className="text-xs text-muted-foreground leading-snug">{ai.recommended_angle}</p>
        </div>
      )}

      {/* Venue vibe tags */}
      {ai.venue_vibe_tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {ai.venue_vibe_tags.map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
              style={{ background: `${accent}14`, color: accent }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Confidence footnote */}
      {ai.confidence === "low" && (
        <p className="text-[10px] text-muted-foreground/60">
          Low confidence — limited data available for this venue.
        </p>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   Compact horizontal card — map view left sidebar
════════════════════════════════════════════════ */
interface DiscoverCardCompactProps {
  place:          Place;
  isSaved:        boolean;
  savedInstagram: string | null;
  igHandle?:      string | null;
  onSaved:        (placeId: string) => void;
  onToast:        (message: string, icon?: "sparkles" | "check") => void;
  selectedType:   string;
}

function DiscoverCardCompact({
  place, isSaved, savedInstagram, igHandle, onSaved, onToast, selectedType,
}: DiscoverCardCompactProps) {
  const photoUrl = place.photoReference
    ? `/api/places/photo?ref=${encodeURIComponent(place.photoReference)}&maxWidth=200`
    : null;

  const [isSaving, setIsSaving]       = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaving || isSaved || saveSuccess) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/opportunities", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:           place.name,
          type:           selectedType !== "all" ? selectedType : "venue",
          location:       place.address,
          googlePlaceId:  place.id,
          rating:         place.rating,
          ratingCount:    place.ratingCount,
          photoReference: place.photoReference,
          website:        place.website,
          source:         "manual_search",
          status:         "outreach_ready",
          liked:          true,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      if (data.id) {
        fetch("/api/enrich-venue", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            google_place_id: place.id,
            website_url:     place.website,
            place_name:      place.name,
          }),
        }).catch(() => {});
      }
      setSaveSuccess(true);
      onSaved(place.id);
      onToast("Added to Outreach — Kammie is writing your email sequence", "sparkles");
    } catch (err) {
      console.error("[DiscoverCardCompact] Save failed:", err);
      setIsSaving(false);
    }
  };

  const instagramHandle = savedInstagram || igHandle || null;
  const saved = isSaved || saveSuccess;

  return (
    <div className="glass-card glass-card-hover rounded-xl overflow-hidden flex gap-2 p-2" style={{ borderLeft: `3px solid ${ACCENT}` }}>

      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 relative bg-muted/40">
        {photoUrl ? (
          <img src={photoUrl} alt={place.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
               style={{ background: `rgba(124,110,247,0.10)` }}>
            <MapPin className="w-4 h-4" style={{ color: `${ACCENT}60` }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <p className="text-xs font-bold line-clamp-1" style={{ color: "#131b2e" }}>{place.name}</p>
        {place.address && (
          <p className="text-[10px] text-muted-foreground line-clamp-1">{place.address}</p>
        )}
        {place.rating && (
          <div className="flex items-center gap-0.5">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="text-[10px] font-semibold text-muted-foreground">{place.rating.toFixed(1)}</span>
          </div>
        )}
        {instagramHandle && (
          <p className="text-[10px] font-medium truncate" style={{ color: "#e1306c" }}>
            {instagramHandle}
          </p>
        )}
      </div>

      {/* Save icon */}
      <button
        onClick={handleSaveClick}
        disabled={saved || isSaving}
        className={`shrink-0 self-center w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
          saved ? "text-primary" : isSaving ? "opacity-50" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
        }`}
      >
        {isSaving
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <Heart className={`w-4 h-4 ${saved ? "fill-primary" : ""}`} />
        }
      </button>
    </div>
  );
}
