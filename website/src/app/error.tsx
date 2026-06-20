"use client";

import { useEffect } from "react";
import Link from "next/link";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    // Log to an error reporting service in production
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 text-5xl font-black font-mono text-zinc-300 dark:text-zinc-700">500</div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">
        Something went wrong
      </h1>
      <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-sm mb-8 leading-relaxed">
        An unexpected error occurred while rendering this page.
        {error.digest && (
          <span className="block mt-2 font-mono text-xs text-zinc-400 dark:text-zinc-600">
            Error ID: {error.digest}
          </span>
        )}
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-cyan-500 hover:bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 px-5 py-2.5 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
