"use client";

import { useState, useTransition, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAurora } from "./aurora-app";
import { createOutreachMessage, markMessageAsSent, updateOpportunity, createOpportunity } from "@/lib/actions";
import { typeLabels, contactMethodLabels, statusLabels } from "@/lib/types";
import type { Opportunity, OutreachMessage, ContactMethod, ContactMethodType, FollowUpTask } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  Mail, Copy, ExternalLink, Check, ArrowLeft, Sparkles, Send, Save,
  AlertCircle, Instagram, Linkedin, Phone, Clock, CheckCircle2, Circle,
  ChevronRight, MessageSquare, Calendar, TrendingUp, Zap, MapPin, Star,
  PlayCircle, PauseCircle, MoreHorizontal, Plus, Pencil, Trash2, Loader2,
  Minus, ChevronUp, ChevronDown, Globe, Facebook, FileText, X, Trophy,
  FileText as FileTextIcon,
} from "lucide-react";

/* ─── Constants ─────────────────────────────── */
const ACCENT  = "#7c6ef7";
const ACCENT2 = "#9585f9";

/* ─── Interfaces ─────────────────────────────── */
interface OutreachSequence {
  opportunity: Opportunity;
  messages: OutreachMessage[];
  followUps: FollowUpTask[];
  totalTouches: number;
  lastTouchDate?: string;
  nextAction?: {
    type: 'send_initial' | 'send_follow_up' | 'check_reply' | 'mark_complete';
    dueDate?: string;
    message?: string;
  };
}

interface SequenceTemplate {
  id: string;
  name: string;
  description?: string;
  steps: {
    id: string;
    type: 'email' | 'instagram' | 'linkedin' | 'phone';
    delayDays: number;
    subject?: string;
    body: string;
  }[];
  createdAt: string;
  // Local stats
  isAiGenerated?: boolean;
  timesUsed?: number;
  replyRate?: number;   // 0–100
  wonCount?: number;
}

interface SequenceStep {
  id: string;
  step_number: number;
  subject: string | null;
  body: string;
  delay_days: number;
  status: 'pending' | 'sent' | 'skipped';
  scheduled_at: string | null;
  sent_at: string | null;
}

type PipelineStage = 'ready' | 'sent' | 'replied' | 'won';

/* ─── Helpers ─────────────────────────────── */
function daysAgoStr(date: string) {
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (d === 0) return 'Today';
  if (d === 1) return '1d ago';
  return `${d}d ago`;
}

function daysUntilStr(date: string) {
  const d = Math.floor((new Date(date).getTime() - Date.now()) / 86_400_000);
  if (d < 0) return 'Overdue';
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return `In ${d} days`;
}

function thumbUrl(ref?: string | null, w = 200) {
  return ref ? `/api/places/photo?ref=${encodeURIComponent(ref)}&maxWidth=${w}` : null;
}

function statusBadge(status: string): { label: string; bg: string; color: string } {
  switch (status) {
    case 'outreach_ready': return { label: 'Ready',     bg: 'rgba(124,110,247,0.12)', color: ACCENT };
    case 'sent':           return { label: 'Sent',      bg: 'rgba(245,158,11,0.12)',  color: '#d97706' };
    case 'follow_up_due':  return { label: 'Follow up', bg: 'rgba(239,68,68,0.12)',   color: '#dc2626' };
    case 'replied':        return { label: 'Replied',   bg: 'rgba(34,197,94,0.12)',   color: '#16a34a' };
    case 'closed':         return { label: 'Won',       bg: 'rgba(34,197,94,0.12)',   color: '#16a34a' };
    default:               return { label: status,      bg: 'rgba(100,100,120,0.1)',  color: '#666' };
  }
}

