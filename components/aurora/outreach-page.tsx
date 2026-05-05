"use client";

import { useState, useTransition, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useAurora } from "./aurora-app";
import { createOutreachMessage, markMessageAsSent, updateOpportunity } from "@/lib/actions";
import { typeLabels, contactMethodLabels, statusLabels } from "@/lib/types";
import type { Opportunity, OutreachMessage, ContactMethod, ContactMethodType, FollowUpTask } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { 
  Mail, 
  Copy, 
  ExternalLink, 
  Check, 
  ArrowLeft,
  Sparkles,
  Send,
  Save,
  AlertCircle,
  Instagram,
  Linkedin,
  Phone,
  Clock,
  CheckCircle2,
  Circle,
  ChevronRight,
  MessageSquare,
  Calendar,
  TrendingUp,
  Zap,
  MapPin,
  Star,
  PlayCircle,
  PauseCircle,
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Minus,
  ChevronUp,
  ChevronDown,
  Globe,
  Facebook,
  FileText,
} from "lucide-react";

// Group opportunities by their outreach status
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

// Sequence template type
interface SequenceTemplate {
  id: string;
  name: string;
  description?: string;
  steps: {
    id: string;
    type: 'email' | 'instagram' | 'linkedin' | 'phone';
    delayDays: number; // Days after previous step
    subject?: string;
    body: string;
  }[];
  createdAt: string;
}

