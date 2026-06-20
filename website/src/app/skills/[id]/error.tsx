"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function SkillError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[SkillDetail] render error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="text-4xl mb-4">⚠️</p>
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
        Something went wrong loading this skill.
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
        {error.message ?? "An unexpected error occurred."}
      </p>
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={reset}
          className="text-sm px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-80 transition-opacity"
        >
          Try again
        </button>
        <Link
          href="/skills"
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        >
          Back to Skills
        </Link>
      </div>
    </div>
  );
}
