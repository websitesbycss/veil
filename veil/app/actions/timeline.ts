"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const generateTimelineSchema = z.object({
  weddingId: z.string().uuid(),
});

const reorderSchema = z.object({
  weddingId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()),
});

const updateBlockSchema = z.object({
  blockId: z.string().uuid(),
  weddingId: z.string().uuid(),
  label: z.string().min(1).max(200),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  duration_minutes: z.number().int().min(1).max(480),
  location: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});

const deleteBlockSchema = z.object({
  blockId: z.string().uuid(),
  weddingId: z.string().uuid(),
});

type TimelineBlock = {
  id: string;
  sort_order: number;
  label: string;
  start_time: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
};

async function getAuthorizedWedding(weddingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: photographer } = await supabase
    .from("photographers")
    .select("id, studio_name")
    .eq("auth_user_id", user.id)
    .single();
  if (!photographer) return null;

  type WeddingForTimeline = {
    id: string;
    wedding_date: string | null;
    venue_name: string | null;
    golden_hour_time: string | null;
    drive_time_minutes: number | null;
    ceremony_address: string | null;
    client1: { first_name: string } | null;
    client2: { first_name: string } | null;
  };

  const { data: wedding } = (await supabase
    .from("weddings")
    .select(
      `id, wedding_date, venue_name, golden_hour_time, drive_time_minutes, ceremony_address,
       client1:clients!weddings_client1_id_fkey(first_name),
       client2:clients!weddings_client2_id_fkey(first_name)`
    )
    .eq("id", weddingId)
    .eq("photographer_id", photographer.id)
    .single()) as { data: WeddingForTimeline | null; error: unknown };
  if (!wedding) return null;

  return { supabase, photographer, wedding };
}

