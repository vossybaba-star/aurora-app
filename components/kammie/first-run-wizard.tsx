"use client";

/**
 * First-run onboarding wizard
 *
 * Shows once per browser (localStorage key kammie_frw_v1) on the
 * very first dashboard visit. Skipped entirely if the flag is already set.
 *
 * Step 1 — Profession picker (saves to profile.businessType)
 * Step 2 — Connect inbox (Nylas OAuth, with "Skip for now")
 * Step 3 — Animated scan → navigates to Discover
 */

import { useState, useEffect, useRef } from "react";
import { updateProfile } from "@/lib/actions";
import { useKammie } from "./kammie-app";
import { getRoleById } from "@/lib/roles";
import { RolePickerModal } from "@/components/onboarding/RolePickerModal";
import { Sparkles, Mail, Check, ChevronRight, Zap, MapPin, Building2 } from "lucide-react";

/* ── Constants ─────────────────────────────────────────────── */
const ACCENT  = "#7c6ef7";
const ACCENT2 = "#9585f9";
const LS_KEY  = "kammie_frw_v1";

const SCAN_MESSAGES = [
  "Scanning your area for venues…",
  "Analysing contact opportunities…",
  "Preparing your lead pipeline…",
  "Almost there — lining up your first leads…",
];

/* ── Mark wizard complete (localStorage) ───────────────────── */
function markDone() {
  try { localStorage.setItem(LS_KEY, "done"); } catch { /* private mode */ }
}

/* ── Step dots ──────────────────────────────────────────────── */
function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-1.5 rounded-full transition-all duration-300"
          style={{
            width:      i === step ? 24 : 8,
            background: i <= step
              ? `linear-gradient(90deg,${ACCENT},${ACCENT2})`
              : "rgba(0,0,0,0.12)",
          }}
        />
      ))}
    </div>
  );
}

