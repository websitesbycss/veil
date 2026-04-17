import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Kanban } from "@/components/kanban";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: photographer } = await supabase
    .from("photographers")
    .select("id, full_name")
    .eq("auth_user_id", user!.id)
    .single();

  const { data: weddings } = await supabase
    .from("weddings")
    .select(
      `id, wedding_date, venue_name, status,
       client1:clients!weddings_client1_id_fkey(first_name, last_name),
       client2:clients!weddings_client2_id_fkey(first_name, last_name)`
    )
    .eq("photographer_id", photographer!.id)
    .order("wedding_date", { ascending: true });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between px-4 pt-6 pb-2">
        <h1 className="text-xl font-semibold text-stone-900">
          Pipeline
        </h1>
        <Link
          href="/weddings/new"
          className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors"
        >
          + New wedding
        </Link>
      </div>

      {(!weddings || weddings.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-stone-400 text-sm mb-4">No weddings yet.</p>
          <Link
            href="/weddings/new"
            className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors"
          >
            Add your first wedding
          </Link>
        </div>
      ) : (
        <Kanban weddings={weddings as Parameters<typeof Kanban>[0]["weddings"]} />
      )}
    </div>
  );
}
