"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAurora } from "./aurora-app";
import { typeLabels } from "@/lib/types";
import type { Opportunity, OpportunityType } from "@/lib/types";
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
} from "lucide-react";

type ViewMode = "grid" | "map";

// Module-level Instagram cache - persists across re-renders within session
const igCache = new Map();

function getSearchPrompts(businessType) {
  const bt = (businessType || "").toLowerCase();
  if (bt.includes("photo") || bt.includes("video")) {
    return ["Wedding venues", "Luxury hotels", "Event planners", "Brands", "Restaurants", "PR agencies"];
  }
  if (bt.includes("flor")) return ["Wedding planners", "Hotels", "Event venues", "Restaurants", "Corporate events"];
  if (bt.includes("cater")) return ["Corporate offices", "Wedding venues", "Private events", "Hotels", "Event planners"];
  if (bt.includes("bak")) return ["Cafes", "Restaurants", "Wedding planners", "Hotels", "Markets"];
  if (bt.includes("music") || bt.includes("dj")) return ["Wedding venues", "Bars", "Hotels", "Corporate events"];
  if (bt.includes("makeup") || bt.includes("hair") || bt.includes("beauty")) return ["Wedding planners", "Spas", "Hotels", "Photo studios"];
  return ["Wedding venues", "Hotels", "Event planners", "Restaurants", "Corporate", "Agencies"];
}

