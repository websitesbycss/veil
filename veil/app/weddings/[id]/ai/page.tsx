import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { GhostwriterPanel } from "./ghostwriter-panel";

type AiDraft = {
  id: string;
  draft_type: string;
  content: string;
  status: string;
  created_at: string;
};

export default async function AiDraftsPage({
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

  const { data: drafts } = await supabase
    .from("ai_drafts")
    .select("id, draft_type, content, status, created_at")
    .eq("wedding_id", id)
    .eq("draft_type", "email")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col min-h-screen">
      <Nav studioName={photographer.studio_name} />
      <main className="max-w-4xl mx-auto px-4 py-8 w-full">
        <div className="mb-6">
          <a href={`/weddings/${id}`} className="text-xs text-stone-400 hover:text-stone-600 mb-1 block">
            ← Wedding
          </a>
          <h1 className="text-2xl font-semibold text-stone-900">AI Drafts</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Generate emails in your voice. Review and approve before sending.
          </p>
        </div>

        <GhostwriterPanel
          weddingId={id}
          existingDrafts={(drafts ?? []) as AiDraft[]}
        />
      </main>
    </div>
  );
}
