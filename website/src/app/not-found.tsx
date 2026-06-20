import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 text-6xl font-black font-mono text-zinc-200 dark:text-zinc-800">404</div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">
        Page not found
      </h1>
      <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-sm mb-8 leading-relaxed">
        The page you are looking for does not exist or may have been moved.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-cyan-500 hover:bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors"
        >
          Go home
        </Link>
        <Link
          href="/skills"
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 px-5 py-2.5 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          Browse Skills
        </Link>
      </div>
    </div>
  );
}