export function DiscoverPage() {
  const { profile, opportunities, refreshData, setActiveTab } = useAurora();
  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [isSearching, setIsSearching] = useState(false);
  const [isFinding, setIsFinding] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const [findResult, setFindResult] = useState(null);
  const [nearbyLocation, setNearbyLocation] = useState("");
  const loadMoreRef = useRef(null);

  useEffect(() => {
    const ids = new Set(opportunities.map(o => o.googlePlaceId).filter(Boolean));
    setSavedIds(ids);
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
        }
      } catch (e) {
        console.error("Failed to load venues:", e);
      } finally {
        setIsLoadingInitial(false);
      }
    };
    load();
  }, []);

  // Infinite scroll - also expose loadMore for manual trigger
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !nextPageToken) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0, rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextPageToken]); // only re-run when token changes, not isLoadingMore

  const loadMore = async () => {
    if (isLoadingMore) return;
    const token = nextPageToken;
    if (!token) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery || undefined, location: profile?.location, pageToken: token }),
      });
      const data = await res.json();
      if (data.places && data.places.length > 0) {
        setSearchResults(prev => [...prev, ...data.places]);
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

  const handleSearch = async (query) => {
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
      }
    } catch {
      console.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSave = async (place) => {
    try {
      let contactMethods = [];
      if (place.website || place.id) {
        try {
          const enrichRes = await fetch("/api/enrich-contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ websiteUrl: place.website, placeId: place.id }),
          });
          if (enrichRes.ok) {
            const { contactInfo } = await enrichRes.json();
            if (contactInfo.emails?.length > 0) {
              contactInfo.emails.forEach((email, i) => contactMethods.push({ type: "email", value: email, isPrimary: i === 0 }));
            }
            if (contactInfo.instagram) {
              igCache.set(place.id, contactInfo.instagram);
              contactMethods.push({ type: "instagram", value: contactInfo.instagram, isPrimary: contactMethods.length === 0 });
            }
            if (contactInfo.phone) contactMethods.push({ type: "phone", value: contactInfo.phone, isPrimary: contactMethods.length === 0 });
            if (contactInfo.facebook) contactMethods.push({ type: "facebook", value: contactInfo.facebook });
            if (contactInfo.linkedin) contactMethods.push({ type: "linkedin", value: contactInfo.linkedin });
          }
        } catch { /* skip enrichment */ }
      }
      if (place.website && !contactMethods.some(c => c.type === "website")) {
        contactMethods.push({ type: "website", value: place.website, isPrimary: contactMethods.length === 0 });
      }
      const response = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: place.name,
          type: selectedType !== "all" ? selectedType : "venue",
          location: place.address,
          googlePlaceId: place.id,
          rating: place.rating,
          ratingCount: place.ratingCount,
          photoReference: place.photoReference,
          website: place.website,
          source: "manual_search",
          liked: true,
          contactMethods,
        }),
      });
      if (response.ok) {
        setSavedIds(prev => new Set([...prev, place.id]));
        await refreshData();
      }
    } catch { console.error("Failed to save"); }
  };

  const opportunityTypes = ["all", "venue", "event_organiser", "market", "wedding_planner", "agency", "brand", "publication"];

  const mapQuery = searchResults.length > 0
    ? searchResults.slice(0, 5).map(p => p.name).join(" ")
    : `event venues near ${profile?.location || nearbyLocation || "London UK"}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Discover</h1>
          <p className="text-xs text-muted-foreground">Find your next opportunity</p>
        </div>
        <button
          onClick={handleAISearch}
          disabled={isFinding}
          className="rounded-2xl font-bold text-white px-4 py-2 text-sm flex items-center gap-1.5 shadow-md shadow-primary/25 hover:opacity-90 transition-all active:scale-[0.97] disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg,#3525cd,#4f46e5)' }}
        >
          {isFinding ? <><Loader2 className="w-4 h-4 animate-spin" />Finding…</> : <><Sparkles className="w-4 h-4" />AI Find</>}
        </button>
      </div>

      {findResult && (
        <div className={`glass-card rounded-2xl p-3 text-sm font-medium ${findResult.count > 0 ? "border-primary/20 text-primary" : "text-muted-foreground"}`}>
          {findResult.message}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search or tap a suggestion below..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => handleSearch()} disabled={isSearching || !searchQuery.trim()}>
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {getSearchPrompts(profile?.businessType).map((prompt) => (
            <button
              key={prompt}
              onClick={() => { setSearchQuery(prompt); handleSearch(prompt); }}
              className={`px-3 py-1 text-xs rounded-full border font-semibold transition-all ${
                searchQuery === prompt
                  ? "text-white border-transparent shadow-sm shadow-primary/25"
                  : "glass-card border-white/60 text-foreground hover:border-primary/30"
              }`}
            style={searchQuery === prompt ? { background:'linear-gradient(135deg,#3525cd,#4f46e5)' } : {}}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Select value={selectedType} onValueChange={(v) => setSelectedType(v)}>
            <SelectTrigger className="w-[130px] shrink-0">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {opportunityTypes.filter(t => t !== "all").map((type) => (
                <SelectItem key={type} value={type}>{typeLabels[type] || type}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex rounded-lg border overflow-hidden shrink-0">
            <button onClick={() => setViewMode("grid")} className={`px-3 py-2 flex items-center ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode("map")} className={`px-3 py-2 flex items-center ${viewMode === "map" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              <MapIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="space-y-3">
          {isLoadingInitial ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl fluid-gradient flex items-center justify-center shadow-lg shadow-primary/25">
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                </div>
                <p className="text-sm text-muted-foreground">Finding venues near you…</p>
              </div>
            </div>
          ) : searchResults.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? `${searchResults.length} results found` : `${searchResults.length} venues near ${nearbyLocation || "you"}`}
              </p>
              {searchResults.map((place) => (
                <DiscoverCard key={place.id} place={place} isSaved={savedIds.has(place.id)} onSave={() => handleSave(place)} />
              ))}
              <div ref={loadMoreRef} className="py-4 flex flex-col items-center gap-2">
                {isLoadingMore && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading more...
                  </div>
                )}
                {!isLoadingMore && nextPageToken && (
                  <Button variant="outline" size="sm" onClick={loadMore} className="text-xs">
                    Load more venues
                  </Button>
                )}
                {!isLoadingMore && !nextPageToken && searchResults.length > 0 && (
                  <p className="text-xs text-muted-foreground">All results loaded</p>
                )}
              </div>
            </>
          ) : !isSearching ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <MapPin className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <h3 className="font-semibold mb-2">No Venues Found</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Try searching manually or update your location in your profile.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl overflow-hidden border" style={{ height: "60vh" }}>
            <iframe
              title="Venue map"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps/embed/v1/search?key=AIzaSyA1kVerq-mvYsWmObYOTEWZPm4vUbcgmlY&q=${encodeURIComponent(mapQuery)}`}
            />
          </div>
          <p className="text-sm text-muted-foreground">{searchResults.length} venues</p>
          {searchResults.slice(0, 5).map((place) => (
            <DiscoverCard key={place.id} place={place} isSaved={savedIds.has(place.id)} onSave={() => handleSave(place)} />
          ))}
        </div>
      )}
    </div>
  );
}

