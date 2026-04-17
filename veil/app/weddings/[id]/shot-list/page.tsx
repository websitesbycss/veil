import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { ShotListManager } from "./shot-list-manager";

type ShotListItem = {
  id: string;
  sort_order: number;
  grouping_label: string;
  notes: string | null;
  completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
};

type SecondShooter = {
  id: string;
  name: string;
};

export default async function ShotListPage({
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
    .select("id, venue_name, wedding_date")
    .eq("id", id)
    .eq("photographer_id", photographer.id)
    .single();
  if (!wedding) notFound();

  const [{ data: items }, { data: shooters }, { data: familyCount }] = await Promise.all([
    supabase
      .from("shot_list_items")
      .select("id, sort_order, grouping_label, notes, completed, completed_by, completed_at")
      .eq("wedding_id", id)
      .order("sort_order"),
    supabase
      .from("second_shooters")
      .select("id, name")
      .eq("wedding_id", id),
    supabase
      .from("family_members")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", id),
  ]);

  const hasFamilyMembers = (familyCount?.length ?? 0) > 0 || false;

  return (
    <div className="flex flex-col min-h-screen">
      <Nav studioName={photographer.studio_name} />
      <main className="max-w-3xl mx-auto px-4 py-8 w-full">
        <div className="mb-6">
          <a href={`/weddings/${id}`} className="text-xs text-stone-400 hover:text-stone-600 mb-1 block">
            ← Wedding
          </a>
          <h1 className="text-2xl font-semibold text-stone-900">Shot List</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Family formals, ordered strategically. Share with your second shooter via PIN.
          </p>
        </div>

        <ShotListManager
          weddingId={id}
          initialItems={(items ?? []) as ShotListItem[]}
          initialShooters={(shooters ?? []) as SecondShooter[]}
          hasFamilyMembers={hasFamilyMembers}
        />
      </main>
    </div>
  );
}
