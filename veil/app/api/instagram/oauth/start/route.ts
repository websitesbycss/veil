import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const appId = process.env.INSTAGRAM_APP_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!appId || !siteUrl) {
    return NextResponse.json(
      { error: "Instagram OAuth is not configured." },
      { status: 500 }
    );
  }

  const redirectUri = `${siteUrl}/api/instagram/oauth/callback`;
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: "instagram_business_basic,instagram_business_content_publish",
    response_type: "code",
    state,
  });

  const authorizeUrl = `https://www.instagram.com/oauth/authorize?${params.toString()}`;

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set("ig_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
