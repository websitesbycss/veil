import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Shot List — Veil",
  description: "Second shooter checklist",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1c1917",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function ChecklistLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            }
          `,
        }}
      />
    </>
  );
}