/* ── Scan animation ─────────────────────────────────────────── */
function ScanAnimation({ onDone }: { onDone: () => void }) {
  const [msgIdx, setMsgIdx]     = useState(0);
  const [dots,   setDots]       = useState("");
  const [done,   setDone]       = useState(false);
  const calledDone               = useRef(false);

  /* Cycle dot animation */
  useEffect(() => {
    const iv = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 400);
    return () => clearInterval(iv);
  }, []);

  /* Cycle scan messages */
  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      i += 1;
      if (i < SCAN_MESSAGES.length) {
        setMsgIdx(i);
      } else {
        clearInterval(iv);
        setDone(true);
      }
    }, 750);
    return () => clearInterval(iv);
  }, []);

  /* Trigger done callback after "done" flash */
  useEffect(() => {
    if (done && !calledDone.current) {
      calledDone.current = true;
      const t = setTimeout(onDone, 600);
      return () => clearTimeout(t);
    }
  }, [done, onDone]);

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      {/* Pulsing icon ring */}
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
        />
        <div
          className="relative w-20 h-20 rounded-full flex items-center justify-center shadow-xl"
          style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
        >
          {done
            ? <Check className="w-9 h-9 text-white" strokeWidth={3} />
            : <Sparkles className="w-9 h-9 text-white" />
          }
        </div>
      </div>

      {/* Fake map / venue scan */}
      {!done && (
        <div className="w-full rounded-2xl overflow-hidden border border-white/50 bg-white/30 backdrop-blur-sm relative" style={{ height: 120 }}>
          <div className="absolute inset-0 flex items-center justify-center gap-4 p-4">
            {[Building2, MapPin, Zap].map((Icon, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-1.5 opacity-0"
                style={{ animation: `fadeInUp 0.4s ease forwards ${i * 0.18}s` }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `rgba(124,110,247,${0.08 + i * 0.04})` }}
                >
                  <Icon className="w-5 h-5" style={{ color: ACCENT }} />
                </div>
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: [48, 56, 40][i],
                    background: `rgba(124,110,247,0.25)`,
                    animation: `pulse 1.2s ease-in-out infinite ${i * 0.3}s`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message */}
      <p
        className="text-sm font-semibold text-center transition-all duration-300"
        style={{ color: done ? "#16a34a" : "#131b2e" }}
      >
        {done ? "✓ Ready! Taking you to Discover…" : `${SCAN_MESSAGES[msgIdx]}${dots}`}
      </p>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50%       { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Main wizard
════════════════════════════════════════════════════════════ */
export function FirstRunWizard() {
  const { setActiveTab, profile } = useKammie();
  const [visible,     setVisible]     = useState(false);
  const [step,        setStep]        = useState(0);  // 0 = role picker | 1 = email | 2 = scan
  const [isSaving,    setIsSaving]    = useState(false);
  const [emailStatus, setEmailStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");

  /* Show only if flag not set */
  useEffect(() => {
    try {
      if (localStorage.getItem(LS_KEY) !== "done") setVisible(true);
    } catch {
      /* private mode — don't show */
    }
  }, []);

  /* Skip role picker if profile already has a role set */
  useEffect(() => {
    if (profile?.roleId && step === 0) setStep(1);
  }, [profile?.roleId]);

  /* Fetch email status for Step 1 (email connect) */
  useEffect(() => {
    if (step === 1) {
      fetch("/api/email/status")
        .then(r => r.json())
        .then(d => setEmailStatus(d.connected ? "connected" : "disconnected"))
        .catch(() => setEmailStatus("disconnected"));
    }
  }, [step]);

  const handleRoleComplete = async (roleId: string, targetMarkets: string[]) => {
    const role = getRoleById(roleId);
    setIsSaving(true);
    await updateProfile({
      businessType:  role?.label ?? roleId,
      roleId,
      roleCategory:  role?.category ?? "",
      targetMarkets,
    }).catch(() => {});
    setIsSaving(false);
    setStep(1);
  };

  const handleConnectEmail = () => {
    markDone(); // mark before redirect so returning users skip wizard
    window.location.href = "/api/email/connect";
  };

  const handleSkipEmail = () => {
    setStep(2);
  };

  const handleScanDone = () => {
    markDone();
    setVisible(false);
    setActiveTab("discover");
  };

  const handleClose = () => {
    markDone();
    setVisible(false);
  };

  if (!visible) return null;

  /* Step 0 — full-screen role picker (RolePickerModal handles its own overlay) */
  if (step === 0) {
    return <RolePickerModal overlay onComplete={handleRoleComplete} />;
  }

  const TOTAL = 2; // email + scan (role picker was step 0, outside this modal)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(10,8,25,0.72)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-white/50 shadow-2xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.96)" }}
      >
        {/* Purple top accent bar */}
        <div
          className="h-1 w-full"
          style={{ background: `linear-gradient(90deg,${ACCENT},${ACCENT2})` }}
        />

        <div className="p-7 sm:p-9">
          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-7">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm shrink-0"
                style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-sm tracking-tight" style={{ color: "#131b2e" }}>
                Kammie
              </span>
            </div>

            <div className="flex items-center gap-3">
              <ProgressDots step={step - 1} total={TOTAL} />
              <span className="text-[11px] font-bold text-muted-foreground">
                {step} / {TOTAL}
              </span>
            </div>
          </div>

          {/* ══════════════════════════
              STEP 1 — Connect inbox
          ══════════════════════════ */}
          {step === 1 && (
            <>
              <h2 className="text-xl font-extrabold mb-1.5 leading-snug" style={{ color: "#131b2e" }}>
                Connect your inbox
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Send outreach directly from Kammie — no copy-paste, no switching apps.
              </p>

              {emailStatus === "connected" ? (
                /* Already connected */
                <div
                  className="flex items-center gap-3 px-4 py-4 rounded-2xl mb-8"
                  style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                       style={{ background: "rgba(34,197,94,0.12)" }}>
                    <Mail className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#131b2e" }}>Inbox already connected</p>
                    <p className="text-xs text-muted-foreground">Kammie can send from your real address</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-600">Live</span>
                  </div>
                </div>
              ) : (
                /* Not connected — show connect card */
                <div
                  className="rounded-2xl p-5 mb-6 text-white relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 8px 24px rgba(124,110,247,0.35)` }}
                >
                  {/* Decorative circles */}
                  <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full pointer-events-none"
                       style={{ background: "rgba(255,255,255,0.10)" }} />
                  <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full pointer-events-none"
                       style={{ background: "rgba(255,255,255,0.07)" }} />

                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                           style={{ background: "rgba(255,255,255,0.20)" }}>
                        <Mail className="w-4.5 h-4.5 text-white" />
                      </div>
                      <p className="font-bold text-base">Connect your inbox</p>
                    </div>
                    <p className="text-sm opacity-80 mb-4 leading-relaxed">
                      Works with Gmail, Outlook, and most email providers. Kammie uses Nylas — we never store your password.
                    </p>
                    <button
                      onClick={handleConnectEmail}
                      className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                      style={{ background: "rgba(255,255,255,0.95)", color: ACCENT }}
                    >
                      Connect your inbox →
                    </button>
                  </div>
                </div>
              )}

              {/* Feature list */}
              <ul className="space-y-2 mb-8">
                {[
                  "Emails sent from your real address — land in your Sent folder",
                  "Replies tracked automatically",
                  "Revoke access any time from your email provider",
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-500" />
                    {t}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-2.5">
                {emailStatus !== "connected" && (
                  <button
                    onClick={handleConnectEmail}
                    className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
                    style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 4px 18px rgba(124,110,247,0.35)` }}
                  >
                    Connect email <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                {emailStatus === "connected" && (
                  <button
                    onClick={() => setStep(2)}
                    className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
                    style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 4px 18px rgba(124,110,247,0.35)` }}
                  >
                    Continue <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                {/* Skip — intentionally de-emphasised */}
                <button
                  onClick={handleSkipEmail}
                  className="w-full py-3 rounded-2xl text-sm font-medium border transition-colors hover:bg-black/[0.03]"
                  style={{ color: "#9ca3af", borderColor: "rgba(0,0,0,0.10)" }}
                >
                  Skip for now
                </button>
              </div>
            </>
          )}

          {/* ══════════════════════════
              STEP 3 — Scanning
          ══════════════════════════ */}
          {step === 2 && (
            <>
              <h2 className="text-xl font-extrabold mb-1.5 leading-snug" style={{ color: "#131b2e" }}>
                Kammie is finding your first leads
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Sit tight — this takes just a moment.
              </p>
              <ScanAnimation onDone={handleScanDone} />
            </>
          )}
        </div>

        {/* Subtle dismiss link (only on steps 0-1) */}
        {step < 2 && (
          <div className="pb-5 text-center">
            <button
              onClick={handleClose}
              className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              Skip setup
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
