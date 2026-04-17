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
    client1: { first_name: string; last_name: string } | null;
    client2: { first_name: string; last_name: string } | null;
  };
  const { data: wedding } = (await supabase
    .from("weddings")
    .select(
      `id, wedding_date, venue_name,
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
