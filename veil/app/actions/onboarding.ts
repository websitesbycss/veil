"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const onboardingSchema = z.object({
  full_name: z.string().min(1, "Full name is required").max(100),
  studio_name: z.string().max(100).optional(),
  style_notes: z.string().max(2000).optional(),
});

const emailSampleSchema = z.object({
  subject: z.string().max(255).optional(),
  body: z.string().min(10, "Email body is too short").max(10000),
  tone_tags: z.string().max(100).optional(),
});

export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  const parsed = onboardingSchema.safeParse({
    full_name: formData.get("full_name"),
    studio_name: formData.get("studio_name") || undefined,
    style_notes: formData.get("style_notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Create photographer profile
  const { data: photographer, error: pgError } = await supabase
    .from("photographers")
    .insert({
      auth_user_id: user.id,
      full_name: parsed.data.full_name,
      studio_name: parsed.data.studio_name ?? null,
      email: user.email!,
      style_notes: parsed.data.style_notes ?? null,
    })
    .select("id")
    .single();

  if (pgError) {
    console.error("Photographer insert error:", pgError.code);
    return { error: "Failed to create your profile. Please try again." };
  }

  // Parse email samples (up to 5)
  const sampleInserts = [];
  for (let i = 0; i < 5; i++) {
    const body = formData.get(`sample_body_${i}`) as string | null;
    if (!body?.trim()) continue;

    const sample = emailSampleSchema.safeParse({
      subject: formData.get(`sample_subject_${i}`) || undefined,
      body: body.trim(),
      tone_tags: formData.get(`sample_tone_${i}`) || undefined,
    });

    if (sample.success) {
      sampleInserts.push({
        photographer_id: photographer.id,
        subject: sample.data.subject ?? null,
        body: sample.data.body,
        tone_tags: sample.data.tone_tags ?? null,
      });
    }
  }

  if (sampleInserts.length > 0) {
    await supabase.from("email_samples").insert(sampleInserts);
  }

  redirect("/dashboard");
}
