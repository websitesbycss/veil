import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-5xl font-semibold tracking-tight text-stone-900 mb-4">Veil</h1>
      <p className="text-xl text-stone-500 mb-8 max-w-md">
        The studio OS for wedding photographers.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="px-6 py-3 bg-stone-900 text-white font-medium rounded-lg hover:bg-stone-700 transition-colors"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="px-6 py-3 border border-stone-300 text-stone-700 font-medium rounded-lg hover:border-stone-500 transition-colors"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
