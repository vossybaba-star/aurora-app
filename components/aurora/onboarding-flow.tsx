"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { PlacesAutocomplete } from "./places-autocomplete";
import { useAurora } from "./aurora-app";
import { completeOnboarding } from "@/lib/actions";
import { ArrowLeft, ArrowRight, Sparkles, Check } from "lucide-react";
import type { Tone } from "@/lib/types";

const toneLabels: Record<Tone, string> = {
  friendly: "Friendly",
  professional: "Professional",
  premium: "Premium",
  casual: "Casual",
};

const businessTypeExamples = [
  "Wedding photographer",
  "DJ",
  "Food vendor",
  "Florist",
  "Personal trainer",
  "Makeup artist",
];

const opportunityExamples = [
  "Wedding bookings",
  "Event gigs",
  "Market stalls",
  "Corporate events",
  "Venue partnerships",
];

const tones: Tone[] = ["friendly", "professional", "premium", "casual"];

const steps = [
  { title: "About You", subtitle: "Tell Aurora what you do" },
  { title: "Opportunities", subtitle: "What are you looking for?" },
  { title: "Your Pitch", subtitle: "What makes you special?" },
  { title: "Preferences", subtitle: "How should Aurora work?" },
];

export function OnboardingFlow() {
  const router = useRouter();
  const { setAppState, onboardingStep, setOnboardingStep } = useAurora();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "",
    location: "",
    opportunities: [] as string[],
    customOpportunity: "",
    pitch: "",
    website: "",
    instagram: "",
    linkedin: "",
    phone: "",
    tone: "professional" as Tone,
    opportunitiesPerWeek: 5,
  });

  const updateFormData = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleOpportunity = (opp: string) => {
    setFormData((prev) => ({
      ...prev,
      opportunities: prev.opportunities.includes(opp)
        ? prev.opportunities.filter((o) => o !== opp)
        : [...prev.opportunities, opp],
    }));
  };

  const nextStep = () => {
    if (onboardingStep < steps.length - 1) {
      setOnboardingStep(onboardingStep + 1);
    } else {
      // Complete onboarding - save to database
      startTransition(async () => {
        setError(null);
        const result = await completeOnboarding({
          businessName: formData.businessName || formData.businessType,
          businessType: formData.businessType,
          location: formData.location,
          opportunityTypes: formData.opportunities,
          pitch: formData.pitch,
          website: formData.website || undefined,
          instagram: formData.instagram || undefined,
          linkedin: formData.linkedin || undefined,
          phone: formData.phone || undefined,
          tone: formData.tone,
          opportunitiesPerWeek: formData.opportunitiesPerWeek,
        });

        if (result.success) {
          setAppState("dashboard");
          router.refresh();
        } else {
          setError(result.error || "Failed to save profile");
        }
      });
    }
  };

  const prevStep = () => {
    if (onboardingStep > 0) {
      setOnboardingStep(onboardingStep - 1);
    } else {
      router.push("/");
    }
  };

  const canProceed = () => {
    switch (onboardingStep) {
      case 0:
        return formData.businessType.trim() !== "" && formData.location.trim() !== "";
      case 1:
        return formData.opportunities.length > 0;
      case 2:
        return formData.pitch.trim() !== "";
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="p-4 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prevStep} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                i <= onboardingStep ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <div className="w-10" />
      </header>

      {/* Content */}
      <main className="flex-1 px-6 pb-8 flex flex-col">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">{steps[onboardingStep].title}</h1>
          <p className="text-muted-foreground">{steps[onboardingStep].subtitle}</p>
        </div>

        <div className="flex-1 space-y-6">
          {onboardingStep === 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="businessType">What do you do?</Label>
                <Input
                  id="businessType"
                  placeholder="e.g., Wedding photographer"
                  value={formData.businessType}
                  onChange={(e) => updateFormData("businessType", e.target.value)}
                  className="h-12"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  {businessTypeExamples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => updateFormData("businessType", example)}
                      className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessName">Business name (optional)</Label>
                <Input
                  id="businessName"
                  placeholder="e.g., Sophie Captures Weddings"
                  value={formData.businessName}
                  onChange={(e) => updateFormData("businessName", e.target.value)}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Where are you based?</Label>
  <PlacesAutocomplete
  value={formData.location}
  onChange={(value) => updateFormData("location", value)}
  placeholder="e.g., London, UK"
  className="h-12"
  />
              </div>
            </>
          )}

          {onboardingStep === 1 && (
            <>
              <div className="space-y-3">
                <Label>What opportunities are you looking for?</Label>
                <div className="grid gap-2">
                  {opportunityExamples.map((opp) => (
                    <button
                      key={opp}
                      type="button"
                      onClick={() => toggleOpportunity(opp)}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                        formData.opportunities.includes(opp)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span className="font-medium">{opp}</span>
                      {formData.opportunities.includes(opp) && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customOpp">Add your own</Label>
                <div className="flex gap-2">
                  <Input
                    id="customOpp"
                    placeholder="e.g., Festival bookings"
                    value={formData.customOpportunity}
                    onChange={(e) => updateFormData("customOpportunity", e.target.value)}
                    className="h-12"
                  />
                  <Button
                    variant="secondary"
                    className="h-12 px-4"
                    onClick={() => {
                      if (formData.customOpportunity.trim()) {
                        toggleOpportunity(formData.customOpportunity.trim());
                        updateFormData("customOpportunity", "");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </>
          )}

          {onboardingStep === 2 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="pitch">What makes your business special?</Label>
                <Textarea
                  id="pitch"
                  placeholder="Tell Aurora about your unique selling points, experience, awards, or specialties..."
                  value={formData.pitch}
                  onChange={(e) => updateFormData("pitch", e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website (optional)</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="www.yourbusiness.com"
                  value={formData.website}
                  onChange={(e) => updateFormData("website", e.target.value)}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram (optional)</Label>
                <Input
                  id="instagram"
                  placeholder="@yourbusiness"
                  value={formData.instagram}
                  onChange={(e) => updateFormData("instagram", e.target.value)}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedin">LinkedIn (optional)</Label>
                <Input
                  id="linkedin"
                  placeholder="linkedin.com/in/you"
                  value={formData.linkedin}
                  onChange={(e) => updateFormData("linkedin", e.target.value)}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+44 7700 123456"
                  value={formData.phone}
                  onChange={(e) => updateFormData("phone", e.target.value)}
                  className="h-12"
                />
              </div>
            </>
          )}

          {onboardingStep === 3 && (
            <>
              <div className="space-y-3">
                <Label>Preferred tone for outreach</Label>
                <div className="grid grid-cols-2 gap-2">
                  {tones.map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => updateFormData("tone", tone)}
                      className={`p-4 rounded-xl border text-center transition-all ${
                        formData.tone === tone
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span className="font-medium capitalize">{toneLabels[tone]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>How many opportunities per week?</Label>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    onClick={() =>
                      updateFormData(
                        "opportunitiesPerWeek",
                        Math.max(1, formData.opportunitiesPerWeek - 1)
                      )
                    }
                  >
                    -
                  </Button>
                  <span className="text-3xl font-bold w-12 text-center">
                    {formData.opportunitiesPerWeek}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    onClick={() =>
                      updateFormData(
                        "opportunitiesPerWeek",
                        Math.min(20, formData.opportunitiesPerWeek + 1)
                      )
                    }
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* Preview card */}
              <Card className="mt-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Your Aurora Profile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-balance">
                    You are a <span className="font-medium text-foreground">{formData.businessType || "[business type]"}</span> based in{" "}
                    <span className="font-medium text-foreground">{formData.location || "[location]"}</span>, looking for{" "}
                    <span className="font-medium text-foreground">
                      {formData.opportunities.length > 0
                        ? formData.opportunities.join(", ").toLowerCase()
                        : "[opportunities]"}
                    </span>
                    . Aurora will find{" "}
                    <span className="font-medium text-foreground">{formData.opportunitiesPerWeek}</span>{" "}
                    opportunities per week.
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
            {error}
          </div>
        )}

        <div className="pt-6">
          <Button
            size="lg"
            className="w-full h-14 text-base rounded-xl"
            onClick={nextStep}
            disabled={!canProceed() || isPending}
          >
            {isPending ? (
              <>
                <Spinner className="mr-2" />
                Saving...
              </>
            ) : onboardingStep === steps.length - 1 ? (
              <>
                Start Finding Opportunities
                <Sparkles className="ml-2 w-4 h-4" />
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="ml-2 w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
