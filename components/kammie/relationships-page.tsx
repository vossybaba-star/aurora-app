"use client";

/**
 * components/kammie/relationships-page.tsx
 *
 * Relationships CRM — light glassmorphism, matching app design system:
 *  - glass-card class (white frosted), text-[#131b2e], text-muted-foreground
 *  - ACCENT #7c6ef7 for interactive highlights only
 *  - Consistent with outreach-page / profile-page patterns
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ChangeEvent,
} from "react";
import {
  Users,
  Building2,
  Target,
  UserCheck,
  Mail,
  Phone,
  Instagram,
  Globe,
  Plus,
  Upload,
  Sparkles,
  ChevronRight,
  X,
  Clock,
  MessageSquare,
  Zap,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Tag,
  Search,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT  = "#7c6ef7";
const ACCENT2 = "#9585f9";
const DARK    = "#131b2e";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  id:                  string;
  name:                string;
  email:               string | null;
  phone:               string | null;
  instagram_handle:    string | null;
  website:             string | null;
  relationship_type:   string;
  source:              string | null;
  status:              string;
  last_contacted_at:   string | null;
  next_action:         string | null;
  next_action_due:     string | null;
  tags:                string[];
  ai_notes:            string | null;
  ai_notes_updated_at: string | null;
  booking_platform:    string | null;
  opportunity_id:      string | null;
  venue_id:            string | null;
  created_at:          string;
  updated_at:          string;
}

interface Note {
  id:         string;
  body:       string;
  created_at: string;
}

interface NurtureStep {
  subject: string;
  body:    string;
}

interface NurtureSequenceData {
  sequence_id:   string;
  email1:        NurtureStep;
  email2:        NurtureStep;
  email3:        NurtureStep;
  step2_send_at: string;
  step3_send_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTypeLabel(t: string) {
  const map: Record<string, string> = {
    venue_customer: "Client",
    past_client:    "Past Client",
    venue_target:   "Target",
    lead:           "Lead",
    partner:        "Partner",
  };
  return map[t] ?? t;
}

function relTypeColor(t: string): string {
  const map: Record<string, string> = {
    venue_customer: "#10b981",
    past_client:    "#6366f1",
    venue_target:   ACCENT,
    lead:           "#f59e0b",
    partner:        "#ec4899",
  };
  return map[t] ?? "#6b7280";
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const ms = Date.now() - new Date(dateStr).getTime();
  const d  = Math.floor(ms / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7)  return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ─── Shared input style ───────────────────────────────────────────────────────

const INPUT_CLS =
  "w-full rounded-xl px-3 py-2.5 text-sm bg-white/60 border border-white/60 " +
  "focus:outline-none focus:ring-2 focus:ring-[#7c6ef7]/30 placeholder:text-muted-foreground";

// ─── RelType badge ────────────────────────────────────────────────────────────

function RelBadge({ type }: { type: string }) {
  const color = relTypeColor(type);
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
    >
      {relTypeLabel(type)}
    </span>
  );
}

// ─── Contact Avatar ───────────────────────────────────────────────────────────

function ContactAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{
        width: size, height: size, fontSize: size * 0.36,
        background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
      }}
    >
      {initials}
    </div>
  );
}

// ─── CSV Import Panel ─────────────────────────────────────────────────────────

function CsvImportPanel({ onImported }: { onImported: () => void }) {
  const [file,    setFile]    = useState<File | null>(null);
  const [relType, setRelType] = useState("past_client");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<{ imported: number; skipped: number; errors: string[]; fresha_detected: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("relationship_type", relType);
      const res  = await fetch("/api/contacts/import-csv", { method: "POST", body: form });
      const data = await res.json();
      setResult(data);
      if (data.imported > 0) { setFile(null); onImported(); }
    } catch {
      setResult({ imported: 0, skipped: 0, errors: ["Upload failed"], fresha_detected: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Supports generic CSVs and Fresha exports. Deduplicates by email.
      </p>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1 block">
          Relationship type
        </label>
        <select
          value={relType}
          onChange={e => setRelType(e.target.value)}
          className={INPUT_CLS}
        >
          <option value="past_client">Past Client</option>
          <option value="venue_customer">Venue Client</option>
          <option value="venue_target">Target Venue</option>
          <option value="lead">Lead</option>
          <option value="partner">Partner</option>
        </select>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        className="rounded-xl p-4 text-center cursor-pointer transition-all hover:border-[#7c6ef7]/40 border-2 border-dashed border-muted-foreground/20"
      >
        <Upload className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1" />
        <p className="text-xs text-muted-foreground">
          {file ? <span className="font-semibold" style={{ color: ACCENT }}>{file.name}</span> : "Click to choose a .csv file"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <button
        onClick={handleImport}
        disabled={!file || loading}
        className="w-full rounded-xl py-2.5 text-sm font-bold text-white transition-all disabled:opacity-40"
        style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` }}
      >
        {loading ? "Importing…" : "Import Contacts"}
      </button>

      {result && (
        <div className={`rounded-xl p-3 space-y-1 ${result.imported > 0 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
          {result.fresha_detected && (
            <p className="text-[10px] font-bold text-emerald-600 mb-1">✓ Fresha export detected</p>
          )}
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-emerald-600">{result.imported} imported</span>
            {" · "}
            {result.skipped} duplicates skipped
          </p>
          {result.errors.map((e, i) => (
            <p key={i} className="text-[10px] text-red-500">{e}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Nurture Sequence Panel ───────────────────────────────────────────────────

function NurturePanel({ contact }: { contact: Contact }) {
  const [sequence,   setSequence]   = useState<NurtureSequenceData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [expanded,   setExpanded]   = useState<number | null>(null);

  const generate = async () => {
    if (!contact.email) {
      setError("Add an email address to this contact before creating a nurture sequence.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res  = await fetch("/api/contacts/generate-nurture", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contact.id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Generation failed"); return; }
      setSequence(data);
    } catch {
      setError("Failed to generate sequence");
    } finally {
      setGenerating(false);
    }
  };

  if (!sequence) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Generate a personalised 3-email re-engagement sequence for <strong>{contact.name}</strong>.
          Steps send automatically 7 and 14 days apart once activated.
        </p>

        {!contact.email && (
          <div className="rounded-xl px-3 py-2.5 flex items-start gap-2 bg-amber-50 border border-amber-200">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Email address required to send nurture emails.</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl px-3 py-2.5 bg-red-50 border border-red-200">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        <button
          onClick={generate}
          disabled={generating}
          className="w-full rounded-xl py-2.5 text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` }}
        >
          {generating ? (
            <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating…</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5" />Generate with AI</>
          )}
        </button>
      </div>
    );
  }

  const steps = [
    { label: "Email 1 · Send now",                              ...sequence.email1 },
    { label: `Email 2 · ${formatDate(sequence.step2_send_at)}`, ...sequence.email2 },
    { label: `Email 3 · ${formatDate(sequence.step3_send_at)}`, ...sequence.email3 },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold" style={{ color: DARK }}>3-email sequence ready</p>
        <button
          onClick={generate}
          disabled={generating}
          className="text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all disabled:opacity-40"
          style={{ color: ACCENT, background: `${ACCENT}12` }}
        >
          {generating ? "…" : "Regenerate"}
        </button>
      </div>

      {steps.map((step, i) => (
        <div
          key={i}
          className="glass-card rounded-xl overflow-hidden cursor-pointer border border-white/60"
          onClick={() => setExpanded(expanded === i ? null : i)}
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` }}
            >
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: DARK }}>{step.subject}</p>
              <p className="text-[10px] text-muted-foreground">{step.label}</p>
            </div>
            <ChevronRight
              className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 transition-transform"
              style={{ transform: expanded === i ? "rotate(90deg)" : "none" }}
            />
          </div>
          {expanded === i && (
            <div className="px-3 pb-3 pt-1 border-t border-white/40">
              <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{step.body}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Contact Detail Panel ─────────────────────────────────────────────────────

function ContactDetail({
  contact,
  onClose,
  onUpdated,
}: {
  contact:   Contact;
  onClose:   () => void;
  onUpdated: () => void;
}) {
  const [notes,      setNotes]      = useState<Note[]>([]);
  const [noteBody,   setNoteBody]   = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(contact.ai_notes);
  const [loadingSug, setLoadingSug] = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [activeTab,  setActiveTab]  = useState<"overview" | "notes" | "nurture">("overview");

  const copyEmail = () => {
    if (!contact.email) return;
    navigator.clipboard.writeText(contact.email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const loadNotes = useCallback(async () => {
    try {
      const res  = await fetch(`/api/contacts/notes?contact_id=${contact.id}`);
      const data = await res.json();
      setNotes(data.notes ?? []);
    } catch { /* non-fatal */ }
  }, [contact.id]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const submitNote = async () => {
    if (!noteBody.trim()) return;
    setAddingNote(true);
    try {
      await fetch("/api/contacts/notes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contact.id, body: noteBody.trim() }),
      });
      setNoteBody("");
      await loadNotes();
      onUpdated();
    } finally {
      setAddingNote(false);
    }
  };

  const getSuggestion = async () => {
    setLoadingSug(true);
    try {
      const res  = await fetch("/api/contacts/suggest-reengage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contact.id }),
      });
      const data = await res.json();
      setSuggestion(data.suggestion ?? null);
    } finally {
      setLoadingSug(false);
    }
  };

  const TABS = [
    { id: "overview" as const, label: "Overview",  icon: UserCheck },
    { id: "notes"    as const, label: "Notes",      icon: MessageSquare },
    { id: "nurture"  as const, label: "Nurture",    icon: Zap },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-white/40">
        <div className="flex items-start gap-3">
          <ContactAvatar name={contact.name} size={44} />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold truncate" style={{ color: DARK }}>{contact.name}</h2>
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <RelBadge type={contact.relationship_type} />
              {contact.booking_platform === "fresha" && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">Fresha</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-black/05 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {TABS.map(tab => {
            const Icon   = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={active
                  ? { background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, color: "white" }
                  : { color: "var(--muted-foreground)" }
                }
              >
                <Icon className="w-3 h-3" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ scrollbarWidth: "none" }}>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <>
            {/* Contact methods */}
            <div className="glass-card rounded-2xl p-4 border border-white/60 space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Contact</p>

              {contact.email && (
                <div className="flex items-center gap-2.5 group">
                  <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />
                  <a href={`mailto:${contact.email}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate flex-1">
                    {contact.email}
                  </a>
                  <button onClick={copyEmail} className="opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Copy email">
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-muted-foreground/50" />}
                  </button>
                </div>
              )}

              {contact.phone && (
                <div className="flex items-center gap-2.5">
                  <Phone className="w-3.5 h-3.5 shrink-0 text-muted-foreground/50" />
                  <a href={`tel:${contact.phone}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{contact.phone}</a>
                </div>
              )}

              {contact.instagram_handle && (
                <div className="flex items-center gap-2.5">
                  <Instagram className="w-3.5 h-3.5 shrink-0 text-pink-400" />
                  <a
                    href={`https://instagram.com/${contact.instagram_handle.replace("@", "")}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {contact.instagram_handle}
                  </a>
                  <ExternalLink className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                </div>
              )}

              {contact.website && (
                <div className="flex items-center gap-2.5">
                  <Globe className="w-3.5 h-3.5 shrink-0 text-muted-foreground/50" />
                  <a
                    href={contact.website}
                    target="_blank" rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate"
                  >
                    {contact.website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}

              {!contact.email && !contact.phone && !contact.instagram_handle && !contact.website && (
                <p className="text-sm text-muted-foreground italic">No contact details recorded.</p>
              )}
            </div>

            {/* Engagement */}
            <div className="glass-card rounded-2xl p-4 border border-white/60 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Engagement</p>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl p-2.5 text-center bg-white/40 border border-white/50">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground/40 mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground">Last contact</p>
                  <p className="text-sm font-bold" style={{ color: DARK }}>{timeAgo(contact.last_contacted_at)}</p>
                </div>
                <div className="rounded-xl p-2.5 text-center bg-white/40 border border-white/50">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground/40 mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground">Source</p>
                  <p className="text-sm font-bold capitalize" style={{ color: DARK }}>{contact.source?.replace(/_/g, " ") ?? "—"}</p>
                </div>
              </div>

              {contact.next_action && (
                <div className="rounded-xl px-3 py-2.5 flex items-start gap-2" style={{ background: `${ACCENT}0d`, border: `1px solid ${ACCENT}25` }}>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: ACCENT }} />
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground">Next action</p>
                    <p className="text-xs font-medium" style={{ color: DARK }}>{contact.next_action}</p>
                    {contact.next_action_due && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(contact.next_action_due)}</p>
                    )}
                  </div>
                </div>
              )}

              {contact.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {contact.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/60 border border-white/60 text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* AI suggestion */}
            <div className="glass-card rounded-2xl p-4 border border-white/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">AI Re-engagement Idea</p>
                </div>
                <button
                  onClick={getSuggestion}
                  disabled={loadingSug}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all disabled:opacity-40"
                  style={{ color: ACCENT, background: `${ACCENT}12` }}
                >
                  {loadingSug ? "…" : suggestion ? "Refresh" : "Generate"}
                </button>
              </div>
              {suggestion
                ? <p className="text-sm text-muted-foreground leading-relaxed">{suggestion}</p>
                : <p className="text-sm text-muted-foreground/60 italic">Click Generate for a personalised re-engagement idea.</p>
              }
            </div>
          </>
        )}

        {/* NOTES */}
        {activeTab === "notes" && (
          <>
            <div className="space-y-2">
              <textarea
                value={noteBody}
                onChange={e => setNoteBody(e.target.value)}
                placeholder="Add a note…"
                rows={3}
                className={`${INPUT_CLS} resize-none`}
              />
              <button
                onClick={submitNote}
                disabled={!noteBody.trim() || addingNote}
                className="w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-40 flex items-center justify-center gap-1.5"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` }}
              >
                <Plus className="w-3.5 h-3.5" />
                {addingNote ? "Saving…" : "Add Note"}
              </button>
            </div>

            {notes.length === 0 ? (
              <div className="text-center py-10">
                <MessageSquare className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No notes yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notes.map(note => (
                  <div key={note.id} className="glass-card rounded-xl p-3 border border-white/60">
                    <p className="text-sm text-muted-foreground leading-relaxed">{note.body}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1.5">{formatDate(note.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* NURTURE */}
        {activeTab === "nurture" && <NurturePanel contact={contact} />}
      </div>
    </div>
  );
}

// ─── Contact List Row ─────────────────────────────────────────────────────────

function ContactRow({
  contact,
  selected,
  onClick,
}: {
  contact:  Contact;
  selected: boolean;
  onClick:  () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150"
      style={selected
        ? { background: `${ACCENT}12`, border: `1px solid ${ACCENT}30` }
        : { border: "1px solid transparent" }
      }
    >
      <ContactAvatar name={contact.name} size={34} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: DARK }}>{contact.name}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {contact.email ?? contact.instagram_handle ?? relTypeLabel(contact.relationship_type)}
        </p>
      </div>
      <div className="shrink-0 text-right space-y-1">
        <div
          className="w-1.5 h-1.5 rounded-full ml-auto"
          style={{ background: relTypeColor(contact.relationship_type) }}
        />
        <p className="text-[9px] text-muted-foreground/60">{timeAgo(contact.last_contacted_at)}</p>
      </div>
    </button>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTERS = [
  { id: "all",            label: "All",         icon: Users },
  { id: "venue_customer", label: "Clients",     icon: Building2 },
  { id: "past_client",    label: "Past",        icon: UserCheck },
  { id: "venue_target",   label: "New contacts", icon: Target },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export function RelationshipsPage() {
  const [contacts,      setContacts]      = useState<Contact[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [filterType,    setFilterType]    = useState("all");
  const [selected,      setSelected]      = useState<Contact | null>(null);
  const [search,        setSearch]        = useState("");

  // Add contact form
  const [showAdd,  setShowAdd]  = useState(false);
  const [newName,  setNewName]  = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newType,  setNewType]  = useState("lead");
  const [adding,   setAdding]   = useState(false);

  // Import panel (shown inline on desktop right col)
  const [showImport, setShowImport] = useState(false);

  // Auto-populate from opportunities on first visit
  useEffect(() => {
    const key = "kammie_contacts_populated_v1";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch("/api/contacts/auto-populate", { method: "POST" }).catch(() => {});
  }, []);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/contacts/list?type=${filterType}`);
      const data = await res.json();
      setContacts(data.contacts ?? []);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const handleAddContact = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/contacts/list", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, email: newEmail || null, relationship_type: newType }),
      });
      setNewName(""); setNewEmail(""); setNewType("lead");
      setShowAdd(false);
      await loadContacts();
    } finally {
      setAdding(false);
    }
  };

  const filtered = contacts.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.instagram_handle ?? "").toLowerCase().includes(q)
    );
  });

  const counts = FILTERS.reduce((acc, f) => {
    acc[f.id] = f.id === "all" ? contacts.length : contacts.filter(c => c.relationship_type === f.id).length;
    return acc;
  }, {} as Record<string, number>);

  const stats = {
    total:   contacts.length,
    clients: contacts.filter(c => c.relationship_type === "venue_customer" || c.relationship_type === "past_client").length,
    targets: contacts.filter(c => c.relationship_type === "venue_target").length,
    noEmail: contacts.filter(c => !c.email).length,
  };

  return (
    <div className="flex flex-col gap-5">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: DARK }}>Relationships</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowImport(true); setShowAdd(false); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-black/05 transition-all border border-white/60 glass-card"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Import CSV</span>
          </button>
          <button
            onClick={() => { setShowAdd(v => !v); setShowImport(false); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-white transition-all"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Add Contact</span>
          </button>
        </div>
      </div>

      {/* ── Add contact form ── */}
      {showAdd && (
        <div className="glass-card rounded-2xl p-5 border border-white/60 max-w-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold" style={{ color: DARK }}>New Contact</p>
            <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name *" className={INPUT_CLS} />
          <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email" type="email" className={INPUT_CLS} />
          <select value={newType} onChange={e => setNewType(e.target.value)} className={INPUT_CLS}>
            <option value="lead">Lead</option>
            <option value="venue_target">Target Venue</option>
            <option value="venue_customer">Venue Client</option>
            <option value="past_client">Past Client</option>
            <option value="partner">Partner</option>
          </select>
          <button
            onClick={handleAddContact}
            disabled={!newName.trim() || adding}
            className="w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-40"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` }}
          >
            {adding ? "Saving…" : "Add Contact"}
          </button>
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div className="flex gap-4" style={{ minHeight: 520 }}>

        {/* LEFT — contact list */}
        <div
          className={`flex flex-col glass-card rounded-2xl border border-white/60 overflow-hidden transition-all duration-300
            ${selected ? "hidden lg:flex lg:w-72 xl:w-80 shrink-0" : "flex w-full lg:w-72 xl:w-80 shrink-0"}`}
        >
          {/* Search + filters */}
          <div className="shrink-0 p-3 border-b border-white/40 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground/50 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search contacts…"
                className={`${INPUT_CLS} pl-8 text-sm`}
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {FILTERS.map(f => {
                const Icon   = f.icon;
                const active = filterType === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilterType(f.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
                    style={active
                      ? { background: `${ACCENT}15`, color: ACCENT }
                      : { color: "var(--muted-foreground)" }
                    }
                  >
                    <Icon className="w-3 h-3" />
                    {f.label}
                    {counts[f.id] > 0 && (
                      <span
                        className="ml-0.5 min-w-[16px] px-1 rounded-full text-[9px] font-bold"
                        style={active
                          ? { background: `${ACCENT}20`, color: ACCENT }
                          : { background: "rgba(0,0,0,0.06)", color: "var(--muted-foreground)" }
                        }
                      >
                        {counts[f.id]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5" style={{ scrollbarWidth: "none" }}>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-5 h-5 border-2 border-muted-foreground/20 border-t-muted-foreground/60 rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Users className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">
                  {search ? "No contacts match" : "No contacts yet"}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {search
                    ? "Try a different search"
                    : "Import a CSV or add a contact above.\nContacts appear automatically when you close a deal."
                  }
                </p>
              </div>
            ) : (
              filtered.map(c => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  selected={selected?.id === c.id}
                  onClick={() => setSelected(c)}
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT — contact detail or empty state */}
        {selected ? (
          <div className="flex-1 glass-card rounded-2xl border border-white/60 overflow-hidden">
            <ContactDetail
              contact={selected}
              onClose={() => setSelected(null)}
              onUpdated={loadContacts}
            />
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 flex-col glass-card rounded-2xl border border-white/60 items-center justify-center gap-6 p-8">
            {/* Empty state */}
            <div className="text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm"
                style={{ background: `rgba(124,110,247,0.08)` }}
              >
                <UserCheck className="w-7 h-7" style={{ color: `${ACCENT}80` }} />
              </div>
              <p className="text-base font-bold" style={{ color: DARK }}>Select a contact to view their details</p>
              <p className="text-xs text-muted-foreground mt-1">Click any name in the list on the left</p>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 flex-wrap justify-center">
              {[
                { label: "Total",        value: stats.total,   color: ACCENT     },
                { label: "Clients",      value: stats.clients, color: "#10b981"  },
                { label: "New contacts", value: stats.targets, color: "#f59e0b"  },
                { label: "No email",     value: stats.noEmail, color: "#6b7280"  },
              ].map(s => (
                <div key={s.label} className="rounded-2xl px-5 py-3 text-center bg-white/50 border border-white/50 min-w-[80px]">
                  <p className="text-xl font-extrabold leading-none" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Import CSV modal ── */}
      {showImport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowImport(false)}
        >
          <div
            className="glass-card rounded-2xl p-6 border border-white/60 w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
                >
                  <Upload className="w-4 h-4 text-white" />
                </div>
                <p className="text-sm font-bold" style={{ color: DARK }}>Import CSV</p>
              </div>
              <button
                onClick={() => setShowImport(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/05 transition-colors text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <CsvImportPanel onImported={() => { setShowImport(false); loadContacts(); }} />
          </div>
        </div>
      )}
    </div>
  );
}
