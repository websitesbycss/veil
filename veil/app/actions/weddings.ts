"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const clientSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
  referral_source: z
    .enum(["past_client", "instagram", "google", "vendor", "other"])
    .optional(),
});

const weddingIntakeSchema = z.object({
  wedding_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  venue_name: z.string().max(200).optional(),
  venue_address: z.string().max(500).optional(),
  ceremony_address: z.string().max(500).optional(),
  style_vibe: z.string().max(2000).optional(),
  special_requests: z.string().max(5000).optional(),
});

const familyMemberSchema = z.object({
  side: z.enum(["client1", "client2"]),
  role: z.string().min(1).max(100),
  first_name: z.string().min(1).max(100),
  last_name: z.string().max(100).optional(),
  mobility_limited: z.boolean().optional(),
});

async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || !address.trim()) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    const data = await res.json();
    if (data.status === "OK" && data.results[0]) {
      return data.results[0].geometry.location;
    }
  } catch {
    // geocoding is non-critical; continue without it
  }
  return null;
}

async function fetchGoldenHour(
  lat: number,
  lng: number,
  date: string
): Promise<string | null> {
  try {
    const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${date}&formatted=0`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    const data = await res.json();
    if (data.status === "OK") {
      const sunsetUtc = new Date(data.results.sunset);
      // golden hour = sunset - 45 minutes
      const goldenHour = new Date(sunsetUtc.getTime() - 45 * 60 * 1000);
      // Store as HH:MM:SS in UTC (photographer's local conversion handled in UI)
      return goldenHour.toISOString().substring(11, 19);
    }
  } catch {
    // non-critical
  }
  return null;
}

async function getDriveTime(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number }
): Promise<number | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${dest.lat},${dest.lng}&mode=driving&key=${key}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    const data = await res.json();
    if (
      data.status === "OK" &&
      data.rows[0]?.elements[0]?.status === "OK"
    ) {
      return Math.round(data.rows[0].elements[0].duration.value / 60);
    }
  } catch {
    // non-critical
  }
  return null;
}

export async function createWedding(formData: FormData) {
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
  if (!photographer) return { error: "Photographer profile not found." };

  // Validate clients
  const c1Result = clientSchema.safeParse({
    first_name: formData.get("c1_first_name"),
    last_name: formData.get("c1_last_name"),
    email: formData.get("c1_email") || undefined,
    phone: formData.get("c1_phone") || undefined,
    referral_source: formData.get("c1_referral_source") || undefined,
  });

  if (!c1Result.success) {
    return { error: `Client 1: ${c1Result.error.issues[0].message}` };
  }

  const c2Raw = {
    first_name: formData.get("c2_first_name") as string,
    last_name: formData.get("c2_last_name") as string,
    email: formData.get("c2_email") || undefined,
    phone: formData.get("c2_phone") || undefined,
    referral_source: formData.get("c2_referral_source") || undefined,
  };
  const hasClient2 = !!c2Raw.first_name?.trim();
  const c2Result = hasClient2 ? clientSchema.safeParse(c2Raw) : null;

  if (c2Result && !c2Result.success) {
    return { error: `Client 2: ${c2Result.error.issues[0].message}` };
  }

  // Validate wedding details
  const weddingResult = weddingIntakeSchema.safeParse({
    wedding_date: formData.get("wedding_date") || undefined,
    venue_name: formData.get("venue_name") || undefined,
    venue_address: formData.get("venue_address") || undefined,
    ceremony_address: formData.get("ceremony_address") || undefined,
    style_vibe: formData.get("style_vibe") || undefined,
    special_requests: formData.get("special_requests") || undefined,
  });

  if (!weddingResult.success) {
    return { error: weddingResult.error.issues[0].message };
  }

  // Insert clients
  const { data: client1 } = await supabase
    .from("clients")
    .insert({
      photographer_id: photographer.id,
      first_name: c1Result.data.first_name,
      last_name: c1Result.data.last_name,
      email: c1Result.data.email || null,
      phone: c1Result.data.phone || null,
      referral_source: c1Result.data.referral_source ?? null,
    })
    .select("id")
    .single();

  if (!client1) return { error: "Failed to create client record." };

  let client2Id: string | null = null;
  if (c2Result?.success) {
    const { data: client2 } = await supabase
      .from("clients")
      .insert({
        photographer_id: photographer.id,
        first_name: c2Result.data.first_name,
        last_name: c2Result.data.last_name,
        email: c2Result.data.email || null,
        phone: c2Result.data.phone || null,
        referral_source: c2Result.data.referral_source ?? null,
      })
      .select("id")
      .single();
    client2Id = client2?.id ?? null;
  }

  // Geocode + golden hour
  const wd = weddingResult.data;
  let venueLat: number | null = null;
  let venueLng: number | null = null;
  let ceremonyLat: number | null = null;
  let ceremonyLng: number | null = null;
  let goldenHourTime: string | null = null;
  let driveTimeMinutes: number | null = null;

  if (wd.venue_address) {
    const coords = await geocodeAddress(wd.venue_address);
    if (coords) {
      venueLat = coords.lat;
      venueLng = coords.lng;
      if (wd.wedding_date) {
        goldenHourTime = await fetchGoldenHour(coords.lat, coords.lng, wd.wedding_date);
      }
    }
  }

  if (wd.ceremony_address) {
    const coords = await geocodeAddress(wd.ceremony_address);
    if (coords) {
      ceremonyLat = coords.lat;
      ceremonyLng = coords.lng;
    }
  }

  if (
    venueLat && venueLng && ceremonyLat && ceremonyLng &&
    wd.venue_address !== wd.ceremony_address
  ) {
    driveTimeMinutes = await getDriveTime(
      { lat: venueLat, lng: venueLng },
      { lat: ceremonyLat, lng: ceremonyLng }
    );
  }

  // Insert wedding
  const { data: wedding, error: wError } = await supabase
    .from("weddings")
    .insert({
      photographer_id: photographer.id,
      client1_id: client1.id,
      client2_id: client2Id,
      wedding_date: wd.wedding_date || null,
      status: "inquiry",
      venue_name: wd.venue_name || null,
      venue_address: wd.venue_address || null,
      venue_lat: venueLat,
      venue_lng: venueLng,
      ceremony_address: wd.ceremony_address || null,
      ceremony_lat: ceremonyLat,
      ceremony_lng: ceremonyLng,
      golden_hour_time: goldenHourTime,
      drive_time_minutes: driveTimeMinutes,
      style_vibe: wd.style_vibe || null,
      special_requests: wd.special_requests || null,
    })
    .select("id")
    .single();

  if (wError || !wedding) {
    console.error("Wedding insert error:", wError?.code);
    return { error: "Failed to create wedding record." };
  }

  // Insert family members
  const familyCount = parseInt(formData.get("family_count") as string) || 0;
  const familyInserts = [];

  for (let i = 0; i < familyCount; i++) {
    const fm = familyMemberSchema.safeParse({
      side: formData.get(`fm_side_${i}`),
      role: formData.get(`fm_role_${i}`),
      first_name: formData.get(`fm_first_name_${i}`),
      last_name: formData.get(`fm_last_name_${i}`) || undefined,
      mobility_limited: formData.get(`fm_mobility_${i}`) === "true",
    });

    if (fm.success) {
      familyInserts.push({
        wedding_id: wedding.id,
        side: fm.data.side,
        role: fm.data.role,
        first_name: fm.data.first_name,
        last_name: fm.data.last_name || null,
        mobility_limited: fm.data.mobility_limited ?? false,
        divorced_from: null,
      });
    }
  }

  if (familyInserts.length > 0) {
    await supabase.from("family_members").insert(familyInserts);
  }

  redirect(`/weddings/${wedding.id}`);
}
