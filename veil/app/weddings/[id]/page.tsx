import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";

type ClientInfo = { first_name: string; last_name: string; email: string | null; phone: string | null } | null;
type WeddingDetail = {
  id: string;
  wedding_date: string | null;
  venue_name: string | null;
  status: string;
  style_vibe: string | null;
  special_requests: string | null;
  venue_address: string | null;
  ceremony_address: string | null;
  golden_hour_time: string | null;
  drive_time_minutes: number | null;
  client1: ClientInfo;
  client2: ClientInfo;
};

export default async function WeddingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: photographer } = await supabase
    .from("photographers")
    .select("id, studio_name")
    .eq("auth_user_id", user.id)
    .single();
  if (!photographer) redirect("/onboarding");

  const { data: wedding } = await supabase
    .from("weddings")
    .select(
      `id, wedding_date, venue_name, status, style_vibe, special_requests,
       venue_address, ceremony_address, golden_hour_time, drive_time_minutes,
       client1:clients!weddings_client1_id_fkey(first_name, last_name, email, phone),
       client2:clients!weddings_client2_id_fkey(first_name, last_name, email, phone)`
    )
    .eq("id", id)
    .eq("photographer_id", photographer.id)
    .single() as { data: WeddingDetail | null; error: unknown };

  if (!wedding) notFound();

  const coupleNames = [wedding.client1, wedding.client2]
    .filter(Boolean)
    .map((c) => `${c!.first_name} ${c!.last_name}`)
    .join(" & ");

  const dateStr = wedding.wedding_date
    ? new Date(wedding.wedding_date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const subLinks = [
    { href: `/weddings/${id}/timeline`, label: "Timeline" },
    { href: `/weddings/${id}/shot-list`, label: "Shot list" },
    { href: `/weddings/${id}/vendors`, label: "Vendors" },
    { href: `/weddings/${id}/ai`, label: "AI drafts" },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Nav studioName={photographer.studio_name} />
      <main className="max-w-4xl mx-auto px-4 py-8 w-full">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <Link href="/dashboard" className="text-xs text-stone-400 hover:text-stone-600 mb-1 block">
                ← Pipeline
              </Link>
              <h1 className="text-2xl font-semibold text-stone-900">{coupleNames}</h1>
              {dateStr && <p className="text-sm text-stone-500 mt-0.5">{dateStr}</p>}
              {wedding.venue_name && (
                <p className="text-sm text-stone-400 mt-0.5">{wedding.venue_name}</p>
              )}
            </div>
            <StatusBadge status={wedding.status} />
          </div>
        </div>

        {/* Sub-navigation */}
        <div className="flex gap-2 mb-8 border-b border-stone-100 pb-4 overflow-x-auto">
          {subLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="px-3 py-1.5 text-sm text-stone-600 border border-stone-200 rounded-lg hover:border-stone-400 hover:text-stone-900 transition-colors whitespace-nowrap"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Clients */}
          {[wedding.client1, wedding.client2].filter(Boolean).map((c, i) => (
            <DetailCard key={i} title={`Client ${i + 1}`}>
              <p className="font-medium">{c!.first_name} {c!.last_name}</p>
              {c!.email && <p className="text-stone-500">{c!.email}</p>}
              {c!.phone && <p className="text-stone-500">{c!.phone}</p>}
            </DetailCard>
          ))}

          {/* Venue */}
          {(wedding.venue_name || wedding.venue_address) && (
            <DetailCard title="Venue">
              {wedding.venue_name && <p className="font-medium">{wedding.venue_name}</p>}
              {wedding.venue_address && (
                <p className="text-stone-500">{wedding.venue_address}</p>
              )}
              {wedding.golden_hour_time && (
                <p className="text-amber-600 text-sm mt-1">
                  Golden hour: {wedding.golden_hour_time.substring(0, 5)} UTC
                </p>
              )}
            </DetailCard>
          )}

          {/* Ceremony */}
          {wedding.ceremony_address && (
            <DetailCard title="Ceremony">
              <p className="text-stone-500">{wedding.ceremony_address}</p>
              {wedding.drive_time_minutes && (
                <p className="text-stone-400 text-sm mt-1">
                  Drive to venue: ~{wedding.drive_time_minutes} min
                </p>
              )}
            </DetailCard>
          )}

          {/* Style */}
          {(wedding.style_vibe || wedding.special_requests) && (
            <DetailCard title="Notes" className="md:col-span-2">
              {wedding.style_vibe && (
                <p className="text-stone-600 text-sm">{wedding.style_vibe}</p>
              )}
              {wedding.special_requests && (
                <p className="text-stone-500 text-sm mt-2">{wedding.special_requests}</p>
              )}
            </DetailCard>
          )}
        </div>
      </main>
    </div>
  );
}

function DetailCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-stone-200 rounded-xl p-4 ${className}`}>
      <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
        {title}
      </h3>
      <div className="text-sm space-y-0.5">{children}</div>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  inquiry: "bg-stone-100 text-stone-600",
  consultation: "bg-blue-100 text-blue-700",
  booked: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  delivered: "bg-purple-100 text-purple-700",
  archived: "bg-stone-100 text-stone-400",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
        STATUS_STYLES[status] ?? "bg-stone-100 text-stone-600"
      }`}
    >
      {status}
    </span>
  );
}
