"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { motion } from "framer-motion";

const NAV = [
  { href: "/",               label: "Home"           },
  { href: "/how-it-works",   label: "How It Works"   },
  { href: "/skills",         label: "Skills"         },
  { href: "/architecture",   label: "Architecture"   },
  { href: "/getting-started",label: "Getting Started"},
  { href: "/reference",      label: "Reference"      },
];

export function Navbar() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/80 dark:bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex h-14 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-white">
            ASE<span className="text-cyan-400">-OS</span>
          </span>
          <span className="hidden sm:inline text-xs text-zinc-500 font-mono border border-zinc-700 rounded px-1.5 py-0.5">
            v1.0
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const active = path === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-3 py-1.5 text-sm rounded-md transition-colors ${
                  active
                    ? "text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-md bg-zinc-800"
                    style={{ zIndex: -1 }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