export function OutreachPage() {
  const { opportunities, outreachMessages, followUpTasks, refreshData } = useAurora();
  const [selectedSequence, setSelectedSequence] = useState<OutreachSequence | null>(null);
  const [view, setView] = useState<'active' | 'ready' | 'completed' | 'templates'>('active');
  const [templates, setTemplates] = useState<SequenceTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<SequenceTemplate | null>(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  // Build sequences from opportunities
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
      if (opp.status === 'outreach_ready' && sentMessages.length === 0) {
        nextAction = { type: 'send_initial', message: 'Send initial outreach' };
      } else if (opp.status === 'sent' || opp.status === 'follow_up_due') {
        const pendingFollowUp = oppFollowUps.find(f => f.status === 'pending');
        if (pendingFollowUp) {
          nextAction = { 
            type: 'send_follow_up', 
            dueDate: pendingFollowUp.dueDate,
            message: pendingFollowUp.suggestedAction || 'Send follow-up'
          };
        }
      } else if (opp.status === 'replied') {
        nextAction = { type: 'check_reply', message: 'Review response' };
      }

      return {
        opportunity: opp,
        messages: oppMessages,
        followUps: oppFollowUps,
        totalTouches: sentMessages.length,
        lastTouchDate: lastSent?.sentAt || lastSent?.createdAt,
        nextAction,
      };
    });

  // Filter sequences by view
  const activeSequences = sequences.filter(s => 
    s.opportunity.status === 'sent' || 
    s.opportunity.status === 'follow_up_due' ||
    s.opportunity.status === 'replied'
  );
  const readySequences = sequences.filter(s => s.opportunity.status === 'outreach_ready');
  const completedSequences = sequences.filter(s => s.opportunity.status === 'closed');

  const displayedSequences = view === 'active' ? activeSequences 
    : view === 'ready' ? readySequences 
    : completedSequences;

  // Stats
  const stats = {
    active: activeSequences.length,
    ready: readySequences.length,
    totalSent: outreachMessages.filter(m => m.status === 'sent').length,
    replies: opportunities.filter(o => o.status === 'replied').length,
  };

  if (selectedSequence) {
    return (
      <SequenceDetail 
        sequence={selectedSequence}
        onBack={() => setSelectedSequence(null)}
        onRefresh={async () => {
          await refreshData();
          // Update the selected sequence with fresh data
          const updated = opportunities.find(o => o.id === selectedSequence.opportunity.id);
          if (updated) {
            const oppMessages = outreachMessages.filter(m => m.opportunityId === updated.id);
            const oppFollowUps = (followUpTasks || []).filter(f => f.opportunityId === updated.id);
            setSelectedSequence({
              ...selectedSequence,
              opportunity: updated,
              messages: oppMessages,
              followUps: oppFollowUps,
            });
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Compact Header with Inline Stats */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Outreach</h1>
        
        {/* Inline Stats with Labels */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex flex-col items-center px-2 py-1 bg-primary/10 rounded-md">
            <span className="font-semibold text-primary">{stats.active}</span>
            <span className="text-[10px] text-muted-foreground">Active</span>
          </div>
          <div className="flex flex-col items-center px-2 py-1 bg-amber-500/10 rounded-md">
            <span className="font-semibold text-amber-600">{stats.ready}</span>
            <span className="text-[10px] text-muted-foreground">Ready</span>
          </div>
          <div className="flex flex-col items-center px-2 py-1 bg-muted/50 rounded-md">
            <span className="font-semibold">{stats.totalSent}</span>
            <span className="text-[10px] text-muted-foreground">Sent</span>
          </div>
          <div className="flex flex-col items-center px-2 py-1 bg-green-500/10 rounded-md">
            <span className="font-semibold text-green-600">{stats.replies}</span>
            <span className="text-[10px] text-muted-foreground">Replies</span>
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setView('active')}
          className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            view === 'active' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Active ({activeSequences.length})
        </button>
        <button
          onClick={() => setView('ready')}
          className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            view === 'ready' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Ready ({readySequences.length})
        </button>
        <button
          onClick={() => setView('completed')}
          className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            view === 'completed' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Completed ({completedSequences.length})
        </button>
        <button
          onClick={() => setView('templates')}
          className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            view === 'templates' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Templates
        </button>
      </div>

      {/* Templates View */}
      {view === 'templates' ? (
        <div className="space-y-4">
          {/* Create Template Button */}
          {!isCreatingTemplate && !editingTemplate && (
            <Button 
              onClick={() => setIsCreatingTemplate(true)}
              className="w-full"
              variant="outline"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Sequence Template
            </Button>
          )}

          {/* Template Editor */}
          {(isCreatingTemplate || editingTemplate) && (
            <TemplateEditor
              template={editingTemplate}
              onSave={(template) => {
                if (editingTemplate) {
                  setTemplates(prev => prev.map(t => t.id === template.id ? template : t));
                } else {
                  setTemplates(prev => [...prev, template]);
                }
                setEditingTemplate(null);
                setIsCreatingTemplate(false);
                toast.success(editingTemplate ? "Template updated!" : "Template created!");
              }}
              onCancel={() => {
                setEditingTemplate(null);
                setIsCreatingTemplate(false);
              }}
            />
          )}

          {/* Templates List */}
          {!isCreatingTemplate && !editingTemplate && (
            templates.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-1">No templates yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create reusable outreach sequences to speed up your workflow
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <Card key={template.id} className="hover:border-primary/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium truncate">{template.name}</h3>
                          {template.description && (
                            <p className="text-sm text-muted-foreground truncate">{template.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {template.steps.length} step{template.steps.length !== 1 ? 's' : ''}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {template.steps.reduce((acc, s) => acc + s.delayDays, 0)} days total
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingTemplate(template)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setTemplates(prev => prev.filter(t => t.id !== template.id));
                              toast.success("Template deleted");
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          )}
        </div>
      ) : (
        /* Sequences List */
        displayedSequences.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                {view === 'active' ? (
                  <PlayCircle className="w-6 h-6 text-muted-foreground" />
                ) : view === 'ready' ? (
                  <Zap className="w-6 h-6 text-muted-foreground" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <h3 className="font-medium mb-1">
                {view === 'active' ? 'No active sequences' 
                  : view === 'ready' ? 'No opportunities ready' 
                  : 'No completed sequences'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {view === 'active' 
                  ? 'Start outreach on ready opportunities to begin tracking.' 
                  : view === 'ready'
                    ? 'Mark opportunities as ready for outreach from the Opportunities tab.'
                    : 'Completed sequences will appear here.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {displayedSequences.map((sequence) => (
              <SequenceCard 
                key={sequence.opportunity.id}
                sequence={sequence}
                onClick={() => setSelectedSequence(sequence)}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}

function SequenceCard({ 
  sequence, 
  onClick 
}: { 
  sequence: OutreachSequence;
  onClick: () => void;
}) {
  const { opportunity, totalTouches, lastTouchDate, nextAction } = sequence;
  
  const photoUrl = opportunity.photoReference 
    ? `/api/places/photo?ref=${encodeURIComponent(opportunity.photoReference)}&maxWidth=200`
    : null;

  const emailValue = opportunity.contactMethods.find(c => c.type === 'email')?.value;
  const instagramValue = opportunity.contactMethods.find(c => c.type === 'instagram')?.value;
  const phoneValue = opportunity.contactMethods.find(c => c.type === 'phone')?.value;

  const statusColors: Record<string, string> = {
    outreach_ready: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    sent: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    follow_up_due: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    replied: 'bg-green-500/10 text-green-600 border-green-500/20',
    closed: 'bg-muted text-muted-foreground',
  };

  const getDaysAgo = (date: string) => {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  const getDaysUntil = (date: string) => {
    const days = Math.floor((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Overdue';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  };

  return (
    <Card 
      className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md overflow-hidden group"
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="flex">
          {/* Image */}
          <div className="w-20 sm:w-24 shrink-0 relative bg-muted">
            {photoUrl ? (
              <img 
                src={photoUrl} 
                alt={opportunity.name}
                className="w-full h-full object-cover absolute inset-0"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                <MapPin className="w-6 h-6 text-primary/30" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-3 sm:p-4 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm sm:text-base truncate">{opportunity.name}</h3>
                <p className="text-xs text-muted-foreground">{typeLabels[opportunity.type]}</p>
              </div>
              <Badge className={`shrink-0 text-xs ${statusColors[opportunity.status] || ''}`}>
                {statusLabels[opportunity.status]}
              </Badge>
            </div>

            {/* Contact Info Row */}
            {(emailValue || instagramValue || phoneValue) && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2 overflow-hidden">
                {emailValue && (
                  <span className="flex items-center gap-1 truncate max-w-[140px]" title={emailValue}>
                    <Mail className="w-3 h-3 shrink-0 text-primary/70" />
                    <span className="truncate">{emailValue}</span>
                  </span>
                )}
                {instagramValue && (
                  <span className="flex items-center gap-1 truncate" title={instagramValue}>
                    <Instagram className="w-3 h-3 shrink-0 text-pink-500" />
                    <span className="truncate">{instagramValue.replace('https://instagram.com/', '@').replace('https://www.instagram.com/', '@')}</span>
                  </span>
                )}
                {phoneValue && !emailValue && !instagramValue && (
                  <span className="flex items-center gap-1" title={phoneValue}>
                    <Phone className="w-3 h-3 shrink-0 text-green-600" />
                    <span>{phoneValue}</span>
                  </span>
                )}
              </div>
            )}

            {/* Progress */}
            <div className="flex items-center gap-4 mb-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Send className="w-3 h-3" />
                <span>{totalTouches} {totalTouches === 1 ? 'touch' : 'touches'}</span>
              </div>
              {lastTouchDate && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>Last: {getDaysAgo(lastTouchDate)}</span>
                </div>
              )}
            </div>

            {/* Next Action */}
            {nextAction && (
              <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded-md ${
                nextAction.type === 'send_follow_up' && nextAction.dueDate && new Date(nextAction.dueDate) < new Date()
                  ? 'bg-orange-500/10 text-orange-600'
                  : 'bg-primary/10 text-primary'
              }`}>
                {nextAction.type === 'send_initial' && <Zap className="w-3 h-3" />}
                {nextAction.type === 'send_follow_up' && <Calendar className="w-3 h-3" />}
                {nextAction.type === 'check_reply' && <MessageSquare className="w-3 h-3" />}
                <span className="truncate">{nextAction.message}</span>
                {nextAction.dueDate && (
                  <span className="ml-auto shrink-0">{getDaysUntil(nextAction.dueDate)}</span>
                )}
              </div>
            )}
          </div>

          {/* Arrow */}
          <div className="flex items-center pr-3">
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Email sequence step type
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

function SequenceDetail({ 
  sequence, 
  onBack,
  onRefresh,
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

  const photoUrl = opportunity.photoReference 
    ? `/api/places/photo?ref=${encodeURIComponent(opportunity.photoReference)}&maxWidth=800`
    : null;

  // Load or create sequence steps
  useEffect(() => {
    const loadSequence = async () => {
      setIsLoadingSteps(true);
      try {
        // Try to fetch existing steps
        const res = await fetch(`/api/sequences?opportunityId=${opportunity.id}`);
        const data = await res.json();
        
        if (data.steps && data.steps.length > 0) {
          setSequenceSteps(data.steps);
        } else {
          // Create default 4-email sequence
          const createRes = await fetch('/api/sequences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ opportunityId: opportunity.id }),
          });
          const createData = await createRes.json();
          if (createData.steps) {
            setSequenceSteps(createData.steps);
          }
        }
      } catch (error) {
        console.error("Failed to load sequence:", error);
      } finally {
        setIsLoadingSteps(false);
      }
    };

    loadSequence();
  }, [opportunity.id]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short',
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleEditStep = (step: SequenceStep) => {
    setEditingStep(step);
    setEditSubject(step.subject || '');
    setEditBody(step.body);
    setEditDelay(step.delay_days);
  };

  const handleSaveEdit = async () => {
    if (!editingStep) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/sequences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId: editingStep.id,
          subject: editSubject,
          body: editBody,
          delay_days: editDelay,
        }),
      });
      
      if (res.ok) {
        // Refresh steps
        const refreshRes = await fetch(`/api/sequences?opportunityId=${opportunity.id}`);
        const data = await refreshRes.json();
        if (data.steps) setSequenceSteps(data.steps);
        setEditingStep(null);
        toast.success('Email updated!');
      }
    } catch (error) {
      toast.error('Failed to update');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!confirm('Delete this email from the sequence?')) return;
    try {
      const res = await fetch(`/api/sequences?stepId=${stepId}`, { method: 'DELETE' });
      if (res.ok) {
        const refreshRes = await fetch(`/api/sequences?opportunityId=${opportunity.id}`);
        const data = await refreshRes.json();
        setSequenceSteps(data.steps || []);
        toast.success('Email removed');
      }
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleAddStep = async () => {
    try {
      const res = await fetch('/api/sequences/add-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: opportunity.id,
          delay_days: 5,
        }),
      });
      
      if (res.ok) {
        const refreshRes = await fetch(`/api/sequences?opportunityId=${opportunity.id}`);
        const data = await refreshRes.json();
        if (data.steps) setSequenceSteps(data.steps);
        toast.success('Email added to sequence');
      }
    } catch (error) {
      toast.error('Failed to add');
    }
  };

  const handleSendStep = async (step: SequenceStep) => {
    // Find primary email contact
    const emailContact = opportunity.contactMethods.find(c => c.type === 'email');
    if (!emailContact?.value) {
      toast.error('No email address found for this opportunity');
      return;
    }
    try {
      // Check if email is connected first
      const statusRes = await fetch('/api/email/status');
      const statusData = await statusRes.json();
      if (!statusData.connected) {
        toast.error('Connect your email first — go to Profile to set it up');
        return;
      }
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailContact.value,
          toName: opportunity.name,
          subject: step.subject,
          body: `<p>${step.body.replace(/\n/g, '<br/>')}</p>`,
          opportunityId: opportunity.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      // Mark step as sent
      await fetch('/api/sequences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId: step.id, status: 'sent' }),
      });
      setSequenceSteps(prev => prev.map(s => s.id === step.id ? { ...s, status: 'sent' } : s));
      toast.success('Email sent!');
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send');
    }
  };

  const handleUpdateDelay = async (stepId: string, newDelay: number) => {
    if (newDelay < 1 || newDelay > 30) return;
    
    // Optimistic update
    setSequenceSteps(prev => prev.map(s => 
      s.id === stepId ? { ...s, delay_days: newDelay } : s
    ));

    try {
      await fetch('/api/sequences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId, delay_days: newDelay }),
      });
    } catch (error) {
      // Revert on error
      const refreshRes = await fetch(`/api/sequences?opportunityId=${opportunity.id}`);
      const data = await refreshRes.json();
      if (data.steps) setSequenceSteps(data.steps);
    }
  };

  // Show edit modal
  if (editingStep) {
    return (
      <div className="space-y-4">
        <button 
          onClick={() => setEditingStep(null)}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sequence
        </button>

        <h2 className="text-lg font-semibold">Edit Email #{editingStep.step_number}</h2>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Subject Line</Label>
            <Input
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              placeholder="Email subject..."
            />
          </div>

          <div className="space-y-2">
            <Label>Message Body</Label>
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              placeholder="Your message..."
              className="min-h-[200px]"
            />
          </div>

          {editingStep.step_number > 1 && (
            <div className="space-y-2">
              <Label>Days after previous email</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={editDelay}
                  onChange={(e) => setEditDelay(Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button 
              onClick={handleSaveEdit} 
              disabled={isSaving}
              className="flex-1"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
            <Button variant="outline" onClick={() => setEditingStep(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with image */}
      <div className="relative -mx-4 -mt-4 sm:-mx-6 sm:-mt-6">
        <div className="aspect-[21/9] bg-muted relative overflow-hidden">
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
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          
          <button 
            onClick={onBack}
            className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-sm text-sm font-medium hover:bg-background transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
              {typeLabels[opportunity.type]}
            </Badge>
            <Badge className={`${
              opportunity.status === 'replied' ? 'bg-green-500' :
              opportunity.status === 'follow_up_due' ? 'bg-orange-500' :
              opportunity.status === 'sent' ? 'bg-amber-500' :
              'bg-primary'
            } text-white`}>
              {statusLabels[opportunity.status]}
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">{opportunity.name}</h1>
          {opportunity.location && (
            <p className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" />
              {opportunity.location}
            </p>
          )}
        </div>
      </div>

      {/* Email Sequence Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email Sequence ({sequenceSteps.length} emails)
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={handleAddStep}>
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingSteps ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : sequenceSteps.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-4">No emails in sequence</p>
              <Button onClick={handleAddStep}>
                <Plus className="w-4 h-4 mr-2" />
                Create Sequence
              </Button>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-6 bottom-6 w-0.5 bg-border" />

              {sequenceSteps.map((step, idx) => {
                const isSent = step.status === 'sent';
                const isFirst = idx === 0;
                const isLast = idx === sequenceSteps.length - 1;
                const nextStep = !isLast ? sequenceSteps[idx + 1] : null;
                const scheduledDate = step.scheduled_at ? new Date(step.scheduled_at) : null;
                const isOverdue = scheduledDate && scheduledDate < new Date() && !isSent;

                return (
                  <div key={step.id}>
                    <div className="relative pl-10 pb-2">
                      {/* Timeline dot */}
                      <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${
                        isSent 
                          ? 'bg-green-500' 
                          : isOverdue 
                            ? 'bg-orange-500'
                            : 'bg-muted border-2 border-border'
                      }`}>
                        {isSent ? (
                          <Check className="w-3 h-3 text-white" />
                        ) : (
                          <span className="text-xs font-medium">{step.step_number}</span>
                        )}
                      </div>

                      {/* Email card */}
                      <div className={`rounded-lg border p-4 ${
                        isSent 
                          ? 'bg-green-500/5 border-green-500/20' 
                          : isOverdue 
                            ? 'bg-orange-500/5 border-orange-500/20'
                            : 'bg-card'
                      }`}>
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={isSent ? 'secondary' : 'outline'} className="text-xs">
                              {isFirst ? 'Initial Email' : `Follow-up #${step.step_number - 1}`}
                            </Badge>
                            {isSent && (
                              <Badge className="bg-green-500/20 text-green-700 border-0 text-xs">
                                Sent
                              </Badge>
                            )}
                            {isOverdue && !isSent && (
                              <Badge className="bg-orange-500/20 text-orange-700 border-0 text-xs">
                                Overdue
                              </Badge>
                            )}
                          </div>
                          {!isSent && (
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 w-7 p-0"
                                onClick={() => handleEditStep(step)}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              {sequenceSteps.length > 1 && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteStep(step.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Subject */}
                        {step.subject && (
                          <p className="text-sm font-medium mb-1">{step.subject}</p>
                        )}

                        {/* Body preview */}
                        <p className="text-sm text-muted-foreground line-clamp-2">{step.body}</p>

                        {/* Send button for pending emails */}
                        {!isSent && isFirst && (
                          <Button 
                            size="sm" 
                            className="mt-3"
                            onClick={() => handleSendStep(step)}
                          >
                            <Send className="w-3 h-3 mr-1" />
                            Send Now
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Delay selector between emails */}
                    {nextStep && nextStep.status !== 'sent' && (
                      <div className="relative pl-10 py-2">
                        <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-border" />
                        <div className="flex items-center gap-2 ml-1">
                          <div className="flex items-center bg-muted rounded-full">
                            <button
                              onClick={() => handleUpdateDelay(nextStep.id, nextStep.delay_days - 1)}
                              disabled={nextStep.delay_days <= 1}
                              className="w-7 h-7 flex items-center justify-center rounded-l-full hover:bg-muted-foreground/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 text-sm font-medium min-w-[3rem] text-center">
                              {nextStep.delay_days}d
                            </span>
                            <button
                              onClick={() => handleUpdateDelay(nextStep.id, nextStep.delay_days + 1)}
                              disabled={nextStep.delay_days >= 30}
                              className="w-7 h-7 flex items-center justify-center rounded-r-full hover:bg-muted-foreground/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-xs text-muted-foreground">until next email</span>
                        </div>
                      </div>
                    )}

                    {/* Spacing for sent emails without delay selector */}
                    {(isLast || (nextStep && nextStep.status === 'sent')) && (
                      <div className="h-4" />
                    )}
                  </div>
                );
              })}

              {/* Add more button at end */}
              <div className="relative pl-10">
                <div className="absolute left-2 w-5 h-5 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center">
                  <Plus className="w-3 h-3 text-muted-foreground" />
                </div>
                <Button variant="outline" size="sm" className="border-dashed" onClick={handleAddStep}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add Another Email
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contact Methods</CardTitle>
        </CardHeader>
        <CardContent>
          {opportunity.contactMethods.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contact methods added</p>
          ) : (
            <div className="space-y-2">
              {opportunity.contactMethods.map((cm) => {
                const Icon = getContactIcon(cm.type);
                return (
                  <div 
                    key={cm.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{cm.value}</span>
                      {cm.isPrimary && (
                        <Badge variant="secondary" className="text-xs">Primary</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {opportunity.status !== 'replied' && (
        <div className="flex gap-3">
          <Button 
            size="lg" 
            className="flex-1 h-14 rounded-xl"
            onClick={() => {
              startTransition(async () => {
                await updateOpportunity(opportunity.id, { status: 'replied' });
                await onRefresh();
                toast.success('Marked as replied!');
              });
            }}
            disabled={isPending}
          >
            {isPending ? <Spinner className="mr-2" /> : <MessageSquare className="w-5 h-5 mr-2" />}
            Mark as Replied
          </Button>
        </div>
      )}
    </div>
  );
}

function ComposeMessage({
  opportunity,
  type,
  onBack,
  onRefresh,
  existingMessages,
}: {
  opportunity: Opportunity;
  type: 'initial' | 'follow_up';
  onBack: () => void;
  onRefresh: () => Promise<void>;
  existingMessages: OutreachMessage[];
}) {
  const { profile } = useAurora();
  const [isPending, startTransition] = useTransition();
  const primaryContact = opportunity.contactMethods.find(c => c.isPrimary) || opportunity.contactMethods[0];
  const [selectedContact, setSelectedContact] = useState<ContactMethod | undefined>(primaryContact);

  const businessName = profile?.businessName || "my business";
  
  const defaultInitial = {
    subject: `Partnership Inquiry - ${businessName}`,
    body: `Hi there,

I'm reaching out from ${businessName}. I came across ${opportunity.name} and thought there might be a great opportunity for collaboration.

${profile?.pitch || "We offer professional services that could add value to your events/venue."}

I'd love to discuss how we might work together. Would you be open to a brief chat?

Best regards`,
  };

  const defaultFollowUp = {
    subject: `Following up - ${businessName}`,
    body: `Hi there,

I wanted to follow up on my previous message about a potential collaboration between ${businessName} and ${opportunity.name}.

I understand you're busy, but I'd love the chance to discuss how we could work together. Even a brief call would be great.

Let me know if you have any availability this week.

Best regards`,
  };

  const defaults = type === 'initial' ? defaultInitial : defaultFollowUp;
  const [subject, setSubject] = useState(defaults.subject);
  const [body, setBody] = useState(defaults.body);
  const [copied, setCopied] = useState(false);
  const [emailConnected, setEmailConnected] = useState<boolean | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetch('/api/email/status')
      .then(r => r.json())
      .then(d => setEmailConnected(d.connected))
      .catch(() => setEmailConnected(false));
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = async () => {
    if (!selectedContact?.value) return;
    setIsSending(true);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedContact.value,
          toName: opportunity.name,
          subject,
          body: `<p>${body.replace(/\n/g, '<br/>')}</p>`,
          opportunityId: opportunity.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      const result = await createOutreachMessage({
        opportunityId: opportunity.id,
        contactMethodId: selectedContact?.id,
        contactMethod: selectedContact?.value,
        type,
        subject,
        body,
        status: 'ready',
      });
      if (result.id) await markMessageAsSent(result.id);
      await onRefresh();
      toast.success("Email sent! Follow-up reminder created.");
      onBack();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkSent = () => {
    startTransition(async () => {
      const result = await createOutreachMessage({
        opportunityId: opportunity.id,
        contactMethodId: selectedContact?.id,
        contactMethod: selectedContact?.value,
        type,
        subject,
        body,
        status: 'ready',
      });
      if (result.id) {
        await markMessageAsSent(result.id);
      }
      await onRefresh();
      toast.success("Marked as sent! Follow-up reminder created.");
      onBack();
    });
  };

  const isEmail = selectedContact?.type === 'email';
  const ContactIcon = selectedContact ? getContactIcon(selectedContact.type) : Mail;

  return (
    <div className="space-y-4">
      <button 
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to sequence
      </button>

      <div className="space-y-1">
        <h1 className="text-xl font-bold">
          {type === 'initial' ? 'Initial Outreach' : 'Follow-up Message'}
        </h1>
        <p className="text-muted-foreground text-sm">
          Compose your message for {opportunity.name}
        </p>
      </div>

      {/* Contact selector */}
      {opportunity.contactMethods.length > 1 && (
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm font-medium mb-3 block">Send via</Label>
            <div className="flex flex-wrap gap-2">
              {opportunity.contactMethods.map((cm) => {
                const Icon = getContactIcon(cm.type);
                const isSelected = cm.id === selectedContact?.id;
                return (
                  <button
                    key={cm.id}
                    onClick={() => setSelectedContact(cm)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary hover:bg-secondary/80'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {contactMethodLabels[cm.type]}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Previous messages context */}
      {type === 'follow_up' && existingMessages.length > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Previous message sent:</p>
            <p className="text-sm line-clamp-3">
              {existingMessages[existingMessages.length - 1].body}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Compose form */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="p-3 bg-muted rounded-lg flex items-center gap-2">
            <ContactIcon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{selectedContact?.value || 'No contact selected'}</span>
          </div>

          {isEmail && (
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
          )}

          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea 
              value={body} 
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="resize-none"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleCopy}>
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            {isEmail && (
              <Button variant="outline" className="flex-1" asChild>
                <a href={`mailto:${selectedContact?.value}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Mail App
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isEmail && emailConnected === false && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">No email account connected</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Connect your email to send directly from Aurora.{' '}
                <a href="/api/email/connect" className="underline text-amber-600 hover:text-amber-700">Connect now</a>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {(!isEmail || emailConnected === false) && (
        <Card className="bg-muted/50 border-muted">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              Copy the message and send it manually. Click &quot;Mark as Sent&quot; to track it and schedule follow-up reminders.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 flex-col">
        {isEmail && emailConnected && (
          <Button 
            size="lg"
            className="w-full h-14 rounded-xl"
            onClick={handleSendEmail}
            disabled={isSending || !selectedContact}
          >
            {isSending ? <Spinner className="mr-2" /> : <Send className="w-5 h-5 mr-2" />}
            Send Email Now
          </Button>
        )}
        <div className="flex gap-3">
          <Button 
            variant="outline"
            size="lg"
            className="flex-1 h-14 rounded-xl"
            onClick={onBack}
          >
            Cancel
          </Button>
          <Button 
            size="lg"
            variant={isEmail && emailConnected ? "outline" : "default"}
            className="flex-1 h-14 rounded-xl"
            onClick={handleMarkSent}
            disabled={isPending || !selectedContact}
          >
            {isPending ? <Spinner className="mr-2" /> : <Check className="w-5 h-5 mr-2" />}
            Mark as Sent
          </Button>
        </div>
      </div>
    </div>
  );
}

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

// Template Editor Component
function TemplateEditor({
  template,
  onSave,
  onCancel,
}: {
  template: {
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
  } | null;
  onSave: (template: {
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
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [steps, setSteps] = useState(
    template?.steps || [
      { id: crypto.randomUUID(), type: 'email' as const, delayDays: 0, subject: "", body: "" }
    ]
  );

  const channelOptions = [
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'instagram', label: 'Instagram DM', icon: Instagram },
    { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
    { value: 'phone', label: 'Phone Call', icon: Phone },
  ];

  const addStep = () => {
    const lastStep = steps[steps.length - 1];
    setSteps([
      ...steps,
      {
        id: crypto.randomUUID(),
        type: 'email',
        delayDays: 3,
        subject: "",
        body: "",
      }
    ]);
  };

  const removeStep = (id: string) => {
    if (steps.length > 1) {
      setSteps(steps.filter(s => s.id !== id));
    }
  };

  const updateStep = (id: string, updates: Partial<typeof steps[0]>) => {
    setSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    if (steps.some(s => !s.body.trim())) {
      toast.error("All steps must have content");
      return;
    }

    onSave({
      id: template?.id || crypto.randomUUID(),
      name: name.trim(),
      description: description.trim() || undefined,
      steps,
      createdAt: template?.createdAt || new Date().toISOString(),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          {template ? "Edit Template" : "Create Sequence Template"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template Name */}
        <div className="space-y-2">
          <Label htmlFor="template-name">Template Name</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Wedding Venue Outreach"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="template-desc">Description (optional)</Label>
          <Input
            id="template-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of when to use this template"
          />
        </div>

        {/* Steps */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Sequence Steps</Label>
            <span className="text-xs text-muted-foreground">
              {steps.reduce((acc, s) => acc + s.delayDays, 0)} days total
            </span>
          </div>

          {steps.map((step, index) => (
            <Card key={step.id} className="bg-muted/30">
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Step {index + 1}
                    </Badge>
                    {index > 0 && (
                      <span className="text-xs text-muted-foreground">
                        +{step.delayDays} day{step.delayDays !== 1 ? 's' : ''} after previous
                      </span>
                    )}
                  </div>
                  {steps.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStep(step.id)}
                      className="h-7 w-7 p-0"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  )}
                </div>

                {/* Channel selector */}
                <div className="flex gap-1">
                  {channelOptions.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateStep(step.id, { type: opt.value as any })}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                          step.type === opt.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80"
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Delay (for steps after first) */}
                {index > 0 && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs shrink-0">Wait</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={step.delayDays}
                      onChange={(e) => updateStep(step.id, { delayDays: parseInt(e.target.value) || 1 })}
                      className="w-16 h-8 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">days before this step</span>
                  </div>
                )}

                {/* Subject (email only) */}
                {step.type === 'email' && (
                  <Input
                    value={step.subject || ""}
                    onChange={(e) => updateStep(step.id, { subject: e.target.value })}
                    placeholder="Email subject line..."
                    className="text-sm"
                  />
                )}

                {/* Message body - with prompts for email step 1 */}
                {step.type === 'email' && index === 0 ? (
                  <div className="space-y-2">
                    {/* Textarea with integrated hints */}
                    <div className="relative rounded-md border border-input bg-background">
                      <Textarea
                        value={step.body}
                        onChange={(e) => updateStep(step.id, { body: e.target.value })}
                        placeholder="Write your email message... Use {{name}} for venue name, {{your_name}} for your name"
                        rows={5}
                        className="text-sm resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      {/* Inline hints below textarea */}
                      <div className="border-t border-input bg-muted/30 px-3 py-2">
                        <p className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-primary" />
                          Tips for a great first email:
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          <span className="text-[10px] text-muted-foreground">• Introduce yourself</span>
                          <span className="text-[10px] text-muted-foreground">• Why them specifically</span>
                          <span className="text-[10px] text-muted-foreground">• Link to your work</span>
                          <span className="text-[10px] text-muted-foreground">• Clear next step</span>
                          <span className="text-[10px] text-muted-foreground">• Keep under 150 words</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Textarea
                    value={step.body}
                    onChange={(e) => updateStep(step.id, { body: e.target.value })}
                    placeholder={
                      step.type === 'instagram'
                        ? "Write your DM message..."
                        : step.type === 'phone'
                          ? "Write your call script or talking points..."
                          : "Write your message..."
                    }
                    rows={3}
                    className="text-sm resize-none"
                  />
                )}
              </CardContent>
            </Card>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={addStep}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Follow-up Step
          </Button>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            {template ? "Update Template" : "Save Template"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
