import Link from "next/link";

export default function SkillNotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="text-4xl mb-4">🔍</p>
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
        Skill not found
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
        The skill ID you requested does not exist in the registry.
      </p>
      <Link
        href="/skills"
        className="text-sm px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-80 transition-opacity"
      >
        Browse all skills
      </Link>
    </div>
  );
}
