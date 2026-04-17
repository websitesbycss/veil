import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";

export default async function WeddingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: photographer } = await supabase
    .from("photographers")
    .select("id, studio_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!photographer) redirect("/onboarding");

  return (
    <div className="flex flex-col min-h-screen">
      <Nav studioName={photographer.studio_name} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
