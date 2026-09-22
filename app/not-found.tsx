import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-5 text-center text-stone-200">
      <h1 className="text-2xl font-light uppercase tracking-widest text-amber-600">
        Page not found
      </h1>
      <p className="mt-4 text-sm text-stone-400">
        This page does not exist. Invite links open from the home page.
      </p>
      <Link
        href="/"
        className="mt-6 rounded border border-stone-600 px-4 py-2 text-sm hover:bg-stone-900"
      >
        Play chess
      </Link>
    </main>
  );
}
