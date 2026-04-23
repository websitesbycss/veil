"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const vendorSchema = z.object({
  weddingId: z.string().uuid(),
  role: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  phone: z.string().max(30).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

async function authorizeWedding(weddingId: string) {
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
    .select("id")
    .eq("id", weddingId)
    .eq("photographer_id", photographer.id)
    .single();
  if (!wedding) return null;

  return { supabase, photographerId: photographer.id };
}

export async function addVendor(formData: FormData) {
  const parsed = vendorSchema.safeParse({
    weddingId: formData.get("weddingId"),
    role: formData.get("role"),
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ctx = await authorizeWedding(parsed.data.weddingId);
  if (!ctx) return { error: "Not authorized." };

  const { error } = await ctx.supabase.from("vendors").insert({
    wedding_id: parsed.data.weddingId,
    role: parsed.data.role,
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    notes: parsed.data.notes || null,
  });
  if (error) return { error: "Failed to save vendor." };

  revalidatePath(`/weddings/${parsed.data.weddingId}/vendors`);
  return { success: true };
}

const deleteSchema = z.object({
  weddingId: z.string().uuid(),
  vendorId: z.string().uuid(),
});

export async function deleteVendor(formData: FormData) {
  const parsed = deleteSchema.safeParse({
    weddingId: formData.get("weddingId"),
    vendorId: formData.get("vendorId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ctx = await authorizeWedding(parsed.data.weddingId);
  if (!ctx) return { error: "Not authorized." };

  await ctx.supabase
    .from("vendors")
    .delete()
    .eq("id", parsed.data.vendorId)
    .eq("wedding_id", parsed.data.weddingId);

  revalidatePath(`/weddings/${parsed.data.weddingId}/vendors`);
  return { success: true };
}
