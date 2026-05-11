"use client";

import { useState } from "react";

const ACCENT  = "#7c6ef7";
const ACCENT2 = "#9585f9";

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}

/**
 * Three-tier logo lookup:
 *  1. Apollo CDN logo_url (proxied to avoid CORS)
 *  2. Clearbit by primary_domain
 *  3. Gradient initials fallback
 */
export function CompanyLogo({
  name, domain, logoUrl, size = "md",
}: {
  name:      string;
  domain?:   string | null;
  logoUrl?:  string | null;
  size?:     "sm" | "md" | "lg";
}) {
  const [apolloFailed,   setApolloFailed]   = useState(false);
  const [clearbitFailed, setClearbitFailed] = useState(false);

  const sz = size === "lg"
    ? "w-14 h-14 text-base rounded-2xl"
    : size === "sm"
      ? "w-7 h-7 text-[10px] rounded-xl"
      : "w-9 h-9 text-xs rounded-xl";

  if (logoUrl && !apolloFailed) {
    return (
      <div className={`${sz} overflow-hidden shrink-0 bg-white border border-white/60 flex items-center justify-center shadow-sm`}>
        <img
          src={`/api/logo?url=${encodeURIComponent(logoUrl)}`}
          alt={name}
          className="w-full h-full object-contain p-0.5"
          onError={() => setApolloFailed(true)}
        />
      </div>
    );
  }

  if (domain && !clearbitFailed) {
    return (
      <div className={`${sz} overflow-hidden shrink-0 bg-white border border-white/60 flex items-center justify-center shadow-sm`}>
        <img
          src={`/api/logo?domain=${encodeURIComponent(domain)}`}
          alt={name}
          className="w-full h-full object-contain p-0.5"
          onError={() => setClearbitFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${sz} flex items-center justify-center shrink-0 font-bold text-white shadow-sm`}
      style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}
    >
      {initials(name)}
    </div>
  );
}

/** Derive best-guess domain from an organisation name string. */
export function deriveOrgDomain(orgName: string): string {
  return (
    orgName
      .toLowerCase()
      .replace(/\s+(inc|llc|ltd|corp|limited|group|co|plc|gmbh|sas|bv|nv)\.?$/i, "")
      .replace(/[^a-z0-9]/g, "") + ".com"
  );
}