/* ════════════════════════════════════════════════
   Pipeline Strip
════════════════════════════════════════════════ */
function PipelineStrip({
  counts, active, onChange,
}: {
  counts: Record<PipelineStage, number>;
  active: PipelineStage;
  onChange: (s: PipelineStage) => void;
}) {
  const stages: { id: PipelineStage; label: string; desc: string }[] = [
    { id: 'ready',   label: 'Ready',   desc: 'Drafted, waiting to send' },
    { id: 'sent',    label: 'Sent',    desc: 'Awaiting reply'           },
    { id: 'replied', label: 'Replied', desc: 'They got back to you'     },
    { id: 'won',     label: 'Won',     desc: 'Booking confirmed'        },
  ];

  return (
    <div className="glass-card rounded-2xl p-1 flex items-center gap-0.5">
      {stages.map((stage, i) => {
        const isActive = active === stage.id;
        return (
          <div key={stage.id} className="flex items-center flex-1">
            <button
              onClick={() => onChange(stage.id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-2 rounded-xl text-sm font-bold transition-all duration-200"
              style={isActive ? {
                background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`,
                color: '#fff',
                boxShadow: `0 4px 14px rgba(124,110,247,0.3)`,
              } : { color: '#6b7280' }}
            >
              <div className="flex items-center gap-1.5">
                <span className="hidden sm:inline">{stage.label}</span>
                <span className="sm:hidden text-xs">{stage.label.slice(0, 3)}</span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                  style={isActive
                    ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                    : { background: 'rgba(0,0,0,0.06)', color: '#6b7280' }}
                >
                  {counts[stage.id]}
                </span>
              </div>
              <span
                className="hidden sm:block text-[9px] font-medium leading-tight text-center"
                style={{ opacity: isActive ? 0.8 : 0.5 }}
              >
                {stage.desc}
              </span>
            </button>
            {i < stages.length - 1 && (
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground/40 mx-0.5" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════
   Contact Row (left pane)
════════════════════════════════════════════════ */
function ContactRow({
  sequence, isActive, onClick,
}: {
  sequence: OutreachSequence;
  isActive: boolean;
  onClick: () => void;
}) {
  const { opportunity, lastTouchDate, nextAction } = sequence;
  const photo = thumbUrl(opportunity.photoReference);
  const badge = statusBadge(opportunity.status);
  const isOverdue = nextAction?.type === 'send_follow_up' &&
    nextAction.dueDate && new Date(nextAction.dueDate) < new Date();

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 border-b border-white/20 text-left transition-all duration-150 relative"
      style={isActive
        ? { background: `rgba(124,110,247,0.09)`, borderLeftColor: ACCENT }
        : { background: 'transparent' }}
    >
      {/* Active indicator bar */}
      <span
        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full transition-all"
        style={{ background: isActive ? ACCENT : 'transparent' }}
      />

      {/* Photo */}
      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-muted/50 relative">
        {photo ? (
          <img src={photo} alt={opportunity.name} className="w-full h-full object-cover"
               onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
               style={{ background: `linear-gradient(135deg,rgba(124,110,247,0.12),rgba(149,133,249,0.06))` }}>
            <MapPin className="w-4 h-4" style={{ color: `${ACCENT}60` }} />
          </div>
        )}
        {isOverdue && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: '#131b2e' }}>
          {opportunity.name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {lastTouchDate && (
            <span className="text-[11px] text-muted-foreground">{daysAgoStr(lastTouchDate)}</span>
          )}
          {isOverdue && (
            <span className="text-[10px] font-bold px-1 py-0.5 rounded-full bg-red-50 text-red-600">
              Overdue
            </span>
          )}
        </div>
      </div>

      {/* Badge */}
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
            style={{ background: badge.bg, color: badge.color }}>
        {badge.label}
      </span>
    </button>
  );
}

/* ════════════════════════════════════════════════
   Pane Detail (desktop right pane)
════════════════════════════════════════════════ */
const CONFETTI_COLORS = ['#7c6ef7', '#9585f9', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#22c55e', '#f97316'];

function PaneDetail({
  sequence, onRefresh, onDeselect,
}: {
  sequence: OutreachSequence;
  onRefresh: () => Promise<void>;
  onDeselect: () => void;
}) {
  const { opportunity, messages, followUps } = sequence;
  const { setActiveTab } = useAurora();
  const [isPending, startTransition] = useTransition();
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>([]);
  const [isLoadingSteps, setIsLoadingSteps] = useState(true);
  const [editingStep, setEditingStep] = useState<SequenceStep | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editDelay, setEditDelay] = useState(3);
  const [isSaving, setIsSaving] = useState(false);
  const [emailConnected, setEmailConnected] = useState<boolean | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [personalisationScore, setPersonalisationScore] = useState<number | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [generationTookTooLong, setGenerationTookTooLong] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [wonModal, setWonModal] = useState<{ leadName: string } | null>(null);

  const confettiPieces = useMemo(() =>
    Array.from({ length: 28 }, (_, i) => ({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      left: `${2 + (i * 3.5) % 96}%`,
      delay: `${(i * 0.045).toFixed(2)}s`,
      isCircle: i % 3 !== 0,
      size: i % 5 === 0 ? 10 : 7,
    })),
  []);

  const handleWon = useCallback(async () => {
    startTransition(async () => {
      await updateOpportunity(opportunity.id, { status: 'closed' });
      // Fire-and-forget the upsert — non-fatal if it fails
      fetch('/api/contacts/upsert-won', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ opportunity_id: opportunity.id }),
      }).catch(() => {/* silent */});
      await onRefresh();
      setWonModal({ leadName: opportunity.name });
    });
  }, [opportunity.id, opportunity.name, onRefresh, startTransition]);

  const photo = thumbUrl(opportunity.photoReference, 600);
  const badge = statusBadge(opportunity.status);

  useEffect(() => {
    fetch('/api/email/status')
      .then(r => r.json()).then(d => setEmailConnected(d.connected))
      .catch(() => setEmailConnected(false));
  }, []);

  // ── Polling helper — checks every 3 s until steps appear (max 10 tries) ──
  const startPolling = useCallback((oppId: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setIsPolling(true);
    setGenerationTookTooLong(false);
    let count = 0;
    const MAX = 10;
    pollTimerRef.current = setInterval(async () => {
      count++;
      if (count >= MAX) {
        clearInterval(pollTimerRef.current!);
        pollTimerRef.current = null;
        setIsPolling(false);
        setGenerationTookTooLong(true);
        return;
      }
      try {
        const r = await fetch(`/api/sequences?opportunityId=${oppId}`);
        const d = await r.json();
        if (d.steps?.length > 0) {
          clearInterval(pollTimerRef.current!);
          pollTimerRef.current = null;
          setIsPolling(false);
          setSequenceSteps(d.steps);
        }
      } catch { /* keep polling */ }
    }, 3000);
  }, []);

  useEffect(() => {
    setSendSuccess(false);
    setIsPolling(false);
    setGenerationTookTooLong(false);
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }

    const load = async () => {
      setIsLoadingSteps(true);
      try {
        // Step 1: Check if steps already exist (e.g. background pipeline completed)
        const res = await fetch(`/api/sequences?opportunityId=${opportunity.id}`);
        const data = await res.json();
        if (data.steps?.length > 0) {
          setSequenceSteps(data.steps);
          return;
        }

        // Step 2: No steps — attempt synchronous generation
        let generated = false;
        try {
          const cr = await fetch('/api/generate-sequence', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ opportunity_id: opportunity.id }),
          });
          const cd = await cr.json();
          if (cd.status === 'generated') {
            const r2 = await fetch(`/api/sequences?opportunityId=${opportunity.id}`);
            const d2 = await r2.json();
            if (d2.steps?.length > 0) {
              setSequenceSteps(d2.steps);
              if (cd.personalisation_score != null) setPersonalisationScore(cd.personalisation_score);
              generated = true;
            }
          } else if (cd.status === 'cached') {
            const r2 = await fetch(`/api/sequences?opportunityId=${opportunity.id}`);
            const d2 = await r2.json();
            if (d2.steps?.length > 0) {
              setSequenceSteps(d2.steps);
              generated = true;
            }
          }
        } catch { /* synchronous generation failed — fall through to polling */ }

        // Step 3: Still no steps — start polling (background pipeline may still be running)
        if (!generated) {
          startPolling(opportunity.id);
        }
      } catch { /* silent */ }
      finally { setIsLoadingSteps(false); }
    };
    load();

    return () => {
      if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    };
  }, [opportunity.id, startPolling]);

  const refreshSteps = async () => {
    const r = await fetch(`/api/sequences?opportunityId=${opportunity.id}`);
    const d = await r.json();
    if (d.steps) setSequenceSteps(d.steps);
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const res = await fetch('/api/generate-sequence', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ opportunity_id: opportunity.id, regenerate: true }),
      });
      const data = await res.json();
      if (data.status === 'generated') {
        await refreshSteps();
        if (data.personalisation_score != null) setPersonalisationScore(data.personalisation_score);
        toast.success('Sequence regenerated');
      } else {
        toast.error(data.error || 'Regeneration failed');
      }
    } catch { toast.error('Failed to regenerate'); }
    finally { setIsRegenerating(false); }
  };

  const handleSaveEdit = async () => {
    if (!editingStep) return;
    setIsSaving(true);
    try {
      await fetch('/api/sequences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId: editingStep.id, subject: editSubject, body: editBody, delay_days: editDelay }),
      });
      await refreshSteps();
      setEditingStep(null);
      toast.success('Email updated!');
    } catch { toast.error('Failed to update'); }
    finally { setIsSaving(false); }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!confirm('Delete this email?')) return;
    try {
      await fetch(`/api/sequences?stepId=${stepId}`, { method: 'DELETE' });
      await refreshSteps();
      toast.success('Email removed');
    } catch { toast.error('Failed to delete'); }
  };

  const handleAddStep = async () => {
    try {
      await fetch('/api/sequences/add-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: opportunity.id, delay_days: 5 }),
      });
      await refreshSteps();
      toast.success('Email added');
    } catch { toast.error('Failed to add'); }
  };

  const handleSendStep = async (step: SequenceStep) => {
    const emailContact = opportunity.contactMethods.find(c => c.type === 'email');
    if (!emailContact?.value) { toast.error('No email address found'); return; }
    const statusRes = await fetch('/api/email/status');
    const statusData = await statusRes.json();
    if (!statusData.connected) { toast.error('Connect your email first — go to Profile'); return; }
    setIsSending(true);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailContact.value, toName: opportunity.name,
          subject: step.subject, body: `<p>${step.body.replace(/\n/g, '<br/>')}</p>`,
          opportunityId: opportunity.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      await fetch('/api/sequences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId: step.id, status: 'sent' }),
      });
      setSequenceSteps(prev => prev.map(s => s.id === step.id ? { ...s, status: 'sent' } : s));
      setSendSuccess(true);
      toast.success('Email sent!');
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send');
    } finally { setIsSending(false); }
  };

  const handleUpdateDelay = async (stepId: string, newDelay: number) => {
    if (newDelay < 1 || newDelay > 30) return;
    setSequenceSteps(prev => prev.map(s => s.id === stepId ? { ...s, delay_days: newDelay } : s));
    try {
      await fetch('/api/sequences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId, delay_days: newDelay }),
      });
    } catch { await refreshSteps(); }
  };

  const nextSendable = sequenceSteps.find(s => s.status === 'pending');
  const isInitialSend = nextSendable?.step_number === 1;

  return (
    <>
    <div className="flex flex-col h-full relative">

      {/* ── Inline edit overlay ── */}
      {editingStep && (
        <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-md p-5 overflow-y-auto flex flex-col gap-4">
          <button
            onClick={() => setEditingStep(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Back to sequence
          </button>
          <h3 className="font-bold text-base" style={{ color: '#131b2e' }}>
            Edit Email #{editingStep.step_number}
          </h3>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input value={editSubject} onChange={e => setEditSubject(e.target.value)} placeholder="Email subject…" />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea value={editBody} onChange={e => setEditBody(e.target.value)} className="min-h-[160px]" placeholder="Your message…" />
          </div>
          {editingStep.step_number > 1 && (
            <div className="space-y-2">
              <Label>Days after previous email</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={30} value={editDelay} onChange={e => setEditDelay(Number(e.target.value))} className="w-20" />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSaveEdit} disabled={isSaving} className="flex-1" style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
            <Button variant="outline" onClick={() => setEditingStep(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── Compact header ── */}
      <div className="shrink-0 border-b border-white/30 px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0"
             style={{ background: `linear-gradient(135deg,rgba(124,110,247,0.12),rgba(149,133,249,0.06))` }}>
          {photo
            ? <img src={photo} alt={opportunity.name} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center">
                <MapPin className="w-4 h-4" style={{ color: `${ACCENT}60` }} />
              </div>}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-extrabold text-sm truncate" style={{ color: '#131b2e' }}>{opportunity.name}</h3>
          {opportunity.location && (
            <p className="text-[11px] text-muted-foreground truncate">
              {opportunity.location.split(',').slice(0, 2).join(',')}
            </p>
          )}
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{ background: badge.bg, color: badge.color }}>
          {badge.label}
        </span>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Sequence timeline */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/30 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
              <span className="text-sm font-bold truncate" style={{ color: '#131b2e' }}>
                Email Sequence ({sequenceSteps.length})
              </span>
              {personalisationScore != null && (
                <span
                  title={personalisationScore < 50 ? 'Add more to your profile to improve personalisation' : undefined}
                  className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={
                    personalisationScore >= 80
                      ? { background: '#dcfce7', color: '#15803d' }
                      : personalisationScore >= 50
                      ? { background: '#fef9c3', color: '#a16207' }
                      : { background: '#f1f5f9', color: '#64748b' }
                  }
                >
                  {personalisationScore >= 80 ? '✦ Highly personalised' : personalisationScore >= 50 ? '✦ Personalised' : '✦ Low personalisation'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="flex items-center gap-1 text-xs font-bold hover:opacity-80 transition-opacity disabled:opacity-50"
                style={{ color: ACCENT }}
                title="Regenerate with AI"
              >
                {isRegenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {isRegenerating ? '' : 'Regenerate'}
              </button>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <button
                onClick={handleAddStep}
                className="flex items-center gap-1 text-xs font-bold hover:opacity-80 transition-opacity"
                style={{ color: ACCENT }}
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
          {isRegenerating && (
            <div className="px-4 py-2 border-b border-white/20 flex items-center gap-2" style={{ background: `${ACCENT}0a` }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: ACCENT }} />
              <span className="text-xs font-medium" style={{ color: ACCENT }}>Aurora is rewriting this sequence…</span>
            </div>
          )}

          {isLoadingSteps ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : isPolling ? (
            <div className="px-4 py-5 flex flex-col items-center gap-2.5 text-center">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: ACCENT }} />
                <span className="text-sm font-semibold" style={{ color: ACCENT }}>
                  Aurora is writing your email sequence…
                </span>
              </div>
              <p className="text-xs text-muted-foreground">This usually takes 20–40 seconds. Hang tight.</p>
            </div>
          ) : generationTookTooLong ? (
            <div className="px-4 py-5 flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">
                Generation is taking longer than expected.
              </p>
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="text-sm font-bold flex items-center gap-1.5"
                style={{ color: ACCENT }}
              >
                {isRegenerating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                  : <><Sparkles className="w-3.5 h-3.5" /> Regenerate Sequence</>}
              </button>
            </div>
          ) : sequenceSteps.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">No emails in sequence</p>
              <button onClick={handleAddStep} className="text-sm font-bold" style={{ color: ACCENT }}>
                + Create Sequence
              </button>
            </div>
          ) : (
            <div className="p-4 relative">
              {/* Timeline line */}
              <div className="absolute left-7 top-6 bottom-6 w-0.5 bg-white/60" />

              {sequenceSteps.map((step, idx) => {
                const isSent = step.status === 'sent';
                const isFirst = idx === 0;
                const nextStep = idx < sequenceSteps.length - 1 ? sequenceSteps[idx + 1] : null;
                const isOverdue = step.scheduled_at && new Date(step.scheduled_at) < new Date() && !isSent;

                return (
                  <div key={step.id}>
                    <div className="relative pl-9 pb-2">
                      {/* Dot */}
                      <div className={`absolute left-[11px] w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isSent ? 'bg-green-500 text-white' : isOverdue ? 'bg-orange-500 text-white' : 'bg-white border-2 border-muted-foreground/30 text-muted-foreground'
                      }`}>
                        {isSent ? <Check className="w-3 h-3" /> : step.step_number}
                      </div>

                      {/* Card */}
                      <div className={`rounded-xl border p-3 ${
                        isSent ? 'bg-green-500/5 border-green-500/20'
                          : isOverdue ? 'bg-orange-500/5 border-orange-500/20'
                          : 'bg-white/50 border-white/60'
                      }`}>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-bold text-muted-foreground">
                              {isFirst ? 'Initial Email' : `Follow-up #${step.step_number - 1}`}
                            </span>
                            {isSent && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Sent</span>
                            )}
                            {isOverdue && !isSent && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">Overdue</span>
                            )}
                          </div>
                          {!isSent && (
                            <div className="flex gap-0.5 shrink-0">
                              <button onClick={() => { setEditingStep(step); setEditSubject(step.subject || ''); setEditBody(step.body); setEditDelay(step.delay_days); }}
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors">
                                <Pencil className="w-3 h-3" />
                              </button>
                              {sequenceSteps.length > 1 && (
                                <button onClick={() => handleDeleteStep(step.id)}
                                  className="w-6 h-6 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {step.subject && <p className="text-xs font-semibold mb-1" style={{ color: '#131b2e' }}>{step.subject}</p>}
                        <p className="text-xs text-muted-foreground line-clamp-4 leading-relaxed">{step.body}</p>
                      </div>
                    </div>

                    {/* Delay stepper between emails */}
                    {nextStep && nextStep.status !== 'sent' && (
                      <div className="relative pl-9 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-white/60 rounded-full border border-white/70">
                            <button onClick={() => handleUpdateDelay(nextStep.id, nextStep.delay_days - 1)}
                              disabled={nextStep.delay_days <= 1}
                              className="w-6 h-6 flex items-center justify-center rounded-l-full hover:bg-muted/30 disabled:opacity-30 transition-colors">
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <span className="px-2 text-xs font-bold min-w-[2.5rem] text-center">{nextStep.delay_days}d</span>
                            <button onClick={() => handleUpdateDelay(nextStep.id, nextStep.delay_days + 1)}
                              disabled={nextStep.delay_days >= 30}
                              className="w-6 h-6 flex items-center justify-center rounded-r-full hover:bg-muted/30 disabled:opacity-30 transition-colors">
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                          <span className="text-[11px] text-muted-foreground">until next email</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add button */}
              <div className="relative pl-9 pt-2">
                <div className="absolute left-[11px] w-5 h-5 rounded-full bg-white/60 border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <Plus className="w-2.5 h-2.5 text-muted-foreground" />
                </div>
                <button onClick={handleAddStep}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors border border-dashed border-muted-foreground/30 rounded-xl px-3 py-1.5">
                  + Add Another Email
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Contact Intelligence */}
        <ContactIntelCard opportunity={opportunity} />

      </div>{/* end scrollable */}

      {/* ── Sticky action bar ── */}
      <div className="shrink-0 px-4 py-3 border-t border-white/30 glass-nav space-y-2">

        {emailConnected === false && (
          <div className="flex items-center justify-between glass-card rounded-xl px-3 py-2 border border-amber-200/50"
               style={{ background: 'rgba(245,158,11,0.06)' }}>
            <p className="text-xs text-amber-700">Connect email to send directly</p>
            <button className="text-xs font-bold px-2 py-1 rounded-lg text-white"
                    style={{ background: 'linear-gradient(135deg,#d97706,#f59e0b)' }}
                    onClick={() => window.location.href = '/api/email/connect?provider=google'}>
              Connect
            </button>
          </div>
        )}

        {sendSuccess && (
          <div className="flex items-center justify-center gap-2 py-1.5 rounded-xl bg-green-500/10 text-green-700 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" /> Sent!
          </div>
        )}

        <div className="flex gap-2">
          {/* Primary: Send now / Send follow-up */}
          {nextSendable && !sendSuccess && (
            <button
              onClick={() => handleSendStep(nextSendable)}
              disabled={isSending || isPending}
              className="flex-1 h-10 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 4px 14px rgba(124,110,247,0.3)` }}
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {isSending ? 'Sending…' : isInitialSend ? 'Send now' : 'Send follow-up'}
            </button>
          )}

          {/* Secondary: Mark as replied */}
          {opportunity.status !== 'replied' && opportunity.status !== 'closed' && (
            <button
              onClick={() => startTransition(async () => {
                await updateOpportunity(opportunity.id, { status: 'replied' });
                await onRefresh();
                toast.success('Marked as replied!');
              })}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 h-10 rounded-xl font-semibold text-xs border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-all disabled:opacity-50"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Replied</span>
            </button>
          )}

          {/* Mark as won */}
          {opportunity.status !== 'closed' && (
            <button
              onClick={handleWon}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 h-10 rounded-xl font-semibold text-xs border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all disabled:opacity-50"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Won</span>
            </button>
          )}
        </div>
      </div>
    </div>

    {/* ── Won celebration modal ── */}
    {wonModal && (
      <>
        <style>{`
          @keyframes confettiFall {
            0%   { transform: translateY(-8px) rotate(0deg);   opacity: 1; }
            80%  { opacity: 1; }
            100% { transform: translateY(300px) rotate(540deg); opacity: 0; }
          }
          @keyframes wonModalIn {
            0%   { opacity: 0; transform: scale(0.88) translateY(12px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>

        {/* Backdrop */}
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(19,27,46,0.55)', backdropFilter: 'blur(4px)' }}
        >
          {/* Confetti layer */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {confettiPieces.map(p => (
              <div
                key={p.id}
                style={{
                  position:        'absolute',
                  top:             0,
                  left:            p.left,
                  width:           `${p.size}px`,
                  height:          `${p.size}px`,
                  backgroundColor: p.color,
                  borderRadius:    p.isCircle ? '50%' : '2px',
                  animation:       `confettiFall 1.4s ease-in ${p.delay} forwards`,
                  opacity:         0,
                }}
              />
            ))}
          </div>

          {/* Modal card */}
          <div
            className="relative mx-4 w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl"
            style={{
              background:  'rgba(255,255,255,0.97)',
              animation:   'wonModalIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards',
            }}
          >
            {/* Trophy icon */}
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', boxShadow: '0 8px 24px rgba(245,158,11,0.35)' }}
            >
              <Trophy className="h-8 w-8 text-white" />
            </div>

            <h2 className="mb-2 text-xl font-extrabold" style={{ color: '#131b2e' }}>
              Brilliant!
            </h2>
            <p className="mb-1 text-base font-semibold" style={{ color: '#131b2e' }}>
              {wonModal.leadName} is now a client. 🎉
            </p>
            <p className="mb-8 text-sm text-muted-foreground">
              They&apos;ve been added to your Relationships as a Client.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setWonModal(null); setActiveTab('relationships'); }}
                className="h-12 w-full rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98]"
                style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 4px 14px rgba(124,110,247,0.35)` }}
              >
                View in Relationships
              </button>
              <button
                onClick={() => setWonModal(null)}
                className="h-11 w-full rounded-xl border border-muted/40 bg-white font-semibold text-sm text-muted-foreground transition-all hover:bg-muted/10 active:scale-[0.98]"
              >
                Back to Outreach
              </button>
            </div>
          </div>
        </div>
      </>
    )}
    </>
  );
}

/* ════════════════════════════════════════════════
   AI suggested template bank (static)
════════════════════════════════════════════════ */
const AI_SUGGESTION_BANK: (SequenceTemplate & { tags: string[]; expectedReply: string })[] = [
  {
    id: 'sugg-venue',
    name: 'Venue Partnership Pitch',
    description: '3-touch: email × 2 + Instagram follow-up. Best for wedding/events venues.',
    tags: ['venues', 'weddings', 'events'],
    expectedReply: '18–25%',
    isAiGenerated: true,
    steps: [
      { id: 's1', type: 'email', delayDays: 0, subject: 'Collaboration opportunity — {{VenueName}}', body: 'Hi {{ContactName}},\n\nI came across {{VenueName}} and was genuinely impressed by your space. I specialise in event photography and I\'d love to explore whether there\'s an opportunity to work together.\n\nWould you be open to a quick 10-minute call this week?\n\nBest,\n{{YourName}}' },
      { id: 's2', type: 'email', delayDays: 5, subject: '', body: 'Hi {{ContactName}},\n\nJust following up on my note from last week. I work with venues like yours to provide professional photography that can elevate your portfolio too.\n\nHappy to chat whenever suits — even a quick email exchange works!\n\nBest,\n{{YourName}}' },
      { id: 's3', type: 'instagram', delayDays: 4, subject: undefined, body: 'Hey! I sent an email about a potential collaboration — just wanted to reach out here too. Would love to connect if you\'re interested! 🙌' },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sugg-events',
    name: 'Event Organiser Sequence',
    description: '4-touch email sequence for corporate event planners and agencies.',
    tags: ['corporate', 'agencies', 'events'],
    expectedReply: '12–20%',
    isAiGenerated: true,
    steps: [
      { id: 's4', type: 'email', delayDays: 0, subject: 'Photography for your upcoming events', body: 'Hi {{ContactName}},\n\nI specialise in event photography and have covered [similar events]. I\'d love to discuss how I can document your upcoming events professionally.\n\nAre you currently working with a photographer?\n\nKind regards,\n{{YourName}}' },
      { id: 's5', type: 'email', delayDays: 4, subject: '', body: 'Hi {{ContactName}},\n\nFollowing up — happy to share my portfolio and pricing if that\'s helpful.\n\n{{YourName}}' },
      { id: 's6', type: 'email', delayDays: 7, subject: '', body: 'Hi {{ContactName}},\n\nLast follow-up from me! If the timing isn\'t right, I\'d love to stay in touch for a future project.\n\n{{YourName}}' },
      { id: 's7', type: 'instagram', delayDays: 3, subject: undefined, body: 'Hi! I reached out via email about event photography — happy to connect here if you prefer 📸' },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sugg-social',
    name: 'DM-first Collaboration',
    description: 'Instagram DM first, then an email for leads who don\'t reply. High open rate.',
    tags: ['instagram', 'social', 'quick'],
    expectedReply: '20–30%',
    isAiGenerated: true,
    steps: [
      { id: 's8', type: 'instagram', delayDays: 0, subject: undefined, body: 'Hey {{ContactName}}! Love what you\'re doing at {{VenueName}} ✨ I\'m a photographer who\'d love to collab — would you be open to a quick chat? 🙌' },
      { id: 's9', type: 'email', delayDays: 3, subject: 'Following up — photography collaboration', body: 'Hi {{ContactName}},\n\nI sent a DM on Instagram recently about potentially working together. I\'d love to share some ideas — would a quick call work?\n\nBest,\n{{YourName}}' },
    ],
    createdAt: new Date().toISOString(),
  },
];

/* ════════════════════════════════════════════════
   TemplateCard — rich list item
════════════════════════════════════════════════ */
function TemplateCard({
  template,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  template: SequenceTemplate;
  onEdit: (t: SequenceTemplate) => void;
  onDuplicate: (t: SequenceTemplate) => void;
  onDelete: (id: string) => void;
}) {
  const rr = template.replyRate ?? 0;
  const rrColor = rr >= 15 ? '#16a34a' : rr > 0 ? '#d97706' : undefined;

  return (
    <div className="glass-card rounded-2xl p-4 border border-white/60">
      <div className="flex items-start gap-3">
        {/* Left: name + tags */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-bold text-sm truncate" style={{ color: '#131b2e' }}>{template.name}</p>
            {template.isAiGenerated && (
              <span
                className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0"
                style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
              >
                <Sparkles className="w-2 h-2" />AI
              </span>
            )}
          </div>
          {template.description && (
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{template.description}</p>
          )}
          {/* Step count + times used */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(124,110,247,0.12)', color: ACCENT }}
            >
              {template.steps.length} step{template.steps.length !== 1 ? 's' : ''}
            </span>
            {(template.timesUsed ?? 0) > 0 && (
              <span className="text-[10px] text-muted-foreground">
                Used {template.timesUsed}×
              </span>
            )}
          </div>
        </div>

        {/* Right: stats + action buttons */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {/* Stats row */}
          {(rr > 0 || (template.wonCount ?? 0) > 0) && (
            <div className="flex items-start gap-4">
              {rr > 0 && (
                <div className="text-right">
                  <p className="text-sm font-extrabold leading-none" style={{ color: rrColor }}>
                    {rr}%
                  </p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">reply rate</p>
                </div>
              )}
              {(template.wonCount ?? 0) > 0 && (
                <div className="text-right">
                  <p className="text-sm font-extrabold leading-none" style={{ color: '#d97706' }}>
                    {template.wonCount}
                  </p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">won</p>
                </div>
              )}
            </div>
          )}
          {/* Action buttons */}
          <div className="flex gap-0.5">
            <button
              onClick={() => onEdit(template)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-white/60 transition-colors"
              title="Edit"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={() => onDuplicate(template)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-white/60 transition-colors"
              title="Duplicate"
            >
              <Copy className="w-3 h-3" />
            </button>
            <button
              onClick={() => onDelete(template.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Performance Tab
════════════════════════════════════════════════ */
function PerformanceTab({ templates }: { templates: SequenceTemplate[] }) {
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const sorted = [...templates].sort((a, b) => {
    const diff = (b.replyRate ?? 0) - (a.replyRate ?? 0);
    return sortDir === 'desc' ? diff : -diff;
  });

  if (templates.length === 0) {
    return (
      <div className="text-center py-10">
        <TrendingUp className="w-9 h-9 mx-auto mb-3 text-muted-foreground/30" />
        <p className="text-sm font-semibold text-muted-foreground">No data yet</p>
        <p className="text-xs text-muted-foreground mt-1">Create templates and start sending to see performance stats.</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-white/60">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_56px_80px_52px] gap-2 px-4 py-2.5 border-b border-white/30"
           style={{ background: 'rgba(124,110,247,0.04)' }}>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Template</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Sent</span>
        <button
          onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
          className="flex items-center justify-center gap-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors hover:text-foreground"
          style={{ color: ACCENT }}
        >
          Reply rate
          {sortDir === 'desc'
            ? <ChevronDown className="w-2.5 h-2.5" />
            : <ChevronUp className="w-2.5 h-2.5" />}
        </button>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Won</span>
      </div>

      {sorted.map((t, i) => {
        const rr = t.replyRate ?? 0;
        return (
          <div
            key={t.id}
            className="grid grid-cols-[1fr_56px_80px_52px] gap-2 px-4 py-3 items-center border-b border-white/20 last:border-0"
            style={i % 2 === 0 ? {} : { background: 'rgba(255,255,255,0.25)' }}
          >
            <p className="text-xs font-semibold truncate" style={{ color: '#131b2e' }}>{t.name}</p>
            <p className="text-xs text-center text-muted-foreground">{t.timesUsed ?? 0}</p>
            <p
              className="text-xs font-bold text-center"
              style={{ color: rr >= 15 ? '#16a34a' : rr > 0 ? '#d97706' : '#9ca3af' }}
            >
              {rr > 0 ? `${rr}%` : '—'}
            </p>
            <p className="text-xs text-center text-muted-foreground">{t.wonCount ?? 0}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════
   AI Suggested Tab
════════════════════════════════════════════════ */
function AISuggestedTab({
  onUse,
}: {
  onUse: (t: SequenceTemplate) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground leading-snug">
        Aurora-crafted sequences based on common outreach patterns. Click <strong>Use template</strong> to copy one to your library.
      </p>
      {AI_SUGGESTION_BANK.map(s => (
        <div
          key={s.id}
          className="glass-card rounded-2xl p-4 border border-white/60"
        >
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold" style={{ color: '#131b2e' }}>{s.name}</p>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(34,197,94,0.12)', color: '#16a34a' }}
                >
                  ~{s.expectedReply} reply
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{s.description}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(124,110,247,0.10)', color: ACCENT }}
                >
                  {s.steps.length} steps
                </span>
                {s.tags.map(tag => (
                  <span key={tag} className="text-[10px] text-muted-foreground/60">{tag}</span>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={() => onUse(s)}
            className="mt-3 w-full h-8 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
          >
            <Plus className="w-3 h-3" />
            Use template
          </button>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════
   Templates Modal  (3-tab redesign)
════════════════════════════════════════════════ */
function TemplatesModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAurora();
  const [templates,      setTemplates]      = useState<SequenceTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<SequenceTemplate | null>(null);
  const [isCreating,     setIsCreating]     = useState(false);
  const [isGenerating,   setIsGenerating]   = useState(false);
  const [tab,            setTab]            = useState<'mine' | 'ai' | 'performance'>('mine');

  const isEditing = isCreating || !!editingTemplate;

  /* ── AI generate ── */
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessType: profile?.businessType }),
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(prev => [...prev, { ...data, id: data.id || crypto.randomUUID(), isAiGenerated: true, createdAt: new Date().toISOString() }]);
        toast.success('AI template generated!');
      } else throw new Error('API failed');
    } catch {
      /* Graceful fallback — pre-fill editor with AI scaffold */
      const fallback: SequenceTemplate = {
        id: crypto.randomUUID(),
        name: `${profile?.businessType || 'Outreach'} Sequence`,
        description: 'AI-generated — personalise before sending',
        isAiGenerated: true,
        steps: [
          {
            id: crypto.randomUUID(), type: 'email', delayDays: 0,
            subject: 'Collaboration opportunity — quick intro',
            body: `Hi there,\n\nI came across your venue and would love to discuss a potential collaboration. ${profile?.businessType ? `As a ${profile.businessType}, I` : 'I'} work with spaces like yours to create something truly special.\n\nWould you have 10 minutes for a quick call?\n\nBest,\n${profile?.businessName || 'Your Name'}`,
          },
          {
            id: crypto.randomUUID(), type: 'email', delayDays: 5,
            subject: '',
            body: `Hi,\n\nJust following up on my previous message — happy to chat whenever works.\n\nBest,\n${profile?.businessName || 'Your Name'}`,
          },
          {
            id: crypto.randomUUID(), type: 'instagram', delayDays: 4,
            body: 'Hey! I sent an email about a potential collaboration — just reaching out here too. Would love to connect! 🙌',
          },
        ],
        createdAt: new Date().toISOString(),
      };
      setTemplates(prev => [...prev, fallback]);
      toast.success('Template created! Edit it to make it yours.');
    } finally {
      setIsGenerating(false);
    }
  };

  /* ── CRUD helpers ── */
  const handleSave = (t: SequenceTemplate) => {
    if (editingTemplate) setTemplates(prev => prev.map(x => x.id === t.id ? t : x));
    else setTemplates(prev => [...prev, t]);
    setEditingTemplate(null); setIsCreating(false);
    toast.success(editingTemplate ? 'Template updated!' : 'Template created!');
  };

  const handleDuplicate = (t: SequenceTemplate) => {
    setTemplates(prev => [...prev, {
      ...t,
      id: crypto.randomUUID(),
      name: `${t.name} (copy)`,
      createdAt: new Date().toISOString(),
      timesUsed: 0,
      replyRate: undefined,
      wonCount: 0,
    }]);
    toast.success('Template duplicated!');
  };

  const handleDelete = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success('Deleted');
  };

  const handleUseAiSuggestion = (s: SequenceTemplate) => {
    setTemplates(prev => [...prev, {
      ...s,
      id: crypto.randomUUID(),
      steps: s.steps.map(st => ({ ...st, id: crypto.randomUUID() })),
      createdAt: new Date().toISOString(),
    }]);
    setTab('mine');
    toast.success(`"${s.name}" added to your templates!`);
  };

  const TABS: { id: 'mine' | 'ai' | 'performance'; label: string }[] = [
    { id: 'mine',        label: 'My templates'  },
    { id: 'ai',          label: 'AI suggested'  },
    { id: 'performance', label: 'Performance'   },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
    >
      <div className="glass-panel rounded-3xl w-full max-w-xl max-h-[88vh] flex flex-col shadow-2xl border border-white/40">

        {/* ── Modal header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/30 shrink-0">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <button
                onClick={() => { setEditingTemplate(null); setIsCreating(false); }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Templates
              </button>
            ) : (
              <>
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
                >
                  <FileText className="w-3.5 h-3.5 text-white" />
                </div>
                <h2 className="font-extrabold text-base" style={{ color: '#131b2e' }}>Templates</h2>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-white/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Tab bar (hidden while editing) ── */}
        {!isEditing && (
          <div className="px-5 pt-3 pb-2 shrink-0">
            <div
              className="flex items-center gap-0.5 p-1 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.45)' }}
            >
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200"
                  style={tab === t.id ? {
                    background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`,
                    color: '#fff',
                    boxShadow: `0 2px 8px rgba(124,110,247,0.3)`,
                  } : { color: '#6b7280' }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-4 space-y-4">

          {/* ─── Editor view ─── */}
          {isEditing && (
            <TemplateEditor
              template={editingTemplate}
              onSave={handleSave}
              onCancel={() => { setEditingTemplate(null); setIsCreating(false); }}
            />
          )}

          {/* ─── My Templates tab ─── */}
          {!isEditing && tab === 'mine' && (
            <>
              {/* AI generation banner */}
              <div
                className="rounded-2xl p-4 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg,rgba(124,110,247,0.13) 0%,rgba(149,133,249,0.07) 100%)',
                  border: '1px solid rgba(124,110,247,0.22)',
                }}
              >
                {/* Decorative blobs */}
                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-30 blur-2xl pointer-events-none"
                     style={{ background: 'var(--ll-liquid-b)' }} />
                <div className="flex items-center gap-3 relative z-10">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
                  >
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: '#131b2e' }}>Let Aurora write your template</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      AI generates a full sequence based on your profession and target type
                    </p>
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-60 active:scale-[0.97]"
                    style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
                  >
                    {isGenerating
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Sparkles className="w-3 h-3" />}
                    Generate
                  </button>
                </div>
              </div>

              {/* Create button */}
              <button
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border-2 border-dashed border-white/60 text-sm font-bold transition-all hover:border-primary/30 hover:bg-primary/5"
                style={{ color: ACCENT }}
              >
                <Plus className="w-4 h-4" /> Create New Template
              </button>

              {/* Template list */}
              {templates.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <FileText className="w-9 h-9 mx-auto mb-3 opacity-25" />
                  <p className="text-sm">No templates yet</p>
                  <p className="text-xs mt-1 opacity-70">Generate one with AI or create manually above</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map(t => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      onEdit={setEditingTemplate}
                      onDuplicate={handleDuplicate}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ─── AI Suggested tab ─── */}
          {!isEditing && tab === 'ai' && (
            <AISuggestedTab onUse={handleUseAiSuggestion} />
          )}

          {/* ─── Performance tab ─── */}
          {!isEditing && tab === 'performance' && (
            <PerformanceTab templates={templates} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Main Outreach Page
════════════════════════════════════════════════ */
export function OutreachPage() {
  const { opportunities, outreachMessages, followUpTasks, refreshData, outreachStage, goToOutreachStage } = useAurora();

  // Pipeline stage — seeded from context so metric-card nav can pre-select a tab
  const [activeStage, setActiveStage] = useState<PipelineStage>(outreachStage as PipelineStage ?? 'sent');

  // Reset context stage after mount so future direct visits default to 'sent'
  useEffect(() => {
    goToOutreachStage('sent');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selected contact (desktop right pane / mobile full-screen)
  const [selectedSequence, setSelectedSequence] = useState<OutreachSequence | null>(null);

  // Add-contact inline form state (left panel)
  const [showAddContact, setShowAddContact]   = useState(false);
  const [addName,        setAddName]          = useState("");
  const [addEmail,       setAddEmail]         = useState("");
  const [addType,        setAddType]          = useState("venue");
  const [isAdding,       setIsAdding]         = useState(false);

  // Templates modal
  const [showTemplates, setShowTemplates] = useState(false);

  // Build sequences
  const sequences: OutreachSequence[] = opportunities
    .filter(o => o.status !== 'new' && o.status !== 'closed')
    .map(opp => {
      const oppMessages = outreachMessages.filter(m => m.opportunityId === opp.id);
      const oppFollowUps = (followUpTasks || []).filter(f => f.opportunityId === opp.id);
      const sentMessages = oppMessages.filter(m => m.status === 'sent');
      const lastSent = sentMessages.sort((a, b) =>
        new Date(b.sentAt || b.createdAt).getTime() - new Date(a.sentAt || a.createdAt).getTime()
      )[0];

      let nextAction: OutreachSequence['nextAction'];
      if (opp.status === 'outreach_ready' && sentMessages.length === 0)
        nextAction = { type: 'send_initial', message: 'Send initial outreach' };
      else if (opp.status === 'sent' || opp.status === 'follow_up_due') {
        const pf = oppFollowUps.find(f => f.status === 'pending');
        if (pf) nextAction = { type: 'send_follow_up', dueDate: pf.dueDate, message: pf.suggestedAction || 'Send follow-up' };
      } else if (opp.status === 'replied')
        nextAction = { type: 'check_reply', message: 'Review response' };

      return {
        opportunity: opp, messages: oppMessages, followUps: oppFollowUps,
        totalTouches: sentMessages.length,
        lastTouchDate: lastSent?.sentAt || lastSent?.createdAt,
        nextAction,
      };
    });

  // Include closed for "won" stage
  const wonSequences: OutreachSequence[] = opportunities
    .filter(o => o.status === 'closed')
    .map(opp => ({
      opportunity: opp,
      messages: outreachMessages.filter(m => m.opportunityId === opp.id),
      followUps: (followUpTasks || []).filter(f => f.opportunityId === opp.id),
      totalTouches: outreachMessages.filter(m => m.opportunityId === opp.id && m.status === 'sent').length,
    }));

  const stageMap: Record<PipelineStage, OutreachSequence[]> = {
    ready:   sequences.filter(s => s.opportunity.status === 'outreach_ready'),
    sent:    sequences.filter(s => s.opportunity.status === 'sent' || s.opportunity.status === 'follow_up_due'),
    replied: sequences.filter(s => s.opportunity.status === 'replied'),
    won:     wonSequences,
  };

  const counts: Record<PipelineStage, number> = {
    ready:   stageMap.ready.length,
    sent:    stageMap.sent.length,
    replied: stageMap.replied.length,
    won:     stageMap.won.length,
  };

  const activeList: OutreachSequence[] = stageMap[activeStage];

  // Auto-select first contact when the list gains its first item (async data load)
  // Tab-change auto-select is handled inline in the PipelineStrip onChange below
  useEffect(() => {
    if (!selectedSequence && activeList.length > 0) {
      setSelectedSequence(activeList[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeList.length]);

  const handleRefresh = async () => {
    await refreshData();
    if (selectedSequence) {
      const updated = opportunities.find(o => o.id === selectedSequence.opportunity.id);
      if (updated) {
        setSelectedSequence(prev => prev ? {
          ...prev, opportunity: updated,
          messages: outreachMessages.filter(m => m.opportunityId === updated.id),
          followUps: (followUpTasks || []).filter(f => f.opportunityId === updated.id),
        } : null);
      }
    }
  };

  const handleAddContact = async () => {
    if (!addName.trim()) return;
    setIsAdding(true);
    try {
      const result = await createOpportunity({
        name: addName.trim(),
        type: addType,
        status: "outreach_ready",
        source: "manual",
        contactMethods: addEmail.trim()
          ? [{ type: "email", value: addEmail.trim(), isPrimary: true }]
          : [],
      });
      if (result.success) {
        setAddName(""); setAddEmail(""); setAddType("venue");
        setShowAddContact(false);
        // Switch to Ready tab so the new contact is visible
        setActiveStage("ready");
        await refreshData();
        toast.success(`${addName.trim()} added to Ready`);
      } else {
        toast.error(result.error ?? "Failed to add contact");
      }
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
      {showTemplates && <TemplatesModal onClose={() => setShowTemplates(false)} />}

      {/* Mobile: full-screen detail (shown when a sequence is selected on small screens) */}
      {selectedSequence && (
        <div className="lg:hidden">
          <SequenceDetail
            sequence={selectedSequence}
            onBack={() => setSelectedSequence(null)}
            onRefresh={handleRefresh}
          />
        </div>
      )}

      <div className={`space-y-3${selectedSequence ? ' hidden lg:block' : ''}`}>

        {/* ── Pipeline strip + Templates ── */}
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <PipelineStrip counts={counts} active={activeStage} onChange={s => {
              setActiveStage(s);
              setShowAddContact(false);
              // Auto-select first contact in the new tab immediately
              setSelectedSequence(stageMap[s][0] ?? null);
            }} />
          </div>
          <button
            onClick={() => setShowTemplates(true)}
            className="shrink-0 flex items-center gap-1.5 text-sm font-bold transition-colors hover:opacity-80"
            style={{ color: ACCENT }}
          >
            <FileText className="w-4 h-4" />
            Templates
          </button>
        </div>

        {/* ══════════════════════════════════════
            DESKTOP: Split pane (lg+)
        ══════════════════════════════════════ */}
        <div className="hidden lg:flex glass-panel rounded-2xl overflow-hidden"
             style={{ height: 'calc(100vh - 210px)', minHeight: '520px' }}>

          {/* Left pane — contact list */}
          <div className="w-[350px] shrink-0 border-r border-white/30 flex flex-col">
            {/* Header row */}
            <div className="px-4 py-3 border-b border-white/20 shrink-0 flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {activeList.length} contact{activeList.length !== 1 ? 's' : ''}
              </p>
              <button
                onClick={() => setShowAddContact(v => !v)}
                className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors"
                style={showAddContact
                  ? { background: `rgba(124,110,247,0.12)`, color: ACCENT }
                  : { color: ACCENT }}
              >
                {showAddContact ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                {showAddContact ? "Cancel" : "Add contact"}
              </button>
            </div>

            {/* Inline add-contact form */}
            {showAddContact && (
              <div className="px-4 py-3 border-b border-white/20 shrink-0 space-y-2">
                <input
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  placeholder="Name *"
                  className="w-full text-sm rounded-xl px-3 py-2 border border-white/50 bg-white/60 outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground/50"
                />
                <input
                  value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  placeholder="Email"
                  type="email"
                  className="w-full text-sm rounded-xl px-3 py-2 border border-white/50 bg-white/60 outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground/50"
                />
                <select
                  value={addType}
                  onChange={e => setAddType(e.target.value)}
                  className="w-full text-sm rounded-xl px-3 py-2 border border-white/50 bg-white/60 outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 text-foreground"
                >
                  <option value="venue">Venue</option>
                  <option value="wedding_planner">Wedding Planner</option>
                  <option value="event_organiser">Event Organiser</option>
                  <option value="agency">Agency</option>
                  <option value="brand">Brand</option>
                  <option value="other">Other</option>
                </select>
                <button
                  onClick={handleAddContact}
                  disabled={!addName.trim() || isAdding}
                  className="w-full rounded-xl py-2 text-sm font-bold text-white disabled:opacity-40 flex items-center justify-center gap-1.5"
                  style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
                >
                  {isAdding ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Adding…</> : "Add to Ready"}
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {activeList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                       style={{ background: `rgba(124,110,247,0.10)` }}>
                    {activeStage === 'ready'   && <Zap className="w-6 h-6" style={{ color: ACCENT }} />}
                    {activeStage === 'sent'    && <Send className="w-6 h-6" style={{ color: ACCENT }} />}
                    {activeStage === 'replied' && <MessageSquare className="w-6 h-6" style={{ color: ACCENT }} />}
                    {activeStage === 'won'     && <Trophy className="w-6 h-6" style={{ color: ACCENT }} />}
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    No {activeStage} contacts
                  </p>
                </div>
              ) : (
                activeList.map(seq => (
                  <ContactRow
                    key={seq.opportunity.id}
                    sequence={seq}
                    isActive={selectedSequence?.opportunity.id === seq.opportunity.id}
                    onClick={() => setSelectedSequence(seq)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right pane — detail */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {selectedSequence ? (
              <PaneDetail
                key={selectedSequence.opportunity.id}
                sequence={selectedSequence}
                onRefresh={handleRefresh}
                onDeselect={() => setSelectedSequence(null)}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                     style={{ background: `rgba(124,110,247,0.08)` }}>
                  <Mail className="w-8 h-8" style={{ color: `${ACCENT}60` }} />
                </div>
                <h3 className="font-bold text-base mb-1" style={{ color: '#131b2e' }}>Select a contact</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Choose a contact from the list to view their email sequence and take action.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════
            MOBILE: Full-screen list (< lg)
        ══════════════════════════════════════ */}
        <div className="lg:hidden space-y-2">
          {activeList.length === 0 ? (
            <div className="glass-panel rounded-3xl p-8 text-center">
              <div className="w-14 h-14 rounded-3xl flex items-center justify-center mx-auto mb-4"
                   style={{ background: `rgba(124,110,247,0.10)` }}>
                {activeStage === 'ready'   && <Zap className="w-7 h-7" style={{ color: ACCENT }} />}
                {activeStage === 'sent'    && <Send className="w-7 h-7" style={{ color: ACCENT }} />}
                {activeStage === 'replied' && <MessageSquare className="w-7 h-7" style={{ color: ACCENT }} />}
                {activeStage === 'won'     && <Trophy className="w-7 h-7" style={{ color: ACCENT }} />}
              </div>
              <p className="font-semibold text-sm" style={{ color: '#131b2e' }}>No {activeStage} contacts</p>
            </div>
          ) : (
            activeList.map(seq => (
              <MobileSequenceCard
                key={seq.opportunity.id}
                sequence={seq}
                onClick={() => setSelectedSequence(seq)}
              />
            ))
          )}
        </div>

      </div>
    </>
  );
}

/* ════════════════════════════════════════════════
   Mobile sequence card (simplified SequenceCard)
════════════════════════════════════════════════ */
function MobileSequenceCard({ sequence, onClick }: { sequence: OutreachSequence; onClick: () => void }) {
  const { opportunity, totalTouches, lastTouchDate, nextAction } = sequence;
  const photo = thumbUrl(opportunity.photoReference);
  const badge = statusBadge(opportunity.status);
  const isOverdue = nextAction?.type === 'send_follow_up' &&
    nextAction.dueDate && new Date(nextAction.dueDate) < new Date();

  return (
    <div className="glass-card glass-card-hover rounded-2xl overflow-hidden cursor-pointer border-l-[3px]"
         style={{ borderLeftColor: ACCENT }}
         onClick={onClick}>
      <div className="flex items-stretch">
        <div className="w-20 shrink-0 relative self-stretch min-h-[80px]">
          {photo ? (
            <img src={photo} alt={opportunity.name} className="w-full h-full object-cover absolute inset-0" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"
                 style={{ background: `linear-gradient(135deg,rgba(124,110,247,0.10),rgba(149,133,249,0.06))` }}>
              <MapPin className="w-5 h-5" style={{ color: `${ACCENT}50` }} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 p-3 flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm truncate" style={{ color: '#131b2e' }}>{opportunity.name}</h3>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">{typeLabels[opportunity.type]}</p>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Send className="w-2.5 h-2.5" />{totalTouches} touch{totalTouches !== 1 ? 'es' : ''}</span>
            {lastTouchDate && <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{daysAgoStr(lastTouchDate)}</span>}
          </div>
          {isOverdue && (
            <span className="self-start text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">Overdue</span>
          )}
        </div>
        <div className="flex items-center pr-3">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Sequence Detail (mobile full-screen — UNCHANGED)
════════════════════════════════════════════════ */
function SequenceDetail({
  sequence, onBack, onRefresh,
}: {
  sequence: OutreachSequence;
  onBack: () => void;
  onRefresh: () => Promise<void>;
}) {
  const { profile } = useAurora();
  const { opportunity, messages, followUps } = sequence;
  const [isPending, startTransition] = useTransition();
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>([]);
  const [isLoadingSteps, setIsLoadingSteps] = useState(true);
  const [editingStep, setEditingStep] = useState<SequenceStep | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editDelay, setEditDelay] = useState(3);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [personalisationScore, setPersonalisationScore] = useState<number | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [generationTookTooLong, setGenerationTookTooLong] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const photoUrl = opportunity.photoReference
    ? `/api/places/photo?ref=${encodeURIComponent(opportunity.photoReference)}&maxWidth=800`
    : null;

  const startPolling = useCallback((oppId: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setIsPolling(true);
    setGenerationTookTooLong(false);
    let count = 0;
    const MAX = 10;
    pollTimerRef.current = setInterval(async () => {
      count++;
      if (count >= MAX) {
        clearInterval(pollTimerRef.current!);
        pollTimerRef.current = null;
        setIsPolling(false);
        setGenerationTookTooLong(true);
        return;
      }
      try {
        const r = await fetch(`/api/sequences?opportunityId=${oppId}`);
        const d = await r.json();
        if (d.steps?.length > 0) {
          clearInterval(pollTimerRef.current!);
          pollTimerRef.current = null;
          setIsPolling(false);
          setSequenceSteps(d.steps);
        }
      } catch { /* keep polling */ }
    }, 3000);
  }, []);

  useEffect(() => {
    setIsPolling(false);
    setGenerationTookTooLong(false);
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }

    const loadSequence = async () => {
      setIsLoadingSteps(true);
      try {
        const res = await fetch(`/api/sequences?opportunityId=${opportunity.id}`);
        const data = await res.json();
        if (data.steps?.length > 0) {
          setSequenceSteps(data.steps);
          return;
        }

        let generated = false;
        try {
          const createRes = await fetch('/api/generate-sequence', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ opportunity_id: opportunity.id }),
          });
          const createData = await createRes.json();
          if (createData.status === 'generated' || createData.status === 'cached') {
            const r2 = await fetch(`/api/sequences?opportunityId=${opportunity.id}`);
            const d2 = await r2.json();
            if (d2.steps?.length > 0) {
              setSequenceSteps(d2.steps);
              if (createData.personalisation_score != null) setPersonalisationScore(createData.personalisation_score);
              generated = true;
            }
          }
        } catch { /* fall through to polling */ }

        if (!generated) startPolling(opportunity.id);
      } catch { /* silent */ }
      finally { setIsLoadingSteps(false); }
    };
    loadSequence();

    return () => {
      if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    };
  }, [opportunity.id, startPolling]);

  const refreshSteps = async () => {
    const r = await fetch(`/api/sequences?opportunityId=${opportunity.id}`);
    const d = await r.json();
    if (d.steps) setSequenceSteps(d.steps);
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const res = await fetch('/api/generate-sequence', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ opportunity_id: opportunity.id, regenerate: true }),
      });
      const data = await res.json();
      if (data.status === 'generated') {
        await refreshSteps();
        if (data.personalisation_score != null) setPersonalisationScore(data.personalisation_score);
        toast.success('Sequence regenerated');
      } else {
        toast.error(data.error || 'Regeneration failed');
      }
    } catch { toast.error('Failed to regenerate'); }
    finally { setIsRegenerating(false); }
  };

  const handleEditStep = (step: SequenceStep) => {
    setEditingStep(step); setEditSubject(step.subject || ''); setEditBody(step.body); setEditDelay(step.delay_days);
  };

  const handleSaveEdit = async () => {
    if (!editingStep) return;
    setIsSaving(true);
    try {
      await fetch('/api/sequences', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId: editingStep.id, subject: editSubject, body: editBody, delay_days: editDelay }),
      });
      await refreshSteps(); setEditingStep(null); toast.success('Email updated!');
    } catch { toast.error('Failed to update'); }
    finally { setIsSaving(false); }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!confirm('Delete this email?')) return;
    try {
      await fetch(`/api/sequences?stepId=${stepId}`, { method: 'DELETE' });
      await refreshSteps(); toast.success('Email removed');
    } catch { toast.error('Failed to delete'); }
  };

  const handleAddStep = async () => {
    try {
      await fetch('/api/sequences/add-step', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: opportunity.id, delay_days: 5 }),
      });
      await refreshSteps(); toast.success('Email added to sequence');
    } catch { toast.error('Failed to add'); }
  };

  const handleSendStep = async (step: SequenceStep) => {
    const emailContact = opportunity.contactMethods.find(c => c.type === 'email');
    if (!emailContact?.value) { toast.error('No email address found'); return; }
    try {
      const statusRes = await fetch('/api/email/status');
      const statusData = await statusRes.json();
      if (!statusData.connected) { toast.error('Connect your email first — go to Profile'); return; }
      const res = await fetch('/api/email/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailContact.value, toName: opportunity.name,
          subject: step.subject, body: `<p>${step.body.replace(/\n/g, '<br/>')}</p>`,
          opportunityId: opportunity.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      await fetch('/api/sequences', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId: step.id, status: 'sent' }),
      });
      setSequenceSteps(prev => prev.map(s => s.id === step.id ? { ...s, status: 'sent' } : s));
      toast.success('Email sent!');
      await onRefresh();
    } catch (err: any) { toast.error(err.message || 'Failed to send'); }
  };

  const handleUpdateDelay = async (stepId: string, newDelay: number) => {
    if (newDelay < 1 || newDelay > 30) return;
    setSequenceSteps(prev => prev.map(s => s.id === stepId ? { ...s, delay_days: newDelay } : s));
    try {
      await fetch('/api/sequences', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId, delay_days: newDelay }),
      });
    } catch { await refreshSteps(); }
  };

  if (editingStep) {
    return (
      <div className="space-y-4">
        <button onClick={() => setEditingStep(null)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to sequence
        </button>
        <h2 className="text-lg font-semibold">Edit Email #{editingStep.step_number}</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Subject Line</Label>
            <Input value={editSubject} onChange={e => setEditSubject(e.target.value)} placeholder="Email subject..." />
          </div>
          <div className="space-y-2">
            <Label>Message Body</Label>
            <Textarea value={editBody} onChange={e => setEditBody(e.target.value)} placeholder="Your message..." className="min-h-[200px]" />
          </div>
          {editingStep.step_number > 1 && (
            <div className="space-y-2">
              <Label>Days after previous email</Label>
              <div className="flex items-center gap-3">
                <Input type="number" min={1} max={30} value={editDelay} onChange={e => setEditDelay(Number(e.target.value))} className="w-20" />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <Button onClick={handleSaveEdit} disabled={isSaving} className="flex-1">
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
            <Button variant="outline" onClick={() => setEditingStep(null)}>Cancel</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compact header — no photo */}
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-muted/60 hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0"
             style={{ background: `linear-gradient(135deg,rgba(124,110,247,0.12),rgba(149,133,249,0.06))` }}>
          {photoUrl
            ? <img src={photoUrl} alt={opportunity.name} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center">
                <MapPin className="w-4 h-4" style={{ color: `${ACCENT}60` }} />
              </div>}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-extrabold text-sm truncate" style={{ color: '#131b2e' }}>{opportunity.name}</h2>
          {opportunity.location && (
            <p className="text-[11px] text-muted-foreground truncate">{opportunity.location.split(',').slice(0, 2).join(',')}</p>
          )}
        </div>
        <Badge className="text-white border-0 shrink-0 text-[10px]"
               style={{ background: opportunity.status === 'replied' ? '#22c55e' : opportunity.status === 'follow_up_due' ? '#f97316' : opportunity.status === 'sent' ? '#f59e0b' : ACCENT }}>
          {statusLabels[opportunity.status]}
        </Badge>
      </div>

      {/* Email Sequence */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4" />Email Sequence ({sequenceSteps.length} emails)
              </CardTitle>
              {personalisationScore != null && (
                <span
                  title={personalisationScore < 50 ? 'Add more to your profile to improve personalisation' : undefined}
                  className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={
                    personalisationScore >= 80
                      ? { background: '#dcfce7', color: '#15803d' }
                      : personalisationScore >= 50
                      ? { background: '#fef9c3', color: '#a16207' }
                      : { background: '#f1f5f9', color: '#64748b' }
                  }
                >
                  {personalisationScore >= 80 ? '✦ Highly personalised' : personalisationScore >= 50 ? '✦ Personalised' : '✦ Low personalisation'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="ghost" size="sm"
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="text-xs h-8 gap-1.5"
                style={{ color: ACCENT }}
              >
                {isRegenerating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Rewriting…</>
                  : <><Sparkles className="w-3.5 h-3.5" />Regenerate</>}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleAddStep}><Plus className="w-4 h-4 mr-1" />Add</Button>
            </div>
          </div>
          {isRegenerating && (
            <p className="text-xs mt-1" style={{ color: ACCENT }}>
              Aurora is rewriting this sequence…
            </p>
          )}
        </CardHeader>
        <CardContent>
          {isLoadingSteps ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : isPolling ? (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: ACCENT }} />
                <span className="text-sm font-semibold" style={{ color: ACCENT }}>Aurora is writing your email sequence…</span>
              </div>
              <p className="text-xs text-muted-foreground">This usually takes 20–40 seconds. Hang tight.</p>
            </div>
          ) : generationTookTooLong ? (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">Generation is taking longer than expected.</p>
              <Button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                size="sm"
                style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
              >
                {isRegenerating
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating…</>
                  : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Regenerate Sequence</>}
              </Button>
            </div>
          ) : sequenceSteps.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-4">No emails in sequence</p>
              <Button onClick={handleAddStep}><Plus className="w-4 h-4 mr-2" />Create Sequence</Button>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-6 bottom-6 w-0.5 bg-border" />
              {sequenceSteps.map((step, idx) => {
                const isSent = step.status === 'sent';
                const isFirst = idx === 0;
                const nextStep = idx < sequenceSteps.length - 1 ? sequenceSteps[idx + 1] : null;
                const isOverdue = step.scheduled_at && new Date(step.scheduled_at) < new Date() && !isSent;
                return (
                  <div key={step.id}>
                    <div className="relative pl-10 pb-2">
                      <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${isSent ? 'bg-green-500' : isOverdue ? 'bg-orange-500' : 'bg-muted border-2 border-border'}`}>
                        {isSent ? <Check className="w-3 h-3 text-white" /> : <span className="text-xs font-medium">{step.step_number}</span>}
                      </div>
                      <div className={`rounded-lg border p-4 ${isSent ? 'bg-green-500/5 border-green-500/20' : isOverdue ? 'bg-orange-500/5 border-orange-500/20' : 'bg-card'}`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={isSent ? 'secondary' : 'outline'} className="text-xs">{isFirst ? 'Initial Email' : `Follow-up #${step.step_number - 1}`}</Badge>
                            {isSent && <Badge className="bg-green-500/20 text-green-700 border-0 text-xs">Sent</Badge>}
                            {isOverdue && !isSent && <Badge className="bg-orange-500/20 text-orange-700 border-0 text-xs">Overdue</Badge>}
                          </div>
                          {!isSent && (
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEditStep(step)}><Pencil className="w-3 h-3" /></Button>
                              {sequenceSteps.length > 1 && <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteStep(step.id)}><Trash2 className="w-3 h-3" /></Button>}
                            </div>
                          )}
                        </div>
                        {step.subject && <p className="text-sm font-medium mb-1">{step.subject}</p>}
                        <p className="text-sm text-muted-foreground line-clamp-4">{step.body}</p>
                        {!isSent && isFirst && (
                          <Button size="sm" className="mt-3" onClick={() => handleSendStep(step)}>
                            <Send className="w-3 h-3 mr-1" />Send Now
                          </Button>
                        )}
                      </div>
                    </div>
                    {nextStep && nextStep.status !== 'sent' && (
                      <div className="relative pl-10 py-2">
                        <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-border" />
                        <div className="flex items-center gap-2 ml-1">
                          <div className="flex items-center bg-muted rounded-full">
                            <button onClick={() => handleUpdateDelay(nextStep.id, nextStep.delay_days - 1)} disabled={nextStep.delay_days <= 1}
                              className="w-7 h-7 flex items-center justify-center rounded-l-full hover:bg-muted-foreground/10 disabled:opacity-30 transition-colors"><Minus className="w-3 h-3" /></button>
                            <span className="px-2 text-sm font-medium min-w-[3rem] text-center">{nextStep.delay_days}d</span>
                            <button onClick={() => handleUpdateDelay(nextStep.id, nextStep.delay_days + 1)} disabled={nextStep.delay_days >= 30}
                              className="w-7 h-7 flex items-center justify-center rounded-r-full hover:bg-muted-foreground/10 disabled:opacity-30 transition-colors"><Plus className="w-3 h-3" /></button>
                          </div>
                          <span className="text-xs text-muted-foreground">until next email</span>
                        </div>
                      </div>
                    )}
                    {(idx === sequenceSteps.length - 1 || (nextStep && nextStep.status === 'sent')) && <div className="h-4" />}
                  </div>
                );
              })}
              <div className="relative pl-10">
                <div className="absolute left-2 w-5 h-5 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center"><Plus className="w-3 h-3 text-muted-foreground" /></div>
                <Button variant="outline" size="sm" className="border-dashed" onClick={handleAddStep}><Plus className="w-3 h-3 mr-1" />Add Another Email</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Intelligence */}
      <ContactIntelCard opportunity={opportunity} />

      {/* Action */}
      {opportunity.status !== 'replied' && (
        <div className="flex gap-3">
          <Button size="lg" className="flex-1 h-14 rounded-xl"
            onClick={() => startTransition(async () => { await updateOpportunity(opportunity.id, { status: 'replied' }); await onRefresh(); toast.success('Marked as replied!'); })}>
            <MessageSquare className="w-5 h-5 mr-2" />Mark as Replied
          </Button>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   Contact Intelligence Card
════════════════════════════════════════════════ */
function ContactIntelCard({ opportunity }: { opportunity: Opportunity }) {
  const [copiedHandle, setCopiedHandle] = useState(false);

  // Collect all contact signals — prefer Tier 1 contact intel, fall back to contactMethods
  const emailFromMethods = opportunity.contactMethods.find(c => c.type === 'email');
  const igFromMethods    = opportunity.contactMethods.find(c => c.type === 'instagram');
  const phoneFromMethods = opportunity.contactMethods.find(c => c.type === 'phone');
  const websiteFromMethods = opportunity.contactMethods.find(c => c.type === 'website');

  const email     = opportunity.contactEmail || emailFromMethods?.value || null;
  const emailType = opportunity.contactEmailType || null;
  const igHandle  = opportunity.instagramHandle || igFromMethods?.value || null;
  const igUrl     = opportunity.instagramUrl || (igHandle ? `https://www.instagram.com/${igHandle.replace('@', '')}/` : null);
  const formUrl   = opportunity.contactFormUrl || opportunity.contactForm?.url || null;
  const hasForm   = opportunity.hasContactForm || !!formUrl;
  const phone     = phoneFromMethods?.value || null;
  const website   = opportunity.website || websiteFromMethods?.value || null;

  const hasAny = email || igHandle || formUrl || phone;
  if (!hasAny && !website) return null;

  const emailTypeBadge: Record<string, { label: string; color: string }> = {
    booking: { label: 'Booking',  color: '#7c6ef7' },
    wedding: { label: 'Wedding',  color: '#e879a0' },
    direct:  { label: 'Direct',   color: '#22c55e' },
    info:    { label: 'Info',     color: '#f59e0b' },
    other:   { label: 'General',  color: '#6b7280' },
  };

  const copyHandle = () => {
    if (!igHandle) return;
    navigator.clipboard.writeText(igHandle).catch(() => {});
    setCopiedHandle(true);
    setTimeout(() => setCopiedHandle(false), 2000);
  };

  return (
    <div className="glass-card rounded-2xl p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contact Intelligence</p>

      {/* Email */}
      {email && (
        <div className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
               style={{ background: 'rgba(124,110,247,0.1)' }}>
            <Mail className="w-3.5 h-3.5" style={{ color: ACCENT }} />
          </div>
          <div className="flex-1 min-w-0">
            <a href={`mailto:${email}`}
               className="text-sm font-medium truncate block hover:underline"
               style={{ color: '#131b2e' }}>
              {email}
            </a>
            {emailType && emailTypeBadge[emailType] && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: `${emailTypeBadge[emailType].color}18`,
                      color: emailTypeBadge[emailType].color,
                    }}>
                {emailTypeBadge[emailType].label}
              </span>
            )}
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(email).catch(() => {})}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-white/60"
          >
            <Copy className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Instagram */}
      {igHandle && (
        <div className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
               style={{ background: 'rgba(232,73,160,0.1)' }}>
            <Instagram className="w-3.5 h-3.5 text-pink-500" />
          </div>
          <div className="flex-1 min-w-0">
            {igUrl ? (
              <a href={igUrl} target="_blank" rel="noopener noreferrer"
                 className="text-sm font-medium hover:underline block truncate"
                 style={{ color: '#131b2e' }}>
                {igHandle}
              </a>
            ) : (
              <span className="text-sm font-medium truncate block" style={{ color: '#131b2e' }}>
                {igHandle}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">Tap to open · DM for enquiries</span>
          </div>
          <button
            onClick={copyHandle}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-white/60"
          >
            {copiedHandle
              ? <Check className="w-3 h-3 text-green-500" />
              : <Copy className="w-3 h-3 text-muted-foreground" />}
          </button>
        </div>
      )}

      {/* Contact form */}
      {(hasForm && formUrl) && (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
               style={{ background: 'rgba(245,158,11,0.1)' }}>
            <FileText className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <a href={formUrl} target="_blank" rel="noopener noreferrer"
               className="text-sm font-medium hover:underline block truncate"
               style={{ color: '#131b2e' }}>
              Contact form
            </a>
            <span className="text-[10px] text-muted-foreground">Use for initial enquiry</span>
          </div>
          <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
        </div>
      )}

      {/* Phone */}
      {phone && (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
               style={{ background: 'rgba(34,197,94,0.1)' }}>
            <Phone className="w-3.5 h-3.5 text-green-500" />
          </div>
          <a href={`tel:${phone}`}
             className="text-sm font-medium hover:underline"
             style={{ color: '#131b2e' }}>
            {phone}
          </a>
        </div>
      )}

      {/* Website (only if no email / form found, as a fallback) */}
      {website && !email && !formUrl && (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
               style={{ background: 'rgba(100,100,120,0.08)' }}>
            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <a href={website} target="_blank" rel="noopener noreferrer"
             className="text-sm font-medium hover:underline truncate block flex-1"
             style={{ color: '#131b2e' }}>
            {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </a>
          <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   Contact icon helper (UNCHANGED)
════════════════════════════════════════════════ */
function getContactIcon(type: ContactMethodType) {
  switch (type) {
    case 'email': return Mail;
    case 'instagram': return Instagram;
    case 'linkedin': return Linkedin;
    case 'phone': return Phone;
    case 'contact_form': return ExternalLink;
    case 'website': return Globe;
    case 'facebook': return Facebook;
    case 'twitter': return ExternalLink;
    case 'tiktok': return ExternalLink;
    default: return Globe;
  }
}

/* ════════════════════════════════════════════════
   Template Editor
════════════════════════════════════════════════ */
function TemplateEditor({
  template, onSave, onCancel,
}: {
  template: SequenceTemplate | null;
  onSave: (t: SequenceTemplate) => void;
  onCancel: () => void;
}) {
  const { profile } = useAurora();
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [steps, setSteps] = useState(
    template?.steps || [{ id: crypto.randomUUID(), type: 'email' as const, delayDays: 0, subject: "", body: "" }]
  );
  const [writingAI, setWritingAI] = useState<Record<string, boolean>>({});
  const [isAiGenerated] = useState(template?.isAiGenerated ?? false);

  // LinkedIn removed — only email, instagram, phone
  const channelOptions = [
    { value: 'email',     label: 'Email',        icon: Mail },
    { value: 'instagram', label: 'Instagram DM', icon: Instagram },
    { value: 'phone',     label: 'Phone',        icon: Phone },
  ];

  const addStep = () => setSteps([
    ...steps,
    { id: crypto.randomUUID(), type: 'email', delayDays: 3, subject: "", body: "" },
  ]);
  const removeStep = (id: string) => {
    if (steps.length > 1) setSteps(steps.filter(s => s.id !== id));
  };
  const updateStep = (id: string, u: Partial<typeof steps[0]>) =>
    setSteps(steps.map(s => s.id === id ? { ...s, ...u } : s));

  const handleWriteWithAI = async (stepId: string, stepIndex: number) => {
    setWritingAI(prev => ({ ...prev, [stepId]: true }));
    try {
      const step = steps.find(s => s.id === stepId);
      const res = await fetch('/api/templates/write-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName: name,
          stepIndex,
          channel: step?.type,
          businessType: profile?.businessType,
          existingBody: step?.body,
        }),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      if (data.body) updateStep(stepId, { body: data.body });
    } catch {
      // Graceful fallback: insert placeholder scaffold
      const step = steps.find(s => s.id === stepId);
      const biz = profile?.businessType || "your business";
      const fallbacks: Record<string, string> = {
        email: `Hi [Name],\n\nI came across your venue and thought there could be a great fit with ${biz}.\n\nWould you be open to a quick chat?\n\nBest,\n[Your name]`,
        instagram: `Hey! Love what you're doing 👋 I run ${biz} and think we could collaborate — mind if I share a quick idea?`,
        phone: `Introduction: "Hi, is this [Name]? Great — I'm [Your name] from ${biz}. I'd love 60 seconds of your time..."`,
      };
      updateStep(stepId, { body: fallbacks[step?.type || 'email'] || fallbacks.email });
      toast.success("AI placeholder added — edit to personalise");
    } finally {
      setWritingAI(prev => ({ ...prev, [stepId]: false }));
    }
  };

  const handleSave = () => {
    if (!name.trim()) { toast.error("Please enter a template name"); return; }
    if (steps.some(s => !s.body.trim())) { toast.error("All steps must have content"); return; }
    onSave({
      id: template?.id || crypto.randomUUID(),
      name: name.trim(),
      description: description.trim() || undefined,
      steps,
      createdAt: template?.createdAt || new Date().toISOString(),
      isAiGenerated,
      timesUsed: template?.timesUsed ?? 0,
      replyRate: template?.replyRate,
      wonCount: template?.wonCount,
    });
  };

  return (
    <div className="space-y-4">
      {/* Name + description */}
      <div className="glass-card rounded-2xl p-4 border border-white/60 space-y-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Template Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Wedding Venue Outreach"
            className="w-full px-3 py-2 rounded-xl text-sm border border-white/50 bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Description <span className="font-normal normal-case tracking-normal opacity-60">(optional)</span></label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="When to use this template…"
            className="w-full px-3 py-2 rounded-xl text-sm border border-white/50 bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Sequence Steps</p>
          <span className="text-[10px] text-muted-foreground">
            {steps.reduce((a, s) => a + s.delayDays, 0)} days total
          </span>
        </div>

        {steps.map((step, index) => (
          <div key={step.id} className="glass-card rounded-2xl border border-white/60 overflow-hidden">
            {/* Step header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/40"
                 style={{ background: 'rgba(124,110,247,0.04)' }}>
              {/* Step pill */}
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full text-white shrink-0"
                    style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
                {index === 0 ? 'Step 1' : `Follow-up ${index}`}
              </span>

              {/* Inline delay for follow-up steps */}
              {index > 0 && (
                <div className="flex items-center gap-1.5 ml-1">
                  <span className="text-[11px] text-muted-foreground">Wait</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={step.delayDays}
                    onChange={e => updateStep(step.id, { delayDays: parseInt(e.target.value) || 1 })}
                    className="w-10 h-6 text-center text-xs rounded-lg border border-white/50 bg-white/70 focus:outline-none focus:ring-1 focus:ring-[#7c6ef7]/40"
                  />
                  <span className="text-[11px] text-muted-foreground">days</span>
                </div>
              )}

              {/* Spacer + remove */}
              <div className="flex-1" />
              {steps.length > 1 && (
                <button
                  onClick={() => removeStep(step.id)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="p-4 space-y-3">
              {/* Channel selector */}
              <div className="flex gap-1.5 flex-wrap">
                {channelOptions.map(opt => {
                  const Icon = opt.icon;
                  const isActive = step.type === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => updateStep(step.id, { type: opt.value as any })}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                        isActive
                          ? 'text-white border-transparent shadow-sm'
                          : 'bg-white/50 border-white/50 text-muted-foreground hover:bg-white/70'
                      }`}
                      style={isActive ? { background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, borderColor: 'transparent' } : {}}
                    >
                      <Icon className="w-3 h-3" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Subject line — email only */}
              {step.type === 'email' && (
                <div className="space-y-1">
                  <input
                    value={step.subject || ""}
                    onChange={e => updateStep(step.id, { subject: e.target.value })}
                    placeholder={index > 0 ? "Subject (leave blank to reply in same thread)" : "Email subject line…"}
                    className="w-full px-3 py-2 rounded-xl text-sm border border-white/50 bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground"
                  />
                  {index > 0 && (
                    <p className="text-[10px] text-muted-foreground pl-1">
                      Leave blank to continue the email thread
                    </p>
                  )}
                </div>
              )}

              {/* Message body */}
              <div className="space-y-1.5">
                <textarea
                  value={step.body}
                  onChange={e => updateStep(step.id, { body: e.target.value })}
                  placeholder={
                    step.type === 'instagram' ? "Write your DM message…" :
                    step.type === 'phone'     ? "Write your call script…" :
                                                "Write your message…"
                  }
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border border-white/50 bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground resize-none"
                />

                {/* Write with AI button */}
                <button
                  onClick={() => handleWriteWithAI(step.id, index)}
                  disabled={writingAI[step.id]}
                  className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all disabled:opacity-60"
                  style={{
                    background: 'rgba(124,110,247,0.07)',
                    borderColor: 'rgba(124,110,247,0.25)',
                    color: ACCENT,
                  }}
                >
                  {writingAI[step.id]
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Sparkles className="w-3 h-3" />
                  }
                  {writingAI[step.id] ? 'Writing…' : 'Write with AI'}
                </button>
              </div>

              {/* Instagram manual-send hint */}
              {step.type === 'instagram' && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border"
                     style={{ background: 'rgba(236,72,153,0.05)', borderColor: 'rgba(236,72,153,0.2)' }}>
                  <Copy className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#db2777' }} />
                  <div>
                    <p className="text-[11px] font-bold" style={{ color: '#be185d' }}>Manual send required</p>
                    <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                      You'll send this manually on Instagram — Aurora will copy the message to your clipboard.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Add step */}
        <button
          onClick={addStep}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border-2 border-dashed text-sm font-medium text-muted-foreground hover:text-foreground hover:border-[#7c6ef7]/40 hover:bg-[#7c6ef7]/04 transition-all"
          style={{ borderColor: 'rgba(124,110,247,0.25)' }}
        >
          <Plus className="w-4 h-4" />
          Add follow-up step
        </button>
      </div>

      {/* Footer actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-white/40 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white shadow-sm transition-all hover:opacity-90"
          style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
        >
          <Save className="w-4 h-4" />
          {template ? "Update Template" : "Save Template"}
        </button>
      </div>
    </div>
  );
}
