import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { TimelineEditor } from "./timeline-editor";

type TimelineBlock = {
  id: string;
  sort_order: number;
  label: string;
  start_time: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
};

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
    .select("id, venue_name, wedding_date, golden_hour_time, drive_time_minutes")
    .eq("id", id)
    .eq("photographer_id", photographer.id)
    .single();
  if (!wedding) notFound();

  const { data: blocks } = await supabase
    .from("timeline_blocks")
    .select("id, sort_order, label, start_time, duration_minutes, location, notes")
    .eq("wedding_id", id)
    .order("sort_order");

  const goldenHour = wedding.golden_hour_time
    ? (wedding.golden_hour_time as string).substring(0, 5)
    : null;

  const weddingDateStr = wedding.wedding_date
    ? new Date((wedding.wedding_date as string) + "T00:00:00").toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="flex flex-col min-h-screen">
      <Nav studioName={photographer.studio_name} />
      <main className="max-w-3xl mx-auto px-4 py-8 w-full">
        <div className="mb-6">
          <a href={`/weddings/${id}`} className="text-xs text-stone-400 hover:text-stone-600 mb-1 block">
            ← Wedding
          </a>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-stone-900">Timeline</h1>
              {weddingDateStr && (
                <p className="text-sm text-stone-500 mt-0.5">{weddingDateStr}</p>
              )}
            </div>
            {goldenHour && (
              <div className="text-right">
                <p className="text-xs text-stone-400">Golden hour</p>
                <p className="text-sm font-medium text-amber-600">{goldenHour} UTC</p>
              </div>
            )}
          </div>
        </div>

        <TimelineEditor
          weddingId={id}
          initialBlocks={(blocks ?? []) as TimelineBlock[]}
          goldenHour={goldenHour}
        />
      </main>
    </div>
  );
}
