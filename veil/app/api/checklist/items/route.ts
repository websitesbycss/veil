import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function getSecret() {
  const secret = process.env.CHECKLIST_JWT_SECRET ?? process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error("CHECKLIST_JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
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

  const { data: items } = await supabase
    .from("shot_list_items")
    .select("id, sort_order, grouping_label, notes, completed, completed_at")
    .eq("wedding_id", weddingId)
    .order("sort_order");

  return NextResponse.json({ items: items ?? [], shooterName: payload.shooterName });
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const weddingId = searchParams.get("weddingId");

  if (!weddingId || !/^[0-9a-f-]{36}$/i.test(weddingId)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const payload = await verifyToken(request, weddingId);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const { itemId, completed } = body as { itemId?: string; completed?: boolean };
  if (!itemId || !/^[0-9a-f-]{36}$/i.test(itemId) || typeof completed !== "boolean") {
    return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  }

  const supabase = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from("shot_list_items")
    .update({
      completed,
      completed_by: payload.sub,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", itemId)
    .eq("wedding_id", weddingId);

  if (error) {
    return NextResponse.json({ error: "Failed to update." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
