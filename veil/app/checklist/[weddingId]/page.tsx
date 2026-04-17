import { ChecklistApp } from "./checklist-app";

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ weddingId: string }>;
}) {
  const { weddingId } = await params;

  // Validate UUID
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(weddingId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-900 text-white px-4">
        <p className="text-stone-400">Invalid checklist link.</p>
      </div>
    );
  }

  return <ChecklistApp weddingId={weddingId} />;
}
