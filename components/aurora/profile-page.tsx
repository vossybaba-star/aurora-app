"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PlacesAutocomplete } from "./places-autocomplete";
import { useAurora } from "./aurora-app";
import { updateProfile, signOut } from "@/lib/actions";
import { toneLabels } from "@/lib/types";
import type { Tone, UserProfile } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { 
  Sparkles, 
  MapPin, 
  Target, 
  MessageSquare, 
  Link as LinkIcon,
  Instagram,
  Linkedin,
  Phone,
  Briefcase,
  Check,
  X,
  Mail,
  LogOut,
  ChevronRight,
  Zap,
  Globe,
  Edit2,
} from "lucide-react";

// ============ HELPER COMPONENTS ============

// Pitch prompts based on business type
const pitchPrompts: Record<string, { placeholder: string; prompts: string[] }> = {
  photographer: {
    placeholder: "I'm a wedding and events photographer based in...",
    prompts: [
      "What's your photography style? (documentary, editorial, fine art)",
      "What type of events do you shoot?",
      "What makes your approach unique?",
      "How long have you been shooting professionally?",
    ],
  },
  videographer: {
    placeholder: "I create cinematic wedding films that...",
    prompts: [
      "What's your filmmaking style? (cinematic, documentary, storytelling)",
      "What deliverables do you offer? (highlights, full films)",
      "What equipment do you use?",
      "What makes your films stand out?",
    ],
  },
  florist: {
    placeholder: "I design bespoke floral arrangements for...",
    prompts: [
      "What's your signature style? (wild, structured, romantic)",
      "What events do you specialize in?",
      "Do you offer installation services?",
      "What makes your arrangements unique?",
    ],
  },
  caterer: {
    placeholder: "We craft memorable dining experiences for...",
    prompts: [
      "What cuisine do you specialize in?",
      "What size events do you cater?",
      "Do you accommodate dietary requirements?",
      "What makes your food memorable?",
    ],
  },
  baker: {
    placeholder: "I create custom cakes and desserts for...",
    prompts: [
      "What are your signature creations?",
      "What styles do you specialize in?",
      "Do you offer tastings?",
      "What makes your bakes special?",
    ],
  },
  musician: {
    placeholder: "I perform live music that creates the perfect...",
    prompts: [
      "What genre/style do you perform?",
      "What's your setup? (solo, duo, band)",
      "What atmosphere do you create?",
      "What events have you performed at?",
    ],
  },
  dj: {
    placeholder: "I curate music experiences that get everyone...",
    prompts: [
      "What genres do you specialize in?",
      "What equipment do you bring?",
      "How do you read the room?",
      "What makes your sets memorable?",
    ],
  },
  makeup: {
    placeholder: "I specialize in bridal and editorial makeup that...",
    prompts: [
      "What's your makeup style? (natural, glamorous, editorial)",
      "Do you offer trials?",
      "Do you travel to venues?",
      "What makes your work stand out?",
    ],
  },
  hair: {
    placeholder: "I create stunning bridal and event hairstyles...",
    prompts: [
      "What styles do you specialize in?",
      "Do you offer trials?",
      "Do you travel to venues?",
      "What makes your styling unique?",
    ],
  },
  default: {
    placeholder: "I help businesses create memorable experiences by...",
    prompts: [
      "What services do you offer?",
      "Who is your ideal client?",
      "What makes you different from others?",
      "What value do you bring to events?",
    ],
  },
};

function getPitchPrompts(businessType: string): { placeholder: string; prompts: string[] } {
  const bt = businessType?.toLowerCase() || "";
  for (const [key, value] of Object.entries(pitchPrompts)) {
    if (key !== "default" && bt.includes(key)) {
      return value;
    }
  }
  return pitchPrompts.default;
}

