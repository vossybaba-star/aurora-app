"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Search, Mail, Bell, Zap } from "lucide-react";

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass-header sticky top-0 z-50 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl fluid-gradient flex items-center justify-center shadow-md">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-gradient">Aurora</span>
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground font-medium" asChild>
          <Link href="/auth/login">Sign in</Link>
        </Button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-8 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-primary/8 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-24 w-64 h-64 rounded-full bg-purple-300/10 blur-3xl pointer-events-none" />

        <div className="max-w-sm w-full text-center space-y-5 relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-card text-xs font-semibold text-primary border-primary/10 mb-2">
            <Zap className="w-3.5 h-3.5 fill-primary" />
            AI-powered outreach for independents
          </div>

          {/* Wordmark icon */}
          <div className="w-20 h-20 mx-auto rounded-3xl fluid-gradient flex items-center justify-center shadow-xl shadow-primary/25 mb-2">
            <Sparkles className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-balance leading-tight text-foreground">
            Get more bookings without chasing people manually.
          </h1>

          <p className="text-muted-foreground text-base leading-relaxed text-pretty">
            Tell Aurora what you do. Aurora finds relevant opportunities, writes the outreach, and reminds you when to follow up.
          </p>

          <div className="pt-3 space-y-3">
            <Button
              size="lg"
              className="w-full h-14 text-base rounded-2xl font-bold fluid-gradient border-0 shadow-lg shadow-primary/30 hover:opacity-90 hover:shadow-primary/40 transition-all active:scale-[0.98]"
              asChild
            >
              <Link href="/auth/sign-up">
                Get started free
                <ArrowRight className="ml-2 w-4.5 h-4.5" />
              </Link>
            </Button>

            <Button
              variant="ghost"
              className="w-full text-muted-foreground text-sm"
              asChild
            >
              <Link href="/auth/login">
                Already have an account? Sign in
              </Link>
            </Button>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-14 w-full max-w-sm space-y-3 relative z-10">
          <FeatureCard
            icon={<Search className="w-5 h-5 text-primary" />}
            title="Find opportunities"
            description="Aurora searches for venues, planners, and clients that match your business"
          />
          <FeatureCard
            icon={<Mail className="w-5 h-5 text-primary" />}
            title="Prepare outreach"
            description="Get ready-to-send emails and messages written in your tone"
          />
          <FeatureCard
            icon={<Bell className="w-5 h-5 text-primary" />}
            title="Never miss a follow-up"
            description="Aurora reminds you when it's time to follow up"
          />
        </div>

        {/* Social proof */}
        <div className="mt-10 text-center text-xs text-muted-foreground/60 relative z-10">
          For photographers · DJs · makeup artists · food vendors · freelancers
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="glass-card glass-card-hover flex items-start gap-4 p-4 rounded-2xl">
      <div className="w-10 h-10 rounded-xl fluid-gradient-subtle flex items-center justify-center shrink-0 border border-primary/10">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-sm text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
