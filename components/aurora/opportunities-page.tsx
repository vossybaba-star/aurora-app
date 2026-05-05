"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAurora } from "./aurora-app";
import { createOpportunity, updateOpportunity, deleteOpportunity, addContactMethod } from "@/lib/actions";
import { 
  typeLabels, 
  statusLabels,
  contactMethodLabels,
} from "@/lib/types";
import type { 
  Opportunity,
  OpportunityStatus,
  OpportunityType,
  ContactMethod,
  ContactMethodType,
} from "@/lib/types";
import { 
  MapPin, 
  Mail, 
  ExternalLink, 
  ChevronRight,
  Sparkles,
  Filter,
  Phone,
  Linkedin,
  Instagram,
  Star,
  Plus,
  Trash2,
  Wand2,
  Loader2,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

const statusFilters: { id: OpportunityStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "outreach_ready", label: "Ready" },
  { id: "sent", label: "Sent" },
  { id: "follow_up_due", label: "Follow-up" },
  { id: "replied", label: "Replied" },
  { id: "closed", label: "Closed" },
];

export function OpportunitiesPage() {
  const { opportunities, refreshData } = useAurora();
  const [activeFilter, setActiveFilter] = useState<OpportunityStatus | "all">("all");
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFinding, setIsFinding] = useState(false);

  const handleFindWithAI = async () => {
    setIsFinding(true);
    try {
      const response = await fetch("/api/find-opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (data.success) {
        await refreshData();
      }
    } catch (error) {
      console.error("Failed to find opportunities:", error);
    } finally {
      setIsFinding(false);
    }
  };

  const filteredOpportunities = activeFilter === "all" 
    ? opportunities 
    : opportunities.filter(o => o.status === activeFilter);

  if (selectedOpp) {
    return (
      <OpportunityDetail 
        opportunity={selectedOpp} 
        onBack={() => setSelectedOpp(null)}
        onRefresh={refreshData}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Opportunities</h1>
          <p className="text-muted-foreground">
            {opportunities.length} opportunities found
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={handleFindWithAI}
            disabled={isFinding}
          >
            {isFinding ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4 mr-1" />
            )}
            {isFinding ? "Finding..." : "Find with AI"}
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Opportunity</DialogTitle>
            </DialogHeader>
            <CreateOpportunityForm 
              onSuccess={() => {
                setIsCreateOpen(false);
                refreshData();
              }}
            />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
        {statusFilters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeFilter === filter.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Opportunity cards */}
      <div className="space-y-3">
        {filteredOpportunities.length === 0 ? (
          <EmptyState 
              filter={activeFilter} 
              onAdd={() => setIsCreateOpen(true)} 
              onFindWithAI={handleFindWithAI}
              isFinding={isFinding}
            />
        ) : (
          filteredOpportunities.map((opp) => (
            <OpportunityCard 
              key={opp.id} 
              opportunity={opp} 
              onClick={() => setSelectedOpp(opp)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CreateOpportunityForm({ onSuccess }: { onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    name: "",
    type: "venue" as OpportunityType,
    location: "",
    description: "",
    whyGoodFit: "",
    priority: "medium" as "high" | "medium" | "low",
    website: "",
    contactEmail: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createOpportunity({
        name: formData.name,
        type: formData.type,
        location: formData.location,
        description: formData.description,
        whyGoodFit: formData.whyGoodFit,
        priority: formData.priority,
        website: formData.website,
        contactMethods: formData.contactEmail ? [{
          type: "email",
          value: formData.contactEmail,
          isPrimary: true,
        }] : [],
      });
      if (result.success) {
        onSuccess();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
          placeholder="e.g., Riverside Wedding Venue"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select 
            value={formData.type} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as OpportunityType }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(typeLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select 
            value={formData.priority} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as "high" | "medium" | "low" }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          value={formData.location}
          onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
          placeholder="e.g., London, UK"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          value={formData.website}
          onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
          placeholder="https://..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactEmail">Contact Email</Label>
        <Input
          id="contactEmail"
          type="email"
          value={formData.contactEmail}
          onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
          placeholder="contact@example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="whyGoodFit">Why is this a good fit?</Label>
        <Textarea
          id="whyGoodFit"
          value={formData.whyGoodFit}
          onChange={(e) => setFormData(prev => ({ ...prev, whyGoodFit: e.target.value }))}
          rows={3}
          placeholder="Describe why this opportunity matches your business..."
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending || !formData.name}>
        {isPending ? <Spinner className="mr-2" /> : null}
        Add Opportunity
      </Button>
    </form>
  );
}

function getContactMethodIcon(type: ContactMethodType) {
  switch (type) {
    case 'email': return Mail;
    case 'contact_form': return ExternalLink;
    case 'instagram': return Instagram;
    case 'linkedin': return Linkedin;
    case 'phone': return Phone;
    default: return Mail;
  }
}

function OpportunityCard({ 
  opportunity, 
  onClick 
}: { 
  opportunity: Opportunity; 
  onClick: () => void;
}) {
  const statusColors: Record<OpportunityStatus, string> = {
    "new": "bg-primary/10 text-primary",
    "outreach_ready": "bg-accent/20 text-accent-foreground",
    "sent": "bg-secondary text-secondary-foreground",
    "follow_up_due": "bg-warning/20 text-warning-foreground",
    "replied": "bg-success/20 text-success-foreground",
    "closed": "bg-muted text-muted-foreground",
  };

  const photoUrl = opportunity.photoReference 
    ? `/api/places/photo?ref=${encodeURIComponent(opportunity.photoReference)}&maxWidth=400`
    : null;

  return (
    <Card 
      className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md overflow-hidden group"
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="flex">
          {/* Image */}
          <div className="w-24 h-24 sm:w-32 sm:h-32 shrink-0 relative bg-muted">
            {photoUrl ? (
              <img 
                src={photoUrl} 
                alt={opportunity.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <MapPin className="w-8 h-8 text-primary/30" />
              </div>
            )}
            {opportunity.source === 'aurora_ai' && (
              <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
                <Sparkles className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
            {opportunity.rating && (
              <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs font-medium flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {opportunity.rating.toFixed(1)}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-3 sm:p-4 min-w-0 flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-semibold truncate text-sm sm:text-base">{opportunity.name}</h3>
                  {opportunity.priority === 'high' && (
                    <Star className="w-4 h-4 text-primary fill-primary shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <span>{typeLabels[opportunity.type]}</span>
                  {opportunity.location && (
                    <>
                      <span className="text-muted-foreground/40">&middot;</span>
                      <span className="truncate">{opportunity.location.split(',')[0]}</span>
                    </>
                  )}
                </div>
              </div>
              <Badge className={`shrink-0 text-xs ${statusColors[opportunity.status]}`}>
                {statusLabels[opportunity.status]}
              </Badge>
            </div>

            {opportunity.whyGoodFit && (
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mt-1 flex-1">
                {opportunity.whyGoodFit}
              </p>
            )}

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1.5">
                {opportunity.contactMethods.slice(0, 3).map((cm) => {
                  const Icon = getContactMethodIcon(cm.type);
                  return (
                    <div 
                      key={cm.id} 
                      className={`w-6 h-6 rounded flex items-center justify-center ${
                        cm.isPrimary ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}
                      title={contactMethodLabels[cm.type]}
                    >
                      <Icon className="w-3 h-3" />
                    </div>
                  );
                })}
                {opportunity.contactMethods.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{opportunity.contactMethods.length - 3}
                  </span>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OpportunityDetail({ 
  opportunity, 
  onBack,
  onRefresh,
}: { 
  opportunity: Opportunity; 
  onBack: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  const photoUrl = opportunity.photoReference 
    ? `/api/places/photo?ref=${encodeURIComponent(opportunity.photoReference)}&maxWidth=800`
    : null;

  const handleDelete = () => {
    if (!confirm("Delete this opportunity?")) return;
    startTransition(async () => {
      await deleteOpportunity(opportunity.id);
      await onRefresh();
      onBack();
    });
  };

  const handleMarkReady = () => {
    startTransition(async () => {
      await updateOpportunity(opportunity.id, { status: "outreach_ready" });
      await onRefresh();
      onBack();
    });
  };

  return (
    <div className="space-y-6">
      {/* Hero Image */}
      <div className="relative -mx-4 -mt-4 sm:-mx-6 sm:-mt-6">
        <div className="aspect-[16/9] sm:aspect-[21/9] bg-muted relative overflow-hidden">
          {photoUrl ? (
            <img 
              src={photoUrl} 
              alt={opportunity.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-background flex items-center justify-center">
              <MapPin className="w-16 h-16 text-primary/30" />
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          
          {/* Back button */}
          <button 
            onClick={onBack}
            className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-sm text-sm font-medium hover:bg-background transition-colors flex items-center gap-1"
          >
            &larr; Back
          </button>
          
          {/* Delete button */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleDelete} 
            disabled={isPending}
            className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="w-4 h-4" />
          </Button>

          {/* AI badge */}
          {opportunity.source === 'aurora_ai' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              Found by Aurora AI
            </div>
          )}
        </div>

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
              {typeLabels[opportunity.type]}
            </Badge>
            {opportunity.priority === 'high' && (
              <Badge className="bg-primary/90 text-primary-foreground">High Priority</Badge>
            )}
            {opportunity.rating && (
              <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {opportunity.rating.toFixed(1)}
                {opportunity.ratingCount && (
                  <span className="text-muted-foreground">({opportunity.ratingCount})</span>
                )}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-balance">{opportunity.name}</h1>
          {opportunity.location && (
            <p className="text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="w-4 h-4" />
              {opportunity.location}
            </p>
          )}
        </div>
      </div>

      {opportunity.tags && opportunity.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {opportunity.tags.map((tag) => (
            <span 
              key={tag}
              className="px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {opportunity.whyGoodFit && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium mb-1">Why it&apos;s a good fit</h3>
                <p className="text-sm text-muted-foreground">{opportunity.whyGoodFit}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {opportunity.contactMethods.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-medium">Contact methods ({opportunity.contactMethods.length})</h3>
            <div className="space-y-3">
              {opportunity.contactMethods.map((cm) => {
                const Icon = getContactMethodIcon(cm.type);
                return (
                  <div key={cm.id} className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      cm.isPrimary ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">
                          {contactMethodLabels[cm.type]}
                          {cm.label && ` (${cm.label})`}
                        </p>
                        {cm.isPrimary && (
                          <Badge variant="outline" className="text-xs">Primary</Badge>
                        )}
                      </div>
                      <p className="font-medium truncate">{cm.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {(opportunity.source || opportunity.website) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {opportunity.source && (
              <div>
                <p className="text-sm text-muted-foreground">Source</p>
                <p className="font-medium">{opportunity.source}</p>
              </div>
            )}
            {opportunity.website && (
              <div>
                <p className="text-sm text-muted-foreground">Website</p>
                <a 
                  href={opportunity.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline flex items-center gap-1"
                >
                  {opportunity.website.replace(/^https?:\/\//, '')}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {opportunity.notes && (
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-success-foreground">{opportunity.notes}</p>
          </CardContent>
        </Card>
      )}

      {opportunity.status === "new" && (
        <Button 
          size="lg" 
          className="w-full h-14 text-base rounded-xl"
          onClick={handleMarkReady}
          disabled={isPending}
        >
          {isPending ? <Spinner className="mr-2" /> : <Mail className="mr-2 w-5 h-5" />}
          Mark ready for outreach
        </Button>
      )}
    </div>
  );
}

function EmptyState({ 
  filter, 
  onAdd,
  onFindWithAI,
  isFinding,
}: { 
  filter: OpportunityStatus | "all";
  onAdd: () => void;
  onFindWithAI: () => void;
  isFinding: boolean;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Sparkles className="w-7 h-7 text-primary" />
        </div>
        <h3 className="font-semibold text-lg mb-1">No opportunities yet</h3>
        <p className="text-sm text-muted-foreground mb-6">
          {filter === "all" 
            ? "Let Aurora find opportunities for you, or add them manually."
            : `No opportunities with status "${statusLabels[filter as OpportunityStatus]}" at the moment.`}
        </p>
        {filter === "all" && (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={onFindWithAI} disabled={isFinding}>
              {isFinding ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4 mr-2" />
              )}
              {isFinding ? "Finding..." : "Find with AI"}
            </Button>
            <Button variant="outline" onClick={onAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Add manually
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
