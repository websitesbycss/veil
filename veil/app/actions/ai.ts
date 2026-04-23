"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EMAIL_TYPES = [
  "inquiry_response",
  "booking_confirmation",
  "two_week_checkin",
  "gallery_delivery",
  "anniversary_outreach",
] as const;

type EmailType = (typeof EMAIL_TYPES)[number];

const EMAIL_TYPE_DESCRIPTIONS: Record<EmailType, string> = {
  inquiry_response:
    "A warm, professional response to a new inquiry from a couple interested in booking wedding photography.",
  booking_confirmation:
    "A confirmation email after the couple has signed the contract and paid the retainer. Express excitement, outline next steps.",
  two_week_checkin:
    "A check-in email sent two weeks before the wedding. Confirm the timeline, ask for any final details, and reassure the couple.",
  gallery_delivery:
    "An email announcing that the couple's wedding gallery is ready for viewing. Include the gallery link placeholder [GALLERY_LINK].",
  anniversary_outreach:
    "A warm anniversary email reaching out to a past couple on their anniversary. Mention the wedding fondly, keep it personal.",
};

const generateEmailSchema = z.object({
  weddingId: z.string().uuid(),
  emailType: z.enum(EMAIL_TYPES),
  additionalContext: z.string().max(1000).optional(),
});

const updateDraftStatusSchema = z.object({
  draftId: z.string().uuid(),
  status: z.enum(["approved", "sent"]),
});

const generateQuoteSchema = z.object({
  weddingId: z.string().uuid(),
  hoursRequested: z.coerce.number().int().min(1).max(24),
  styleComplexity: z.enum(["simple", "standard", "premium", "luxury"]),
  includeSecondShooter: z
    .union([z.literal("true"), z.literal("false"), z.literal("on"), z.literal("")])
    .optional(),
  includeEngagement: z
    .union([z.literal("true"), z.literal("false"), z.literal("on"), z.literal("")])
    .optional(),
  basePriceFloor: z.coerce.number().int().min(0).max(100000).optional(),
  additionalContext: z.string().max(1000).optional(),
});

function getSeason(date: Date): "spring" | "summer" | "fall" | "winter" {
  const m = date.getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

const generateBlogSchema = z.object({
  weddingId: z.string().uuid(),
  targetCity: z.string().min(1).max(100),
  imageUrls: z.string().max(5000).optional(),
  keyMoments: z.string().max(2000).optional(),
});

async function getPhotographerAndWedding(weddingId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: photographer } = await supabase
    .from("photographers")
    .select("id, studio_name, style_notes")
    .eq("auth_user_id", user.id)
    .single();
  if (!photographer) return null;

  type WeddingWithClients = {
    id: string;
    wedding_date: string | null;
    venue_name: string | null;
    drive_time_minutes: number | null;
    style_vibe: string | null;
    client1: { first_name: string; last_name: string } | null;
    client2: { first_name: string; last_name: string } | null;
  };
  const { data: wedding } = (await supabase
    .from("weddings")
    .select(
      `id, wedding_date, venue_name, drive_time_minutes, style_vibe,
       client1:clients!weddings_client1_id_fkey(first_name, last_name),
       client2:clients!weddings_client2_id_fkey(first_name, last_name)`
    )
    .eq("id", weddingId)
    .eq("photographer_id", photographer.id)
    .single()) as { data: WeddingWithClients | null; error: unknown };
  if (!wedding) return null;

  const { data: samples } = await supabase
    .from("email_samples")
    .select("subject, body")
    .eq("photographer_id", photographer.id)
    .order("created_at", { ascending: false })
    .limit(3);

  return { supabase, photographer, wedding, samples: samples ?? [] };
}

