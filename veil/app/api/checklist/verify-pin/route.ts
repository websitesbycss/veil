import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";
import { z } from "zod";
import type { Database } from "@/lib/supabase/types";

const schema = z.object({
  weddingId: z.string().uuid(),
  pin: z.string().length(4).regex(/^\d{4}$/),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { weddingId, pin } = parsed.data;

  // Use service role to bypass RLS for PIN verification
  const supabase = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: shooters } = await supabase
    .from("second_shooters")
    .select("id, name, pin_hash")
    .eq("wedding_id", weddingId);

  if (!shooters || shooters.length === 0) {
    return NextResponse.json({ error: "Invalid PIN." }, { status: 401 });
  }

  // Find a matching PIN (brute-force across shooters — at most a few per wedding)
  let matchedShooter: { id: string; name: string } | null = null;
  for (const shooter of shooters) {
    const match = await bcrypt.compare(pin, shooter.pin_hash);
    if (match) {
      matchedShooter = { id: shooter.id, name: shooter.name };
      break;
    }
  }

  if (!matchedShooter) {
    // Log failed attempt (no sensitive data)
    console.warn(`Failed PIN attempt for wedding ${weddingId}`);
    return NextResponse.json({ error: "Invalid PIN." }, { status: 401 });
  }

  // Issue a short-lived JWT (1 day)
  const secret = new TextEncoder().encode(process.env.CHECKLIST_JWT_SECRET ?? process.env.ENCRYPTION_KEY ?? "dev-secret-change-me");
  const token = await new SignJWT({
    sub: matchedShooter.id,
    weddingId,
    shooterName: matchedShooter.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(secret);

  const response = NextResponse.json({ token, shooterName: matchedShooter.name });
  response.cookies.set("checklist_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 86400,
    path: `/checklist/${weddingId}`,
  });

  return response;
}
