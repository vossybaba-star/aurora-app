/**
 * lib/roles.ts
 *
 * Single source of truth for every role Aurora supports.
 * Pure config — no API calls, no side effects, no imports.
 *
 * Exported:
 *   RoleCategory       — top-level grouping
 *   TargetMarket       — all possible lead target types
 *   RoleConfig         — shape of a single role
 *   ROLES              — flat array of all role configs
 *   ROLES_BY_CATEGORY  — same data grouped for UI pickers
 *   getRoleById        — lookup by id
 *   getRolesByCategory — filter by category
 */

// ─── Category ─────────────────────────────────────────────────────────────────

export type RoleCategory =
  | "creative_visual"
  | "production_film"
  | "events_hospitality"
  | "business_professional"
  | "wellness_personal"
  | "tech_digital"
  | "media_publishing"
  | "other";

export const ROLE_CATEGORY_LABELS: Record<RoleCategory, string> = {
  creative_visual:       "Creative & Visual",
  production_film:       "Production & Film",
  events_hospitality:    "Events & Hospitality",
  business_professional: "Business & Professional",
  wellness_personal:     "Wellness & Personal",
  tech_digital:          "Tech & Digital",
  media_publishing:      "Media & Publishing",
  other:                 "Other",
};

export const ROLE_CATEGORY_EMOJI: Record<RoleCategory, string> = {
  creative_visual:       "🎨",
  production_film:       "🎬",
  events_hospitality:    "🎪",
  business_professional: "💼",
  wellness_personal:     "🧘",
  tech_digital:          "💻",
  media_publishing:      "📰",
  other:                 "✳️",
};

export const TARGET_MARKET_LABELS: Record<TargetMarket, string> = {
  venues:               "Wedding & Event Venues",
  wedding_planners:     "Wedding Planners",
  luxury_hotels:        "Luxury Hotels",
  florists_suppliers:   "Florists & Suppliers",
  beauty_brands:        "Beauty Brands",
  fashion_agencies:     "Fashion Agencies",
  pr_talent_agencies:   "PR & Talent Agencies",
  bridal_boutiques:     "Bridal Boutiques",
  film_tv_production:   "Film & TV Production",
  editorial_magazines:  "Editorial & Magazines",
  investors_vcs:        "Investors & VCs",
  accelerators:         "Accelerators",
  enterprise_companies: "Enterprise Companies",
  co_founders_partners: "Co-founders & Partners",
  industry_press:       "Industry Press",
  corporate_clients:    "Corporate Clients",
  hospitality_hotels:   "Hospitality & Hotels",
  retail_brands:        "Retail Brands",
  music_entertainment:  "Music & Entertainment",
  sport_wellness:       "Sport & Wellness",
};

// ─── Target markets ───────────────────────────────────────────────────────────

export type TargetMarket =
  | "venues"
  | "wedding_planners"
  | "luxury_hotels"
  | "florists_suppliers"
  | "beauty_brands"
  | "fashion_agencies"
  | "pr_talent_agencies"
  | "bridal_boutiques"
  | "film_tv_production"
  | "editorial_magazines"
  | "investors_vcs"
  | "accelerators"
  | "enterprise_companies"
  | "co_founders_partners"
  | "industry_press"
  | "corporate_clients"
  | "hospitality_hotels"
  | "retail_brands"
  | "music_entertainment"
  | "sport_wellness";

// ─── RoleConfig ───────────────────────────────────────────────────────────────