export async function generateEmailDraft(formData: FormData) {
  const parsed = generateEmailSchema.safeParse({
    weddingId: formData.get("weddingId"),
    emailType: formData.get("emailType"),
    additionalContext: formData.get("additionalContext") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { weddingId, emailType, additionalContext } = parsed.data;
  const ctx = await getPhotographerAndWedding(weddingId);
  if (!ctx) return { error: "Not authorized." };

  const { supabase, photographer, wedding, samples } = ctx;

  // Build few-shot system prompt with prompt caching on the static parts
  const studioName = photographer.studio_name ?? "the studio";

  const c1 = wedding.client1;
  const c2 = wedding.client2;
  const coupleNames = [c1, c2]
    .filter(Boolean)
    .map((c) => `${c!.first_name} ${c!.last_name}`)
    .join(" & ") || "the couple";

  const weddingDate = wedding.wedding_date
    ? new Date(wedding.wedding_date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "TBD";

  const samplesText =
    samples.length > 0
      ? samples
          .map(
            (s, i) =>
              `--- Example ${i + 1} ---\n${s.subject ? `Subject: ${s.subject}\n` : ""}${s.body}`
          )
          .join("\n\n")
      : "No examples provided. Use a warm, professional tone.";

  const systemPrompt = `You are a writing assistant for ${studioName}, a wedding photography studio.
Your job is to draft emails in the photographer's exact voice and tone.

Here are examples of how this photographer writes:

${samplesText}

Match this tone, vocabulary, formality level, sign-off style, and any recurring phrases exactly.
Always address the couple by their first names.
Never fabricate specific details not provided. Use [PLACEHOLDER] for anything unknown.
Output the email only — subject line first, then a blank line, then the body. No preamble or explanation.`;

  const userPrompt = `Draft a "${EMAIL_TYPE_DESCRIPTIONS[emailType]}" email for:
- Couple: ${coupleNames}
- Wedding date: ${weddingDate}
- Venue: ${wedding.venue_name ?? "TBD"}
- Photographer studio: ${studioName}
${photographer.style_notes ? `- Photographer's style: ${photographer.style_notes}` : ""}
${additionalContext ? `- Additional context: ${additionalContext}` : ""}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = message.content[0].type === "text" ? message.content[0].text : "";

  if (!content) return { error: "AI returned an empty response. Please try again." };

  const { data: draft, error: insertError } = await supabase
    .from("ai_drafts")
    .insert({
      wedding_id: weddingId,
      photographer_id: photographer.id,
      draft_type: "email",
      content,
      status: "draft",
    })
    .select("id")
    .single();

  if (insertError || !draft) {
    console.error("Draft insert error:", insertError?.code);
    return { error: "Failed to save draft." };
  }

  return { draftId: draft.id, content };
}

export async function updateDraftStatus(formData: FormData) {
  const parsed = updateDraftStatusSchema.safeParse({
    draftId: formData.get("draftId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: photographer } = await supabase
    .from("photographers")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!photographer) return { error: "Not authorized." };

  const { error } = await supabase
    .from("ai_drafts")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.draftId)
    .eq("photographer_id", photographer.id);

  if (error) return { error: "Failed to update draft status." };

  return { success: true };
}

export async function deleteDraft(draftId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(draftId)) return { error: "Invalid draft ID." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: photographer } = await supabase
    .from("photographers")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!photographer) return { error: "Not authorized." };

  await supabase
    .from("ai_drafts")
    .delete()
    .eq("id", draftId)
    .eq("photographer_id", photographer.id);

  return { success: true };
}

export async function generateQuote(formData: FormData) {
  const parsed = generateQuoteSchema.safeParse({
    weddingId: formData.get("weddingId"),
    hoursRequested: formData.get("hoursRequested"),
    styleComplexity: formData.get("styleComplexity"),
    includeSecondShooter: formData.get("includeSecondShooter") ?? "",
    includeEngagement: formData.get("includeEngagement") ?? "",
    basePriceFloor: formData.get("basePriceFloor") || undefined,
    additionalContext: formData.get("additionalContext") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const {
    weddingId,
    hoursRequested,
    styleComplexity,
    includeSecondShooter,
    includeEngagement,
    basePriceFloor,
    additionalContext,
  } = parsed.data;

  const wantsSecondShooter =
    includeSecondShooter === "true" || includeSecondShooter === "on";
  const wantsEngagement =
    includeEngagement === "true" || includeEngagement === "on";

  const ctx = await getPhotographerAndWedding(weddingId);
  if (!ctx) return { error: "Not authorized." };

  const { supabase, photographer, wedding } = ctx;

  const { count: familyCount } = await supabase
    .from("family_members")
    .select("id", { count: "exact", head: true })
    .eq("wedding_id", weddingId);

  const c1 = wedding.client1;
  const c2 = wedding.client2;
  const coupleNames =
    [c1, c2]
      .filter(Boolean)
      .map((c) => `${c!.first_name} ${c!.last_name}`)
      .join(" & ") || "the couple";

  const dateObj = wedding.wedding_date
    ? new Date(wedding.wedding_date + "T00:00:00")
    : null;
  const dayOfWeek = dateObj
    ? dateObj.toLocaleDateString("en-US", { weekday: "long" })
    : "TBD";
  const season = dateObj ? getSeason(dateObj) : "TBD";
  const isPeakDay = dateObj
    ? dateObj.getDay() === 6 || dateObj.getDay() === 5
    : false;
  const isPeakSeason = season === "summer" || season === "fall";

  const { data: recentQuotes } = await supabase
    .from("ai_drafts")
    .select("content")
    .eq("photographer_id", photographer.id)
    .eq("draft_type", "quote")
    .order("created_at", { ascending: false })
    .limit(2);

  const pastQuotesText =
    recentQuotes && recentQuotes.length > 0
      ? recentQuotes
          .map((q, i) => `--- Past quote ${i + 1} ---\n${q.content}`)
          .join("\n\n")
      : "No past quotes available.";

  const studioName = photographer.studio_name ?? "the studio";

  const systemPrompt = `You are a pricing assistant for ${studioName}, a wedding photography studio.
Your job is to build itemized, professional wedding photography quotes.

${photographer.style_notes ? `Photographer's style: ${photographer.style_notes}\n` : ""}
Here are recent quotes from this photographer to match tone, structure, and price ranges:

${pastQuotesText}

Pricing guidance:
- Peak season (summer/fall) and Saturday weddings command a premium.
- Additional hours beyond 8 typically add $300–500/hr.
- A second shooter adds $800–1500.
- Engagement sessions add $400–700.
- Larger wedding parties (>15 immediate family) may warrant additional time or a second shooter.
- Drive time over 60 minutes one-way should include a travel line item.
- Style complexity ("luxury") justifies higher base rates and premium deliverables.

Output format:
Always produce THREE package options: "Essential", "Signature", and "Collector's".
For each package include: package name, price, and a bulleted list of what's included (hours, deliverables, turnaround, extras).
End with a short "Recommended for this wedding" note (1–2 sentences) explaining which package best fits this couple's profile and why.
Use clean plain-text formatting with headers — no markdown bold.`;

  const userPrompt = `Build a quote for:
- Couple: ${coupleNames}
- Wedding date: ${wedding.wedding_date ?? "TBD"} (${dayOfWeek})
- Season: ${season}${isPeakSeason ? " (peak)" : " (off-peak)"}
- Day premium: ${isPeakDay ? "Yes — Friday/Saturday" : "No — weekday"}
- Venue: ${wedding.venue_name ?? "TBD"}
- Drive time from studio: ${wedding.drive_time_minutes ?? "unknown"} minutes one-way
- Hours requested: ${hoursRequested}
- Immediate family party size: ${familyCount ?? 0}
- Style vibe: ${wedding.style_vibe ?? "not specified"}
- Style complexity tier: ${styleComplexity}
- Couple wants a second shooter: ${wantsSecondShooter ? "yes" : "no preference"}
- Couple wants an engagement session: ${wantsEngagement ? "yes" : "no preference"}
${basePriceFloor ? `- Photographer's minimum base price: $${basePriceFloor}` : ""}
${additionalContext ? `- Additional context: ${additionalContext}` : ""}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = message.content[0].type === "text" ? message.content[0].text : "";
  if (!content) return { error: "AI returned an empty response. Please try again." };

  const { data: draft, error: insertError } = await supabase
    .from("ai_drafts")
    .insert({
      wedding_id: weddingId,
      photographer_id: photographer.id,
      draft_type: "quote",
      content,
      status: "draft",
    })
    .select("id")
    .single();

  if (insertError || !draft) {
    console.error("Quote insert error:", insertError?.code);
    return { error: "Failed to save quote." };
  }

  return { draftId: draft.id, content };
}

export async function generateBlogPost(formData: FormData) {
  const parsed = generateBlogSchema.safeParse({
    weddingId: formData.get("weddingId"),
    targetCity: formData.get("targetCity"),
    imageUrls: formData.get("imageUrls") || undefined,
    keyMoments: formData.get("keyMoments") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { weddingId, targetCity, imageUrls, keyMoments } = parsed.data;
  const ctx = await getPhotographerAndWedding(weddingId);
  if (!ctx) return { error: "Not authorized." };

  const { supabase, photographer, wedding } = ctx;

  const c1 = wedding.client1;
  const c2 = wedding.client2;
  const coupleNames =
    [c1, c2]
      .filter(Boolean)
      .map((c) => `${c!.first_name} ${c!.last_name}`)
      .join(" & ") || "the couple";
  const firstNames =
    [c1, c2]
      .filter(Boolean)
      .map((c) => c!.first_name)
      .join(" & ") || "the couple";

  const dateObj = wedding.wedding_date
    ? new Date(wedding.wedding_date + "T00:00:00")
    : null;
  const season = dateObj ? getSeason(dateObj) : "";

  const imageUrlList = imageUrls
    ? imageUrls
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20)
    : [];

  const studioName = photographer.studio_name ?? "the studio";
  const venueName = wedding.venue_name ?? "the venue";

  const systemPrompt = `You are a blog-post writer for ${studioName}, a wedding photography studio.
${photographer.style_notes ? `Studio style: ${photographer.style_notes}\n` : ""}
Your job is to draft SEO-optimized blog posts about real weddings the photographer shot.

SEO requirements:
- Primary keyword: "${venueName} wedding photographer"
- Secondary keyword: "${targetCity} wedding photographer"
- Use each primary keyword 2–3 times naturally. Secondary keyword 1–2 times.
- Include an H1 title (use format "# Title") that features the venue name.
- Include 3–4 H2 section headers (use format "## Section") that break the story into beats (e.g., Getting Ready, Ceremony, Portraits, Reception).
- Target 600–900 words.
- Warm, story-first voice that matches the photographer's style. Not keyword-stuffed.
- Close with a soft CTA inviting couples planning a ${venueName} or ${targetCity} wedding to reach out.
${imageUrlList.length > 0 ? `- Reference specific images at these URLs by inserting [IMAGE: <url>] on its own line where that image should appear in the post. Distribute evenly across sections. URLs: ${imageUrlList.join(", ")}` : ""}

Output the blog post as clean markdown only — no preamble, no commentary.`;

  const userPrompt = `Write a blog post for this wedding:
- Couple: ${coupleNames} (refer to them by first names: ${firstNames})
- Wedding date: ${wedding.wedding_date ?? "recently"}${season ? ` (${season})` : ""}
- Venue: ${venueName}
- Target city market: ${targetCity}
- Style / vibe: ${wedding.style_vibe ?? "not specified"}
${keyMoments ? `- Key moments the photographer wants included: ${keyMoments}` : ""}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = message.content[0].type === "text" ? message.content[0].text : "";
  if (!content) return { error: "AI returned an empty response. Please try again." };

  const { data: draft, error: insertError } = await supabase
    .from("ai_drafts")
    .insert({
      wedding_id: weddingId,
      photographer_id: photographer.id,
      draft_type: "blog_post",
      content,
      status: "draft",
    })
    .select("id")
    .single();

  if (insertError || !draft) {
    console.error("Blog insert error:", insertError?.code);
    return { error: "Failed to save blog post." };
  }

  return { draftId: draft.id, content };
}
