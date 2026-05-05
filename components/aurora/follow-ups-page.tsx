"use client";

import { useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAurora } from "./aurora-app";
import { completeFollowUpTask, snoozeFollowUpTask } from "@/lib/actions";
import { typeLabels } from "@/lib/types";
import type { FollowUpTask, Opportunity } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { 
  Clock, 
  Send, 
  Calendar, 
  MessageSquare,
  AlertTriangle,
  Sparkles,
  Check,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(dateString);
}

export function FollowUpsPage() {
  const { followUpTasks, opportunities, refreshData } = useAurora();

  const today = new Date().toISOString().split("T")[0];
  
  // Filter and sort follow-ups
  const pendingFollowUps = followUpTasks.filter(f => f.status === 'pending');
  const urgentFollowUps = pendingFollowUps.filter(f => f.dueDate <= today);
  const upcomingFollowUps = pendingFollowUps.filter(f => f.dueDate > today);

  // Get opportunities that have been sent but no follow-up task yet
  const sentOpportunities = opportunities.filter(
    o => o.status === 'sent' && !pendingFollowUps.some(f => f.opportunityId === o.id)
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Follow-ups</h1>
        <p className="text-muted-foreground">
          {pendingFollowUps.length} follow-ups pending
        </p>
      </div>

      {/* Urgent Follow-ups */}
      {urgentFollowUps.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Due now</h2>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {urgentFollowUps.length}
            </Badge>
          </div>
          <div className="space-y-3">
            {urgentFollowUps.map((task) => (
              <FollowUpCard 
                key={task.id} 
                task={task} 
                opportunities={opportunities}
                onRefresh={refreshData}
                urgent 
              />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Follow-ups */}
      {upcomingFollowUps.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold">Upcoming</h2>
          </div>
          <div className="space-y-3">
            {upcomingFollowUps.map((task) => (
              <FollowUpCard 
                key={task.id} 
                task={task} 
                opportunities={opportunities}
                onRefresh={refreshData}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recently Sent (waiting for response) */}
      {sentOpportunities.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold">Waiting for response</h2>
          </div>
          <div className="space-y-3">
            {sentOpportunities.map((opp) => (
              <Card key={opp.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-medium truncate">{opp.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {typeLabels[opp.type]} &middot; {opp.location || "No location"}
                      </p>
                    </div>
                    <Badge variant="secondary">Sent</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Outreach sent {formatRelativeDate(opp.updatedAt)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {pendingFollowUps.length === 0 && sentOpportunities.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1">No follow-ups needed</h3>
            <p className="text-sm text-muted-foreground">
              When you reach out to opportunities, Aurora will remind you to follow up.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FollowUpCard({ 
  task, 
  opportunities,
  onRefresh,
  urgent = false 
}: { 
  task: FollowUpTask;
  opportunities: Opportunity[];
  onRefresh: () => Promise<void>;
  urgent?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const opportunity = opportunities.find(o => o.id === task.opportunityId);
  
  if (!opportunity) return null;

  const isOverdue = new Date(task.dueDate) < new Date();

  const handleComplete = () => {
    startTransition(async () => {
      await completeFollowUpTask(task.id);
      await onRefresh();
      toast.success("Follow-up marked as complete!");
    });
  };

  const handleSnooze = (days: number) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + days);
    
    startTransition(async () => {
      await snoozeFollowUpTask(task.id, newDate.toISOString());
      await onRefresh();
      toast.success(`Snoozed for ${days} day${days > 1 ? 's' : ''}`);
    });
  };

  return (
    <Card className={urgent ? "border-primary/50 bg-primary/5" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="space-y-1 min-w-0">
            <h3 className="font-medium truncate">{opportunity.name}</h3>
            <p className="text-sm text-muted-foreground">
              {typeLabels[opportunity.type]} &middot; {opportunity.location || "No location"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {urgent && (
              <Badge className="bg-primary/10 text-primary shrink-0">
                {isOverdue ? 'Overdue' : 'Due'}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={isPending}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleComplete}>
                  <Check className="w-4 h-4 mr-2" />
                  Mark complete
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSnooze(1)}>
                  Snooze 1 day
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSnooze(3)}>
                  Snooze 3 days
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSnooze(7)}>
                  Snooze 1 week
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Suggested Action */}
        <div className="flex items-start gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
          <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-sm">{task.suggestedAction}</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Due: {formatDate(task.dueDate)}
            </span>
          </div>
          <Button 
            size="sm" 
            className={urgent ? "" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}
            onClick={handleComplete}
            disabled={isPending}
          >
            {isPending ? (
              <Spinner className="w-4 h-4" />
            ) : (
              <>
                <Send className="mr-1.5 w-4 h-4" />
                {urgent ? "Send follow-up" : "Follow up"}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