function PitchEditor({
  value,
  onChange,
  businessType,
  isPending,
  onSave,
  onCancel,
}: {
  value: string;
  onChange: (value: string) => void;
  businessType: string;
  isPending: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { placeholder, prompts } = getPitchPrompts(businessType);
  const [showPrompts, setShowPrompts] = useState(!value);

  return (
    <div className="space-y-3">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="resize-none"
        placeholder={placeholder}
      />
      
      {/* Contextual prompts */}
      {showPrompts && (
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-primary" />
            Think about including:
          </p>
          <ul className="space-y-1.5">
            {prompts.map((prompt, i) => (
              <li 
                key={i} 
                className="text-xs text-muted-foreground flex items-start gap-2"
              >
                <span className="text-primary mt-0.5">Ã¢ÂÂ¢</span>
                {prompt}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowPrompts(!showPrompts)}
          className="text-xs text-primary hover:underline"
        >
          {showPrompts ? "Hide tips" : "Show writing tips"}
        </button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={isPending}>
            {isPending ? <Spinner className="w-4 h-4" /> : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Profile completion prompts based on business type
function ProfileCompletionPrompts({
  profile,
  onEditPitch,
  onEditLocation,
  onEditOpportunityTypes,
  onEditWebsite,
  onEditInstagram,
}: {
  profile: UserProfile;
  onEditPitch: () => void;
  onEditLocation: () => void;
  onEditOpportunityTypes: () => void;
  onEditWebsite: () => void;
  onEditInstagram: () => void;
}) {
  const prompts: { icon: React.ReactNode; text: string; action: () => void; priority: number }[] = [];
  const bt = profile.businessType?.toLowerCase() || "";

  if (!profile.pitch) {
    let pitchPrompt = "Add a pitch to help Aurora write better outreach";
    if (bt.includes("photo")) {
      pitchPrompt = "Describe your photography style and what makes your work unique";
    } else if (bt.includes("video")) {
      pitchPrompt = "Share what type of videos you create and your creative approach";
    } else if (bt.includes("flor")) {
      pitchPrompt = "Describe your floral design style and signature arrangements";
    } else if (bt.includes("cater")) {
      pitchPrompt = "Tell venues about your cuisine style and what events you specialize in";
    } else if (bt.includes("music") || bt.includes("dj")) {
      pitchPrompt = "Share your music style and the atmosphere you create at events";
    } else if (bt.includes("makeup") || bt.includes("hair") || bt.includes("beauty")) {
      pitchPrompt = "Describe your beauty style and the looks you specialize in";
    } else if (bt.includes("bak")) {
      pitchPrompt = "Share what you bake and your signature creations";
    }
    prompts.push({ 
      icon: <MessageSquare className="w-4 h-4" />, 
      text: pitchPrompt, 
      action: onEditPitch,
      priority: 1 
    });
  }

  if (!profile.location) {
    prompts.push({ 
      icon: <MapPin className="w-4 h-4" />, 
      text: "Add your location so Aurora finds nearby opportunities", 
      action: onEditLocation,
      priority: 2 
    });
  }

  if (profile.opportunityTypes.length === 0) {
    let oppPrompt = "Select what types of clients you're looking for";
    if (bt.includes("photo") || bt.includes("video")) {
      oppPrompt = "Select venue types - wedding venues, hotels, brands?";
    } else if (bt.includes("flor")) {
      oppPrompt = "Who do you want to work with - wedding planners, hotels, events?";
    } else if (bt.includes("cater")) {
      oppPrompt = "What events do you cater - weddings, corporate, private parties?";
    }
    prompts.push({ 
      icon: <Target className="w-4 h-4" />, 
      text: oppPrompt, 
      action: onEditOpportunityTypes,
      priority: 3 
    });
  }

  if (!profile.website && !profile.instagram) {
    let linkPrompt = "Add your website or Instagram so venues can see your work";
    if (bt.includes("photo") || bt.includes("video")) {
      linkPrompt = "Add your portfolio link or Instagram to showcase your work";
    }
    prompts.push({ 
      icon: <LinkIcon className="w-4 h-4" />, 
      text: linkPrompt, 
      action: profile.instagram ? onEditWebsite : onEditInstagram,
      priority: 4 
    });
  }

  if (prompts.length === 0) return null;

  const topPrompts = prompts.sort((a, b) => a.priority - b.priority).slice(0, 2);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground px-1 flex items-center gap-1">
        <Sparkles className="w-3 h-3 text-primary" />
        Complete your profile
      </p>
      {topPrompts.map((prompt, i) => (
        <button
          key={i}
          onClick={prompt.action}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            {prompt.icon}
          </div>
          <p className="text-sm">{prompt.text}</p>
          <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
        </button>
      ))}
    </div>
  );
}

// All available opportunity types with descriptions
const opportunityTypeOptions = [
  { value: "restaurant", label: "Restaurants", description: "Cafes, bars, fine dining" },
  { value: "hotel", label: "Hotels", description: "Hotels, resorts, B&Bs" },
  { value: "venue", label: "Event Venues", description: "Wedding venues, event spaces" },
  { value: "wedding_planner", label: "Wedding Planners", description: "Wedding & event coordinators" },
  { value: "event_organiser", label: "Event Organisers", description: "Corporate events, festivals" },
  { value: "market", label: "Markets", description: "Farmers markets, craft fairs" },
  { value: "agency", label: "Agencies", description: "Creative, marketing, PR agencies" },
  { value: "brand", label: "Brands", description: "Product brands, startups" },
  { value: "publication", label: "Publications", description: "Magazines, blogs, media" },
  { value: "retail", label: "Retail Stores", description: "Shops, boutiques, galleries" },
  { value: "corporate", label: "Corporate", description: "Office events, team building" },
  { value: "private", label: "Private Events", description: "Birthdays, anniversaries" },
];

// Suggestions based on business type
const businessTypeSuggestions: Record<string, string[]> = {
  photographer: ["wedding_planner", "venue", "hotel", "brand", "agency", "publication"],
  videographer: ["wedding_planner", "venue", "brand", "agency", "corporate"],
  florist: ["wedding_planner", "venue", "hotel", "restaurant", "event_organiser"],
  caterer: ["wedding_planner", "venue", "corporate", "private", "event_organiser"],
  baker: ["wedding_planner", "restaurant", "market", "retail", "private"],
  musician: ["venue", "wedding_planner", "restaurant", "hotel", "event_organiser"],
  dj: ["venue", "wedding_planner", "corporate", "private", "event_organiser"],
  makeup: ["wedding_planner", "agency", "brand", "publication", "private"],
  hair: ["wedding_planner", "agency", "brand", "publication", "private"],
  default: ["venue", "wedding_planner", "event_organiser", "brand", "agency"],
};

function OpportunityTypeSelector({
  selected,
  businessType,
  isPending,
  onSave,
  onCancel,
}: {
  selected: string[];
  businessType: string;
  isPending: boolean;
  onSave: (types: string[]) => void;
  onCancel: () => void;
}) {
  const [localSelected, setLocalSelected] = useState<string[]>(selected);

  const businessTypeLower = businessType.toLowerCase();
  const suggestedTypes = Object.entries(businessTypeSuggestions).find(
    ([key]) => businessTypeLower.includes(key)
  )?.[1] || businessTypeSuggestions.default;

  const toggleType = (value: string) => {
    setLocalSelected(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const suggestedOptions = opportunityTypeOptions.filter(opt => suggestedTypes.includes(opt.value));
  const otherOptions = opportunityTypeOptions.filter(opt => !suggestedTypes.includes(opt.value));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-primary mb-2 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Suggested for {businessType || "your business"}
        </p>
        <div className="flex flex-wrap gap-2">
          {suggestedOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleType(opt.value)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                localSelected.includes(opt.value)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:border-primary/50"
              }`}
            >
              {localSelected.includes(opt.value) && <Check className="w-3 h-3 inline mr-1" />}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Other opportunities</p>
        <div className="flex flex-wrap gap-2">
          {otherOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleType(opt.value)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                localSelected.includes(opt.value)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:border-primary/50"
              }`}
            >
              {localSelected.includes(opt.value) && <Check className="w-3 h-3 inline mr-1" />}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => onSave(localSelected)} disabled={isPending}>
          {isPending ? <Spinner className="w-4 h-4" /> : `Save (${localSelected.length})`}
        </Button>
      </div>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  disabled?: boolean;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm font-medium pl-7 mt-0.5">{value || "Not set"}</p>
    </div>
  );
}

// ============ MAIN COMPONENT ============

export function ProfilePage() {
  const router = useRouter();
  const { profile, setProfile } = useAurora();
  const [isPending, startTransition] = useTransition();
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [emailConnected, setEmailConnected] = useState<boolean>(false);

  // Check email connection
  useEffect(() => {
    fetch('/api/email/status')
      .then(res => res.json())
      .then(data => setEmailConnected(data.connected))
      .catch(() => setEmailConnected(false));
  }, []);

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  const startEdit = (section: string, value: string) => {
    setEditingSection(section);
    setEditValue(value);
  };

  const saveEdit = () => {
    if (!profile) return;
    
    startTransition(async () => {
      const updates: Partial<Parameters<typeof updateProfile>[0]> = {};
      
      switch (editingSection) {
        case "businessType":
          updates.businessType = editValue;
          break;
        case "businessName":
          updates.businessName = editValue;
          break;
        case "location":
          updates.location = editValue;
          break;
        case "pitch":
          updates.pitch = editValue;
          break;
        case "website":
          updates.website = editValue;
          break;
        case "instagram":
          updates.instagram = editValue;
          break;
        case "linkedin":
          updates.linkedin = editValue;
          break;
        case "phone":
          updates.phone = editValue;
          break;
      }
      
      const result = await updateProfile(updates);
      if (result.success) {
        const updatedProfile: UserProfile = { 
          ...profile, 
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        setProfile(updatedProfile);
        toast.success("Profile updated!");
      } else {
        toast.error(result.error || "Failed to update profile");
      }
      setEditingSection(null);
    });
  };

  const cancelEdit = () => {
    setEditingSection(null);
    setEditValue("");
  };

  const handleToneChange = (tone: Tone) => {
    startTransition(async () => {
      const result = await updateProfile({ tone });
      if (result.success) {
        setProfile({ ...profile, tone, updatedAt: new Date().toISOString() });
      }
    });
  };

  const handleOpportunitiesChange = (delta: number) => {
    const newValue = Math.max(1, Math.min(20, profile.opportunitiesPerWeek + delta));
    startTransition(async () => {
      const result = await updateProfile({ opportunitiesPerWeek: newValue });
      if (result.success) {
        setProfile({ ...profile, opportunitiesPerWeek: newValue, updatedAt: new Date().toISOString() });
      }
    });
  };

  const handleSignOut = () => {
    startTransition(async () => {
      await signOut();
      router.push("/");
      router.refresh();
    });
  };

  const tones: Tone[] = ["friendly", "professional", "premium", "casual"];

  // Calculate profile completion
  const completionItems = [
    { done: !!profile.businessName, label: "Business name" },
    { done: !!profile.location, label: "Location" },
    { done: !!profile.pitch, label: "Pitch" },
    { done: profile.opportunityTypes.length > 0, label: "Opportunity types" },
    { done: !!profile.website || !!profile.instagram, label: "Contact info" },
  ];
  const completedCount = completionItems.filter(i => i.done).length;
  const completionPercent = Math.round((completedCount / completionItems.length) * 100);

  return (
    <div className="space-y-6 pb-8">
      {/* Hero Header */}
      <div className="relative -mx-4 -mt-4 px-4 pt-8 pb-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-lg">
            {(profile.businessName || profile.businessType || "A").charAt(0).toUpperCase()}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">
              {profile.businessName || profile.businessType || "Your Business"}
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              {profile.businessType}
            </p>
            {profile.location && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{profile.location.split(',')[0]}</span>
              </p>
            )}
          </div>
        </div>

        {/* Progress Ring */}
        <div className="absolute top-6 right-4">
          <div className="relative w-14 h-14">
            <svg className="w-14 h-14 -rotate-90">
              <circle
                cx="28"
                cy="28"
                r="24"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-muted/30"
              />
              <circle
                cx="28"
                cy="28"
                r="24"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeDasharray={150.8}
                strokeDashoffset={150.8 - (150.8 * completionPercent / 100)}
                className="text-primary transition-all duration-500"
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
              {completionPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Profile Completion Prompts */}
      {completionPercent < 100 && (
        <ProfileCompletionPrompts 
          profile={profile}
          onEditPitch={() => startEdit("pitch", profile.pitch || "")}
          onEditLocation={() => startEdit("location", profile.location || "")}
          onEditOpportunityTypes={() => setEditingSection("opportunityTypes")}
          onEditWebsite={() => startEdit("website", profile.website || "")}
          onEditInstagram={() => startEdit("instagram", profile.instagram || "")}
        />
      )}

      {/* Email Connection Status */}
      <Card className={emailConnected ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                emailConnected ? "bg-green-500/20" : "bg-amber-500/20"
              }`}>
                <Mail className={`w-5 h-5 ${emailConnected ? "text-green-500" : "text-amber-500"}`} />
              </div>
              <div>
                <p className="font-medium text-sm">Email Connection</p>
                <p className="text-xs text-muted-foreground">
                  {emailConnected ? "Connected and ready to send" : "Connect to send emails from Aurora"}
                </p>
              </div>
            </div>
            {emailConnected ? (
              <Badge className="bg-green-500/20 text-green-600 border-0">Connected</Badge>
            ) : (
              <Button size="sm" variant="outline" onClick={() => window.location.href = '/api/email/connect'}>
                Connect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Business Details Section */}
      <div className="space-y-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
          Business Details
        </h2>
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            <SettingsRow
              icon={<Briefcase className="w-4 h-4" />}
              label="Business name"
              value={profile.businessName || "Not set"}
              editing={editingSection === "businessName"}
              editValue={editValue}
              isPending={isPending}
              onEdit={() => startEdit("businessName", profile.businessName || "")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              onChange={setEditValue}
            />
            <SettingsRow
              icon={<Target className="w-4 h-4" />}
              label="Business type"
              value={profile.businessType || "Not set"}
              editing={editingSection === "businessType"}
              editValue={editValue}
              isPending={isPending}
              onEdit={() => startEdit("businessType", profile.businessType || "")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              onChange={setEditValue}
            />
            
            {/* Location with Places Autocomplete */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground"><MapPin className="w-4 h-4" /></span>
                  <span className="text-sm text-muted-foreground">Location</span>
                </div>
                {editingSection !== "location" && (
                  <button 
                    onClick={() => startEdit("location", profile.location || "")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
              {editingSection === "location" ? (
                <div className="mt-2 space-y-2 pl-7">
                  <PlacesAutocomplete
                    value={editValue}
                    onChange={setEditValue}
                    placeholder="Enter your location"
                    className="h-9"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={isPending}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveEdit} disabled={isPending}>
                      {isPending ? <Spinner className="w-4 h-4" /> : "Save"}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-medium pl-7 mt-0.5">{profile.location || "Not set"}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Your Pitch Section */}
      <div className="space-y-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
          Your Pitch
        </h2>
        <Card>
          <CardContent className="p-4">
            {editingSection === "pitch" ? (
              <PitchEditor
                value={editValue}
                onChange={setEditValue}
                businessType={profile.businessType}
                isPending={isPending}
                onSave={saveEdit}
                onCancel={cancelEdit}
              />
            ) : (
              <div 
                className="group cursor-pointer" 
                onClick={() => startEdit("pitch", profile.pitch || "")}
              >
                <div className="flex items-start justify-between">
                  <p className="text-sm leading-relaxed">
                    {profile.pitch || (
                      <span className="text-muted-foreground italic">
                        Add a compelling pitch to help Aurora craft better messages...
                      </span>
                    )}
                  </p>
                  <Edit2 className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Looking For Section */}
      <div className="space-y-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
          Looking For
        </h2>
        <Card>
          <CardContent className="p-4">
            {editingSection === "opportunityTypes" ? (
              <OpportunityTypeSelector
                selected={profile.opportunityTypes}
                businessType={profile.businessType}
                isPending={isPending}
                onSave={(types) => {
                  startTransition(async () => {
                    const result = await updateProfile({ opportunityTypes: types });
                    if (result.success) {
                      setProfile({ ...profile, opportunityTypes: types, updatedAt: new Date().toISOString() });
                      toast.success("Updated!");
                    }
                    setEditingSection(null);
                  });
                }}
                onCancel={() => setEditingSection(null)}
              />
            ) : (
              <div 
                className="group cursor-pointer"
                onClick={() => setEditingSection("opportunityTypes")}
              >
                <div className="flex items-start justify-between">
                  <div className="flex flex-wrap gap-2">
                    {profile.opportunityTypes.length > 0 ? (
                      profile.opportunityTypes.map((opp) => (
                        <Badge key={opp} variant="secondary" className="px-3 py-1">
                          {opp}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Tap to select opportunity types...</p>
                    )}
                  </div>
                  <Edit2 className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contact Links Section */}
      <div className="space-y-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
          Contact & Links
        </h2>
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            <ContactRow
              icon={<Mail className="w-4 h-4" />}
              label="Email"
              value={profile.email}
              disabled
            />
            <SettingsRow
              icon={<Phone className="w-4 h-4" />}
              label="Phone"
              value={profile.phone || "Add phone"}
              editing={editingSection === "phone"}
              editValue={editValue}
              isPending={isPending}
              onEdit={() => startEdit("phone", profile.phone || "")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              onChange={setEditValue}
              placeholder="+44 7700 123456"
            />
            <SettingsRow
              icon={<Globe className="w-4 h-4" />}
              label="Website"
              value={profile.website || "Add website"}
              editing={editingSection === "website"}
              editValue={editValue}
              isPending={isPending}
              onEdit={() => startEdit("website", profile.website || "")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              onChange={setEditValue}
              placeholder="www.yoursite.com"
            />
            <SettingsRow
              icon={<Instagram className="w-4 h-4" />}
              label="Instagram"
              value={profile.instagram || "Add Instagram"}
              editing={editingSection === "instagram"}
              editValue={editValue}
              isPending={isPending}
              onEdit={() => startEdit("instagram", profile.instagram || "")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              onChange={setEditValue}
              placeholder="@yourusername"
            />
            <SettingsRow
              icon={<Linkedin className="w-4 h-4" />}
              label="LinkedIn"
              value={profile.linkedin || "Add LinkedIn"}
              editing={editingSection === "linkedin"}
              editValue={editValue}
              isPending={isPending}
              onEdit={() => startEdit("linkedin", profile.linkedin || "")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              onChange={setEditValue}
              placeholder="linkedin.com/in/you"
            />
          </CardContent>
        </Card>
      </div>

      {/* Preferences Section */}
      <div className="space-y-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
          Preferences
        </h2>
        <Card>
          <CardContent className="p-4 space-y-5">
            {/* Tone Selection */}
            <div>
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                Message tone
              </p>
              <div className="grid grid-cols-2 gap-2">
                {tones.map((tone) => (
                  <button
                    key={tone}
                    onClick={() => handleToneChange(tone)}
                    disabled={isPending}
                    className={`p-2.5 rounded-lg border text-sm transition-all ${
                      profile.tone === tone
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {toneLabels[tone]}
                  </button>
                ))}
              </div>
            </div>

            {/* Opportunities per week */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <p className="text-sm font-medium flex items-center gap-2">
                  <Zap className="w-4 h-4 text-muted-foreground" />
                  Opportunities / week
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aurora will find this many for you
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpportunitiesChange(-1)}
                  disabled={isPending || profile.opportunitiesPerWeek <= 1}
                  className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  -
                </button>
                <span className="text-lg font-bold w-6 text-center">
                  {profile.opportunitiesPerWeek}
                </span>
                <button
                  onClick={() => handleOpportunitiesChange(1)}
                  disabled={isPending || profile.opportunitiesPerWeek >= 20}
                  className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sign Out */}
      <Button
        variant="ghost"
        className="w-full text-muted-foreground hover:text-destructive"
        onClick={handleSignOut}
        disabled={isPending}
      >
        {isPending ? <Spinner className="mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
        Sign out
      </Button>
    </div>
  );
}

function SettingsRow({
  icon,
  label,
  value,
  editing,
  editValue,
  isPending,
  placeholder,
  onEdit,
  onSave,
  onCancel,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  editing: boolean;
  editValue: string;
  isPending: boolean;
  placeholder?: string;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onChange: (value: string) => void;
}) {
  const isEmpty = !value || value.startsWith("Add ") || value === "Not set";
  
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        {!editing && (
          <button 
            onClick={onEdit}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-2 space-y-2 pl-7">
          <Input
            value={editValue}
            onChange={(e) => onChange(e.target.value)}
            className="h-9"
            placeholder={placeholder}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={onSave} disabled={isPending}>
              {isPending ? <Spinner className="w-4 h-4" /> : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <p className={`text-sm font-medium pl-7 mt-0.5 ${isEmpty ? "text-muted-foreground" : ""}`}>
          {value}
        </p>
      )}
    </div>
  );
}
