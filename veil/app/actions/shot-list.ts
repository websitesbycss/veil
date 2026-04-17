"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const generateShotListSchema = z.object({ weddingId: z.string().uuid() });
const createSecondShooterSchema = z.object({
  weddingId: z.string().uuid(),
  name: z.string().min(1).max(100),
  pin: z.string().length(4).regex(/^\d{4}$/),
});
const toggleCompleteSchema = z.object({
  itemId: z.string().uuid(),
  weddingId: z.string().uuid(),
  completed: z.boolean(),
});

type ShotListItem = {
  id: string;
  sort_order: number;
  grouping_label: string;
  notes: string | null;
  completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
};

async function getAuthorizedWedding(weddingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: photographer } = await supabase
    .from("photographers")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!photographer) return null;

  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, venue_name, wedding_date")
    .eq("id", weddingId)
    .eq("photographer_id", photographer.id)
    .single();
  if (!wedding) return null;

  return { supabase, photographer, wedding };
}

export async function generateShotList(formData: FormData) {
  const parsed = generateShotListSchema.safeParse({ weddingId: formData.get("weddingId") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ctx = await getAuthorizedWedding(parsed.data.weddingId);
  if (!ctx) return { error: "Not authorized." };

  const { supabase, wedding } = ctx;

  // Fetch family members with divorced_from relationships
  const { data: familyMembers } = await supabase
    .from("family_members")
    .select("id, side, role, first_name, last_name, mobility_limited, divorced_from")
    .eq("wedding_id", wedding.id);

  if (!familyMembers || familyMembers.length === 0) {
    return { error: "No family members added. Add family structure in the wedding intake form first." };
  }

  // Fetch couple names for context
  type WeddingWithClients = {
    client1: { first_name: string } | null;
    client2: { first_name: string } | null;
  };
  const { data: weddingWithClients } = (await supabase
    .from("weddings")
    .select(
      "client1:clients!weddings_client1_id_fkey(first_name), client2:clients!weddings_client2_id_fkey(first_name)"
    )
    .eq("id", wedding.id)
    .single()) as { data: WeddingWithClients | null; error: unknown };

  const c1Name = weddingWithClients?.client1?.first_name ?? "Client 1";
  const c2Name = weddingWithClients?.client2?.first_name ?? "Client 2";

  const familyJson = JSON.stringify(familyMembers, null, 2);

  const prompt = `Given this family structure for ${c1Name} & ${c2Name}'s wedding:
${familyJson}

Generate a complete ordered shot list for family formals. Rules:
- Order from largest group to smallest so guests can be released early
- Separate any members where divorced_from is set — they must never be in the same shot grouping
- Schedule members with mobility_limited=true in the first 3 shots
- Include shots from client1 side, client2 side, and combined groups
- Use first names naturally in grouping labels (e.g. "Jordan & both parents")
- The couple should appear in all groupings with their full families
- End with just the two of them alone

Output JSON array only, no preamble:
[{ "sort_order": 1, "grouping_label": "...", "notes": "..." }]`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return { error: "AI returned unexpected format. Try again." };

  let items: Array<{ sort_order: number; grouping_label: string; notes?: string | null }>;
  try {
    items = JSON.parse(jsonMatch[0]);
  } catch {
    return { error: "Could not parse AI response. Try again." };
  }

  // Delete existing items and reinsert
  await supabase.from("shot_list_items").delete().eq("wedding_id", wedding.id);

  const inserts = items.map((item, i) => ({
    wedding_id: wedding.id,
    sort_order: item.sort_order ?? i + 1,
    grouping_label: String(item.grouping_label).substring(0, 500),
    notes: item.notes ? String(item.notes).substring(0, 1000) : null,
    completed: false,
    completed_by: null,
    completed_at: null,
  }));

  const { data: savedItems, error: insertError } = await supabase
    .from("shot_list_items")
    .insert(inserts)
    .select("id, sort_order, grouping_label, notes, completed, completed_by, completed_at")
    .order("sort_order");

  if (insertError) {
    console.error("Shot list insert error:", insertError.code);
    return { error: "Failed to save shot list." };
  }

  return { items: savedItems as ShotListItem[] };
}

export async function toggleShotComplete(data: {
  itemId: string;
  weddingId: string;
  completed: boolean;
}) {
  const parsed = toggleCompleteSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid data." };

  const ctx = await getAuthorizedWedding(parsed.data.weddingId);
  if (!ctx) return { error: "Not authorized." };

  const { supabase } = ctx;
  const { error } = await supabase
    .from("shot_list_items")
    .update({
      completed: parsed.data.completed,
      completed_at: parsed.data.completed ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.itemId)
    .eq("wedding_id", parsed.data.weddingId);

  if (error) return { error: "Failed to update." };
  return { success: true };
}

export async function createSecondShooter(formData: FormData) {
  const parsed = createSecondShooterSchema.safeParse({
    weddingId: formData.get("weddingId"),
    name: formData.get("name"),
    pin: formData.get("pin"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ctx = await getAuthorizedWedding(parsed.data.weddingId);
  if (!ctx) return { error: "Not authorized." };

  const { supabase } = ctx;
  const pin_hash = await bcrypt.hash(parsed.data.pin, 10);

  const { data, error } = await supabase
    .from("second_shooters")
    .insert({
      wedding_id: parsed.data.weddingId,
      name: parsed.data.name,
      pin_hash,
    })
    .select("id, name")
    .single();

  if (error) return { error: "Failed to create second shooter." };
  return { shooter: data, pin: parsed.data.pin };
}

export async function deleteSecondShooter(shooterId: string, weddingId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(shooterId) || !/^[0-9a-f-]{36}$/i.test(weddingId)) {
    return { error: "Invalid IDs." };
  }

  const ctx = await getAuthorizedWedding(weddingId);
  if (!ctx) return { error: "Not authorized." };

  const { supabase } = ctx;
  await supabase
    .from("second_shooters")
    .delete()
    .eq("id", shooterId)
    .eq("wedding_id", weddingId);

  return { success: true };
}
