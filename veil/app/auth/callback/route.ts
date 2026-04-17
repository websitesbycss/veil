import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Check if photographer profile exists; if not, redirect to onboarding
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: photographer } = await supabase
          .from("photographers")
          .select("id")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (!photographer) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
