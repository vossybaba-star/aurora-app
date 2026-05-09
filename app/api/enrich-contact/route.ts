import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ContactFormInfo {
  url: string;
  label: string;
  confidence: 'high' | 'medium' | 'low';
}

interface ContactInfo {
  emails: string[];
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
  linkedin: string | null;
  tiktok: string | null;
  phone: string | null;
  contactForm: ContactFormInfo | null;
}

// Extract emails from text
function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  // Filter out common false positives
  return [...new Set(matches)].filter(email => 
    !email.includes('example.com') &&
    !email.includes('domain.com') &&
    !email.includes('email.com') &&
    !email.includes('sentry.io') &&
    !email.includes('wixpress.com') &&
    !email.includes('.png') &&
    !email.includes('.jpg') &&
    !email.endsWith('.js') &&
    !email.endsWith('.css')
  ).slice(0, 3); // Limit to 3 emails
}

// Extract social media handles from HTML
function extractSocialLinks(html: string, url: string): Partial<ContactInfo> {
  const result: Partial<ContactInfo> = {};
  
  // Instagram - comprehensive patterns
  // First find all instagram.com links in the HTML
  const igMatches: string[] = [];
  const igRegex = /instagram\.com\/([a-zA-Z0-9._]{1,30})/gi;
  let igMatch;
  while ((igMatch = igRegex.exec(html)) !== null) {
    igMatches.push(igMatch[1]);
  }
  
  // Filter out non-profile paths
  const igExclude = ['p', 'reel', 'reels', 'explore', 'accounts', 'about', 'stories', 'direct', 'tv', 'embed', 'developer', 'legal', 'privacy', 'terms', 'help', 'api', 'static'];
  const validIgHandles = igMatches.filter(handle => 
    !igExclude.includes(handle.toLowerCase()) && 
    handle.length > 1 && 
    !handle.includes('.')
  );
  
  if (validIgHandles.length > 0) {
    // Pick the most common handle (likely the business's main account)
    const handleCounts = validIgHandles.reduce((acc, h) => {
      acc[h] = (acc[h] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const mostCommon = Object.entries(handleCounts).sort((a, b) => b[1] - a[1])[0];
    if (mostCommon) {
      result.instagram = `@${mostCommon[0]}`;
    }
  }
  
  // Facebook - comprehensive patterns
  const fbMatches: string[] = [];
  const fbRegex = /facebook\.com\/([a-zA-Z0-9._-]{2,50})/gi;
  let fbMatch;
  while ((fbMatch = fbRegex.exec(html)) !== null) {
    fbMatches.push(fbMatch[1]);
  }
  
  const fbExclude = ['sharer', 'share', 'dialog', 'login', 'plugins', 'sharer.php', 'tr', 'flx', 'pages', 'groups', 'profile.php', 'photo.php', 'watch', 'events', 'help', 'legal', 'privacy', 'policies'];
  const validFbPages = fbMatches.filter(page => 
    !fbExclude.includes(page.toLowerCase()) && 
    page.length > 2 &&
    !page.startsWith('sharer') &&
    !page.includes('?')
  );
  
  if (validFbPages.length > 0) {
    const pageCounts = validFbPages.reduce((acc, p) => {
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const mostCommon = Object.entries(pageCounts).sort((a, b) => b[1] - a[1])[0];
    if (mostCommon) {
      result.facebook = `https://facebook.com/${mostCommon[0]}`;
    }
  }
  
  // Twitter/X
  const twitterPatterns = [
    /href=["'](?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/([a-zA-Z0-9_]+)\/?["']/gi,
    /(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/gi,
  ];
  for (const pattern of twitterPatterns) {
    const match = pattern.exec(html);
    if (match && match[1] && !['share', 'intent', 'home', 'login'].includes(match[1])) {
      result.twitter = `@${match[1]}`;
      break;
    }
  }
  
  // LinkedIn
  const linkedinPatterns = [
    /href=["'](?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:company|in)\/([a-zA-Z0-9-]+)\/?["']/gi,
    /linkedin\.com\/(?:company|in)\/([a-zA-Z0-9-]+)/gi,
  ];
  for (const pattern of linkedinPatterns) {
    const match = pattern.exec(html);
    if (match && match[1] && !['shareArticle', 'share'].includes(match[1])) {
      result.linkedin = `https://linkedin.com/company/${match[1]}`;
      break;
    }
  }
  
  // TikTok
  const tiktokPatterns = [
    /href=["'](?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9._]+)\/?["']/gi,
    /tiktok\.com\/@([a-zA-Z0-9._]+)/gi,
  ];
  for (const pattern of tiktokPatterns) {
    const match = pattern.exec(html);
    if (match && match[1]) {
      result.tiktok = `@${match[1]}`;
      break;
    }
  }
  
  return result;
}

// Extract contact form links
function extractContactForm(html: string, baseUrl: string): ContactFormInfo | null {
  // Keywords that indicate contact/booking/vendor forms - ordered by confidence
  const highConfidencePatterns = [
    { pattern: /href=["']([^"']*(?:vendor|vendors|supplier|partner)[^"']*)["']/gi, label: 'Vendor Application' },
    { pattern: /href=["']([^"']*(?:private-hire|privatehire|hire-us)[^"']*)["']/gi, label: 'Private Hire' },
    { pattern: /href=["']([^"']*(?:wedding|weddings|bridal)[^"']*)["']/gi, label: 'Wedding Enquiry' },
    { pattern: /href=["']([^"']*(?:book-now|booking|reservations)[^"']*)["']/gi, label: 'Booking' },
    { pattern: /href=["']([^"']*(?:apply|application)[^"']*)["']/gi, label: 'Application Form' },
  ];
  
  const mediumConfidencePatterns = [
    { pattern: /href=["']([^"']*(?:enquiry|enquiries|inquiry)[^"']*)["']/gi, label: 'Enquiry Form' },
    { pattern: /href=["']([^"']*(?:events|event-enquiry|corporate)[^"']*)["']/gi, label: 'Events Enquiry' },
    { pattern: /href=["']([^"']*(?:stall|stallholder|market)[^"']*)["']/gi, label: 'Stall Application' },
  ];
  
  const lowConfidencePatterns = [
    { pattern: /href=["']([^"']*contact[^"']*)["']/gi, label: 'Contact Form' },
    { pattern: /href=["']([^"']*get-in-touch[^"']*)["']/gi, label: 'Get in Touch' },
  ];
  
  const allPatterns = [
    ...highConfidencePatterns.map(p => ({ ...p, confidence: 'high' as const })),
    ...mediumConfidencePatterns.map(p => ({ ...p, confidence: 'medium' as const })),
    ...lowConfidencePatterns.map(p => ({ ...p, confidence: 'low' as const })),
  ];
  
  for (const { pattern, label, confidence } of allPatterns) {
    const match = pattern.exec(html);
    if (match && match[1]) {
      let url = match[1];
      
      // Skip common non-form links
      if (url.includes('mailto:') || url.includes('tel:') || url.includes('#') || url.includes('javascript:')) {
        continue;
      }
      
      // Make absolute URL
      if (url.startsWith('/')) {
        try {
          const base = new URL(baseUrl);
          url = `${base.origin}${url}`;
        } catch {
          continue;
        }
      } else if (!url.startsWith('http')) {
        try {
          const base = new URL(baseUrl);
          url = `${base.origin}/${url}`;
        } catch {
          continue;
        }
      }
      
      // Don't follow external links
      try {
        if (!url.includes(new URL(baseUrl).hostname)) {
          continue;
        }
      } catch {
        continue;
      }
      
      return { url, label, confidence };
    }
  }
  
  return null;
}

// Extract phone numbers
function extractPhones(text: string): string | null {
  // Common phone patterns
  const phonePatterns = [
    /tel:["']?([+\d\s()-]{10,})/gi,
    /href=["']tel:([^"']+)["']/gi,
    /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g,
  ];
  
  for (const pattern of phonePatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      const phone = match[1].replace(/\s+/g, ' ').trim();
      if (phone.replace(/\D/g, '').length >= 10) {
        return phone;
      }
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { websiteUrl, placeId } = await request.json();

    if (!websiteUrl && !placeId) {
      return NextResponse.json({ error: "Website URL or Place ID required" }, { status: 400 });
    }

    const contactInfo: ContactInfo = {
      emails: [],
      instagram: null,
      facebook: null,
      twitter: null,
      linkedin: null,
      tiktok: null,
      phone: null,
      contactForm: null,
    };

    // Fetch additional details from Google Places if placeId provided
    if (placeId) {
      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (apiKey) {
        try {
          const resourceName = placeId.startsWith("places/") ? placeId : `places/${placeId}`;
          const response = await fetch(
            `https://places.googleapis.com/v1/${resourceName}`,
            {
              headers: {
                "X-Goog-Api-Key": apiKey,
                "X-Goog-FieldMask": "nationalPhoneNumber,internationalPhoneNumber,websiteUri",
              },
            }
          );
          
          const data = await response.json();
          if (data.nationalPhoneNumber) {
            contactInfo.phone = data.nationalPhoneNumber;
          }
        } catch (err) {
          console.error("[v0] Google Places enrichment error:", err);
        }
      }
    }

    // Scrape website for contact info
    if (websiteUrl) {
      try {
        // Try multiple strategies to fetch the website HTML
        let html = "";
        let fetchSuccess = false;
        
        // Strategy 1: Use corsproxy.io (most reliable)
        try {
          const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(websiteUrl)}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12000);
          
          const response = await fetch(proxyUrl, {
            headers: {
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            signal: controller.signal,
          });
          clearTimeout(timeout);
          
          if (response.ok) {
            html = await response.text();
            if (html && html.length > 500) {
              fetchSuccess = true;
            }
          }
        } catch {
          /* corsproxy fetch failed — try next strategy */
        }
        
        // Strategy 2: Try allorigins if corsproxy failed
        if (!fetchSuccess) {
          try {
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(websiteUrl)}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 12000);
            
            const response = await fetch(proxyUrl, {
              signal: controller.signal,
            });
            clearTimeout(timeout);
            
            if (response.ok) {
              html = await response.text();
              if (html && html.length > 500) {
                fetchSuccess = true;
              }
            }
          } catch {
            /* allorigins fetch failed — try next strategy */
          }
        }
        
        // Strategy 3: Direct fetch as last resort
        if (!fetchSuccess) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            
            const response = await fetch(websiteUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              },
              signal: controller.signal,
            });
            clearTimeout(timeout);
            
            if (response.ok) {
              html = await response.text();
              if (html && html.length > 500) {
                fetchSuccess = true;
              }
            }
          } catch {
            /* direct fetch failed */
          }
        }
        
        if (fetchSuccess && html) {
          
          // Extract emails
          contactInfo.emails = extractEmails(html);
          
          // Extract social links
          const socials = extractSocialLinks(html, websiteUrl);
          Object.assign(contactInfo, socials);
          
          // Log summary of what was found
          
          // Extract phone if not already found
          if (!contactInfo.phone) {
            contactInfo.phone = extractPhones(html);
          }
          
          // Extract contact form link
          contactInfo.contactForm = extractContactForm(html, websiteUrl);
          
          // Try to find contact page and scrape it too
          const contactPagePatterns = [
            /href=["']([^"']*(?:contact|about|connect)[^"']*)["']/gi,
          ];
          
          for (const pattern of contactPagePatterns) {
            const match = pattern.exec(html);
            if (match && match[1]) {
              let contactUrl = match[1];
              // Make absolute URL
              if (contactUrl.startsWith('/')) {
                const baseUrl = new URL(websiteUrl);
                contactUrl = `${baseUrl.origin}${contactUrl}`;
              } else if (!contactUrl.startsWith('http')) {
                continue;
              }
              
              // Don't follow external links
              if (!contactUrl.includes(new URL(websiteUrl).hostname)) {
                continue;
              }
              
              try {
                const contactController = new AbortController();
                const contactTimeout = setTimeout(() => contactController.abort(), 5000);
                
                const contactResponse = await fetch(contactUrl, {
                  headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; ContactBot/1.0)",
                    "Accept": "text/html,application/xhtml+xml",
                  },
                  signal: contactController.signal,
                });
                clearTimeout(contactTimeout);
                
                if (contactResponse.ok) {
                  const contactHtml = await contactResponse.text();
                  
                  // Extract more emails
                  const moreEmails = extractEmails(contactHtml);
                  contactInfo.emails = [...new Set([...contactInfo.emails, ...moreEmails])].slice(0, 3);
                  
                  // Extract more socials (only if not already found)
                  const moreSocials = extractSocialLinks(contactHtml, contactUrl);
                  if (!contactInfo.instagram && moreSocials.instagram) contactInfo.instagram = moreSocials.instagram;
                  if (!contactInfo.facebook && moreSocials.facebook) contactInfo.facebook = moreSocials.facebook;
                  if (!contactInfo.twitter && moreSocials.twitter) contactInfo.twitter = moreSocials.twitter;
                  if (!contactInfo.linkedin && moreSocials.linkedin) contactInfo.linkedin = moreSocials.linkedin;
                  if (!contactInfo.tiktok && moreSocials.tiktok) contactInfo.tiktok = moreSocials.tiktok;
                  
                  // Extract phone
                  if (!contactInfo.phone) {
                    contactInfo.phone = extractPhones(contactHtml);
                  }
                }
              } catch {
                // Ignore contact page errors
              }
              break; // Only try first contact page
            }
          }
        } else {
        }
      } catch (err) {
        console.error("[v0] Website scrape error:", err);
      }
    }

    return NextResponse.json({ 
      success: true,
      contactInfo,
    });

  } catch (error) {
    console.error("[v0] Enrich contact error:", error);
    return NextResponse.json({ error: "Failed to enrich contact" }, { status: 500 });
  }
}
