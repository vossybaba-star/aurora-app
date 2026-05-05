"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Search, Mail, Bell } from "lucide-react";

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg">Aurora</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/auth/login">Sign in</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        <div className="max-w-md text-center space-y-6">
          {/* Aurora sparkle icon */}
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-8">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-balance">
            Get more bookings without chasing people manually.
          </h1>

          <p className="text-muted-foreground text-lg leading-relaxed text-pretty">
            Tell Aurora what you do. Aurora finds relevant opportunities, writes the outreach, and reminds you when to follow up.
          </p>

          <div className="pt-4 space-y-3">
            <Button 
              size="lg" 
              className="w-full h-14 text-base rounded-xl"
              asChild
            >
              <Link href="/auth/sign-up">
                Get started free
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
            
            <Button 
              variant="ghost" 
              className="text-muted-foreground"
              asChild
            >
              <Link href="/auth/login">
                Already have an account? Sign in
              </Link>
            </Button>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-16 w-full max-w-md space-y-3">
          <FeatureCard 
            icon={<Search className="w-5 h-5" />}
            title="Find opportunities"
            description="Aurora searches for venues, planners, and events that match your business"
          />
          <FeatureCard 
            icon={<Mail className="w-5 h-5" />}
            title="Prepare outreach"
            description="Get ready-to-send emails and messages written in your tone"
          />
          <FeatureCard 
            icon={<Bell className="w-5 h-5" />}
            title="Never miss a follow-up"
            description="Aurora reminds you when it&apos;s time to follow up"
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
}) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border/50">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
        {icon}
      </div>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
