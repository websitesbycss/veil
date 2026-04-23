import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("ig_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/dashboard?ig=error_state", request.url));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!appId || !appSecret || !siteUrl) {
    return NextResponse.redirect(new URL("/dashboard?ig=error_config", request.url));
  }

  const redirectUri = `${siteUrl}/api/instagram/oauth/callback`;

  // Short-lived token
  const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  const shortJson = (await shortRes.json()) as {
    access_token?: string;
    user_id?: number | string;
  };
  if (!shortJson.access_token || !shortJson.user_id) {
    return NextResponse.redirect(new URL("/dashboard?ig=error_exchange", request.url));
  }

  // Exchange for long-lived token
  const longRes = await fetch(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(
      appSecret
    )}&access_token=${encodeURIComponent(shortJson.access_token)}`
  );
  const longJson = (await longRes.json()) as { access_token?: string };
  const finalToken = longJson.access_token ?? shortJson.access_token;

  const payload = JSON.stringify({
    ig_user_id: String(shortJson.user_id),
    access_token: finalToken,
    connected_at: new Date().toISOString(),
  });

  const encrypted = encrypt(payload);

  await supabase
    .from("photographers")
    .update({ ig_access_token: encrypted })
    .eq("auth_user_id", user.id);

  const res = NextResponse.redirect(new URL("/dashboard?ig=connected", request.url));
  res.cookies.delete("ig_oauth_state");
  return res;
}
