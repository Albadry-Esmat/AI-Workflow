/**
 * Root OG image — generated at build time via Next.js ImageResponse.
 * Serves as the default og:image and twitter:image for every route that
 * does not define its own opengraph-image file.
 *
 * Uses live data (loadSiteStats) so counts stay accurate on every build.
 */
import { ImageResponse } from "next/og";
import { loadSiteStats } from "@/lib/data";

export const alt = "ASE-OS — AI Software Engineering Operating System";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Node.js runtime: needed to read the file system via loadSiteStats()
export const runtime = "nodejs";

export default function Image() {
  // Graceful fallback so a data read error never blocks the build
  let totalSkills = 0;
  let totalPipelinePhases = 0;
  let totalPipelines = 0;
  try {
    const stats = loadSiteStats();
    totalSkills = stats.totalSkills;
    totalPipelinePhases = stats.totalPipelinePhases;
    totalPipelines = stats.totalPipelines;
  } catch {
    // Use fallback zeroes above
  }

  const statItems: [string, string][] = [
    [`${totalSkills}`,         "Skills"],
    [`${totalPipelinePhases}`, "Pipeline\u00a0Phases"],
    [`${totalPipelines}`,      "Pipelines"],
    ["Zero",                   "Doc\u00a0Drift"],
  ];

  return new ImageResponse(
    (
      <div
        style={{
          background: "#09090b",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "0 80px",
          position: "relative",
        }}
      >
        {/* ── Cyan radial glow — top-right ── */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 560,
            height: 560,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(6,182,212,0.18) 0%, transparent 68%)",
            display: "flex",
          }}
        />

        {/* ── Indigo radial glow — bottom-left ── */}
        <div
          style={{
            position: "absolute",
            bottom: -80,
            left: 160,
            width: 360,
            height: 360,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* ── Badge ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(6,182,212,0.10)",
            border: "1px solid rgba(6,182,212,0.35)",
            borderRadius: "8px",
            padding: "6px 18px",
            marginBottom: "36px",
            color: "#22d3ee",
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          AI WORKFLOW SYSTEM
        </div>

        {/* ── Logo: "ASE" white + "-OS" cyan ── */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            marginBottom: "22px",
          }}
        >
          <span
            style={{
              fontSize: "96px",
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            ASE
          </span>
          <span
            style={{
              fontSize: "96px",
              fontWeight: 900,
              color: "#22d3ee",
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            -OS
          </span>
        </div>

        {/* ── Tagline ── */}
        <div
          style={{
            display: "flex",
            fontSize: "28px",
            color: "#a1a1aa",
            fontWeight: 400,
            marginBottom: "56px",
            lineHeight: 1.4,
          }}
        >
          AI Software Engineering Operating System
        </div>

        {/* ── Cyan divider ── */}
        <div
          style={{
            width: "56px",
            height: "3px",
            background: "#22d3ee",
            borderRadius: "2px",
            marginBottom: "36px",
            display: "flex",
          }}
        />

        {/* ── Stats row ── */}
        <div
          style={{
            display: "flex",
            gap: "56px",
            alignItems: "flex-start",
          }}
        >
          {statItems.map(([val, label]) => (
            <div
              key={label}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <span
                style={{
                  fontSize: "34px",
                  fontWeight: 700,
                  color: "#22d3ee",
                  lineHeight: 1,
                }}
              >
                {val}
              </span>
              <span
                style={{
                  fontSize: "13px",
                  color: "#52525b",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.10em",
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
