"use client";

/**
 * components/aurora/relationships-page.tsx
 *
 * Three-column Relationships CRM:
 *   Left   – filter tabs + contact list
 *   Centre – contact detail panel (5 sections)
 *   Right  – nurture sequence viewer / CSV import
 *
 * Design: glass morphism, ACCENT #7c6ef7, consistent with outreach-page
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
  CheckCircle2,
  Clock,
  MessageSquare,
  Zap,
  Send,
  FileText,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Tag,
  Pencil,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT  = "#7c6ef7";
const ACCENT2 = "#9585f9";

const GLASS = {
  background:           "rgba(255,255,255,0.04)",
  border:               "1px solid rgba(255,255,255,0.08)",
  backdropFilter:       "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
} as const;

const GLASS_STRONG = {
  background:           "rgba(255,255,255,0.06)",
  border:               "1px solid rgba(255,255,255,0.10)",
  backdropFilter:       "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  id:                string;
  name:              string;
  email:             string | null;
  phone:             string | null;
  instagram_handle:  string | null;
  website:           string | null;
  relationship_type: string;
  source:            string | null;
  status:            string;
  last_contacted_at: string | null;
  next_action:       string | null;
  next_action_due:   string | null;
  tags:              string[];
  ai_notes:          string | null;
  ai_notes_updated_at: string | null;
  booking_platform:  string | null;
  opportunity_id:    string | null;
  venue_id:          string | null;
  created_at:        string;
  updated_at:        string;
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
    venue_target:   "Target Venue",
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function ContactAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{
        width: size, height: size, fontSize: size * 0.35,
        background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
      }}
    >
      {initials}
    </div>
  );
}

function Badge({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{
        background: `${color ?? ACCENT}22`,
        color:      color ?? ACCENT,
        border:     `1px solid ${color ?? ACCENT}33`,
      }}
    >
      {label}
    </span>
  );
}

// ─── CSV Import Panel ─────────────────────────────────────────────────────────

function CsvImportPanel({ onImported }: { onImported: () => void }) {
  const [file,     setFile]    = useState<File | null>(null);
  const [relType,  setRelType] = useState("past_client");
  const [loading,  setLoading] = useState(false);
  const [result,   setResult]  = useState<{ imported: number; skipped: number; errors: string[]; fresha_detected: boolean } | null>(null);
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
      if (data.imported > 0) onImported();
    } catch {
      setResult({ imported: 0, skipped: 0, errors: ["Upload failed"], fresha_detected: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl p-4 space-y-3" style={GLASS}>
      <div className="flex items-center gap-2 mb-1">
        <Upload className="w-4 h-4" style={{ color: ACCENT }} />
        <p className="text-sm font-semibold text-white">Import CSV</p>
      </div>

      <p className="text-[11px] text-white/40 leading-relaxed">
        Supports generic CSVs and Fresha client exports. Deduplicates by email.
      </p>

      {/* Relationship type */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-1 block">
          Relationship type
        </label>
        <select
          value={relType}
          onChange={e => setRelType(e.target.value)}
          className="w-full rounded-xl px-3 py-2 text-xs text-white outline-none"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <option value="past_client">Past Client</option>
          <option value="venue_customer">Venue Client</option>
          <option value="venue_target">Target Venue</option>
          <option value="lead">Lead</option>
          <option value="partner">Partner</option>
        </select>
      </div>

      {/* File picker */}
      <div
        onClick={() => inputRef.current?.click()}
        className="rounded-xl p-3 text-center cursor-pointer transition-all hover:border-[#7c6ef7]/40"
        style={{ border: "1.5px dashed rgba(255,255,255,0.12)" }}
      >
        <Upload className="w-5 h-5 text-white/30 mx-auto mb-1" />
        <p className="text-[11px] text-white/40">
          {file ? file.name : "Click to choose a .csv file"}
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
        className="w-full rounded-xl py-2.5 text-xs font-bold text-white transition-all disabled:opacity-40"
        style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` }}
      >
        {loading ? "Importing…" : "Import Contacts"}
      </button>

      {result && (
        <div
          className="rounded-xl p-3 space-y-1"
          style={{ background: result.imported > 0 ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)" }}
        >
          {result.fresha_detected && (
            <p className="text-[10px] font-bold text-emerald-400 mb-1">✓ Fresha export detected</p>
          )}
          <p className="text-[11px] text-white/70">
            ✓ {result.imported} imported &nbsp;·&nbsp; {result.skipped} skipped (duplicates)
          </p>
          {result.errors.map((e, i) => (
            <p key={i} className="text-[10px] text-red-400">{e}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Nurture Sequence Panel ───────────────────────────────────────────────────

function NurturePanel({ contact }: { contact: Contact }) {
  const [sequence,   setSequence]  = useState<NurtureSequenceData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [expanded,   setExpanded]   = useState<number | null>(null);

  const generate = async () => {
    if (!contact.email) {
      setError("This contact needs an email address before you can create a nurture sequence.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res  = await fetch("/api/contacts/generate-nurture", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ contact_id: contact.id }),
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
      <div className="rounded-2xl p-4 space-y-3" style={GLASS}>
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4" style={{ color: ACCENT }} />
          <p className="text-sm font-semibold text-white">Nurture Sequence</p>
        </div>
        <p className="text-[11px] text-white/40 leading-relaxed">
          Generate a personalised 3-email re-engagement sequence for {contact.name}.
          Emails are scheduled 7 and 14 days apart.
        </p>
        {error && (
          <div className="rounded-xl px-3 py-2" style={{ background: "rgba(239,68,68,0.08)" }}>
            <p className="text-[11px] text-red-400">{error}</p>
          </div>
        )}
        <button
          onClick={generate}
          disabled={generating}
          className="w-full rounded-xl py-2.5 text-xs font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` }}
        >
          {generating ? (
            <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating…</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5" />Generate with AI</>
          )}
        </button>
      </div>
    );
  }

  const steps = [
    { label: "Email 1", subtitle: "Send now",              ...sequence.email1 },
    { label: "Email 2", subtitle: formatDate(sequence.step2_send_at), ...sequence.email2 },
    { label: "Email 3", subtitle: formatDate(sequence.step3_send_at), ...sequence.email3 },
  ];

  return (
    <div className="rounded-2xl p-4 space-y-2" style={GLASS}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: ACCENT }} />
          <p className="text-sm font-semibold text-white">Nurture Sequence</p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all disabled:opacity-40"
          style={{ color: ACCENT, background: `${ACCENT}15` }}
        >
          {generating ? "Regenerating…" : "Regenerate"}
        </button>
      </div>

      {steps.map((step, i) => (
        <div
          key={i}
          className="rounded-xl overflow-hidden cursor-pointer"
          style={GLASS_STRONG}
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
              <p className="text-xs font-semibold text-white truncate">{step.subject}</p>
              <p className="text-[10px] text-white/40">{step.subtitle}</p>
            </div>
            <ChevronRight
              className="w-3.5 h-3.5 text-white/30 transition-transform shrink-0"
              style={{ transform: expanded === i ? "rotate(90deg)" : "rotate(0deg)" }}
            />
          </div>
          {expanded === i && (
            <div className="px-3 pb-3 pt-1 border-t border-white/05">
              <p className="text-[11px] text-white/60 leading-relaxed whitespace-pre-wrap">{step.body}</p>
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
  contact: Contact;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [notes,       setNotes]       = useState<Note[]>([]);
  const [noteBody,    setNoteBody]    = useState("");
  const [addingNote,  setAddingNote]  = useState(false);
  const [suggestion,  setSuggestion]  = useState<string | null>(contact.ai_notes);
  const [loadingSug,  setLoadingSug]  = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [activeTab,   setActiveTab]   = useState<"overview" | "notes" | "nurture">("overview");

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
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ contact_id: contact.id, body: noteBody.trim() }),
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
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ contact_id: contact.id }),
      });
      const data = await res.json();
      setSuggestion(data.suggestion ?? null);
    } finally {
      setLoadingSug(false);
    }
  };

  const tabs = [
    { id: "overview" as const, label: "Overview",  icon: UserCheck },
    { id: "notes"    as const, label: "Notes",      icon: MessageSquare },
    { id: "nurture"  as const, label: "Nurture",    icon: Zap },
  ];

  return (
    <div className="h-full flex flex-col" style={{ minHeight: 0 }}>
      {/* Header */}
      <div className="flex items-start gap-3 p-5 pb-3">
        <ContactAvatar name={contact.name} size={44} />
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-white truncate">{contact.name}</h2>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <Badge label={relTypeLabel(contact.relationship_type)} color={relTypeColor(contact.relationship_type)} />
            {contact.booking_platform === "fresha" && (
              <Badge label="Fresha" color="#10b981" />
            )}
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 transition-colors shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 pb-3">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
              style={active
                ? { background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, color: "white" }
                : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.45)" }
              }
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3" style={{ scrollbarWidth: "none" }}>

        {/* ── OVERVIEW tab ── */}
        {activeTab === "overview" && (
          <>
            {/* Contact methods */}
            <div className="rounded-2xl p-4 space-y-2.5" style={GLASS}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/40 mb-2">Contact</p>

              {contact.email && (
                <div className="flex items-center gap-2.5 group">
                  <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />
                  <a href={`mailto:${contact.email}`} className="text-xs text-white/80 hover:text-white transition-colors truncate flex-1">
                    {contact.email}
                  </a>
                  <button onClick={copyEmail} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-white/40" />}
                  </button>
                </div>
              )}

              {contact.phone && (
                <div className="flex items-center gap-2.5">
                  <Phone className="w-3.5 h-3.5 shrink-0 text-white/40" />
                  <a href={`tel:${contact.phone}`} className="text-xs text-white/80 hover:text-white transition-colors">
                    {contact.phone}
                  </a>
                </div>
              )}

              {contact.instagram_handle && (
                <div className="flex items-center gap-2.5">
                  <Instagram className="w-3.5 h-3.5 shrink-0 text-pink-400" />
                  <a
                    href={`https://instagram.com/${contact.instagram_handle.replace("@","")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white/80 hover:text-white transition-colors"
                  >
                    {contact.instagram_handle}
                  </a>
                </div>
              )}

              {contact.website && (
                <div className="flex items-center gap-2.5">
                  <Globe className="w-3.5 h-3.5 shrink-0 text-white/40" />
                  <a
                    href={contact.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white/80 hover:text-white transition-colors truncate"
                  >
                    {contact.website.replace(/^https?:\/\//, "")}
                  </a>
                  <ExternalLink className="w-3 h-3 text-white/30 shrink-0" />
                </div>
              )}

              {!contact.email && !contact.phone && !contact.instagram_handle && !contact.website && (
                <p className="text-xs text-white/30 italic">No contact details</p>
              )}
            </div>

            {/* Engagement */}
            <div className="rounded-2xl p-4 space-y-2.5" style={GLASS}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/40 mb-2">Engagement</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <Clock className="w-3.5 h-3.5 text-white/30 mx-auto mb-1" />
                  <p className="text-[10px] text-white/40">Last contact</p>
                  <p className="text-xs font-semibold text-white/80">{timeAgo(contact.last_contacted_at)}</p>
                </div>
                <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <Tag className="w-3.5 h-3.5 text-white/30 mx-auto mb-1" />
                  <p className="text-[10px] text-white/40">Source</p>
                  <p className="text-xs font-semibold text-white/80 capitalize">{contact.source?.replace(/_/g, " ") ?? "—"}</p>
                </div>
              </div>

              {contact.next_action && (
                <div className="rounded-xl px-3 py-2.5 flex items-start gap-2" style={{ background: `${ACCENT}12` }}>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: ACCENT }} />
                  <div>
                    <p className="text-[10px] font-bold text-white/50">Next action</p>
                    <p className="text-xs text-white/80">{contact.next_action}</p>
                    {contact.next_action_due && (
                      <p className="text-[10px] text-white/40 mt-0.5">{formatDate(contact.next_action_due)}</p>
                    )}
                  </div>
                </div>
              )}

              {contact.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {contact.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* AI re-engagement suggestion */}
            <div className="rounded-2xl p-4 space-y-2.5" style={GLASS}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                  <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">AI Suggestion</p>
                </div>
                <button
                  onClick={getSuggestion}
                  disabled={loadingSug}
                  className="text-[10px] font-semibold px-2 py-1 rounded-lg transition-all disabled:opacity-40"
                  style={{ color: ACCENT, background: `${ACCENT}15` }}
                >
                  {loadingSug ? "…" : suggestion ? "Refresh" : "Generate"}
                </button>
              </div>
              {suggestion ? (
                <p className="text-[11px] text-white/60 leading-relaxed">{suggestion}</p>
              ) : (
                <p className="text-[11px] text-white/30 italic">
                  Click Generate for a re-engagement idea tailored to {contact.name}.
                </p>
              )}
            </div>
          </>
        )}

        {/* ── NOTES tab ── */}
        {activeTab === "notes" && (
          <>
            {/* Add note */}
            <div className="rounded-2xl p-3 space-y-2" style={GLASS}>
              <textarea
                value={noteBody}
                onChange={e => setNoteBody(e.target.value)}
                placeholder="Add a note…"
                rows={3}
                className="w-full rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/30 outline-none resize-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
              <button
                onClick={submitNote}
                disabled={!noteBody.trim() || addingNote}
                className="w-full rounded-xl py-2 text-xs font-bold text-white disabled:opacity-40 flex items-center justify-center gap-1.5"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` }}
              >
                <Plus className="w-3 h-3" />
                {addingNote ? "Saving…" : "Add Note"}
              </button>
            </div>

            {/* Note list */}
            {notes.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-xs text-white/30">No notes yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notes.map(note => (
                  <div key={note.id} className="rounded-xl p-3" style={GLASS}>
                    <p className="text-xs text-white/70 leading-relaxed">{note.body}</p>
                    <p className="text-[10px] text-white/30 mt-1.5">{formatDate(note.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── NURTURE tab ── */}
        {activeTab === "nurture" && (
          <NurturePanel contact={contact} />
        )}
      </div>
    </div>
  );
}

// ─── Contact List Item ────────────────────────────────────────────────────────

function ContactListItem({
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
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
      style={selected
        ? { background: `${ACCENT}18`, border: `1px solid ${ACCENT}33` }
        : { background: "transparent", border: "1px solid transparent" }
      }
    >
      <ContactAvatar name={contact.name} size={34} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate">{contact.name}</p>
        <p className="text-[10px] text-white/40 truncate">
          {contact.email ?? contact.instagram_handle ?? contact.relationship_type}
        </p>
      </div>
      <div className="text-right shrink-0">
        <span
          className="block w-1.5 h-1.5 rounded-full mx-auto"
          style={{ background: relTypeColor(contact.relationship_type) }}
        />
        <p className="text-[9px] text-white/30 mt-1">{timeAgo(contact.last_contacted_at)}</p>
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const FILTER_TABS = [
  { id: "all",            label: "All",         icon: Users },
  { id: "venue_customer", label: "Clients",      icon: Building2 },
  { id: "past_client",    label: "Past Clients", icon: UserCheck },
  { id: "venue_target",   label: "Targets",      icon: Target },
];

export function RelationshipsPage() {
  const [contacts,      setContacts]      = useState<Contact[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [filterType,    setFilterType]    = useState("all");
  const [selected,      setSelected]      = useState<Contact | null>(null);
  const [showImport,    setShowImport]    = useState(false);
  const [showAddManual, setShowAddManual] = useState(false);
  const [search,        setSearch]        = useState("");

  // Manual add form
  const [newName,  setNewName]  = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newType,  setNewType]  = useState("lead");
  const [adding,   setAdding]   = useState(false);

  // Auto-populate once per session from existing opportunities
  useEffect(() => {
    const key = "aurora_contacts_populated";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch("/api/contacts/auto-populate", { method: "POST" }).catch(() => {/* non-fatal */});
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

  const handleAddManual = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/contacts/list", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: newName, email: newEmail || null, relationship_type: newType }),
      });
      setNewName("");
      setNewEmail("");
      setNewType("lead");
      setShowAddManual(false);
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
      c.email?.toLowerCase().includes(q) ||
      c.instagram_handle?.toLowerCase().includes(q)
    );
  });

  const counts = FILTER_TABS.reduce((acc, t) => {
    acc[t.id] = t.id === "all"
      ? contacts.length
      : contacts.filter(c => c.relationship_type === t.id).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="h-full">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Relationships</h1>
          <p className="text-xs text-white/40 mt-0.5">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowImport(!showImport); setShowAddManual(false); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Import CSV</span>
          </button>
          <button
            onClick={() => { setShowAddManual(!showAddManual); setShowImport(false); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Add Contact</span>
          </button>
        </div>
      </div>

      {/* ── Add / Import panels ──────────────────────────────────────────────── */}
      {showImport && (
        <div className="mb-4 max-w-md">
          <CsvImportPanel onImported={() => { setShowImport(false); loadContacts(); }} />
        </div>
      )}

      {showAddManual && (
        <div className="mb-4 max-w-md rounded-2xl p-4 space-y-3" style={GLASS}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Add Contact</p>
            <button onClick={() => setShowAddManual(false)}>
              <X className="w-3.5 h-3.5 text-white/40" />
            </button>
          </div>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Name *"
            className="w-full rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <input
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            placeholder="Email"
            type="email"
            className="w-full rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <select
            value={newType}
            onChange={e => setNewType(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-xs text-white outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <option value="lead">Lead</option>
            <option value="venue_target">Target Venue</option>
            <option value="venue_customer">Venue Client</option>
            <option value="past_client">Past Client</option>
            <option value="partner">Partner</option>
          </select>
          <button
            onClick={handleAddManual}
            disabled={!newName.trim() || adding}
            className="w-full rounded-xl py-2.5 text-xs font-bold text-white disabled:opacity-40"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` }}
          >
            {adding ? "Saving…" : "Add Contact"}
          </button>
        </div>
      )}

      {/* ── Three-column layout ──────────────────────────────────────────────── */}
      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[500px]">

        {/* ── LEFT: Contact list ─────────────────────────────────────────────── */}
        <div
          className={`flex flex-col rounded-2xl overflow-hidden transition-all duration-300 ${selected ? "hidden lg:flex lg:w-72 xl:w-80" : "flex w-full lg:w-72 xl:w-80"}`}
          style={GLASS}
        >
          {/* Filter tabs */}
          <div className="p-3 border-b border-white/06 space-y-2">
            <div className="relative">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search contacts…"
                className="w-full rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 outline-none pl-8"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
              <Users className="w-3.5 h-3.5 text-white/30 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {FILTER_TABS.map(tab => {
                const Icon = tab.icon;
                const active = filterType === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setFilterType(tab.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                    style={active
                      ? { background: `${ACCENT}20`, color: ACCENT }
                      : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)" }
                    }
                  >
                    <Icon className="w-2.5 h-2.5" />
                    {tab.label}
                    {counts[tab.id] > 0 && (
                      <span
                        className="ml-0.5 px-1 rounded-full text-[9px]"
                        style={active
                          ? { background: `${ACCENT}30`, color: ACCENT }
                          : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }
                        }
                      >
                        {counts[tab.id]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contact list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5" style={{ scrollbarWidth: "none" }}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Users className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-xs font-semibold text-white/30">No contacts yet</p>
                <p className="text-[11px] text-white/20 mt-1">
                  Import a CSV or add contacts manually.
                  <br />Contacts also appear automatically when you close a deal.
                </p>
              </div>
            ) : (
              filtered.map(c => (
                <ContactListItem
                  key={c.id}
                  contact={c}
                  selected={selected?.id === c.id}
                  onClick={() => setSelected(c)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── CENTRE: Contact detail ─────────────────────────────────────────── */}
        {selected ? (
          <div
            className="flex-1 rounded-2xl overflow-hidden"
            style={GLASS}
          >
            <ContactDetail
              contact={selected}
              onClose={() => setSelected(null)}
              onUpdated={loadContacts}
            />
          </div>
        ) : (
          <div
            className="hidden lg:flex flex-1 rounded-2xl items-center justify-center"
            style={GLASS}
          >
            <div className="text-center">
              <UserCheck className="w-12 h-12 text-white/10 mx-auto mb-3" />
              <p className="text-sm font-semibold text-white/20">Select a contact</p>
              <p className="text-xs text-white/15 mt-1">Click any contact to view details</p>
            </div>
          </div>
        )}

        {/* ── RIGHT: Tools panel (desktop only) ─────────────────────────────── */}
        {!selected && (
          <div className="hidden xl:flex flex-col gap-3 w-72 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {/* Stats summary */}
            <div className="rounded-2xl p-4 space-y-3" style={GLASS}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">Overview</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Total",   value: contacts.length,                                          color: ACCENT },
                  { label: "Clients", value: contacts.filter(c => c.relationship_type === "venue_customer" || c.relationship_type === "past_client").length, color: "#10b981" },
                  { label: "Targets", value: contacts.filter(c => c.relationship_type === "venue_target").length, color: "#f59e0b" },
                  { label: "No Email", value: contacts.filter(c => !c.email).length,                  color: "#6b7280" },
                ].map(stat => (
                  <div key={stat.label} className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <p className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</p>
                    <p className="text-[10px] text-white/40">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick CSV import */}
            <CsvImportPanel onImported={loadContacts} />
          </div>
        )}
      </div>
    </div>
  );
}
