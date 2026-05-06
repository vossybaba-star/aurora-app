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
import { typeLabels, contactMethodLabels } from "@/lib/types";
import type { Opportunity, ContactMethodType } from "@/lib/types";
import { deleteOpportunity, updateOpportunity } from "@/lib/actions";
import { toast } from "sonner";
import {
  Sparkles, Mail, Search, Loader2, MapPin, Star, ExternalLink,
  Instagram, Send, ChevronRight, Bell, Heart, Compass, Trash2,
  Phone, Globe, MessageCircle, Linkedin, Facebook, FileText,
  MoreHorizontal, X, Maximize2, RefreshCw, Crosshair, Zap,
} from "lucide-react";

export function DashboardHome() {
  const { setActiveTab, profile, opportunities, refreshData } = useAurora();
  const [isFinding, setIsFinding]     = useState(false);
  const [findResult, setFindResult]   = useState<{ count: number; message: string } | null>(null);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [viewingOpp, setViewingOpp]   = useState<Opportunity | null>(null);
  const [showAll, setShowAll]         = useState(false);
  const [isOutreachDialogOpen, setIsOutreachDialogOpen] = useState(false);
  const [greeting, setGreeting]       = useState("Welcome");

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting("Good morning");
    else if (h < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const firstName = profile?.businessName?.split(" ")[0] || "";

  const actionableOpps = opportunities
    .filter(o => o.status === "new" || o.status === "outreach_ready")
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]));

  const stats = {
    new:   opportunities.filter(o => o.status === "new").length,
    sent:  opportunities.filter(o => o.status === "sent").length,
    total: opportunities.length,
  };

  const handleFindOpportunities = async () => {
    setIsFinding(true);
    setFindResult(null);
    try {
      const res  = await fetch("/api/find-opportunities", { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = await res.json();
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

  if (viewingOpp) {
    return <OpportunityDetailView opportunity={viewingOpp} onBack={() => setViewingOpp(null)} onRefresh={refreshData} />;
  }

  return (
    <div className="space-y-5">
      {/* Hero Panel */}
      <div className="glass-panel rounded-3xl p-5 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full opacity-20 blur-2xl pointer-events-none"
             style={{ background: 'var(--ll-liquid-b)' }} />
        <div className="absolute -bottom-6 left-8 w-24 h-24 rounded-full opacity-20 blur-xl pointer-events-none"
             style={{ background: 'var(--ll-liquid-c)' }} />

        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3 shimmer-ai glass-card"
                style={{ color: '#3525cd' }}>
            <Sparkles className="w-3 h-3" style={{ fill: '#3525cd' }} />
            Daily Insight
          </span>

          <h1 className="text-xl font-extrabold leading-snug mb-1" style={{ color: '#131b2e' }}>
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground mb-5">
            {actionableOpps.length > 0
              ? `${actionableOpps.length} ${actionableOpps.length === 1 ? "opportunity" : "opportunities"} ready`
              : "Discover new opportunities to grow your business"}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-5 mb-5">
            {[
              { label: "New",   value: stats.new },
              { label: "Sent",  value: stats.sent },
              { label: "Total", value: stats.total },
            ].map((s, i) => (
              <div key={s.label} className="flex items-center gap-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-extrabold" style={{ color: '#131b2e' }}>{s.value}</p>
                </div>
                {i < 2 && <div className="w-px h-8 bg-white/60" />}
              </div>
            ))}
          </div>

          {/* AI Find CTA */}
          <button
            onClick={handleFindOpportunities}
            disabled={isFinding}
            className="w-full h-11 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 shadow-lg shadow-primary/25"
            style={{ background: 'linear-gradient(135deg, #3525cd 0%, #4f46e5 100%)' }}
          >
            {isFinding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-white" />}
            {isFinding ? "Finding opportunities…" : "AI Find Opportunities"}
          </button>
        </div>
      </div>

      {/* Find result */}
      {findResult && (
        <div className={`glass-card rounded-2xl p-4 flex items-center gap-3 shimmer-ai ${findResult.count > 0 ? "" : ""}`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${findResult.count > 0 ? "fluid-gradient" : "bg-muted"}`}>
            {findResult.count > 0
              ? <Sparkles className="w-4 h-4 text-white" />
              : <Search className="w-4 h-4 text-muted-foreground" />}
          </div>
          <p className="text-sm font-medium" style={{ color: '#131b2e' }}>{findResult.message}</p>
        </div>
      )}

      {/* Opportunities */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-bold text-base" style={{ color: '#131b2e' }}>Ready for Outreach</h2>
          {actionableOpps.length > 0 && (
            <button className="text-xs font-bold hover:underline" style={{ color: '#3525cd' }}
                    onClick={() => setActiveTab("discover")}>
              Find more
            </button>
          )}
        </div>

        {actionableOpps.length === 0 ? (
          <div className="glass-panel rounded-3xl p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-3xl fluid-gradient flex items-center justify-center mb-4 shadow-lg shadow-primary/25">
              <Compass className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-bold text-base mb-1" style={{ color: '#131b2e' }}>No opportunities yet</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto leading-relaxed">
              Discover venues, planners, and clients — or let Aurora find the best matches for you.
            </p>
            <button
              onClick={() => setActiveTab("discover")}
              className="rounded-2xl font-bold text-white px-5 py-2.5 text-sm shadow-md shadow-primary/25 hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #3525cd 0%, #4f46e5 100%)' }}
            >
              <Compass className="w-4 h-4 mr-2 inline" />
              Discover Opportunities
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {(showAll ? actionableOpps : actionableOpps.slice(0, 5)).map(opp => (
              <OpportunityActionCard
                key={opp.id}
                opportunity={opp}
                onStartOutreach={() => { setSelectedOpp(opp); setIsOutreachDialogOpen(true); }}
                onClick={() => setViewingOpp(opp)}
                onRefresh={refreshData}
              />
            ))}
            {actionableOpps.length > 5 && (
              <button
                className="w-full py-3 text-sm font-bold text-center rounded-2xl glass-card glass-card-hover"
                style={{ color: '#3525cd' }}
                onClick={() => setShowAll(s => !s)}
              >
                {showAll ? "Show less" : `Show all ${actionableOpps.length} opportunities`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dialog */}
      <OutreachMethodDialog
        opportunity={selectedOpp}
        isOpen={isOutreachDialogOpen}
        onClose={() => { setIsOutreachDialogOpen(false); setSelectedOpp(null); }}
        onSelectMethod={() => { setIsOutreachDialogOpen(false); setSelectedOpp(null); setActiveTab("outreach"); }}
      />
    </div>
  );
}

/* ── Opportunity Action Card ─────────────────── */
function OpportunityActionCard({ opportunity, onStartOutreach, onClick, onRefresh }: {
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
      const res  = await fetch("/api/re-enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunityId: opportunity.id }) });
      const data = await res.json();
      if (res.ok && data.success) { toast.success(`Found ${data.contactMethodsAdded} contacts`); await onRefresh(); }
      else toast.error(data.error || "Failed to refresh");
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
  const emailValue     = opportunity.contactMethods.find(c => c.type === "email")?.value;
  const instagramValue = opportunity.contactMethods.find(c => c.type === "instagram")?.value;
  const contactFormUrl = opportunity.contactForm?.url || opportunity.contactMethods.find(c => c.type === "contact_form")?.value;
  const contactFormLabel = opportunity.contactForm?.label || "Contact Form";
  const contactCount   = [hasWebsite, hasContactForm, hasEmail, hasInstagram, hasPhone, hasFacebook, hasLinkedin].filter(Boolean).length;
  const photoUrl       = opportunity.photoReference
    ? `/api/places/photo?ref=${encodeURIComponent(opportunity.photoReference)}&maxWidth=400`
    : null;

  return (
    <div className="glass-card glass-card-hover rounded-2xl overflow-hidden cursor-pointer border-l-4"
         style={{ borderLeftColor: '#3525cd' }}
         onClick={onClick}>
      <div className="flex">
        {/* Thumbnail */}
        <div className="w-24 shrink-0 relative self-stretch min-h-[88px]">
          {photoUrl
            ? <img src={photoUrl} alt={opportunity.name} className="w-full h-full object-cover absolute inset-0"
                   onError={e => { const t = e.target as HTMLImageElement; t.style.display='none'; t.nextElementSibling?.classList.remove('hidden'); }} />
            : null}
          <div className={`w-full h-full fluid-gradient-subtle flex items-center justify-center ${photoUrl ? 'hidden' : ''}`}>
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
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-sm leading-tight line-clamp-1" style={{ color: '#131b2e' }}>
              {opportunity.name}
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              {opportunity.priority === "high" && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(53,37,205,0.12)', color: '#3525cd' }}>Hot</span>
              )}
              <button
                onClick={async e => { e.stopPropagation(); await updateOpportunity(opportunity.id, { liked: !opportunity.liked }); await onRefresh(); }}
                className="w-6 h-6 rounded-full flex items-center justify-center transition-colors bg-white/50 hover:bg-primary/10"
              >
                <Heart className={`w-3 h-3 ${opportunity.liked ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
            <span>{typeLabels[opportunity.type]}</span>
            {opportunity.rating && (
              <><span className="text-muted-foreground/40">·</span>
              <span className="flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                {opportunity.rating.toFixed(1)}
              </span></>
            )}
          </div>

          {(hasEmail || hasInstagram) && (
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
                  <span className="truncate">{instagramValue.replace("https://instagram.com/","@").replace("https://www.instagram.com/","@")}</span>
                </span>
              )}
            </div>
          )}

          {opportunity.whyGoodFit && (
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{opportunity.whyGoodFit}</p>
          )}

          {/* Action row */}
          <div className="flex flex-wrap gap-1.5 mt-auto pt-0.5">
            {hasContactForm && contactFormUrl && (
              <button onClick={e => { e.stopPropagation(); window.open(contactFormUrl,"_blank"); }}
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-bold text-white shadow-sm active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg,#3525cd,#4f46e5)' }}>
                <FileText className="w-2.5 h-2.5" />{contactFormLabel.length>12?"Apply":contactFormLabel}
              </button>
            )}
            {hasWebsite && !hasContactForm && (
              <button onClick={e => { e.stopPropagation(); const u=opportunity.website||opportunity.contactMethods.find(c=>c.type==="website")?.value; if(u) window.open(u,"_blank"); }}
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold glass-card border border-white/70 text-foreground">
                <Globe className="w-2.5 h-2.5" />Web
              </button>
            )}
            {hasEmail && (
              <button onClick={e => { e.stopPropagation(); const em=opportunity.contactMethods.find(c=>c.type==="email")?.value; if(em) window.location.href=`mailto:${em}`; }}
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold glass-card border border-white/70 text-foreground">
                <Mail className="w-2.5 h-2.5 text-primary/70" />Email
              </button>
            )}
            {hasInstagram && (
              <button title="Instagram" onClick={e => { e.stopPropagation(); const ig=opportunity.contactMethods.find(c=>c.type==="instagram")?.value; if(ig){const h=ig.replace("@","").replace("https://instagram.com/","").replace("https://www.instagram.com/",""); window.open(`https://instagram.com/${h}`,"_blank");} }}
                className="w-6 h-6 rounded-full glass-card border border-white/70 flex items-center justify-center">
                <Instagram className="w-3 h-3 text-pink-500" />
              </button>
            )}
            {hasFacebook && (
              <button title="Facebook" onClick={e => { e.stopPropagation(); const fb=opportunity.contactMethods.find(c=>c.type==="facebook")?.value; if(fb) window.open(fb.startsWith("http")?fb:`https://facebook.com/${fb}`,"_blank"); }}
                className="w-6 h-6 rounded-full glass-card border border-white/70 flex items-center justify-center">
                <Facebook className="w-3 h-3 text-blue-600" />
              </button>
            )}
            {hasLinkedin && (
              <button title="LinkedIn" onClick={e => { e.stopPropagation(); const li=opportunity.contactMethods.find(c=>c.type==="linkedin")?.value; if(li) window.open(li.startsWith("http")?li:`https://linkedin.com/company/${li}`,"_blank"); }}
                className="w-6 h-6 rounded-full glass-card border border-white/70 flex items-center justify-center">
                <Linkedin className="w-3 h-3 text-blue-700" />
              </button>
            )}
            {hasWebsite && (
              <button title="Refresh contacts" onClick={handleReEnrich} disabled={isEnriching}
                className="w-6 h-6 rounded-full glass-card border border-white/70 flex items-center justify-center">
                <RefreshCw className={`w-3 h-3 text-muted-foreground ${isEnriching?"animate-spin":""}`} />
              </button>
            )}
            {contactCount===0 && !hasWebsite && (
              <button onClick={e => { e.stopPropagation(); onStartOutreach(); }}
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-bold text-white shadow-sm"
                style={{ background:'linear-gradient(135deg,#3525cd,#4f46e5)' }}>
                <Send className="w-2.5 h-2.5" />Outreach
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Outreach Method Dialog ─────────────────── */
function OutreachMethodDialog({ opportunity, isOpen, onClose, onSelectMethod }: {
  opportunity: Opportunity | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectMethod: (m: string) => void;
}) {
  if (!opportunity) return null;
  const methods = [
    { id:"website",   icon:ExternalLink, label:"Website Form",  description:"Fill out their contact form", available:opportunity.website||opportunity.contactMethods.some(c=>c.type==="contact_form"), action:()=>{ const u=opportunity.website||opportunity.contactMethods.find(c=>c.type==="contact_form")?.value; if(u) window.open(u,"_blank"); } },
    { id:"email",     icon:Mail,         label:"Email",          description:"Send a professional email",   available:opportunity.contactMethods.some(c=>c.type==="email"), action:()=>{ const em=opportunity.contactMethods.find(c=>c.type==="email")?.value; if(em) window.location.href=`mailto:${em}`; } },
    { id:"instagram", icon:Instagram,    label:"Instagram DM",   description:"Send a direct message",       available:opportunity.contactMethods.some(c=>c.type==="instagram"), action:()=>{ const ig=opportunity.contactMethods.find(c=>c.type==="instagram")?.value; if(ig){const h=ig.replace("@","").replace("https://instagram.com/",""); window.open(`https://instagram.com/${h}`,"_blank");} } },
  ].filter(m => m.available);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-3xl glass-panel border-white/60">
        <DialogHeader>
          <DialogTitle className="font-bold" style={{ color:'#131b2e' }}>Choose Outreach Method</DialogTitle>
          <DialogDescription className="text-sm">How would you like to contact {opportunity.name}?</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {methods.length > 0 ? methods.map(m => {
            const Icon = m.icon;
            return (
              <button key={m.id} onClick={() => { m.action(); onSelectMethod(m.id); }}
                className="w-full flex items-center gap-4 p-3.5 rounded-2xl glass-card glass-card-hover border border-white/60 text-left">
                <div className="w-10 h-10 rounded-xl fluid-gradient-subtle flex items-center justify-center shrink-0 border border-primary/10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color:'#131b2e' }}>{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
              </button>
            );
          }) : (
            <p className="text-sm text-center text-muted-foreground py-4">No contact methods available.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Contact icon helper ── */
function getContactMethodIcon(type: ContactMethodType) {
  const m: Partial<Record<ContactMethodType, typeof Mail>> = {
    email:Mail, phone:Phone, website:Globe, contact_form:FileText,
    instagram:Instagram, facebook:Facebook, linkedin:Linkedin, twitter:MessageCircle,
  };
  return m[type] || MoreHorizontal;
}

/* ── Opportunity Detail View ─────────────────── */
function OpportunityDetailView({ opportunity, onBack, onRefresh }: {
  opportunity: Opportunity;
  onBack: () => void;
  onRefresh: () => Promise<void>;
}) {
  const { setActiveTab } = useAurora();
  const [isPending, startTransition] = useTransition();
  const [suggestedMessage, setSuggestedMessage] = useState<{ subject:string; body:string; contactMethod:string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [messageError, setMessageError] = useState<string|null>(null);
  const [showImageLightbox, setShowImageLightbox] = useState(false);
  const [emailConnected, setEmailConnected] = useState<boolean|null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/email/status").then(r=>r.json()).then(d=>setEmailConnected(d.connected)).catch(()=>setEmailConnected(false));
  }, []);

  useEffect(() => {
    const gen = async () => {
      setIsGenerating(true); setMessageError(null);
      try {
        const ec = opportunity.contactMethods.find(c=>c.type==="email");
        const ic = opportunity.contactMethods.find(c=>c.type==="instagram");
        const cm = ec?"email":ic?"instagram":"email";
        const res = await fetch("/api/generate-message",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ opportunityId:opportunity.id, contactMethod:cm }) });
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
    startTransition(async () => { await deleteOpportunity(opportunity.id); await onRefresh(); onBack(); });
  };

  return (
    <>
      {showImageLightbox && photoUrl && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setShowImageLightbox(false)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white" onClick={() => setShowImageLightbox(false)}>
            <X className="w-6 h-6" />
          </button>
          <img src={photoUrl.replace("maxWidth=800","maxWidth=1600")} alt={opportunity.name} className="max-w-full max-h-full object-contain p-4" />
        </div>
      )}

      <div className="flex flex-col min-h-[calc(100vh-8rem)] -mx-4 -mt-5">
        {/* Hero */}
        <div className="relative min-h-[45vh]">
          <button className="absolute inset-0 w-full cursor-pointer group" onClick={() => photoUrl && setShowImageLightbox(true)}>
            {photoUrl
              ? <img src={photoUrl} alt={opportunity.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full" style={{ background:'linear-gradient(135deg,rgba(53,37,205,0.25) 0%,rgba(180,19,109,0.15) 100%)' }} />}
            <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/40 to-black/10" />
            {photoUrl && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Maximize2 className="w-5 h-5 text-white" />
              </div>
            )}
          </button>

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10">
            <button onClick={onBack} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <div className="flex items-center gap-2">
              {opportunity.source==="aurora_ai" && (
                <div className="px-3 py-1.5 rounded-full text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
                     style={{ background:'linear-gradient(135deg,#3525cd,#4f46e5)' }}>
                  <Sparkles className="w-3 h-3" />AI Found
                </div>
              )}
              <button onClick={handleDelete} disabled={isPending} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Hero content */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            <div className="flex items-center gap-2 mb-2">
              {opportunity.rating && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-white text-sm font-bold shadow-md">
                  <Star className="w-3.5 h-3.5 fill-white" />{opportunity.rating.toFixed(1)}
                </div>
              )}
              <Badge className="bg-white/90 text-foreground border-0 backdrop-blur-sm text-xs">{typeLabels[opportunity.type]}</Badge>
              {opportunity.priority==="high" && (
                <Badge className="text-white border-0 text-xs" style={{ background:'linear-gradient(135deg,#3525cd,#4f46e5)' }}>Hot Lead</Badge>
              )}
            </div>
            <h1 className="text-2xl font-extrabold leading-tight mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]" style={{ color:'#131b2e' }}>
              {opportunity.name}
            </h1>
            {opportunity.location && (
              <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <MapPin className="w-4 h-4" />{opportunity.location.split(",").slice(0,2).join(",")}
              </p>
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="bg-white/30 backdrop-blur-sm px-4 py-5 space-y-4">
          {opportunity.whyGoodFit && (
            <div className="glass-panel rounded-2xl p-4 shimmer-ai">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Why it&apos;s a great fit</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{opportunity.whyGoodFit}</p>
            </div>
          )}

          {/* Contact scroll */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {opportunity.website && (
              <Button variant="outline" size="sm" className="shrink-0 rounded-xl glass-card border-white/70" onClick={() => window.open(opportunity.website,"_blank")}>
                <Globe className="w-4 h-4 mr-1.5" />Website
              </Button>
            )}
            {opportunity.contactMethods.slice(0,4).map(cm => {
              const Icon = getContactMethodIcon(cm.type);
              return (
                <Button key={cm.id} variant="outline" size="sm" className="shrink-0 rounded-xl glass-card border-white/70"
                  onClick={() => {
                    if (cm.type==="email") window.location.href=`mailto:${cm.value}`;
                    else if (cm.type==="phone") window.location.href=`tel:${cm.value}`;
                    else if (cm.type==="instagram") { const h=cm.value.replace("@","").replace("https://instagram.com/",""); window.open(`https://instagram.com/${h}`,"_blank"); }
                    else if (cm.value.startsWith("http")) window.open(cm.value,"_blank");
                  }}>
                  <Icon className="w-4 h-4 mr-1.5" />{contactMethodLabels[cm.type]}
                </Button>
              );
            })}
          </div>

          {/* AI Message */}
          <div className="glass-panel ai-glow rounded-2xl p-4 shimmer-ai">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg fluid-gradient flex items-center justify-center">
                  <Mail className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-bold" style={{ color:'#131b2e' }}>Your First Message</span>
              </div>
              {!isGenerating && suggestedMessage && (
                <button className="text-xs font-semibold hover:underline text-primary"
                  onClick={() => {
                    setIsGenerating(true); setSuggestedMessage(null);
                    fetch("/api/generate-message",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({opportunityId:opportunity.id,contactMethod:suggestedMessage?.contactMethod||"email",forceRegenerate:true})})
                      .then(r=>r.json()).then(d=>setSuggestedMessage(d)).catch(()=>setMessageError("Could not regenerate")).finally(()=>setIsGenerating(false));
                  }}>Regenerate</button>
              )}
            </div>
            {isGenerating ? (
              <div className="flex items-center gap-3 py-3"><Loader2 className="w-5 h-5 animate-spin text-primary" /><span className="text-sm text-muted-foreground">Crafting the perfect message…</span></div>
            ) : suggestedMessage ? (
              <div className="space-y-2">
                {suggestedMessage.subject && <p className="text-xs text-muted-foreground">Subject: <span className="font-medium" style={{color:'#131b2e'}}>{suggestedMessage.subject}</span></p>}
                <p className="text-sm leading-relaxed line-clamp-3" style={{color:'#131b2e'}}>{suggestedMessage.body}</p>
                <button className="text-xs font-medium hover:underline text-primary">Read full message</button>
              </div>
            ) : messageError ? <p className="text-sm text-muted-foreground py-2">{messageError}</p> : null}
          </div>
        </div>

        {/* Sticky CTA */}
        <div className="sticky bottom-0 glass-nav border-t border-white/50 px-4 py-3 space-y-2">
          {emailConnected===false && (
            <div className="flex items-center justify-between glass-card rounded-xl p-3 border border-white/60">
              <p className="text-sm text-muted-foreground">Connect email to send directly</p>
              <button className="rounded-xl text-white font-bold text-sm px-3 py-1.5"
                      style={{ background:'linear-gradient(135deg,#3525cd,#4f46e5)' }}
                      onClick={() => window.location.href="/api/email/connect?provider=google"}>
                <Mail className="w-4 h-4 mr-1.5 inline" />Connect
              </button>
            </div>
          )}
          {sendSuccess && (
            <div className="bg-green-500/10 text-green-600 rounded-xl p-3 text-center text-sm font-semibold">Email sent! ✓</div>
          )}
          <div className="flex gap-3">
            <button
              disabled={!suggestedMessage||isGenerating||isPending||isSending||sendSuccess}
              className="flex-1 h-12 rounded-2xl font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background:'linear-gradient(135deg,#3525cd,#4f46e5)' }}
              onClick={async () => {
                if (!suggestedMessage) return;
                const ec=opportunity.contactMethods.find(c=>c.type==="email");
                const ic=opportunity.contactMethods.find(c=>c.type==="instagram");
                if (emailConnected&&ec) {
                  setIsSending(true);
                  try {
                    const res=await fetch("/api/email/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:ec.value,toName:opportunity.name,subject:suggestedMessage.subject,body:suggestedMessage.body,opportunityId:opportunity.id})});
                    if (res.ok){setSendSuccess(true);await onRefresh();}
                    else{const d=await res.json();alert(d.error||"Failed to send");}
                  } catch{alert("Failed to send email");}
                  finally{setIsSending(false);}
                } else if (suggestedMessage.contactMethod==="instagram"&&ic){
                  const h=ic.value.replace("@","").replace("https://instagram.com/","");
                  navigator.clipboard.writeText(suggestedMessage.body);
                  window.open(`https://instagram.com/${h}`,"_blank");
                } else if (ec){
                  window.location.href=`mailto:${ec.value}?subject=${encodeURIComponent(suggestedMessage.subject)}&body=${encodeURIComponent(suggestedMessage.body)}`;
                } else if (opportunity.website){
                  navigator.clipboard.writeText(suggestedMessage.body);
                  window.open(opportunity.website,"_blank");
                }
              }}
            >
              {isSending?<Loader2 className="w-5 h-5 animate-spin"/>:<Send className="w-5 h-5"/>}
              {isSending?"Sending…":sendSuccess?"Sent!":"Send Message"}
            </button>
            <button
              disabled={isPending||sendSuccess}
              className="h-12 px-4 rounded-2xl glass-card border border-white/60 flex items-center justify-center"
              onClick={() => startTransition(async()=>{ await updateOpportunity(opportunity.id,{status:"outreach_ready"}); await onRefresh(); setActiveTab("outreach"); })}
            >
              <Crosshair className="w-5 h-5 text-primary" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
