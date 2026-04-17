"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

export async function signInWithPassword(formData: FormData) {
  const email = emailSchema.parse(formData.get("email"));
  const password = passwordSchema.parse(formData.get("password"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Invalid email or password." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signInWithMagicLink(formData: FormData) {
  const email = emailSchema.parse(formData.get("email"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    return { error: "Could not send magic link. Please try again." };
  }

  return { success: "Check your email for a magic link." };
}

export async function signUp(formData: FormData) {
  const email = emailSchema.parse(formData.get("email"));
  const password = passwordSchema.parse(formData.get("password"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: "Check your email to confirm your account." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