export interface RoleConfig {
  /** Unique snake_case identifier */
  id: string;
  /** Human-readable display name */
  label: string;
  /** Top-level grouping */
  category: RoleCategory;
  /** Lead types this role primarily pursues */
  defaultTargetMarkets: TargetMarket[];
  /**
   * Keywords sent to Apollo's q_organization_keyword_tags when searching
   * companies for this role. Be specific — broad tags waste credits.
   */
  companyKeywords: string[];
  /**
   * Natural-language description of the contact titles to search for.
   * Used in Apollo's person_titles search and in copy-engine prompts.
   * E.g. "Head of Events, Event Coordinator, Venue Manager"
   */
  contactKeywords: string;
  /**
   * Short context injected into the copy engine so Claude understands
   * what this professional offers and why a given lead matters.
   * 1–2 sentences max.
   */
  pitchContext: string;
  /** Label shown in the UI while Aurora is scanning for leads */
  scanningLabel: string;
}

// ─── ROLES ────────────────────────────────────────────────────────────────────

export const ROLES: RoleConfig[] = [

  // ── CREATIVE & VISUAL ── Photography ──────────────────────────────────────

  {
    id:                   "wedding_photographer",
    label:                "Wedding Photographer",
    category:             "creative_visual",
    defaultTargetMarkets: ["venues", "wedding_planners", "luxury_hotels", "florists_suppliers"],
    companyKeywords:      ["wedding venue", "country house hotel", "wedding planning", "bridal", "luxury events"],
    contactKeywords:      "Venue Manager, Wedding Coordinator, Events Manager, Director of Events, Hospitality Manager",
    pitchContext:         "A wedding photographer seeking preferred supplier relationships with venues and planners. They want to be on recommended supplier lists and build long-term referral partnerships.",
    scanningLabel:        "Scanning wedding venues and planners…",
  },

  {
    id:                   "events_photographer",
    label:                "Events Photographer",
    category:             "creative_visual",
    defaultTargetMarkets: ["corporate_clients", "luxury_hotels", "pr_talent_agencies", "venues"],
    companyKeywords:      ["corporate events", "conference", "awards", "hospitality", "PR agency", "experiential"],
    contactKeywords:      "Events Manager, Head of Events, PR Manager, Marketing Manager, Brand Manager",
    pitchContext:         "An events photographer who covers corporate conferences, awards nights and brand activations. They want retained contracts with event agencies and direct relationships with in-house events teams.",
    scanningLabel:        "Scanning events agencies and corporate clients…",
  },

  {
    id:                   "commercial_photographer",
    label:                "Commercial Photographer",
    category:             "creative_visual",
    defaultTargetMarkets: ["retail_brands", "beauty_brands", "fashion_agencies", "pr_talent_agencies"],
    companyKeywords:      ["brand", "advertising", "creative agency", "retail", "e-commerce", "product photography"],
    contactKeywords:      "Creative Director, Art Director, Brand Manager, Marketing Director, Head of Content",
    pitchContext:         "A commercial photographer who shoots product, lifestyle and campaign imagery for brands and agencies. They pitch for project briefs and retained content contracts.",
    scanningLabel:        "Scanning brands and creative agencies…",
  },

  {
    id:                   "editorial_photographer",
    label:                "Editorial Photographer",
    category:             "creative_visual",
    defaultTargetMarkets: ["editorial_magazines", "fashion_agencies", "pr_talent_agencies", "beauty_brands"],
    companyKeywords:      ["magazine", "publishing", "fashion editorial", "lifestyle media", "PR", "talent agency"],
    contactKeywords:      "Photo Editor, Picture Editor, Fashion Editor, Art Director, Creative Director",
    pitchContext:         "An editorial photographer whose work appears in magazines and press. They want commissions from publications and relationships with fashion and talent PR agencies who book photographers for shoots.",
    scanningLabel:        "Scanning publications and PR agencies…",
  },

  {
    id:                   "portrait_photographer",
    label:                "Portrait Photographer",
    category:             "creative_visual",
    defaultTargetMarkets: ["corporate_clients", "pr_talent_agencies", "retail_brands", "editorial_magazines"],
    companyKeywords:      ["talent agency", "casting", "professional headshots", "corporate", "law firm", "financial services"],
    contactKeywords:      "Talent Agent, Office Manager, HR Director, Marketing Manager, Operations Manager",
    pitchContext:         "A portrait photographer who shoots headshots, personal branding imagery and corporate team portraits. They target talent agencies, professional services firms and growing companies who need high-quality imagery of their people.",
    scanningLabel:        "Scanning talent agencies and professional firms…",
  },

  // ── CREATIVE & VISUAL ── MUA ───────────────────────────────────────────────

  {
    id:                   "bridal_mua",
    label:                "Bridal MUA",
    category:             "creative_visual",
    defaultTargetMarkets: ["bridal_boutiques", "venues", "wedding_planners", "luxury_hotels"],
    companyKeywords:      ["bridal boutique", "wedding venue", "wedding planning", "bridal hair", "luxury bridal"],
    contactKeywords:      "Wedding Coordinator, Bridal Consultant, Venue Manager, Wedding Planner, Owner",
    pitchContext:         "A bridal makeup artist who specialises in wedding-day and trial makeup. They want to be on recommended supplier lists at venues and bridal boutiques, and build relationships with wedding planners who refer clients directly.",
    scanningLabel:        "Scanning bridal boutiques and wedding venues…",
  },

  {
    id:                   "editorial_mua",
    label:                "Editorial MUA",
    category:             "creative_visual",
    defaultTargetMarkets: ["editorial_magazines", "fashion_agencies", "pr_talent_agencies", "beauty_brands"],
    companyKeywords:      ["fashion magazine", "beauty editorial", "modelling agency", "PR agency", "luxury brand", "cosmetics"],
    contactKeywords:      "Fashion Editor, Beauty Editor, Creative Director, Art Director, Talent Agent",
    pitchContext:         "An editorial makeup artist whose work appears in fashion and beauty publications. They pitch to photo editors and creative directors for shoot commissions, and to PR agencies who book artists for brand campaigns.",
    scanningLabel:        "Scanning magazines and modelling agencies…",
  },

  {
    id:                   "film_tv_mua",
    label:                "Film & TV MUA",
    category:             "creative_visual",
    defaultTargetMarkets: ["film_tv_production", "music_entertainment", "pr_talent_agencies"],
    companyKeywords:      ["film production", "television", "streaming", "broadcast", "commercial production", "casting"],
    contactKeywords:      "Head of Makeup, Production Manager, Line Producer, Casting Director, Producer",
    pitchContext:         "A makeup artist with screen credits in film, TV or commercial production. They want to be known to production companies, line producers and heads of department who build their crew lists.",
    scanningLabel:        "Scanning film and TV production companies…",
  },

  {
    id:                   "commercial_mua",
    label:                "Commercial MUA",
    category:             "creative_visual",
    defaultTargetMarkets: ["beauty_brands", "fashion_agencies", "pr_talent_agencies", "retail_brands"],
    companyKeywords:      ["beauty brand", "cosmetics", "advertising agency", "creative agency", "skincare", "fragrance"],
    contactKeywords:      "Brand Manager, Creative Director, Art Director, Head of Marketing, Campaign Producer",
    pitchContext:         "A makeup artist who works on brand campaigns, product launches and advertising shoots. They want relationships with in-house brand teams and creative agencies who hire freelance artists for commercial projects.",
    scanningLabel:        "Scanning beauty brands and advertising agencies…",
  },

  // ── CREATIVE & VISUAL ── Styling ──────────────────────────────────────────

  {
    id:                   "fashion_stylist",
    label:                "Fashion Stylist",
    category:             "creative_visual",
    defaultTargetMarkets: ["fashion_agencies", "editorial_magazines", "pr_talent_agencies", "beauty_brands"],
    companyKeywords:      ["fashion agency", "modelling agency", "fashion magazine", "luxury brand", "PR agency", "e-commerce"],
    contactKeywords:      "Fashion Editor, Creative Director, Casting Director, Brand Manager, Art Director",
    pitchContext:         "A fashion stylist who works across editorial shoots, lookbooks and campaign imagery. They want to be on the go-to lists for creative directors, fashion editors and e-commerce brands who commission stylists regularly.",
    scanningLabel:        "Scanning fashion agencies and publications…",
  },

  {
    id:                   "celebrity_stylist",
    label:                "Celebrity Stylist",
    category:             "creative_visual",
    defaultTargetMarkets: ["pr_talent_agencies", "music_entertainment", "fashion_agencies", "editorial_magazines"],
    companyKeywords:      ["talent management", "celebrity PR", "music management", "entertainment agency", "luxury fashion"],
    contactKeywords:      "Talent Manager, Artist Manager, PR Director, Personal Assistant, Head of Talent",
    pitchContext:         "A stylist who dresses high-profile talent for red carpets, press tours and public appearances. They want to be known to talent managers, PR agencies and artist management companies who handle clients' public-facing image.",
    scanningLabel:        "Scanning talent agencies and entertainment PR…",
  },

  {
    id:                   "commercial_stylist",
    label:                "Commercial Stylist",
    category:             "creative_visual",
    defaultTargetMarkets: ["retail_brands", "fashion_agencies", "beauty_brands", "editorial_magazines"],
    companyKeywords:      ["retail brand", "e-commerce", "advertising", "creative studio", "product styling", "catalogue"],
    contactKeywords:      "Creative Director, Art Director, Brand Manager, Studio Manager, Marketing Director",
    pitchContext:         "A stylist who works on product and lifestyle shoots for retail brands and advertising agencies. They want recurring project work from in-house creative teams and production studios who need a reliable commercial stylist.",
    scanningLabel:        "Scanning retail brands and creative studios…",
  },

  // ── PRODUCTION & FILM ─────────────────────────────────────────────────────

  {
    id:                   "wedding_videographer",
    label:                "Wedding Videographer",
    category:             "production_film",
    defaultTargetMarkets: ["venues", "wedding_planners", "luxury_hotels", "florists_suppliers"],
    companyKeywords:      ["wedding venue", "country house hotel", "wedding planning", "bridal", "luxury wedding"],
    contactKeywords:      "Wedding Coordinator, Venue Manager, Events Director, Wedding Planner, Owner",
    pitchContext:         "A wedding videographer who creates cinematic films for couples on their wedding day. They want preferred supplier status at venues and close referral relationships with wedding planners who recommend videographers to their clients.",
    scanningLabel:        "Scanning wedding venues and coordinators…",
  },

  {
    id:                   "commercial_videographer",
    label:                "Commercial Videographer",
    category:             "production_film",
    defaultTargetMarkets: ["retail_brands", "corporate_clients", "pr_talent_agencies", "beauty_brands"],
    companyKeywords:      ["creative agency", "brand video", "content production", "advertising", "corporate video", "social media"],
    contactKeywords:      "Head of Content, Creative Director, Marketing Manager, Brand Manager, Social Media Manager",
    pitchContext:         "A videographer and director who produces brand films, product videos and social-first content. They want recurring briefs from marketing teams and creative agencies who need high-quality video content at pace.",
    scanningLabel:        "Scanning brands and content agencies…",
  },

  {
    id:                   "documentary_filmmaker",
    label:                "Documentary Filmmaker",
    category:             "production_film",
    defaultTargetMarkets: ["film_tv_production", "editorial_magazines", "industry_press", "corporate_clients"],
    companyKeywords:      ["documentary production", "broadcast", "streaming platform", "film fund", "arts foundation", "journalism"],
    contactKeywords:      "Commissioning Editor, Executive Producer, Development Producer, Head of Documentaries",
    pitchContext:         "A documentary filmmaker with credits in long-form and short-form factual content. They want to pitch development slates to commissioning editors and build relationships with production companies who co-produce documentary projects.",
    scanningLabel:        "Scanning broadcasters and production companies…",
  },

  {
    id:                   "music_video_director",
    label:                "Music Video Director",
    category:             "production_film",
    defaultTargetMarkets: ["music_entertainment", "pr_talent_agencies", "fashion_agencies"],
    companyKeywords:      ["music label", "record label", "artist management", "music publishing", "entertainment agency"],
    contactKeywords:      "A&R Manager, Music Video Commissioner, Artist Manager, Creative Director, Label Manager",
    pitchContext:         "A director who creates music videos for artists and labels. They want to be known to A&R teams, artist managers and label creative departments who commission video directors for new releases.",
    scanningLabel:        "Scanning music labels and artist management…",
  },

  {
    id:                   "content_creator",
    label:                "Content Creator",
    category:             "production_film",
    defaultTargetMarkets: ["beauty_brands", "retail_brands", "pr_talent_agencies", "fashion_agencies"],
    companyKeywords:      ["influencer marketing", "social media agency", "brand partnership", "creator economy", "content studio"],
    contactKeywords:      "Influencer Manager, Partnership Manager, Social Media Manager, Brand Manager, Head of Digital",
    pitchContext:         "A content creator who produces short-form video and photo content for brands across social platforms. They want paid partnership briefs and ambassador deals from brands and influencer agencies that work with creators in their niche.",
    scanningLabel:        "Scanning brands and influencer agencies…",
  },

  // ── EVENTS & HOSPITALITY ──────────────────────────────────────────────────

  {
    id:                   "wedding_planner",
    label:                "Wedding Planner",
    category:             "events_hospitality",
    defaultTargetMarkets: ["venues", "luxury_hotels", "florists_suppliers", "bridal_boutiques"],
    companyKeywords:      ["wedding venue", "luxury hotel", "country house", "estate", "private hire venue"],
    contactKeywords:      "Venue Manager, Events Director, Director of Sales, General Manager, Hospitality Manager",
    pitchContext:         "A wedding planner who manages full-service and partial-planning packages for couples. They want preferred planner status at venues and relationships with suppliers who can refer planning-only enquiries their way.",
    scanningLabel:        "Scanning venues and luxury hotels…",
  },

  {
    id:                   "corporate_events_planner",
    label:                "Corporate Events Planner",
    category:             "events_hospitality",
    defaultTargetMarkets: ["corporate_clients", "hospitality_hotels", "luxury_hotels", "venues"],
    companyKeywords:      ["corporate events", "conference venue", "incentive travel", "awards ceremony", "team building", "MICE"],
    contactKeywords:      "Head of Events, EA to CEO, Office Manager, Marketing Director, Executive Assistant",
    pitchContext:         "A corporate events planner who designs and delivers conferences, awards nights and incentive programmes. They want to be the trusted agency on retainer for mid-to-large businesses who hold regular events.",
    scanningLabel:        "Scanning corporate venues and companies…",
  },

  {
    id:                   "florist",
    label:                "Florist",
    category:             "events_hospitality",
    defaultTargetMarkets: ["venues", "wedding_planners", "luxury_hotels", "corporate_clients"],
    companyKeywords:      ["wedding venue", "luxury hotel", "event space", "wedding planning", "country house"],
    contactKeywords:      "Wedding Coordinator, Venue Manager, Events Manager, Wedding Planner, F&B Manager",
    pitchContext:         "A florist specialising in wedding and event floristry. They want to be the recommended florist at venues and to build tight referral relationships with wedding planners who need a reliable floral partner for their clients.",
    scanningLabel:        "Scanning wedding venues and planners…",
  },

  {
    id:                   "cake_artist",
    label:                "Cake Artist",
    category:             "events_hospitality",
    defaultTargetMarkets: ["venues", "wedding_planners", "luxury_hotels", "bridal_boutiques"],
    companyKeywords:      ["wedding venue", "bridal boutique", "wedding planning", "patisserie", "luxury events"],
    contactKeywords:      "Wedding Coordinator, Venue Manager, Wedding Planner, Bridal Consultant, Events Manager",
    pitchContext:         "A cake designer who creates bespoke celebration and wedding cakes. They want to be on the recommended supplier lists at venues and to work with wedding planners whose clients need a statement cake as part of their day.",
    scanningLabel:        "Scanning wedding venues and bridal boutiques…",
  },

  {
    id:                   "musician_entertainer",
    label:                "Musician / Entertainer",
    category:             "events_hospitality",
    defaultTargetMarkets: ["venues", "wedding_planners", "hospitality_hotels", "corporate_clients"],
    companyKeywords:      ["wedding venue", "entertainment agency", "live music", "hotel", "event production", "private members club"],
    contactKeywords:      "Entertainment Manager, Events Manager, Wedding Coordinator, F&B Director, General Manager",
    pitchContext:         "A musician or live entertainer who performs at weddings, corporate events and private functions. They want to be on preferred supplier lists at venues and to work with entertainment agencies who book acts for clients.",
    scanningLabel:        "Scanning venues and entertainment agencies…",
  },

  // ── BUSINESS & PROFESSIONAL ───────────────────────────────────────────────

  {
    id:                   "startup_founder_b2b",
    label:                "Startup Founder (B2B)",
    category:             "business_professional",
    defaultTargetMarkets: ["investors_vcs", "accelerators", "enterprise_companies", "co_founders_partners"],
    companyKeywords:      ["venture capital", "angel investment", "startup accelerator", "SaaS", "enterprise software", "B2B technology"],
    contactKeywords:      "Partner, Investment Manager, Venture Partner, Head of Partnerships, Chief of Staff",
    pitchContext:         "A B2B startup founder seeking investment, strategic partnerships or enterprise pilot customers. They want warm introductions to investors, accelerator programme leads and heads of innovation at enterprise companies.",
    scanningLabel:        "Scanning investors and enterprise companies…",
  },

  {
    id:                   "startup_founder_consumer",
    label:                "Startup Founder (Consumer)",
    category:             "business_professional",
    defaultTargetMarkets: ["investors_vcs", "retail_brands", "pr_talent_agencies", "accelerators"],
    companyKeywords:      ["consumer brand", "D2C", "retail investment", "angel network", "consumer VC", "brand accelerator"],
    contactKeywords:      "Investor, Brand Director, Head of Partnerships, Retail Buyer, Consumer Fund Partner",
    pitchContext:         "A consumer startup founder building a direct-to-consumer brand. They want investment conversations, retail distribution deals and PR partnerships to grow brand awareness and reach.",
    scanningLabel:        "Scanning investors and retail partners…",
  },

  {
    id:                   "freelance_consultant",
    label:                "Freelance Consultant",
    category:             "business_professional",
    defaultTargetMarkets: ["enterprise_companies", "corporate_clients", "co_founders_partners", "retail_brands"],
    companyKeywords:      ["management consulting", "strategy", "operations", "interim", "advisory", "professional services"],
    contactKeywords:      "CEO, COO, Director of Strategy, Head of Operations, Chief of Staff, Managing Director",
    pitchContext:         "A freelance strategic or operational consultant who embeds into businesses for fixed-term projects. They want to build relationships with senior leaders at growth-stage and mid-market companies who bring in external expertise.",
    scanningLabel:        "Scanning mid-market and growth companies…",
  },

  {
    id:                   "brand_designer",
    label:                "Brand Designer",
    category:             "business_professional",
    defaultTargetMarkets: ["retail_brands", "corporate_clients", "pr_talent_agencies", "co_founders_partners"],
    companyKeywords:      ["brand identity", "creative agency", "startup", "rebrand", "packaging design", "luxury brand"],
    contactKeywords:      "Founder, Marketing Director, Head of Brand, Creative Director, Head of Marketing",
    pitchContext:         "A brand and identity designer who creates visual systems for new and rebranding companies. They want relationships with founders and marketing directors at startups and growing businesses who need a strong brand to compete.",
    scanningLabel:        "Scanning startups and brands…",
  },

  {
    id:                   "ux_designer",
    label:                "UX Designer",
    category:             "business_professional",
    defaultTargetMarkets: ["enterprise_companies", "corporate_clients", "co_founders_partners", "investors_vcs"],
    companyKeywords:      ["product design", "UX research", "digital product", "app development", "SaaS", "fintech"],
    contactKeywords:      "Head of Product, CTO, Product Manager, Design Lead, VP of Product",
    pitchContext:         "A UX designer who works on digital products, apps and web platforms. They want project-based and embedded engagements with product teams at SaaS companies, fintechs and digital agencies who need design resource.",
    scanningLabel:        "Scanning product teams and digital companies…",
  },

  {
    id:                   "web_developer",
    label:                "Web Developer",
    category:             "business_professional",
    defaultTargetMarkets: ["retail_brands", "corporate_clients", "co_founders_partners", "pr_talent_agencies"],
    companyKeywords:      ["web agency", "digital agency", "e-commerce", "Shopify", "WordPress", "web development"],
    contactKeywords:      "Head of Digital, Technical Director, Marketing Manager, Founder, Operations Director",
    pitchContext:         "A freelance web developer who builds and maintains websites for businesses and agencies. They want direct client relationships with SMEs who need ongoing development support, and subcontract work from digital agencies.",
    scanningLabel:        "Scanning agencies and digital businesses…",
  },

  {
    id:                   "copywriter",
    label:                "Copywriter",
    category:             "business_professional",
    defaultTargetMarkets: ["pr_talent_agencies", "retail_brands", "corporate_clients", "beauty_brands"],
    companyKeywords:      ["content agency", "PR agency", "brand copywriting", "advertising", "editorial", "content marketing"],
    contactKeywords:      "Head of Content, Copy Director, Brand Manager, Marketing Director, PR Manager",
    pitchContext:         "A copywriter who creates brand copy, campaigns and editorial content for agencies and in-house teams. They want retained relationships with heads of content and brand managers at agencies and direct clients who need consistent quality writing.",
    scanningLabel:        "Scanning agencies and brand teams…",
  },

  {
    id:                   "pr_freelancer",
    label:                "PR Freelancer",
    category:             "business_professional",
    defaultTargetMarkets: ["retail_brands", "beauty_brands", "fashion_agencies", "corporate_clients"],
    companyKeywords:      ["PR agency", "communications", "media relations", "brand PR", "consumer PR", "luxury PR"],
    contactKeywords:      "Founder, Managing Director, Head of PR, Brand Director, Communications Director",
    pitchContext:         "A freelance PR consultant who manages press and media relations for brands and agencies. They want retained client work from brands who need senior PR thinking without the full-agency overhead, and overflow project work from agencies.",
    scanningLabel:        "Scanning brands and PR agencies…",
  },

  {
    id:                   "marketing_consultant",
    label:                "Marketing Consultant",
    category:             "business_professional",
    defaultTargetMarkets: ["retail_brands", "corporate_clients", "co_founders_partners", "beauty_brands"],
    companyKeywords:      ["growth marketing", "digital marketing", "marketing strategy", "brand strategy", "CMO advisory", "scale-up"],
    contactKeywords:      "Founder, CMO, Head of Marketing, Marketing Director, VP Marketing",
    pitchContext:         "A marketing consultant who helps growing companies build and execute their go-to-market strategy. They want fractional CMO or project-based engagements with founders and marketing leaders at scale-ups and established SMEs.",
    scanningLabel:        "Scanning scale-ups and growing businesses…",
  },

  // ── WELLNESS & PERSONAL ───────────────────────────────────────────────────

  {
    id:                   "personal_trainer",
    label:                "Personal Trainer",
    category:             "wellness_personal",
    defaultTargetMarkets: ["sport_wellness", "corporate_clients", "hospitality_hotels", "luxury_hotels"],
    companyKeywords:      ["gym", "fitness studio", "corporate wellness", "health club", "luxury hotel gym", "private members club"],
    contactKeywords:      "Gym Manager, Wellness Director, Head of Fitness, Corporate Wellness Manager, General Manager",
    pitchContext:         "A personal trainer who works with private clients and corporate wellness programmes. They want to rent floor space or partner with premium gyms and hotels, and to connect with HR and wellbeing leads at companies who offer employee fitness benefits.",
    scanningLabel:        "Scanning gyms and wellness studios…",
  },

  {
    id:                   "yoga_instructor",
    label:                "Yoga Instructor",
    category:             "wellness_personal",
    defaultTargetMarkets: ["sport_wellness", "corporate_clients", "hospitality_hotels", "luxury_hotels"],
    companyKeywords:      ["yoga studio", "wellness centre", "corporate wellbeing", "retreat", "spa hotel", "mindfulness"],
    contactKeywords:      "Studio Manager, Wellness Director, HR Manager, Retreat Manager, Operations Director",
    pitchContext:         "A yoga teacher who teaches group classes and offers corporate workplace sessions. They want studio partnerships, retreat collaborations and relationships with HR leaders at companies who invest in employee wellbeing programmes.",
    scanningLabel:        "Scanning yoga studios and wellness venues…",
  },

  {
    id:                   "life_coach",
    label:                "Life Coach",
    category:             "wellness_personal",
    defaultTargetMarkets: ["corporate_clients", "co_founders_partners", "sport_wellness"],
    companyKeywords:      ["executive coaching", "leadership development", "HR consulting", "wellbeing", "coaching platform", "professional development"],
    contactKeywords:      "HR Director, Head of People, L&D Manager, Chief People Officer, Founder",
    pitchContext:         "A life and executive coach who works with senior professionals and founders on performance, clarity and leadership. They want relationships with HR leaders, people teams and founder communities who bring in coaches as part of their development programmes.",
    scanningLabel:        "Scanning corporate people teams and founder networks…",
  },

  {
    id:                   "nutritionist",
    label:                "Nutritionist",
    category:             "wellness_personal",
    defaultTargetMarkets: ["corporate_clients", "sport_wellness", "hospitality_hotels", "beauty_brands"],
    companyKeywords:      ["corporate wellness", "nutrition clinic", "sports nutrition", "food brand", "health technology", "wellbeing programme"],
    contactKeywords:      "Wellness Director, HR Manager, Head of People, Sports Scientist, Brand Manager",
    pitchContext:         "A registered nutritionist who works with private clients and corporate wellness programmes. They want speaking opportunities, corporate nutrition workshops and content partnerships with health brands who need expert nutrition input.",
    scanningLabel:        "Scanning wellness programmes and health brands…",
  },

];

// ─── Grouped by category ──────────────────────────────────────────────────────

export const ROLES_BY_CATEGORY: Record<RoleCategory, RoleConfig[]> = {
  creative_visual:       ROLES.filter((r) => r.category === "creative_visual"),
  production_film:       ROLES.filter((r) => r.category === "production_film"),
  events_hospitality:    ROLES.filter((r) => r.category === "events_hospitality"),
  business_professional: ROLES.filter((r) => r.category === "business_professional"),
  wellness_personal:     ROLES.filter((r) => r.category === "wellness_personal"),
  tech_digital:          ROLES.filter((r) => r.category === "tech_digital"),
  media_publishing:      ROLES.filter((r) => r.category === "media_publishing"),
  other:                 ROLES.filter((r) => r.category === "other"),
};

// ─── Utilities ────────────────────────────────────────────────────────────────

export function getRoleById(id: string): RoleConfig | undefined {
  return ROLES.find((r) => r.id === id);
}

export function getRolesByCategory(category: RoleCategory): RoleConfig[] {
  return ROLES_BY_CATEGORY[category] ?? [];
}
