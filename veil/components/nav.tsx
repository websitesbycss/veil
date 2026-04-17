"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";

const links = [
  { href: "/dashboard", label: "Pipeline" },
  { href: "/clients", label: "Clients" },
  { href: "/settings", label: "Settings" },
];

export function Nav({ studioName }: { studioName: string | null }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-stone-200 bg-white sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-semibold text-stone-900">
            Veil
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  pathname.startsWith(href)
                    ? "bg-stone-100 text-stone-900 font-medium"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {studioName && (
            <span className="hidden sm:block text-xs text-stone-400">{studioName}</span>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs text-stone-500 hover:text-stone-800 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
