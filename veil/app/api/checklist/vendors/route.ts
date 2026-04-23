import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function getSecret() {
  return new TextEncoder().encode(
    process.env.CHECKLIST_JWT_SECRET ?? process.env.ENCRYPTION_KEY ?? "dev-secret-change-me"
  );
}

async function verifyToken(request: Request, weddingId: string) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "") ??
    new URL(request.url).searchParams.get("token");

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.weddingId !== weddingId) return null;
    return payload as { sub: string; weddingId: string; shooterName: string };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weddingId = searchParams.get("weddingId");

  if (!weddingId || !/^[0-9a-f-]{36}$/i.test(weddingId)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const payload = await verifyToken(request, weddingId);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, role, name, phone, email, notes")
    .eq("wedding_id", weddingId)
    .order("role", { ascending: true });

  return NextResponse.json({ vendors: vendors ?? [] });
}
