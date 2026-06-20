import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  // Block framing by other origins (clickjacking protection)
  { key: "X-Frame-Options",           value: "SAMEORIGIN" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options",    value: "nosniff" },
  // Restrict referrer information sent to third parties
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  // Restrict access to sensitive APIs
  { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
  // Enable DNS prefetch for performance
  { key: "X-DNS-Prefetch-Control",    value: "on" },
  // Force HTTPS for 2 years (applied only in production by Vercel)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Content Security Policy
  // In dev: React needs 'unsafe-eval' to reconstruct call stacks and support HMR.
  // In prod: 'unsafe-eval' is omitted — React never uses it outside development.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",
      // Tailwind/Framer Motion inject inline styles at runtime
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Google Fonts webfonts
      "font-src 'self' https://fonts.gstatic.com",
      // Images from same origin, data URIs, and CDNs
      "img-src 'self' data: blob: https:",
      // API / fetch calls only to same origin
      "connect-src 'self'",
      // Disallow embedding in foreign frames
      "frame-ancestors 'none'",
      // Disallow base-tag hijacking
      "base-uri 'self'",
      // Restrict form submissions to same origin
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply to every route
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
