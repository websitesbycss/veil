"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const MILESTONE_LABELS: Record<string, string> = {
  anniversary_1yr: "1-year anniversary",
  anniversary_5yr: "5-year anniversary",
  anniversary_10yr: "10-year anniversary",
};

export async function getDueMilestones() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { items: [] };

  const { data: photographer } = await supabase
    .from("photographers")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!photographer) return { items: [] };

  const today = new Date().toISOString().slice(0, 10);

  type DueRow = {
    id: string;
    wedding_id: string;
    milestone_type: "anniversary_1yr" | "anniversary_5yr" | "anniversary_10yr";
    trigger_date: string;
    notified: boolean;
    weddings: {
      id: string;
      photographer_id: string;
      wedding_date: string | null;
      client1: { first_name: string; last_name: string } | null;
      client2: { first_name: string; last_name: string } | null;
    } | null;
  };

  const { data } = (await supabase
    .from("milestones")
    .select(
      `id, wedding_id, milestone_type, trigger_date, notified,
       weddings!inner(
         id, photographer_id, wedding_date,
         client1:clients!weddings_client1_id_fkey(first_name, last_name),
         client2:clients!weddings_client2_id_fkey(first_name, last_name)
       )`
    )
    .eq("notified", false)
    .lte("trigger_date", today)
    .order("trigger_date", { ascending: true })) as {
    data: DueRow[] | null;
  };

  const rows = (data ?? []).filter(
    (r) => r.weddings && r.weddings.photographer_id === photographer.id
  );

  const items = rows.map((r) => {
    const c1 = r.weddings?.client1;
    const c2 = r.weddings?.client2;
    const couple =
      [c1, c2]
        .filter(Boolean)
        .map((c) => `${c!.first_name} ${c!.last_name}`)
        .join(" & ") || "Unknown couple";
    return {
      id: r.id,
      weddingId: r.wedding_id,
      type: r.milestone_type,
      label: MILESTONE_LABELS[r.milestone_type] ?? r.milestone_type,
      triggerDate: r.trigger_date,
      couple,
    };
  });

  return { items };
}

const dismissSchema = z.object({ milestoneId: z.string().uuid() });

export async function dismissMilestone(formData: FormData) {
  const parsed = dismissSchema.safeParse({
    milestoneId: formData.get("milestoneId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

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

  type MRow = {
    id: string;
    weddings: { photographer_id: string } | null;
  };
  const { data: milestone } = (await supabase
    .from("milestones")
    .select(`id, weddings!inner(photographer_id)`)
    .eq("id", parsed.data.milestoneId)
    .single()) as { data: MRow | null };

  if (!milestone || milestone.weddings?.photographer_id !== photographer.id) {
    return { error: "Not authorized." };
  }

  await supabase
    .from("milestones")
    .update({ notified: true, notified_at: new Date().toISOString() })
    .eq("id", parsed.data.milestoneId);

  return { success: true };
}
