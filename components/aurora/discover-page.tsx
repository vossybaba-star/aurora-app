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
  Wand2,
  Filter,
  X,
  Sparkles,
  ExternalLink,
  Grid3X3,
  Map,
  Instagram,
} from "lucide-react";

type ViewMode = "grid" | "map";

// Module-level Instagram cache (persists across re-renders, cleared on page refresh)
const igCache = new Map<string, string | null>();

// Search prompts based on business type
function getSearchPrompts(businessType?: string): string[] {
  const bt = businessType?.toLowerCase() || "";
  
  // Common prompts for all
  const common = ["Wedding venues", "Hotels", "Event spaces"];
  
  if (bt.includes("photo") || bt.includes("video")) {
    return ["Wedding venues", "Luxury hotels", "Event planners", "Brands", "Restaurants", "PR agencies"];
  }
  if (bt.includes("flor")) {
    return ["Wedding planners", "Hotels", "Event venues", "Restaurants", "Corporate events"];
  }
  if (bt.includes("cater")) {
    return ["Corporate offices", "Wedding venues", "Private events", "Hotels", "Event planners"];
  }
  if (bt.includes("bak")) {
    return ["Cafes", "Restaurants", "Wedding planners", "Hotels", "Markets", "Delis"];
  }
  if (bt.includes("music") || bt.includes("dj")) {
    return ["Wedding venues", "Bars", "Hotels", "Corporate events", "Restaurants"];
  }
  if (bt.includes("makeup") || bt.includes("hair") || bt.includes("beauty")) {
    return ["Wedding planners", "Spas", "Hotels", "Photo studios", "Fashion brands"];
  }
  
  // Default prompts
  return ["Wedding venues", "Hotels", "Event planners", "Restaurants", "Corporate", "Agencies"];
}

