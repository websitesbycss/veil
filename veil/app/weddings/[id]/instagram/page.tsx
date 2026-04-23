import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { IgManager } from "./ig-manager";

type IgPost = {
  id: string;
  caption: string | null;
  hashtags: string | null;
  image_urls: string[] | null;
  status: "draft" | "scheduled" | "published" | "failed";
  scheduled_at: string | null;
  ig_media_id: string | null;
  created_at: string;
};

export default async function InstagramPage({
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
    .select("id, studio_name, ig_access_token")
    .eq("auth_user_id", user.id)
    .single();
  if (!photographer) redirect("/onboarding");

  const { data: wedding } = await supabase
    .from("weddings")
    .select("id")
    .eq("id", id)
    .eq("photographer_id", photographer.id)
    .single();
  if (!wedding) notFound();

  const { data: posts } = await supabase
    .from("ig_posts")
    .select("id, caption, hashtags, image_urls, status, scheduled_at, ig_media_id, created_at")
    .eq("wedding_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col min-h-screen">
      <Nav studioName={photographer.studio_name} />
      <main className="max-w-4xl mx-auto px-4 py-8 w-full">
        <div className="mb-6">
          <a
            href={`/weddings/${id}`}
            className="text-xs text-stone-400 hover:text-stone-600 mb-1 block"
          >
            ← Wedding
          </a>
          <h1 className="text-2xl font-semibold text-stone-900">Instagram</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            AI-drafted captions, carousel posts, scheduled publishing.
          </p>
        </div>

        <IgManager
          weddingId={id}
          posts={(posts ?? []) as IgPost[]}
          isConnected={Boolean(photographer.ig_access_token)}
        />
      </main>
    </div>
  );
}
