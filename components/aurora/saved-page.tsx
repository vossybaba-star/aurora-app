"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAurora } from "./aurora-app";
import { typeLabels, statusLabels } from "@/lib/types";
import type { Opportunity, OpportunityStatus } from "@/lib/types";
import { 
  Sparkles,
  Star,
  MapPin,
  ExternalLink,
  Mail,
  Instagram,
  Trash2,
  Phone,
  Heart,
  ChevronRight,
} from "lucide-react";

export function SavedPage() {
  const { opportunities, setActiveTab, refreshData } = useAurora();
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  
  // Only show liked opportunities (not closed)
  const savedOpps = opportunities.filter(o => o.liked && o.status !== 'closed');
  
  // Group by status
  const newOpps = savedOpps.filter(o => o.status === 'new');
  const readyOpps = savedOpps.filter(o => o.status === 'outreach_ready');
  const sentOpps = savedOpps.filter(o => o.status === 'sent' || o.status === 'follow_up_due');
  const repliedOpps = savedOpps.filter(o => o.status === 'replied');

  const handleRemove = async (oppId: string) => {
    if (!confirm("Remove this opportunity from saved?")) return;
    
    try {
      await fetch(`/api/opportunities/${oppId}`, {
        method: "DELETE",
      });
      await refreshData();
    } catch (error) {
      console.error("Failed to remove:", error);
    }
  };

  if (savedOpps.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Saved</h1>
          <p className="text-muted-foreground">Your saved opportunities</p>
        </div>

        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Heart className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="font-semibold mb-2">No saved opportunities yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              Discover and save opportunities you want to reach out to.
            </p>
            <Button onClick={() => setActiveTab("discover")}>
              Start Discovering
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Saved</h1>
        <p className="text-muted-foreground">
          {savedOpps.length} saved opportunit{savedOpps.length === 1 ? "y" : "ies"}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard value={newOpps.length} label="New" />
        <StatCard value={readyOpps.length} label="Ready" />
        <StatCard value={sentOpps.length} label="Sent" />
        <StatCard value={repliedOpps.length} label="Replied" highlight />
      </div>

      {/* Opportunity Sections */}
      {newOpps.length > 0 && (
        <Section title="New" count={newOpps.length}>
          {newOpps.map(opp => (
            <SavedOpportunityCard 
              key={opp.id} 
              opportunity={opp}
              onRemove={() => handleRemove(opp.id)}
              onClick={() => setSelectedOpp(opp)}
            />
          ))}
        </Section>
      )}

      {readyOpps.length > 0 && (
        <Section title="We found these for you" count={readyOpps.length}>
          {readyOpps.map(opp => (
            <SavedOpportunityCard 
              key={opp.id} 
              opportunity={opp}
              onRemove={() => handleRemove(opp.id)}
              onClick={() => setSelectedOpp(opp)}
            />
          ))}
        </Section>
      )}

      {sentOpps.length > 0 && (
        <Section title="Outreach Sent" count={sentOpps.length}>
          {sentOpps.map(opp => (
            <SavedOpportunityCard 
              key={opp.id} 
              opportunity={opp}
              onRemove={() => handleRemove(opp.id)}
              onClick={() => setSelectedOpp(opp)}
            />
          ))}
        </Section>
      )}

      {repliedOpps.length > 0 && (
        <Section title="Got Replies" count={repliedOpps.length}>
          {repliedOpps.map(opp => (
            <SavedOpportunityCard 
              key={opp.id} 
              opportunity={opp}
              onRemove={() => handleRemove(opp.id)}
              onClick={() => setSelectedOpp(opp)}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function StatCard({ 
  value, 
  label, 
  highlight 
}: { 
  value: number; 
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-3 rounded-xl text-center ${
      highlight ? "bg-primary/10" : "bg-muted/50"
    }`}>
      <span className="text-xl font-bold">{value}</span>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Section({ 
  title, 
  count, 
  children 
}: { 
  title: string; 
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <Badge variant="secondary">{count}</Badge>
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

function SavedOpportunityCard({ 
  opportunity, 
  onRemove,
  onClick,
}: { 
  opportunity: Opportunity;
  onRemove: () => void;
  onClick: () => void;
}) {
  const statusColors: Record<OpportunityStatus, string> = {
    "new": "bg-primary/10 text-primary",
    "outreach_ready": "bg-accent/20 text-accent-foreground",
    "sent": "bg-secondary text-secondary-foreground",
    "follow_up_due": "bg-orange-500/20 text-orange-600",
    "replied": "bg-green-500/20 text-green-600",
    "closed": "bg-muted text-muted-foreground",
  };

  const photoUrl = opportunity.photoReference 
    ? `/api/places/photo?ref=${encodeURIComponent(opportunity.photoReference)}&maxWidth=400`
    : null;

  const hasWebsite = opportunity.website || opportunity.contactMethods.some(c => c.type === 'contact_form' || c.type === 'website');
  const hasEmail = opportunity.contactMethods.some(c => c.type === 'email');
  const hasInstagram = opportunity.contactMethods.some(c => c.type === 'instagram');
  const hasPhone = opportunity.contactMethods.some(c => c.type === 'phone');
  
  const emailValue = opportunity.contactMethods.find(c => c.type === 'email')?.value;
  const instagramValue = opportunity.contactMethods.find(c => c.type === 'instagram')?.value;
  const phoneValue = opportunity.contactMethods.find(c => c.type === 'phone')?.value;

  return (
    <Card 
      className="overflow-hidden hover:border-primary/30 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="flex">
          {/* Image */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 relative bg-muted">
            {photoUrl ? (
              <img 
                src={photoUrl} 
                alt={opportunity.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary/30" />
              </div>
            )}
            {opportunity.source === 'aurora_ai' && (
              <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-primary-foreground" />
              </div>
            )}
            {opportunity.rating && (
              <div className="absolute bottom-1.5 left-1.5 px-1 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                {opportunity.rating.toFixed(1)}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-2.5 min-w-0 flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm leading-tight line-clamp-1">
                  {opportunity.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {typeLabels[opportunity.type]}
                </p>
              </div>
              <Badge className={`shrink-0 text-[10px] px-1.5 py-0 ${statusColors[opportunity.status]}`}>
                {statusLabels[opportunity.status]}
              </Badge>
            </div>

            {/* Contact Info Row */}
            {(hasEmail || hasInstagram || hasPhone) && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1.5 overflow-hidden">
                {hasEmail && emailValue && (
                  <span className="flex items-center gap-0.5 truncate max-w-[100px]" title={emailValue}>
                    <Mail className="w-2.5 h-2.5 shrink-0 text-primary/70" />
                    <span className="truncate">{emailValue}</span>
                  </span>
                )}
                {hasInstagram && instagramValue && (
                  <span className="flex items-center gap-0.5 truncate" title={instagramValue}>
                    <Instagram className="w-2.5 h-2.5 shrink-0 text-pink-500" />
                    <span className="truncate">{instagramValue.replace('https://instagram.com/', '@').replace('https://www.instagram.com/', '@')}</span>
                  </span>
                )}
                {hasPhone && phoneValue && !hasEmail && !hasInstagram && (
                  <span className="flex items-center gap-0.5" title={phoneValue}>
                    <Phone className="w-2.5 h-2.5 shrink-0 text-green-600" />
                    <span>{phoneValue}</span>
                  </span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1.5 mt-auto">
              {hasWebsite && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-6 px-2 text-[10px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    const url = opportunity.website || opportunity.contactMethods.find(c => c.type === 'contact_form')?.value;
                    if (url) window.open(url, '_blank');
                  }}
                >
                  <ExternalLink className="w-2.5 h-2.5 mr-1" />
                  Web
                </Button>
              )}
              {hasEmail && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="h-6 px-2 text-[10px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    const email = opportunity.contactMethods.find(c => c.type === 'email')?.value;
                    if (email) window.location.href = `mailto:${email}`;
                  }}
                >
                  <Mail className="w-2.5 h-2.5 mr-1" />
                  Email
                </Button>
              )}
              {hasInstagram && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="h-6 px-2 text-[10px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    const ig = opportunity.contactMethods.find(c => c.type === 'instagram')?.value;
                    if (ig) {
                      const handle = ig.replace('@', '').replace('https://instagram.com/', '');
                      window.open(`https://instagram.com/${handle}`, '_blank');
                    }
                  }}
                >
                  <Instagram className="w-2.5 h-2.5 mr-1" />
                  IG
                </Button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="ml-auto w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