export function DiscoverPage() {
  const { profile, opportunities, refreshData, setActiveTab } = useAurora();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<OpportunityType | "all">("all");
  const [isSearching, setIsSearching] = useState(false);
  const [isFinding, setIsFinding] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [findResult, setFindResult] = useState<{ count: number; message: string } | null>(null);
  const [nearbyLocation, setNearbyLocation] = useState<string>("");
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Track which opportunities are already saved
  useEffect(() => {
    const ids = new Set(opportunities.map(o => o.googlePlaceId).filter(Boolean) as string[]);
    setSavedIds(ids);
  }, [opportunities]);

  // Load nearby venues on mount
  useEffect(() => {
    const loadNearbyVenues = async () => {
      setIsLoadingInitial(true);
      try {
        const res = await fetch('/api/places/search');
        const data = await res.json();
        if (data.places) {
          setSearchResults(data.places);
          setNearbyLocation(data.location || '');
          setNextPageToken(data.nextPageToken || null);
        }
      } catch (error) {
        console.error("Failed to load nearby venues:", error);
      } finally {
        setIsLoadingInitial(false);
      }
    };

    loadNearbyVenues();
  }, []);

  const handleAISearch = async () => {
    setIsFinding(true);
    setFindResult(null);
    
    try {
      const response = await fetch("/api/find-opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery || undefined,
          type: selectedType !== "all" ? selectedType : undefined,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        await refreshData();
        // Navigate to home tab to show the new results
        if (data.created > 0) {
          setActiveTab("home");
        } else {
          setFindResult({
            count: 0,
            message: data.message || "No new opportunities found. Try a different search.",
          });
        }
      } else {
        setFindResult({
          count: 0,
          message: data.error || "Failed to find opportunities",
        });
      }
    } catch (error) {
      setFindResult({
        count: 0,
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setIsFinding(false);
    }
  };

  const handleManualSearch = async (overrideQuery?: string) => {
    const q = overrideQuery ?? searchQuery;
    if (!q.trim()) return;
    setIsSearching(true);
    setNextPageToken(null);
    try {
      const response = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          location: profile?.location,
          type: selectedType !== "all" ? selectedType : undefined,
        }),
      });
      const data = await response.json();
      if (data.places) {
        setSearchResults(data.places);
        setNextPageToken(data.nextPageToken || null);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveOpportunity = async (place: any) => {
    try {
      // First, enrich contact info from website and Google
      let contactMethods: { type: string; value: string; isPrimary?: boolean }[] = [];
      
      if (place.website || place.id) {
        try {
          const enrichRes = await fetch("/api/enrich-contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              websiteUrl: place.website,
              placeId: place.id,
            }),
          });
          
          if (enrichRes.ok) {
            const { contactInfo } = await enrichRes.json();
            
            // Add emails as contact methods
            if (contactInfo.emails?.length > 0) {
              contactInfo.emails.forEach((email: string, i: number) => {
                contactMethods.push({
                  type: "email",
                  value: email,
                  isPrimary: i === 0,
                });
              });
            }
            
            // Add Instagram
            if (contactInfo.instagram) {
              contactMethods.push({
                type: "instagram",
                value: contactInfo.instagram,
                isPrimary: contactMethods.length === 0,
              });
            }
            
            // Add phone
            if (contactInfo.phone) {
              contactMethods.push({
                type: "phone",
                value: contactInfo.phone,
                isPrimary: contactMethods.length === 0,
              });
            }
            
            // Add Facebook
            if (contactInfo.facebook) {
              contactMethods.push({
                type: "facebook",
                value: contactInfo.facebook,
              });
            }
            
            // Add LinkedIn
            if (contactInfo.linkedin) {
              contactMethods.push({
                type: "linkedin",
                value: contactInfo.linkedin,
              });
            }
            
            // Add TikTok
            if (contactInfo.tiktok) {
              contactMethods.push({
                type: "tiktok",
                value: contactInfo.tiktok,
              });
            }
          }
        } catch (enrichError) {
          console.error("Failed to enrich contact:", enrichError);
        }
      }
      
      // Add website as fallback contact method
      if (place.website && !contactMethods.some(c => c.type === 'website')) {
        contactMethods.push({
          type: "website",
          value: place.website,
          isPrimary: contactMethods.length === 0,
        });
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
    } catch (error) {
      console.error("Failed to save:", error);
    }
  };

  const opportunityTypes: (OpportunityType | "all")[] = [
    "all", "venue", "event_organiser", "market", "wedding_planner", "agency", "brand", "publication"
  ];

  return (
    <div className="space-y-3">
      {/* Compact Header with AI Search */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Discover</h1>
        <Button 
          onClick={handleAISearch} 
          disabled={isFinding}
          size="sm"
        >
          {isFinding ? (
            <>
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              Finding...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-1.5" />
              AI Find
            </>
          )}
        </Button>
      </div>
      
      {/* Result message */}
      {findResult && (
        <div className={`p-2.5 rounded-lg text-sm ${
          findResult.count > 0 ? "bg-primary/10" : "bg-muted"
        }`}>
          {findResult.message}
        </div>
      )}

      {/* Search with Prompts */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search or tap a suggestion below..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
              className="pl-10"
            />
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleManualSearch}
            disabled={isSearching || !searchQuery.trim()}
            data-search-trigger
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Quick Search Prompts */}
        <div className="flex flex-wrap gap-1.5">
          {getSearchPrompts(profile?.businessType).map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                setSearchQuery(prompt);
                // Auto-trigger search
                setTimeout(() => {
                  const searchBtn = document.querySelector('[data-search-trigger]') as HTMLButtonElement;
                  searchBtn?.click();
                }, 100);
              }}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                searchQuery === prompt
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          <Select 
            value={selectedType} 
            onValueChange={(v) => setSelectedType(v as OpportunityType | "all")}
          >
            <SelectTrigger className="w-[140px] shrink-0">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {opportunityTypes.filter(t => t !== "all").map((type) => (
                <SelectItem key={type} value={type}>
                  {typeLabels[type as OpportunityType]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex rounded-lg border overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-2 text-sm flex items-center gap-1.5 ${
                viewMode === "grid" 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-muted"
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`px-3 py-2 text-sm flex items-center gap-1.5 ${
                viewMode === "map" 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-muted"
              }`}
            >
              <Map className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {viewMode === "grid" ? (
        <div className="space-y-3">
          {isLoadingInitial ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Finding venues near you...</p>
              </div>
            </div>
          ) : searchResults.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                {searchQuery 
                  ? `${searchResults.length} results found` 
                  : `${searchResults.length} venues near ${nearbyLocation || 'you'}`}
              </p>
              {searchResults.map((place) => (
                <DiscoverCard 
                  key={place.id} 
                  place={place}
                  isSaved={savedIds.has(place.id)}
                  onSave={() => handleSaveOpportunity(place)}
                />
              ))}
            </>
          ) : searchQuery && !isSearching ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">
                  No results found. Try a different search term.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <MapPin className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <h3 className="font-semibold mb-2">No Venues Found</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  We couldn&apos;t find venues in your area. Try searching manually or update your location in your profile.
                </p>
              </CardContent>
            </Card>
          )}
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
              src={`https://www.google.com/maps/embed/v1/search?key=AIzaSyA1kVerq-mvYsWmObYOTEWZPm4vUbcgmlY&q=${encodeURIComponent(
                searchResults.length > 0
                  ? searchResults.slice(0, 5).map((p: any) => p.name).join(" OR ")
                  : `event venues near ${profile?.location || nearbyLocation || "London"}`
              )}`}
            />
          </div>
          {searchResults.slice(0, 5).map((place: any) => (
            <DiscoverCard
              key={place.id}
              place={place}
              isSaved={savedIds.has(place.id)}
              onSave={() => handleSaveOpportunity(place)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DiscoverCard({ 
  place, 
  isSaved,
  onSave 
}: { 
  place: any;
  isSaved: boolean;
  onSave: () => void;
}) {
  const photoUrl = place.photoReference 
    ? `/api/places/photo?ref=${encodeURIComponent(place.photoReference)}&maxWidth=400`
    : null;

  const [instagramHandle, setInstagramHandle] = useState<string | null>(igCache.get(place.id) ?? null);

  useEffect(() => {
    // Already cached — skip fetch
    if (igCache.has(place.id)) {
      setInstagramHandle(igCache.get(place.id) ?? null);
      return;
    }
    if (!place.website && !place.id) return;
    let cancelled = false;
    const enrich = async () => {
      try {
        const res = await fetch("/api/enrich-contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ websiteUrl: place.website, placeId: place.id }),
        });
        if (!res.ok || cancelled) return;
        const { contactInfo } = await res.json();
        const ig = contactInfo?.instagram ?? null;
        igCache.set(place.id, ig);
        if (!cancelled && ig) setInstagramHandle(ig);
      } catch {
        if (!cancelled) igCache.set(place.id, null);
      }
    };
    enrich();
    return () => { cancelled = true; };
  }, [place.id, place.website]);

  return (
    <Card className="overflow-hidden hover:border-primary/30 transition-colors">
      <CardContent className="p-0">
        <div className="flex">
          {/* Image */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 relative bg-muted">
            {photoUrl ? (
              <img 
                src={photoUrl} 
                alt={place.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <MapPin className="w-8 h-8 text-primary/30" />
              </div>
            )}
            {place.rating && (
              <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs font-medium flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {place.rating.toFixed(1)}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-3 min-w-0 flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-semibold text-sm leading-tight line-clamp-1">
                {place.name}
              </h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isSaved) onSave();
                }}
                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isSaved 
                    ? "bg-primary/10 text-primary" 
                    : "hover:bg-muted text-muted-foreground hover:text-primary"
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
              <div className="flex flex-wrap gap-1 mt-auto">
                {place.types.slice(0, 2).map((type: string) => (
                  <Badge key={type} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {type.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-1.5 mt-2 flex-wrap">
              {place.website && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-7 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(place.website, '_blank');
                  }}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Website
                </Button>
              )}
              {instagramHandle && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs border-pink-500/40 text-pink-600 hover:bg-pink-50 hover:text-pink-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    const handle = instagramHandle.replace('@', '');
                    window.open(`https://instagram.com/${handle}`, '_blank');
                  }}
                >
                  <Instagram className="w-3 h-3 mr-1" />
                  {instagramHandle}
                </Button>
              )}

              {!isSaved && (
                <Button 
                  size="sm" 
                  className="h-7 px-2 text-xs flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSave();
                  }}
                >
                  <Heart className="w-3 h-3 mr-1" />
                  Save
                </Button>
              )}
              {isSaved && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  <Heart className="w-3 h-3 fill-current" />
                  Saved
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
