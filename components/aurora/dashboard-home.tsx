"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAurora } from "./aurora-app";
import { typeLabels, contactMethodLabels, statusLabels } from "@/lib/types";
import type { Opportunity, ContactMethod, ContactMethodType } from "@/lib/types";
import { deleteOpportunity, updateOpportunity } from "@/lib/actions";
import { toast } from "sonner";
import { 
  Sparkles, 
  Mail, 
  Search, 
  Loader2, 
  MapPin, 
  Star,
  ExternalLink,
  Instagram,
  Send,
  ChevronRight,
  Bell,
  Heart,
  Compass,
  Trash2,
  Phone,
  Globe,
  MessageCircle,
  Linkedin,
  Facebook,
  FileText,
  MoreHorizontal,
  X,
  Maximize2,
  RefreshCw,
} from "lucide-react";

export function DashboardHome() {
  const { setActiveTab, profile, opportunities, refreshData } = useAurora();
  const [isFinding, setIsFinding] = useState(false);
  const [findResult, setFindResult] = useState<{ count: number; message: string } | null>(null);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [viewingOpp, setViewingOpp] = useState<Opportunity | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [isOutreachDialogOpen, setIsOutreachDialogOpen] = useState(false);
  const [greeting, setGreeting] = useState("Welcome");

  // Set greeting on client side only to avoid hydration mismatch
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const firstName = profile?.businessName?.split(" ")[0] || "";

  // Get actionable opportunities (new ones first, then by priority)
  const actionableOpps = opportunities
    .filter(o => o.status === 'new' || o.status === 'outreach_ready')
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

  const stats = {
    new: opportunities.filter(o => o.status === 'new').length,
    sent: opportunities.filter(o => o.status === 'sent').length,
  };

  const handleFindOpportunities = async () => {
    setIsFinding(true);
    setFindResult(null);
    
    try {
      const response = await fetch("/api/find-opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setFindResult({
          count: data.created || 0,
          message: data.message || `Found ${data.created || 0} new opportunities!`,
        });
        await refreshData();
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

  const handleStartOutreach = (opp: Opportunity) => {
    setSelectedOpp(opp);
    setIsOutreachDialogOpen(true);
  };

  // Show opportunity detail view
  if (viewingOpp) {
    return (
      <OpportunityDetailView
        opportunity={viewingOpp}
        onBack={() => setViewingOpp(null)}
        onRefresh={refreshData}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Compact Header with Stats */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
          <p className="text-sm text-muted-foreground truncate">
            {actionableOpps.length > 0 
              ? `${actionableOpps.length} ready for outreach`
              : "Find opportunities to grow"}
          </p>
        </div>
        
        {/* Inline Stats */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/50 rounded-lg text-sm">
            <span className="flex items-center gap-1 text-primary">
              <Bell className="w-3.5 h-3.5" />
              <span className="font-medium">{stats.new}</span>
            </span>
            <span className="text-muted-foreground/40">|</span>
            <span className="flex items-center gap-1">
              <Send className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-medium">{stats.sent}</span>
            </span>
          </div>
          
          <Button 
            onClick={handleFindOpportunities}
            disabled={isFinding}
            size="sm"
          >
            {isFinding ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-1.5" />
            )}
            {isFinding ? "Finding..." : "AI Find More"}
          </Button>
        </div>
      </div>

      {/* Result message */}
      {findResult && (
        <Card className={findResult.count > 0 ? "border-primary/50 bg-primary/5" : "border-muted"}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              findResult.count > 0 ? "bg-primary/20" : "bg-muted"
            }`}>
              {findResult.count > 0 ? (
                <Sparkles className="w-4 h-4 text-primary" />
              ) : (
                <Search className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm">{findResult.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Opportunities List - Action Focused */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Ready for Outreach</h2>
        </div>

        {actionableOpps.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4">
                <Compass className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No opportunities yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Discover and save opportunities, or let Aurora find the best matches for you.
              </p>
              <Button onClick={() => setActiveTab("discover")} size="lg">
                <Compass className="w-4 h-4 mr-2" />
                Discover Opportunities
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {(showAll ? actionableOpps : actionableOpps.slice(0, 5)).map((opp) => (
              <OpportunityActionCard 
                key={opp.id} 
                opportunity={opp} 
                onStartOutreach={() => handleStartOutreach(opp)}
                onClick={() => setViewingOpp(opp)}
                onRefresh={refreshData}
              />
            ))}
            

          </div>
        )}
      </div>

      {/* Outreach Method Dialog */}
      <OutreachMethodDialog 
        opportunity={selectedOpp}
        isOpen={isOutreachDialogOpen}
        onClose={() => {
          setIsOutreachDialogOpen(false);
          setSelectedOpp(null);
        }}
        onSelectMethod={(method) => {
          setIsOutreachDialogOpen(false);
          setSelectedOpp(null);
          setActiveTab("outreach");
        }}
      />
    </div>
  );
}

function OpportunityActionCard({ 
  opportunity, 
  onStartOutreach,
  onClick,
  onRefresh,
}: { 
  opportunity: Opportunity;
  onStartOutreach: () => void;
  onClick: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [isEnriching, setIsEnriching] = useState(false);
  
  const handleReEnrich = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!opportunity.website) {
      toast.error("No website to enrich");
      return;
    }
    setIsEnriching(true);
    try {
      const res = await fetch("/api/re-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: opportunity.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Found ${data.contactMethodsAdded} contacts`);
        await onRefresh();
      } else {
        toast.error(data.error || "Failed to refresh");
      }
    } catch (err) {
      toast.error("Failed to refresh contacts");
    } finally {
      setIsEnriching(false);
    }
  };
  
  const hasWebsite = opportunity.website || opportunity.contactMethods.some(c => c.type === 'website');
  const hasContactForm = opportunity.contactForm || opportunity.contactMethods.some(c => c.type === 'contact_form');
  const hasEmail = opportunity.contactMethods.some(c => c.type === 'email');
  const hasInstagram = opportunity.contactMethods.some(c => c.type === 'instagram');
  const hasPhone = opportunity.contactMethods.some(c => c.type === 'phone');
  const hasFacebook = opportunity.contactMethods.some(c => c.type === 'facebook');
  const hasLinkedin = opportunity.contactMethods.some(c => c.type === 'linkedin');
  const hasTiktok = opportunity.contactMethods.some(c => c.type === 'tiktok');
  const hasTwitter = opportunity.contactMethods.some(c => c.type === 'twitter');
  
  const emailValue = opportunity.contactMethods.find(c => c.type === 'email')?.value;
  const instagramValue = opportunity.contactMethods.find(c => c.type === 'instagram')?.value;
  const phoneValue = opportunity.contactMethods.find(c => c.type === 'phone')?.value;
  const contactFormUrl = opportunity.contactForm?.url || opportunity.contactMethods.find(c => c.type === 'contact_form')?.value;
  const contactFormLabel = opportunity.contactForm?.label || 'Contact Form';
  
  const contactCount = [hasWebsite, hasContactForm, hasEmail, hasInstagram, hasPhone, hasFacebook, hasLinkedin].filter(Boolean).length;

  // Build photo URL if available
  const photoUrl = opportunity.photoReference 
    ? `/api/places/photo?ref=${encodeURIComponent(opportunity.photoReference)}&maxWidth=400`
    : null;

  return (
    <Card 
      className="overflow-hidden hover:border-primary/30 transition-colors group cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="flex">
          {/* Thumbnail */}
          <div className="w-28 shrink-0 relative">
            {photoUrl ? (
              <img 
                src={photoUrl} 
                alt={opportunity.name}
                className="w-full h-full object-cover absolute inset-0"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={`w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center ${photoUrl ? 'hidden' : ''}`}>
              <MapPin className="w-8 h-8 text-primary/30" />
            </div>
            {opportunity.source === 'aurora_ai' && (
              <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary/90 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
          </div>
          
          {/* Content */}
          <div className="p-3 flex-1 min-w-0 flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-semibold text-sm leading-tight line-clamp-1">{opportunity.name}</h3>
              <div className="flex items-center gap-1 shrink-0">
                {opportunity.priority === 'high' && (
                  <Badge variant="default" className="bg-primary/20 text-primary border-0 text-[10px] px-1.5 py-0">
                    High
                  </Badge>
                )}
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await updateOpportunity(opportunity.id, { liked: !opportunity.liked });
                    await onRefresh();
                  }}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                    opportunity.liked 
                      ? "bg-primary/10 text-primary" 
                      : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  }`}
                  title={opportunity.liked ? "Remove from saved" : "Save"}
                >
                  <Heart className={`w-3 h-3 ${opportunity.liked ? "fill-primary" : ""}`} />
                </button>
              </div>
            </div>
            
            {/* Meta info */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5 flex-wrap">
              <span>{typeLabels[opportunity.type]}</span>
              {opportunity.rating && (
                <>
                  <span className="text-muted-foreground/40">ÃÂ¢ÃÂÃÂ¢</span>
                  <span className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    {opportunity.rating.toFixed(1)}
                  </span>
                </>
              )}
            </div>

            {/* Contact Info Row */}
            {(hasEmail || hasInstagram || hasPhone) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5 overflow-hidden">
                {hasEmail && emailValue && (
                  <span className="flex items-center gap-1 truncate max-w-[120px]" title={emailValue}>
                    <Mail className="w-3 h-3 shrink-0 text-primary/70" />
                    <span className="truncate">{emailValue}</span>
                  </span>
                )}
                {hasInstagram && instagramValue && (
                  <span className="flex items-center gap-1 truncate" title={instagramValue}>
                    <Instagram className="w-3 h-3 shrink-0 text-pink-500" />
                    <span className="truncate">{instagramValue.replace('https://instagram.com/', '@').replace('https://www.instagram.com/', '@')}</span>
                  </span>
                )}
                {hasPhone && phoneValue && !hasEmail && !hasInstagram && (
                  <span className="flex items-center gap-1" title={phoneValue}>
                    <Phone className="w-3 h-3 shrink-0 text-green-600" />
                    <span>{phoneValue}</span>
                  </span>
                )}
              </div>
            )}

            {/* Why good fit */}
            {opportunity.whyGoodFit && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2 flex-1">
                {opportunity.whyGoodFit}
              </p>
            )}

            {/* Action Buttons - Primary actions first */}
            <div className="flex flex-wrap gap-1 mt-auto">
              {/* Contact Form - Primary action if available */}
              {hasContactForm && contactFormUrl && (
                <Button 
                  size="sm" 
                  className="h-7 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(contactFormUrl, '_blank');
                  }}
                >
                  <FileText className="w-3 h-3 mr-1" />
                  {contactFormLabel.length > 12 ? 'Apply' : contactFormLabel}
                </Button>
              )}
              {/* Website - only if no contact form */}
              {hasWebsite && !hasContactForm && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-7 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    const url = opportunity.website || opportunity.contactMethods.find(c => c.type === 'website')?.value;
                    if (url) window.open(url, '_blank');
                  }}
                >
                  <Globe className="w-3 h-3 mr-1" />
                  Web
                </Button>
              )}
              {/* Email */}
              {hasEmail && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    const email = opportunity.contactMethods.find(c => c.type === 'email')?.value;
                    if (email) window.location.href = `mailto:${email}`;
                  }}
                >
                  <Mail className="w-3 h-3 mr-1" />
                  Email
                </Button>
              )}
              {/* Social icons in compact row */}
              {(hasInstagram || hasFacebook || hasLinkedin || (hasWebsite && hasContactForm)) && (
                <div className="flex gap-1">
                  {hasInstagram && (
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        const ig = opportunity.contactMethods.find(c => c.type === 'instagram')?.value;
                        if (ig) {
                          const handle = ig.replace('@', '').replace('https://instagram.com/', '').replace('https://www.instagram.com/', '');
                          window.open(`https://instagram.com/${handle}`, '_blank');
                        }
                      }}
                      title="Instagram"
                    >
                      <Instagram className="w-3.5 h-3.5 text-pink-500" />
                    </Button>
                  )}
                  {hasFacebook && (
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        const fb = opportunity.contactMethods.find(c => c.type === 'facebook')?.value;
                        if (fb) window.open(fb.startsWith('http') ? fb : `https://facebook.com/${fb}`, '_blank');
                      }}
                      title="Facebook"
                    >
                      <Facebook className="w-3.5 h-3.5 text-blue-600" />
                    </Button>
                  )}
                  {hasLinkedin && (
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        const li = opportunity.contactMethods.find(c => c.type === 'linkedin')?.value;
                        if (li) window.open(li.startsWith('http') ? li : `https://linkedin.com/company/${li}`, '_blank');
                      }}
                      title="LinkedIn"
                    >
                      <Linkedin className="w-3.5 h-3.5 text-blue-700" />
                    </Button>
                  )}
                  {/* Website icon if contact form exists */}
                  {hasWebsite && hasContactForm && (
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = opportunity.website || opportunity.contactMethods.find(c => c.type === 'website')?.value;
                        if (url) window.open(url, '_blank');
                      }}
                      title="Website"
                    >
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              )}
              {/* Refresh contacts button */}
              {hasWebsite && (
                <Button 
                  size="sm" 
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={handleReEnrich}
                  disabled={isEnriching}
                  title="Refresh contacts"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${isEnriching ? 'animate-spin' : ''}`} />
                </Button>
              )}
              {/* Fallback if no contacts */}
              {contactCount === 0 && !hasWebsite && (
                <Button 
                  size="sm" 
                  className="h-7 px-2 text-xs"
                  onClick={onStartOutreach}
                >
                  <Send className="w-3 h-3 mr-1" />
                  Outreach
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OutreachMethodDialog({
  opportunity,
  isOpen,
  onClose,
  onSelectMethod,
}: {
  opportunity: Opportunity | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectMethod: (method: string) => void;
}) {
  if (!opportunity) return null;

  const methods = [
    {
      id: 'website',
      icon: ExternalLink,
      label: 'Website Form',
      description: 'Fill out their contact form',
      available: opportunity.website || opportunity.contactMethods.some(c => c.type === 'contact_form'),
      action: () => {
        const url = opportunity.website || opportunity.contactMethods.find(c => c.type === 'contact_form')?.value;
        if (url) window.open(url, '_blank');
      }
    },
    {
      id: 'email',
      icon: Mail,
      label: 'Email',
      description: 'Send a professional email',
      available: opportunity.contactMethods.some(c => c.type === 'email'),
      action: () => {
        const email = opportunity.contactMethods.find(c => c.type === 'email')?.value;
        if (email) window.location.href = `mailto:${email}`;
      }
    },
    {
      id: 'instagram',
      icon: Instagram,
      label: 'Instagram DM',
      description: 'Send a direct message',
      available: opportunity.contactMethods.some(c => c.type === 'instagram'),
      action: () => {
        const ig = opportunity.contactMethods.find(c => c.type === 'instagram')?.value;
        if (ig) {
          const handle = ig.replace('@', '').replace('https://instagram.com/', '');
          window.open(`https://instagram.com/${handle}`, '_blank');
        }
      }
    },
  ];

  const availableMethods = methods.filter(m => m.available);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Outreach Method</DialogTitle>
          <DialogDescription>
            How would you like to contact {opportunity.name}?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-2 mt-4">
          {availableMethods.length > 0 ? (
            availableMethods.map((method) => {
              const Icon = method.icon;
              return (
                <button
                  key={method.id}
                  onClick={() => {
                    method.action();
                    onSelectMethod(method.id);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{method.label}</p>
                    <p className="text-sm text-muted-foreground">{method.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
                </button>
              );
            })
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground">No contact methods available for this opportunity.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper function for contact method icons
function getContactMethodIcon(type: ContactMethodType) {
  const iconMap: Record<ContactMethodType, typeof Mail> = {
    email: Mail,
    phone: Phone,
    website: Globe,
    contact_form: FileText,
    instagram: Instagram,
    facebook: Facebook,
    linkedin: Linkedin,
    twitter: MessageCircle,
    other: MoreHorizontal,
  };
  return iconMap[type] || MoreHorizontal;
}

// Opportunity detail view component
function OpportunityDetailView({
  opportunity,
  onBack,
  onRefresh,
}: {
  opportunity: Opportunity;
  onBack: () => void;
  onRefresh: () => Promise<void>;
}) {
  const { setActiveTab } = useAurora();
  const [isPending, startTransition] = useTransition();
  const [suggestedMessage, setSuggestedMessage] = useState<{
    subject: string;
    body: string;
    contactMethod: string;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [showImageLightbox, setShowImageLightbox] = useState(false);
  const [emailConnected, setEmailConnected] = useState<boolean | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Check email connection status
  useEffect(() => {
    fetch('/api/email/status')
      .then(res => res.json())
      .then(data => setEmailConnected(data.connected))
      .catch(() => setEmailConnected(false));
  }, []);

  // Generate suggested message on mount
  useEffect(() => {
    const generateMessage = async () => {
      setIsGenerating(true);
      setMessageError(null);
      try {
        // Prefer email, then instagram, then contact_form
        const emailContact = opportunity.contactMethods.find(c => c.type === 'email');
        const igContact = opportunity.contactMethods.find(c => c.type === 'instagram');
        const contactMethod = emailContact ? 'email' : igContact ? 'instagram' : 'email';

        const res = await fetch('/api/generate-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            opportunityId: opportunity.id,
            contactMethod,
          }),
        });

        if (!res.ok) throw new Error('Failed to generate');
        
        const data = await res.json();
        setSuggestedMessage(data);
      } catch (err) {
        // Silently fail - let user compose manually
        setSuggestedMessage(null);
      } finally {
        setIsGenerating(false);
      }
    };

    generateMessage();
  }, [opportunity.id, opportunity.contactMethods]);

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
    });
  };

  return (
    <>
    {/* Image Lightbox */}
    {showImageLightbox && photoUrl && (
      <div 
        className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
        onClick={() => setShowImageLightbox(false)}
      >
        <button 
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          onClick={() => setShowImageLightbox(false)}
        >
          <X className="w-6 h-6" />
        </button>
        <img 
          src={photoUrl.replace('maxWidth=800', 'maxWidth=1600')} 
          alt={opportunity.name}
          className="max-w-full max-h-full object-contain p-4"
        />
      </div>
    )}

    <div className="flex flex-col min-h-[calc(100vh-8rem)] -mx-4 -mt-4">
      {/* Full-height hero with overlay content */}
      <div className="relative flex-1 min-h-[45vh]">
        {/* Background image - clickable */}
        <button 
          className="absolute inset-0 w-full cursor-pointer group"
          onClick={() => photoUrl && setShowImageLightbox(true)}
        >
          {photoUrl ? (
            <img 
              src={photoUrl} 
              alt={opportunity.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/10 to-background" />
          )}
          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-black/20" />
          {/* Expand icon hint */}
          {photoUrl && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Maximize2 className="w-5 h-5 text-white" />
            </div>
          )}
        </button>

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div className="flex items-center gap-2">
            {opportunity.source === 'aurora_ai' && (
              <div className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                AI Found
              </div>
            )}
            <button 
              onClick={handleDelete}
              disabled={isPending}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-destructive transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hero content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
          {/* Quality indicators */}
          <div className="flex items-center gap-2 mb-3">
            {opportunity.rating && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-white text-sm font-semibold shadow-lg">
                <Star className="w-3.5 h-3.5 fill-white" />
                {opportunity.rating.toFixed(1)}
              </div>
            )}
            <Badge className="bg-background/90 text-foreground border-0 backdrop-blur-sm shadow-sm">
              {typeLabels[opportunity.type]}
            </Badge>
            {opportunity.priority === 'high' && (
              <Badge className="bg-primary text-primary-foreground shadow-sm">
                Hot Lead
              </Badge>
            )}
          </div>
          
          {/* Title - with text shadow for readability */}
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1 text-balance leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
            {opportunity.name}
          </h1>
          {opportunity.location && (
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
              <MapPin className="w-4 h-4" />
              {opportunity.location.split(',').slice(0, 2).join(',')}
            </p>
          )}
        </div>
      </div>

      {/* Content section - compact */}
      <div className="bg-background px-4 py-4 space-y-4">
        {/* Why good fit - with label */}
        {opportunity.whyGoodFit && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-primary uppercase tracking-wide">Why it&apos;s a great fit</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed pl-6">{opportunity.whyGoodFit}</p>
          </div>
        )}

        {/* Quick contact buttons - horizontal scroll */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {opportunity.website && (
            <Button 
              variant="outline" 
              size="sm"
              className="shrink-0"
              onClick={() => window.open(opportunity.website, '_blank')}
            >
              <Globe className="w-4 h-4 mr-1.5" />
              Website
            </Button>
          )}
          {opportunity.contactMethods.slice(0, 4).map((cm) => {
            const Icon = getContactMethodIcon(cm.type);
            return (
              <Button 
                key={cm.id}
                variant="outline" 
                size="sm"
                className="shrink-0"
                onClick={() => {
                  if (cm.type === 'email') window.location.href = `mailto:${cm.value}`;
                  else if (cm.type === 'phone') window.location.href = `tel:${cm.value}`;
                  else if (cm.type === 'instagram') {
                    const handle = cm.value.replace('@', '').replace('https://instagram.com/', '');
                    window.open(`https://instagram.com/${handle}`, '_blank');
                  } else if (cm.value.startsWith('http')) window.open(cm.value, '_blank');
                }}
              >
                <Icon className="w-4 h-4 mr-1.5" />
                {contactMethodLabels[cm.type]}
              </Button>
            );
          })}
        </div>

        {/* AI Message Preview */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Your First Message</span>
            </div>
            {!isGenerating && suggestedMessage && (
              <button
                onClick={() => {
                  setIsGenerating(true);
                  setSuggestedMessage(null);
                  fetch('/api/generate-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      opportunityId: opportunity.id,
                      contactMethod: suggestedMessage?.contactMethod || 'email',
                      forceRegenerate: true,
                    }),
                  })
                    .then(res => res.json())
                    .then(data => setSuggestedMessage(data))
                    .catch(() => setMessageError('Could not regenerate'))
                    .finally(() => setIsGenerating(false));
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Regenerate
              </button>
            )}
          </div>

          {isGenerating ? (
            <div className="flex items-center gap-3 py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Crafting the perfect message...</span>
            </div>
          ) : suggestedMessage ? (
            <div className="space-y-2">
              {suggestedMessage.subject && (
                <p className="text-xs text-muted-foreground">
                  Subject: <span className="text-foreground">{suggestedMessage.subject}</span>
                </p>
              )}
              <p className="text-sm leading-relaxed line-clamp-3">{suggestedMessage.body}</p>
              <button className="text-xs text-primary hover:underline">Read full message</button>
            </div>
          ) : messageError ? (
            <p className="text-sm text-muted-foreground py-2">{messageError}</p>
          ) : null}
        </div>
      </div>

      {/* Sticky bottom actions */}
      <div className="sticky bottom-0 bg-background border-t px-4 py-3 space-y-2">
        {/* Email connection prompt */}
        {emailConnected === false && (
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 mb-2">
            <p className="text-sm text-muted-foreground">Connect your email to send directly</p>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => window.location.href = '/api/email/connect?provider=google'}
            >
              <Mail className="w-4 h-4 mr-1.5" />
              Connect
            </Button>
          </div>
        )}

        {/* Success message */}
        {sendSuccess && (
          <div className="bg-green-500/10 text-green-600 rounded-lg p-3 text-center text-sm font-medium">
            Email sent successfully!
          </div>
        )}

        <div className="flex gap-3">
          <Button
            size="lg"
            className="flex-1 h-12"
            disabled={!suggestedMessage || isGenerating || isPending || isSending || sendSuccess}
            onClick={async () => {
              if (!suggestedMessage) return;
              const emailContact = opportunity.contactMethods.find(c => c.type === 'email');
              const igContact = opportunity.contactMethods.find(c => c.type === 'instagram');
              
              // If email is connected, send via API
              if (emailConnected && emailContact) {
                setIsSending(true);
                try {
                  const res = await fetch('/api/email/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      to: emailContact.value,
                      toName: opportunity.name,
                      subject: suggestedMessage.subject,
                      body: suggestedMessage.body,
                      opportunityId: opportunity.id,
                    }),
                  });
                  
                  if (res.ok) {
                    setSendSuccess(true);
                    await onRefresh();
                  } else {
                    const data = await res.json();
                    alert(data.error || 'Failed to send email');
                  }
                } catch {
                  alert('Failed to send email');
                } finally {
                  setIsSending(false);
                }
              } else if (suggestedMessage.contactMethod === 'instagram' && igContact) {
                // Instagram: copy message and open profile
                const handle = igContact.value.replace('@', '').replace('https://instagram.com/', '');
                navigator.clipboard.writeText(suggestedMessage.body);
                window.open(`https://instagram.com/${handle}`, '_blank');
              } else if (emailContact) {
                // Fallback to mailto
                const subject = encodeURIComponent(suggestedMessage.subject);
                const body = encodeURIComponent(suggestedMessage.body);
                window.location.href = `mailto:${emailContact.value}?subject=${subject}&body=${body}`;
              } else if (opportunity.website) {
                navigator.clipboard.writeText(suggestedMessage.body);
                window.open(opportunity.website, '_blank');
              }
            }}
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Send className="w-5 h-5 mr-2" />
            )}
            {isSending ? 'Sending...' : sendSuccess ? 'Sent!' : 'Send Message'}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 px-4"
            disabled={isPending || sendSuccess}
            onClick={() => {
              startTransition(async () => {
                await updateOpportunity(opportunity.id, { status: "outreach_ready" });
                await onRefresh();
                setActiveTab("outreach");
              });
            }}
          >
            <Target className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}
