"use client";
import { useEffect, useRef } from "react";
import { animate, useInView } from "framer-motion";

interface Props {
  to: number;
  duration?: number;
  className?: string;
}

/**
 * Counts from 0 to `to` once the element enters the viewport.
 * Uses framer-motion's imperative `animate()` for a smooth eased count-up.
 */
export function AnimatedCounter({ to, duration = 1.4, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView || !ref.current) return;
    const el = ref.current;
    const controls = animate(0, to, {
      duration,
      ease: "easeOut",
      onUpdate(v) {
        el.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [inView, to, duration]);

  return (
    <span ref={ref} className={className}>
      0
    </span>
  );
}