function DiscoverCard({ place, isSaved, onSave }) {
  const photoUrl = place.photoReference
    ? `/api/places/photo?ref=${encodeURIComponent(place.photoReference)}&maxWidth=400`
    : null;

  const [instagramHandle, setInstagramHandle] = useState(igCache.get(place.id) || null);

  useEffect(() => {
    if (igCache.has(place.id)) {
      setInstagramHandle(igCache.get(place.id) || null);
      return;
    }
    if (!place.website && !place.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/enrich-contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ websiteUrl: place.website, placeId: place.id }),
        });
        if (!res.ok || cancelled) return;
        const { contactInfo } = await res.json();
        const ig = contactInfo?.instagram || null;
        igCache.set(place.id, ig);
        if (!cancelled && ig) setInstagramHandle(ig);
      } catch {
        if (!cancelled) igCache.set(place.id, null);
      }
    })();
    return () => { cancelled = true; };
  }, [place.id, place.website]);

  return (
    <div className="glass-card glass-card-hover rounded-2xl overflow-hidden border-l-4" style={{ borderLeftColor:'#3525cd' }}>
      <div className="flex">
        <div className="w-24 shrink-0 relative self-stretch min-h-[88px]">
            {photoUrl ? (
              <img src={photoUrl} alt={place.name} className="w-full h-full object-cover absolute inset-0" />
            ) : (
              <div className="w-full h-full fluid-gradient-subtle flex items-center justify-center">
                <MapPin className="w-8 h-8 text-primary/40" />
              </div>
            )}
            {place.rating && (
              <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs font-medium flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {place.rating.toFixed(1)}
              </div>
            )}
          </div>

          <div className="flex-1 p-3 min-w-0 flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-semibold text-sm leading-tight line-clamp-1">{place.name}</h3>
              <button
                onClick={(e) => { e.stopPropagation(); if (!isSaved) onSave(); }}
                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isSaved ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-primary"
                }`}
                disabled={isSaved}
              >
                <Heart className={`w-4 h-4 ${isSaved ? "fill-primary" : ""}`} />
              </button>
            </div>

            {place.address && (
              <p className="text-xs text-muted-foreground line-clamp-1 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />
                {place.address}
              </p>
            )}

            {place.types && place.types.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {place.types.slice(0, 2).map((type) => (
                  <Badge key={type} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {type.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-1.5 mt-auto flex-wrap">
              {place.website && (
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                  onClick={(e) => { e.stopPropagation(); window.open(place.website, "_blank"); }}>
                  <ExternalLink className="w-3 h-3 mr-1" />Website
                </Button>
              )}
              {instagramHandle && (
                <Button size="sm" variant="outline"
                  className="h-7 px-2 text-xs border-pink-500/40 text-pink-600 hover:bg-pink-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`https://instagram.com/${instagramHandle.replace("@", "")}`, "_blank");
                  }}>
                  <Instagram className="w-3 h-3 mr-1" />{instagramHandle}
                </Button>
              )}
              {!isSaved ? (
                <Button size="sm" className="h-7 px-2 text-xs ml-auto"
                  onClick={(e) => { e.stopPropagation(); onSave(); }}>
                  <Heart className="w-3 h-3 mr-1" />Save
                </Button>
              ) : (
                <span className="h-7 px-2 text-xs flex items-center text-primary font-medium ml-auto">✓ Saved</span>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}