export async function generateTimeline(formData: FormData) {
  const parsed = generateTimelineSchema.safeParse({ weddingId: formData.get("weddingId") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ctx = await getAuthorizedWedding(parsed.data.weddingId);
  if (!ctx) return { error: "Not authorized." };

  const { supabase, wedding } = ctx;

  const coupleNames = [wedding.client1, wedding.client2]
    .filter(Boolean)
    .map((c) => c!.first_name)
    .join(" & ") || "the couple";

  const goldenHour = wedding.golden_hour_time
    ? wedding.golden_hour_time.substring(0, 5)
    : null;

  const prompt = `Generate a detailed wedding day photography timeline for ${coupleNames}'s wedding.

Details:
- Wedding date: ${wedding.wedding_date ?? "TBD"}
- Venue: ${wedding.venue_name ?? "TBD"}
${wedding.ceremony_address ? `- Ceremony is at a different location from the reception` : "- Ceremony and reception at the same venue"}
${wedding.drive_time_minutes ? `- Drive time between ceremony and reception: ${wedding.drive_time_minutes} minutes` : ""}
${goldenHour ? `- Golden hour portrait window starts at: ${goldenHour} UTC (schedule the golden hour portraits block at this time, 45 min duration)` : ""}

Rules:
- Include realistic buffer time between activities
${wedding.ceremony_address && wedding.drive_time_minutes ? `- Insert a "Travel to reception" block of ${wedding.drive_time_minutes} minutes between ceremony and reception arrival` : ""}
${goldenHour ? `- Schedule "Golden hour portraits" at ${goldenHour} for 45 minutes — this is non-negotiable` : ""}
- A typical wedding photography day: getting ready → first look (optional) → ceremony → family formals → couples portraits → reception details → reception events → send-off
- Use realistic durations: getting ready 2h, ceremony 30-60min, family formals 45-60min, couples portraits 30-45min
- Start time: assume photographer arrives 30 min before getting ready begins (typically ~10:00-11:00 AM)

Output a JSON array only, no preamble:
[
  {
    "sort_order": 1,
    "label": "Block name",
    "start_time": "HH:MM",
    "duration_minutes": 30,
    "location": "Location name or null",
    "notes": "Any notes or null"
  }
]`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return { error: "AI returned an unexpected format. Please try again." };

  let blocks: Array<{
    sort_order: number;
    label: string;
    start_time: string;
    duration_minutes: number;
    location: string | null;
    notes: string | null;
  }>;

  try {
    blocks = JSON.parse(jsonMatch[0]);
  } catch {
    return { error: "Could not parse AI response. Please try again." };
  }

  // Delete existing blocks first (regenerate)
  await supabase.from("timeline_blocks").delete().eq("wedding_id", wedding.id);

  const inserts = blocks.map((b, i) => ({
    wedding_id: wedding.id,
    sort_order: b.sort_order ?? i + 1,
    label: String(b.label).substring(0, 200),
    start_time: b.start_time.length === 5 ? b.start_time + ":00" : b.start_time,
    duration_minutes: Number(b.duration_minutes) || 30,
    location: b.location ? String(b.location).substring(0, 200) : null,
    notes: b.notes ? String(b.notes).substring(0, 1000) : null,
  }));

  const { data: savedBlocks, error: insertError } = await supabase
    .from("timeline_blocks")
    .insert(inserts)
    .select("id, sort_order, label, start_time, duration_minutes, location, notes")
    .order("sort_order");

  if (insertError) {
    console.error("Timeline insert error:", insertError.code);
    return { error: "Failed to save timeline." };
  }

  return { blocks: savedBlocks as TimelineBlock[] };
}

export async function reorderBlocks(formData: FormData) {
  const raw = formData.get("orderedIds");
  let orderedIds: string[];
  try {
    orderedIds = JSON.parse(raw as string);
  } catch {
    return { error: "Invalid order data." };
  }

  const parsed = reorderSchema.safeParse({
    weddingId: formData.get("weddingId"),
    orderedIds,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ctx = await getAuthorizedWedding(parsed.data.weddingId);
  if (!ctx) return { error: "Not authorized." };

  const { supabase } = ctx;

  await Promise.all(
    parsed.data.orderedIds.map((id, index) =>
      supabase
        .from("timeline_blocks")
        .update({ sort_order: index + 1 })
        .eq("id", id)
        .eq("wedding_id", parsed.data.weddingId)
    )
  );

  return { success: true };
}

export async function updateBlock(data: {
  blockId: string;
  weddingId: string;
  label: string;
  start_time: string;
  duration_minutes: number;
  location?: string;
  notes?: string;
}) {
  const parsed = updateBlockSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ctx = await getAuthorizedWedding(parsed.data.weddingId);
  if (!ctx) return { error: "Not authorized." };

  const { supabase } = ctx;

  const { error } = await supabase
    .from("timeline_blocks")
    .update({
      label: parsed.data.label,
      start_time: parsed.data.start_time.length === 5
        ? parsed.data.start_time + ":00"
        : parsed.data.start_time,
      duration_minutes: parsed.data.duration_minutes,
      location: parsed.data.location ?? null,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", parsed.data.blockId)
    .eq("wedding_id", parsed.data.weddingId);

  if (error) return { error: "Failed to update block." };
  return { success: true };
}

export async function deleteBlock(blockId: string, weddingId: string) {
  const parsed = deleteBlockSchema.safeParse({ blockId, weddingId });
  if (!parsed.success) return { error: "Invalid IDs." };

  const ctx = await getAuthorizedWedding(parsed.data.weddingId);
  if (!ctx) return { error: "Not authorized." };

  const { supabase } = ctx;
  await supabase
    .from("timeline_blocks")
    .delete()
    .eq("id", parsed.data.blockId)
    .eq("wedding_id", parsed.data.weddingId);

  return { success: true };
}

export async function addBlock(weddingId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(weddingId)) return { error: "Invalid wedding ID." };

  const ctx = await getAuthorizedWedding(weddingId);
  if (!ctx) return { error: "Not authorized." };

  const { supabase, wedding } = ctx;

  const { data: last } = await supabase
    .from("timeline_blocks")
    .select("sort_order")
    .eq("wedding_id", wedding.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (last?.sort_order ?? 0) + 1;

  const { data: block, error } = await supabase
    .from("timeline_blocks")
    .insert({
      wedding_id: wedding.id,
      sort_order: nextOrder,
      label: "New block",
      start_time: "12:00:00",
      duration_minutes: 30,
      location: null,
      notes: null,
    })
    .select("id, sort_order, label, start_time, duration_minutes, location, notes")
    .single();

  if (error) return { error: "Failed to add block." };
  return { block: block as TimelineBlock };
}
