"use client";

import { useState, useEffect, useTransition } from "react";
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
  Crosshair,
  TrendingUp,
  Zap,
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

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const firstName = profile?.businessName?.split(" ")[0] || "";

  const actionableOpps = opportunities
    .filter(o => o.status === "new" || o.status === "outreach_ready")
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

  const stats = {
    new: opportunities.filter(o => o.status === "new").length,
    sent: opportunities.filter(o => o.status === "sent").length,
    total: opportunities.length,
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
        setFindResult({ count: data.created || 0, message: data.message || `Found ${data.created || 0} new opportunities!` });
        await refreshData();
      } else {
        setFindResult({ count: 0, message: data.error || "Failed to find opportunities" });
      }
    } catch {
      setFindResult({ count: 0, message: "Something went wrong. Please try again." });
    } finally {
      setIsFinding(false);
    }
  };

  const handleStartOutreach = (opp: Opportunity) => {
    setSelectedOpp(opp);
    setIsOutreachDialogOpen(true);
  };

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
    <div className="space-y-5">
      {/* Hero Bento Card */}
      <div className="glass-card rounded-3xl p-5 relative overflow-hidden">
        {/* Background decorative blobs */}
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-primary/8 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-6 right-8 w-24 h-24 rounded-full bg-purple-300/10 blur-xl pointer-events-none" />

        <div className="relative z-10">
          {/* Daily Insight badge */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/10 mb-3">
            <Sparkles className="w-3 h-3 fill-primary" />
            Daily Insight
          </span>

          <h1 className="text-xl font-extrabold text-foreground leading-snug mb-1">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
            {actionableOpps.length > 0
              ? `${actionableOpps.length} ${actionableOpps.length === 1 ? "opportunity" : "opportunities"} ready for outreach`
              : "Discover new opportunities to grow your business"}
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-4 mb-4">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">New</p>
              <p className="text-2xl font-extrabold text-foreground leading-none">{stats.new}</p>
            </div>
            <div className="w-px h-8 bg-border/60" />
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sent</p>
              <p className="text-2xl font-extrabold text-foreground leading-none">{stats.sent}</p>
            </div>
            <div className="w-px h-8 bg-border/60" />
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total</p>
              <p className="text-2xl font-extrabold text-foreground leading-none">{stats.total}</p>
            </div>
          </div>

          {/* AI Find CTA */}
          <Button
            onClick={handleFindOpportunities}
            disabled={isFinding}
            className="w-full h-11 rounded-2xl font-bold fluid-gradient border-0 shadow-md shadow-primary/25 hover:opacity-90 transition-all active:scale-[0.98] text-white"
          >
            {isFinding ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2 fill-white" />
            )}
            {isFinding ? "Finding opportunities…" : "AI Find Opportunities"}
          </Button>
        </div>
      </div>

      {/* Find result message */}
      {findResult && (
        <div className={`glass-card rounded-2xl p-4 flex items-center gap-3 ${
          findResult.count > 0 ? "border-primary/20" : ""
        }`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            findResult.count > 0 ? "fluid-gradient" : "bg-muted"
          }`}>
            {findResult.count > 0 ? (
              <Sparkles className="w-4 h-4 text-white" />
            ) : (
              <Search className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <p className="text-sm font-medium">{findResult.message}</p>
        </div>
      )}

      {/* Opportunities list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-bold text-base text-foreground">Ready for Outreach</h2>
          {actionableOpps.length > 0 && (
            <button
              className="text-xs text-primary font-semibold hover:underline"
              onClick={() => setActiveTab("discover")}
            >
              Find more
            </button>
          )}
        </div>

        {actionableOpps.length === 0 ? (
          <div className="glass-card rounded-3xl p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-3xl fluid-gradient flex items-center justify-center mb-4 shadow-lg shadow-primary/25">
              <Compass className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-bold text-base mb-1">No opportunities yet</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto leading-relaxed">
              Discover venues, planners, and clients — or let Aurora find the best matches for you.
            </p>
            <Button
              onClick={() => setActiveTab("discover")}
              className="rounded-2xl font-bold fluid-gradient border-0 shadow-md shadow-primary/25 text-white"
            >
              <Compass className="w-4 h-4 mr-2" />
              Discover Opportunities
            </Button>
          </div>
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

            {actionableOpps.length > 5 && (
              <button
                className="w-full py-3 text-sm text-primary font-semibold text-center rounded-2xl glass-card glass-card-hover"
                onClick={() => setShowAll(s => !s)}
              >
                {showAll
                  ? "Show less"
                  : `Show all ${actionableOpps.length} opportunities`}
              </button>
            )}
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
        onSelectMethod={() => {
          setIsOutreachDialogOpen(false);
          setSelectedOpp(null);
          setActiveTab("outreach");
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────── */
/*  Opportunity Action Card                             */
/* ─────────────────────────────────────────────────── */
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
    if (!opportunity.website) { toast.error("No website to enrich"); return; }
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
    } catch { toast.error("Failed to refresh contacts"); }
    finally { setIsEnriching(false); }
  };

  const hasWebsite     = opportunity.website || opportunity.contactMethods.some(c => c.type === "website");
  const hasContactForm = opportunity.contactForm || opportunity.contactMethods.some(c => c.type === "contact_form");
  const hasEmail       = opportunity.contactMethods.some(c => c.type === "email");
  const hasInstagram   = opportunity.contactMethods.some(c => c.type === "instagram");
  const hasPhone       = opportunity.contactMethods.some(c => c.type === "phone");
  const hasFacebook    = opportunity.contactMethods.some(c => c.type === "facebook");
  const hasLinkedin    = opportunity.contactMethods.some(c => c.type === "linkedin");

  const emailValue       = opportunity.contactMethods.find(c => c.type === "email")?.value;
  const instagramValue   = opportunity.contactMethods.find(c => c.type === "instagram")?.value;
  const phoneValue       = opportunity.contactMethods.find(c => c.type === "phone")?.value;
  const contactFormUrl   = opportunity.contactForm?.url || opportunity.contactMethods.find(c => c.type === "contact_form")?.value;
  const contactFormLabel = opportunity.contactForm?.label || "Contact Form";

  const contactCount = [hasWebsite, hasContactForm, hasEmail, hasInstagram, hasPhone, hasFacebook, hasLinkedin].filter(Boolean).length;

  const photoUrl = opportunity.photoReference
    ? `/api/places/photo?ref=${encodeURIComponent(opportunity.photoReference)}&maxWidth=400`
    : null;

  return (
    <div
      className="glass-card glass-card-hover rounded-2xl overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      <div className="flex">
        {/* Thumbnail */}
        <div className="w-24 shrink-0 relative self-stretch min-h-[88px]">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={opportunity.name}
              className="w-full h-full object-cover absolute inset-0"
              onError={(e) => {
                const t = e.target as HTMLImageElement;
                t.style.display = "none";
                t.nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div className={`w-full h-full fluid-gradient-subtle flex items-center justify-center ${photoUrl ? "hidden" : ""}`}>
            <MapPin className="w-6 h-6 text-primary/40" />
          </div>
          {opportunity.source === "aurora_ai" && (
            <div className="absolute top-2 left-2 w-5 h-5 rounded-full fluid-gradient flex items-center justify-center shadow-sm">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 flex-1 min-w-0 flex flex-col gap-1.5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-sm leading-tight line-clamp-1 text-foreground">
              {opportunity.name}
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              {opportunity.priority === "high" && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/10">
                  Hot
                </span>
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
                    : "bg-muted/60 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                }`}
              >
                <Heart className={`w-3 h-3 ${opportunity.liked ? "fill-primary" : ""}`} />
              </button>
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
            <span>{typeLabels[opportunity.type]}</span>
            {opportunity.rating && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  {opportunity.rating.toFixed(1)}
                </span>
              </>
            )}
          </div>

          {/* Contact row */}
          {(hasEmail || hasInstagram || hasPhone) && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground overflow-hidden">
              {hasEmail && emailValue && (
                <span className="flex items-center gap-1 truncate max-w-[110px]">
                  <Mail className="w-2.5 h-2.5 shrink-0 text-primary/60" />
                  <span className="truncate">{emailValue}</span>
                </span>
              )}
              {hasInstagram && instagramValue && !hasEmail && (
                <span className="flex items-center gap-1 truncate">
                  <Instagram className="w-2.5 h-2.5 shrink-0 text-pink-500" />
                  <span className="truncate">{instagramValue.replace("https://instagram.com/", "@").replace("https://www.instagram.com/", "@")}</span>
                </span>
              )}
            </div>
          )}

          {/* Why good fit */}
          {opportunity.whyGoodFit && (
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
              {opportunity.whyGoodFit}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-1.5 mt-auto pt-0.5">
            {hasContactForm && contactFormUrl && (
              <button
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold fluid-gradient text-white shadow-sm active:scale-[0.97]"
                onClick={(e) => { e.stopPropagation(); window.open(contactFormUrl, "_blank"); }}
              >
                <FileText className="w-2.5 h-2.5" />
                {contactFormLabel.length > 12 ? "Apply" : contactFormLabel}
              </button>
            )}
            {hasWebsite && !hasContactForm && (
              <button
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold glass-card border border-border/60 text-foreground"
                onClick={(e) => { e.stopPropagation(); const u = opportunity.website || opportunity.contactMethods.find(c => c.type === "website")?.value; if (u) window.open(u, "_blank"); }}
              >
                <Globe className="w-2.5 h-2.5" />
                Web
              </button>
            )}
            {hasEmail && (
              <button
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold glass-card border border-border/60 text-foreground"
                onClick={(e) => { e.stopPropagation(); const em = opportunity.contactMethods.find(c => c.type === "email")?.value; if (em) window.location.href = `mailto:${em}`; }}
              >
                <Mail className="w-2.5 h-2.5 text-primary/70" />
                Email
              </button>
            )}
            {/* Social icons */}
            {hasInstagram && (
              <button
                className="w-6 h-6 rounded-full glass-card border border-border/60 flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); const ig = opportunity.contactMethods.find(c => c.type === "instagram")?.value; if (ig) { const h = ig.replace("@", "").replace("https://instagram.com/", "").replace("https://www.instagram.com/", ""); window.open(`https://instagram.com/${h}`, "_blank"); } }}
                title="Instagram"
              >
                <Instagram className="w-3 h-3 text-pink-500" />
              </button>
            )}
            {hasFacebook && (
              <button
                className="w-6 h-6 rounded-full glass-card border border-border/60 flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); const fb = opportunity.contactMethods.find(c => c.type === "facebook")?.value; if (fb) window.open(fb.startsWith("http") ? fb : `https://facebook.com/${fb}`, "_blank"); }}
                title="Facebook"
              >
                <Facebook className="w-3 h-3 text-blue-600" />
              </button>
            )}
            {hasLinkedin && (
              <button
                className="w-6 h-6 rounded-full glass-card border border-border/60 flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); const li = opportunity.contactMethods.find(c => c.type === "linkedin")?.value; if (li) window.open(li.startsWith("http") ? li : `https://linkedin.com/company/${li}`, "_blank"); }}
                title="LinkedIn"
              >
                <Linkedin className="w-3 h-3 text-blue-700" />
              </button>
            )}
            {hasWebsite && hasContactForm && (
              <button
                className="w-6 h-6 rounded-full glass-card border border-border/60 flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); const u = opportunity.website || opportunity.contactMethods.find(c => c.type === "website")?.value; if (u) window.open(u, "_blank"); }}
                title="Website"
              >
                <Globe className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
            {/* Refresh */}
            {hasWebsite && (
              <button
                className="w-6 h-6 rounded-full glass-card border border-border/60 flex items-center justify-center"
                onClick={handleReEnrich}
                disabled={isEnriching}
                title="Refresh contacts"
              >
                <RefreshCw className={`w-3 h-3 text-muted-foreground ${isEnriching ? "animate-spin" : ""}`} />
              </button>
            )}
            {/* Fallback */}
            {contactCount === 0 && !hasWebsite && (
              <button
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold fluid-gradient text-white shadow-sm"
                onClick={(e) => { e.stopPropagation(); onStartOutreach(); }}
              >
                <Send className="w-2.5 h-2.5" />
                Outreach
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────── */
/*  Outreach Method Dialog                              */
/* ─────────────────────────────────────────────────── */
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
      id: "website",
      icon: ExternalLink,
      label: "Website Form",
      description: "Fill out their contact form",
      available: opportunity.website || opportunity.contactMethods.some(c => c.type === "contact_form"),
      action: () => {
        const url = opportunity.website || opportunity.contactMethods.find(c => c.type === "contact_form")?.value;
        if (url) window.open(url, "_blank");
      },
    },
    {
      id: "email",
      icon: Mail,
      label: "Email",
      description: "Send a professional email",
      available: opportunity.contactMethods.some(c => c.type === "email"),
      action: () => {
        const em = opportunity.contactMethods.find(c => c.type === "email")?.value;
        if (em) window.location.href = `mailto:${em}`;
      },
    },
    {
      id: "instagram",
      icon: Instagram,
      label: "Instagram DM",
      description: "Send a direct message",
      available: opportunity.contactMethods.some(c => c.type === "instagram"),
      action: () => {
        const ig = opportunity.contactMethods.find(c => c.type === "instagram")?.value;
        if (ig) { const h = ig.replace("@", "").replace("https://instagram.com/", ""); window.open(`https://instagram.com/${h}`, "_blank"); }
      },
    },
  ];

  const availableMethods = methods.filter(m => m.available);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-3xl glass-card border-white/60">
        <DialogHeader>
          <DialogTitle className="font-bold">Choose Outreach Method</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            How would you like to contact {opportunity.name}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {availableMethods.length > 0 ? (
            availableMethods.map((method) => {
              const Icon = method.icon;
              return (
                <button
                  key={method.id}
                  onClick={() => { method.action(); onSelectMethod(method.id); }}
                  className="w-full flex items-center gap-4 p-3.5 rounded-2xl glass-card glass-card-hover border border-white/60 text-left"
                >
                  <div className="w-10 h-10 rounded-xl fluid-gradient-subtle flex items-center justify-center shrink-0 border border-primary/10">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{method.label}</p>
                    <p className="text-xs text-muted-foreground">{method.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                </button>
              );
            })
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">No contact methods available.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────── */
/*  Helper: contact method icon                         */
/* ─────────────────────────────────────────────────── */
function getContactMethodIcon(type: ContactMethodType) {
  const iconMap: Partial<Record<ContactMethodType, typeof Mail>> = {
    email: Mail,
    phone: Phone,
    website: Globe,
    contact_form: FileText,
    instagram: Instagram,
    facebook: Facebook,
    linkedin: Linkedin,
    twitter: MessageCircle,
  };
  return iconMap[type] || MoreHorizontal;
}

/* ─────────────────────────────────────────────────── */
/*  Opportunity Detail View                             */
/* ─────────────────────────────────────────────────── */
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

  useEffect(() => {
    fetch("/api/email/status")
      .then(r => r.json())
      .then(d => setEmailConnected(d.connected))
      .catch(() => setEmailConnected(false));
  }, []);

  useEffect(() => {
    const gen = async () => {
      setIsGenerating(true);
      setMessageError(null);
      try {
        const emailContact = opportunity.contactMethods.find(c => c.type === "email");
        const igContact    = opportunity.contactMethods.find(c => c.type === "instagram");
        const contactMethod = emailContact ? "email" : igContact ? "instagram" : "email";
        const res = await fetch("/api/generate-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opportunityId: opportunity.id, contactMethod }),
        });
        if (!res.ok) throw new Error("Failed");
        setSuggestedMessage(await res.json());
      } catch { setSuggestedMessage(null); }
      finally { setIsGenerating(false); }
    };
    gen();
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

  return (
    <>
      {showImageLightbox && photoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setShowImageLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
            onClick={() => setShowImageLightbox(false)}
          >
            <X className="w-6 h-6" />
          </button>
          <img src={photoUrl.replace("maxWidth=800", "maxWidth=1600")} alt={opportunity.name} className="max-w-full max-h-full object-contain p-4" />
        </div>
      )}

      <div className="flex flex-col min-h-[calc(100vh-8rem)] -mx-4 -mt-5">
        {/* Hero */}
        <div className="relative min-h-[45vh]">
          <button
            className="absolute inset-0 w-full cursor-pointer group"
            onClick={() => photoUrl && setShowImageLightbox(true)}
          >
            {photoUrl ? (
              <img src={photoUrl} alt={opportunity.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full" style={{ background: "linear-gradient(135deg, rgba(139,120,219,0.3) 0%, rgba(165,148,232,0.1) 100%)" }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-black/20" />
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
              {opportunity.source === "aurora_ai" && (
                <div className="px-3 py-1.5 rounded-full fluid-gradient text-white text-xs font-semibold flex items-center gap-1.5 shadow-md">
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

          {/* Hero overlay content */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            <div className="flex items-center gap-2 mb-2">
              {opportunity.rating && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-white text-sm font-bold shadow-md">
                  <Star className="w-3.5 h-3.5 fill-white" />
                  {opportunity.rating.toFixed(1)}
                </div>
              )}
              <Badge className="bg-white/90 text-foreground border-0 backdrop-blur-sm shadow-sm text-xs">
                {typeLabels[opportunity.type]}
              </Badge>
              {opportunity.priority === "high" && (
                <Badge className="fluid-gradient text-white border-0 shadow-sm text-xs">Hot Lead</Badge>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-foreground mb-1 leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
              {opportunity.name}
            </h1>
            {opportunity.location && (
              <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <MapPin className="w-4 h-4" />
                {opportunity.location.split(",").slice(0, 2).join(",")}
              </p>
            )}
          </div>
        </div>

        {/* Detail content */}
        <div className="bg-background px-4 py-5 space-y-4">
          {opportunity.whyGoodFit && (
            <div className="glass-card rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Why it's a great fit</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{opportunity.whyGoodFit}</p>
            </div>
          )}

          {/* Contact buttons */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {opportunity.website && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 rounded-xl glass-card border-white/70"
                onClick={() => window.open(opportunity.website, "_blank")}
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
                  className="shrink-0 rounded-xl glass-card border-white/70"
                  onClick={() => {
                    if (cm.type === "email") window.location.href = `mailto:${cm.value}`;
                    else if (cm.type === "phone") window.location.href = `tel:${cm.value}`;
                    else if (cm.type === "instagram") { const h = cm.value.replace("@", "").replace("https://instagram.com/", ""); window.open(`https://instagram.com/${h}`, "_blank"); }
                    else if (cm.value.startsWith("http")) window.open(cm.value, "_blank");
                  }}
                >
                  <Icon className="w-4 h-4 mr-1.5" />
                  {contactMethodLabels[cm.type]}
                </Button>
              );
            })}
          </div>

          {/* AI Message Preview */}
          <div className="glass-card ai-glow rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg fluid-gradient flex items-center justify-center">
                  <Mail className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-bold">Your First Message</span>
              </div>
              {!isGenerating && suggestedMessage && (
                <button
                  onClick={() => {
                    setIsGenerating(true);
                    setSuggestedMessage(null);
                    fetch("/api/generate-message", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ opportunityId: opportunity.id, contactMethod: suggestedMessage?.contactMethod || "email", forceRegenerate: true }),
                    })
                      .then(r => r.json())
                      .then(d => setSuggestedMessage(d))
                      .catch(() => setMessageError("Could not regenerate"))
                      .finally(() => setIsGenerating(false));
                  }}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Regenerate
                </button>
              )}
            </div>

            {isGenerating ? (
              <div className="flex items-center gap-3 py-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Crafting the perfect message…</span>
              </div>
            ) : suggestedMessage ? (
              <div className="space-y-2">
                {suggestedMessage.subject && (
                  <p className="text-xs text-muted-foreground">
                    Subject: <span className="text-foreground font-medium">{suggestedMessage.subject}</span>
                  </p>
                )}
                <p className="text-sm leading-relaxed line-clamp-3 text-foreground/90">{suggestedMessage.body}</p>
                <button className="text-xs text-primary hover:underline font-medium">Read full message</button>
              </div>
            ) : messageError ? (
              <p className="text-sm text-muted-foreground py-2">{messageError}</p>
            ) : null}
          </div>
        </div>

        {/* Sticky bottom CTA */}
        <div className="sticky bottom-0 glass-nav border-t border-white/50 px-4 py-3 space-y-2">
          {emailConnected === false && (
            <div className="flex items-center justify-between glass-card rounded-xl p-3">
              <p className="text-sm text-muted-foreground">Connect email to send directly</p>
              <Button
                size="sm"
                className="rounded-xl fluid-gradient border-0 text-white font-semibold"
                onClick={() => window.location.href = "/api/email/connect?provider=google"}
              >
                <Mail className="w-4 h-4 mr-1.5" />
                Connect
              </Button>
            </div>
          )}

          {sendSuccess && (
            <div className="bg-green-500/10 text-green-600 rounded-xl p-3 text-center text-sm font-semibold">
              Email sent successfully! ✓
            </div>
          )}

          <div className="flex gap-3">
            <Button
              size="lg"
              className="flex-1 h-12 rounded-2xl font-bold fluid-gradient border-0 shadow-md shadow-primary/25 text-white hover:opacity-90 transition-all active:scale-[0.98]"
              disabled={!suggestedMessage || isGenerating || isPending || isSending || sendSuccess}
              onClick={async () => {
                if (!suggestedMessage) return;
                const emailContact = opportunity.contactMethods.find(c => c.type === "email");
                const igContact    = opportunity.contactMethods.find(c => c.type === "instagram");

                if (emailConnected && emailContact) {
                  setIsSending(true);
                  try {
                    const res = await fetch("/api/email/send", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ to: emailContact.value, toName: opportunity.name, subject: suggestedMessage.subject, body: suggestedMessage.body, opportunityId: opportunity.id }),
                    });
                    if (res.ok) { setSendSuccess(true); await onRefresh(); }
                    else { const d = await res.json(); alert(d.error || "Failed to send"); }
                  } catch { alert("Failed to send email"); }
                  finally { setIsSending(false); }
                } else if (suggestedMessage.contactMethod === "instagram" && igContact) {
                  const h = igContact.value.replace("@", "").replace("https://instagram.com/", "");
                  navigator.clipboard.writeText(suggestedMessage.body);
                  window.open(`https://instagram.com/${h}`, "_blank");
                } else if (emailContact) {
                  window.location.href = `mailto:${emailContact.value}?subject=${encodeURIComponent(suggestedMessage.subject)}&body=${encodeURIComponent(suggestedMessage.body)}`;
                } else if (opportunity.website) {
                  navigator.clipboard.writeText(suggestedMessage.body);
                  window.open(opportunity.website, "_blank");
                }
              }}
            >
              {isSending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
              {isSending ? "Sending…" : sendSuccess ? "Sent!" : "Send Message"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-4 rounded-2xl glass-card border-white/60"
              disabled={isPending || sendSuccess}
              onClick={() => {
                startTransition(async () => {
                  await updateOpportunity(opportunity.id, { status: "outreach_ready" });
                  await onRefresh();
                  setActiveTab("outreach");
                });
              }}
            >
              <Crosshair className="w-5 h-5 text-primary" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
