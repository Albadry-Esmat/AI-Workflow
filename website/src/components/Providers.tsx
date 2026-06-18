"use client";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="ase-os-theme" disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
