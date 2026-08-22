#!/usr/bin/env node
/**
 * Aerospace Cyberpunk Radar HUD & Jet Heatmap Generator
 * 
 * - 1180px Cyber Deck frame mathematically harmonized with dark.svg
 * - 100% Symmetrical upright stealth jet with multi-stage plasma thruster
 * - Live GitHub GraphQL sync with resilient deterministic mock fallback
 * - Strict input sanitization & STRIDE / OWASP Top 10 defenses
 */

import fs from "node:fs";
import path from "node:path";

export const USERNAME = process.env.GH_USERNAME || "pratikforge";
export const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
export const OUTPUT = process.env.OUTPUT_PATH || "dist/github-jet.svg";

export const COLS = 52;
export const ROWS = 7;
export const CELL = 14;
export const GAP = 4;
export const STEP = CELL + GAP; // 18px

export const WIDTH = 1180;
export const HEIGHT = 320;

export const GRID_X = 140;
export const GRID_Y = 86;

export const JET_X_START = GRID_X + CELL / 2; // 147
export const JET_X_END = GRID_X + (COLS - 1) * STEP + CELL / 2; // 1065
export const JET_Y = 250;
export const LOOP_DUR = 18; // seconds

export const THEME = {
  bgStart: "#0B1120",
  bgEnd: "#050816",
  border1: "#22C55E",
  border2: "#10B981",
  border3: "#38BDF8",
  cyan: "#38BDF8",
  emerald: "#22C55E",
  mint: "#86EFAC",
  slate: "#94A3B8",
  muted: "#475569",
  cellEmpty: "#0F172A",
  cellEmptyBorder: "#1E293B",
  palette: ["#0F172A", "#064E3B", "#047857", "#10B981", "#34D399"]
};

export const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
export const DAY_NAMES = [
  { label: "MON", row: 1 },
  { label: "WED", row: 3 },
  { label: "FRI", row: 5 }
];

export function sanitizeText(str) {
  if (str === null || str === undefined) return "";
  const s = String(str);
  return s
    .replace(/on\w+\s*=/gi, "disarmed-attr=")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function validateUsername(username) {
  if (!username || typeof username !== "string") return false;
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username);
}

export function validateApiEndpoint(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === "https:" && parsed.hostname === "api.github.com";
  } catch {
    return false;
  }
}

export function generateMockWeeks(colCount = COLS) {
  const weeks = [];
  const now = new Date();
  const seedMultiplier = 16807;
  let seed = 42;

  for (let c = 0; c < colCount; c++) {
    const contributionDays = [];
    for (let r = 0; r < ROWS; r++) {
      seed = (seed * seedMultiplier) % 2147483647;
      const rand = seed / 2147483647;
      let count = 0;
      let color = THEME.palette[0];

      if (rand > 0.45) {
        if (rand > 0.90) {
          count = Math.floor(rand * 15) + 6;
          color = THEME.palette[4];
        } else if (rand > 0.75) {
          count = Math.floor(rand * 6) + 3;
          color = THEME.palette[3];
        } else if (rand > 0.60) {
          count = Math.floor(rand * 3) + 2;
          color = THEME.palette[2];
        } else {
          count = 1;
          color = THEME.palette[1];
        }
      }

      const d = new Date(now);
      d.setDate(d.getDate() - ((colCount - 1 - c) * 7 + (6 - r)));
      contributionDays.push({
        contributionCount: count,
        color,
        date: d.toISOString().split("T")[0]
      });
    }
    weeks.push({ contributionDays });
  }
  return weeks;
}

export function computeStats(weeks) {
  let total = 0;
  let activeDays = 0;
  let maxDay = 0;

  for (const week of weeks) {
    if (!week || !Array.isArray(week.contributionDays)) continue;
    for (const day of week.contributionDays) {
      if (!day) continue;
      const count = Number(day.contributionCount) || 0;
      total += count;
      if (count > 0) activeDays++;
      if (count > maxDay) maxDay = count;
    }
  }

  return { total, activeDays, maxDay };
}

export function buildCells(weeks, colCount = COLS) {
  const safeWeeks = Array.isArray(weeks) ? weeks.filter(w => w && Array.isArray(w.contributionDays)) : [];
  const recent = safeWeeks.slice(-colCount);
  const pad = colCount - recent.length;

  const padded = Array.from({ length: Math.max(0, pad) }, () => ({
    contributionDays: Array.from({ length: ROWS }, () => ({ contributionCount: 0, color: THEME.palette[0], date: null }))
  })).concat(recent);

  const cells = [];
  padded.forEach((week, col) => {
    if (col >= colCount) return;
    const days = Array.isArray(week.contributionDays) ? week.contributionDays : [];
    for (let row = 0; row < ROWS; row++) {
      const day = days[row] || { contributionCount: 0, color: THEME.palette[0], date: null };
      const rawColor = day.color || THEME.palette[0];
      // Map GitHub default gray to cyber dark slate
      const color = (rawColor === "#161b22" || rawColor === "#ebedf0") ? THEME.palette[0] : rawColor;
      cells.push({
        col,
        row,
        x: GRID_X + col * STEP,
        y: GRID_Y + row * STEP,
        color: sanitizeText(color),
        count: Number(day.contributionCount) || 0,
        date: sanitizeText(day.date || "")
      });
    }
  });
  return cells;
}

export function buildGrid(cells) {
  let svg = "";
  for (const c of cells) {
    const isLevel0 = c.color === THEME.palette[0];
    const strokeAttr = isLevel0 ? ` stroke="${THEME.cellEmptyBorder}" stroke-width="0.75"` : "";
    svg += `  <rect x="${c.x}" y="${c.y}" width="${CELL}" height="${CELL}" rx="2.5" fill="${c.color}"${strokeAttr}>\n`;
    svg += `    <title>${c.count} contributions on ${c.date || "untracked day"}</title>\n`;
    svg += `  </rect>\n`;
  }
  return svg;
}

export function buildMonthLabels() {
  let svg = "";
  const monthCols = [0, 4, 9, 13, 17, 22, 26, 30, 35, 39, 43, 48];
  monthCols.forEach((col, idx) => {
    const x = GRID_X + col * STEP;
    const label = MONTH_NAMES[idx % MONTH_NAMES.length];
    svg += `  <text x="${x}" y="73" class="axis-label">${label}</text>\n`;
  });
  return svg;
}

export function buildDayLabels() {
  let svg = "";
  DAY_NAMES.forEach(({ label, row }) => {
    const y = GRID_Y + row * STEP + 10.5;
    svg += `  <text x="${GRID_X - 12}" y="${y}" class="axis-label" text-anchor="end">${label}</text>\n`;
  });
  return svg;
}

export function buildCrosshairs() {
  const points = [
    [24, 60], [WIDTH - 24, 60],
    [24, HEIGHT - 24], [WIDTH - 24, HEIGHT - 24]
  ];
  return points.map(([x, y]) =>
    `  <path d="M${x - 4} ${y} H${x + 4} M${x} ${y - 4} V${y + 4}" stroke="#38BDF8" stroke-width="1" opacity="0.3"/>`
  ).join("\n");
}

export function buildStars() {
  const stars = [
    [35, 110, 2.2], [45, 190, 3.1], [75, 140, 1.8], [95, 230, 2.7],
    [1090, 110, 2.5], [1120, 180, 1.9], [1145, 130, 3.4], [1105, 220, 2.1],
    [320, 275, 2.0], [580, 275, 3.0], [840, 275, 1.7]
  ];
  return stars.map(([x, y, dur]) =>
    `  <circle cx="${x}" cy="${y}" r="1.1" fill="#7DD3FC">` +
    `<animate attributeName="opacity" values="0.15;0.9;0.15" dur="${dur}s" repeatCount="indefinite"/>` +
    `</circle>`
  ).join("\n");
}

export function buildLegend() {
  let svg = `<g transform="translate(${GRID_X}, ${HEIGHT - 22})">\n`;
  svg += `  <text x="0" y="8" class="legend-text">LESS</text>\n`;
  THEME.palette.forEach((color, i) => {
    const x = 38 + i * 14;
    const stroke = color === THEME.palette[0] ? ` stroke="${THEME.cellEmptyBorder}" stroke-width="0.75"` : "";
    svg += `  <rect x="${x}" y="0" width="10" height="10" rx="2" fill="${color}"${stroke}/>\n`;
  });
  svg += `  <text x="${38 + 5 * 14 + 4}" y="8" class="legend-text">MORE</text>\n`;
  svg += `</g>\n`;
  return svg;
}

export function buildJet() {
  return `<g id="jet">
  <g transform="translate(0,0)">
    <!-- Ion Particle Trail -->
    <ellipse cx="0" cy="18" rx="8" ry="2.5" fill="url(#ionGlow)" opacity="0.6">
      <animate attributeName="rx" values="6;11;7;10" dur="0.2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.4;0.7;0.3;0.8" dur="0.2s" repeatCount="indefinite"/>
    </ellipse>

    <!-- Supersonic Delta Wings -->
    <polygon points="-10,7 -17,14 -5,9" fill="#0284C7"/>
    <polygon points="10,7 17,14 5,9" fill="#0284C7"/>

    <!-- Wingtip Plasma Nav Coils -->
    <circle cx="-16" cy="13" r="1.4" fill="#22D3EE">
      <animate attributeName="opacity" values="0.5;1;0.5" dur="0.8s" repeatCount="indefinite"/>
    </circle>
    <circle cx="16" cy="13" r="1.4" fill="#22D3EE">
      <animate attributeName="opacity" values="0.5;1;0.5" dur="0.8s" repeatCount="indefinite"/>
    </circle>

    <!-- Titanium Aerodynamic Fuselage -->
    <polygon points="0,-16 10,7 4,4 -4,4 -10,7" fill="#38BDF8" stroke="#0284C7" stroke-width="1.2"/>
    <polygon points="0,-14 6,5 0,2" fill="#7DD3FC" opacity="0.35"/>

    <!-- Crystalline Pilot Canopy -->
    <ellipse cx="0" cy="-6" rx="2.5" ry="5.2" fill="#E0F2FE" opacity="0.95"/>
    <ellipse cx="0" cy="-7.5" rx="1.2" ry="2.4" fill="#FFFFFF"/>

    <!-- Plasma Thruster Flame (High-Frequency Dynamic Pulse) -->
    <g id="jet-exhaust">
      <polygon points="-3,7 3,7 0,22" fill="url(#plasmaFlame)">
        <animate attributeName="opacity" values="0.75;1;0.6;0.95;0.7;1" dur="0.16s" repeatCount="indefinite"/>
      </polygon>
      <polygon points="-1.5,7 1.5,7 0,13" fill="#FFFFFF">
        <animate attributeName="opacity" values="0.8;1;0.7;1" dur="0.16s" repeatCount="indefinite"/>
      </polygon>
    </g>
  </g>

  <!-- Smooth Kinematic Patrol Flight across timeline -->
  <animateTransform attributeName="transform" attributeType="XML" type="translate"
    dur="${LOOP_DUR}s" repeatCount="indefinite" calcMode="spline"
    keyTimes="0; 0.5; 1"
    keySplines="0.45 0 0.55 1; 0.45 0 0.55 1"
    values="${JET_X_START},${JET_Y}; ${JET_X_END},${JET_Y}; ${JET_X_START},${JET_Y}"/>
</g>`;
}

export function buildSvg(weeks, options = {}) {
  const isMock = Boolean(options.mock || !weeks || weeks.length === 0);
  const dataWeeks = isMock ? generateMockWeeks(COLS) : weeks;
  const cells = buildCells(dataWeeks, COLS);
  const stats = computeStats(dataWeeks);

  const displayTotal = sanitizeText(stats.total || (isMock ? "766" : "0"));
  const promptUser = sanitizeText(options.username || USERNAME);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<defs>
  <radialGradient id="bgGlow" cx="30%" cy="20%" r="80%">
    <stop offset="0%" stop-color="${THEME.bgStart}"/>
    <stop offset="100%" stop-color="${THEME.bgEnd}"/>
  </radialGradient>

  <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="${THEME.border1}"/>
    <stop offset="50%" stop-color="${THEME.border2}"/>
    <stop offset="100%" stop-color="${THEME.border3}"/>
  </linearGradient>

  <linearGradient id="plasmaFlame" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#38BDF8"/>
    <stop offset="40%" stop-color="#818CF8"/>
    <stop offset="80%" stop-color="#F59E0B"/>
    <stop offset="100%" stop-color="#EF4444" stop-opacity="0"/>
  </linearGradient>

  <radialGradient id="ionGlow" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.8"/>
    <stop offset="100%" stop-color="#38BDF8" stop-opacity="0"/>
  </radialGradient>

  <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse">
    <rect width="4" height="1" fill="#7DD3FC" opacity="0.035"/>
  </pattern>

  <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="3" result="blur"/>
    <feMerge>
      <feMergeNode in="blur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>

  <style>
    .term-prompt { font-family: 'Courier New', Consolas, monospace; font-size: 13px; fill: #86EFAC; font-weight: bold; letter-spacing: 0.5px; }
    .term-path   { font-family: 'Courier New', Consolas, monospace; font-size: 13px; fill: #38BDF8; font-weight: bold; }
    .status-text { font-family: 'Courier New', Consolas, monospace; font-size: 11px; fill: #38BDF8; font-weight: bold; letter-spacing: 1px; }
    .status-val  { font-family: 'Courier New', Consolas, monospace; font-size: 11px; fill: #4ADE80; font-weight: bold; }
    .axis-label  { font-family: 'Courier New', Consolas, monospace; font-size: 10px; fill: #64748B; font-weight: bold; }
    .legend-text { font-family: 'Courier New', Consolas, monospace; font-size: 9px; fill: #64748B; font-weight: bold; letter-spacing: 0.5px; }
    .hud-meta    { font-family: 'Courier New', Consolas, monospace; font-size: 10px; fill: #475569; letter-spacing: 1px; font-weight: bold; }
    text { white-space: pre; }
  </style>
</defs>

<!-- Cyber Deck Backdrop -->
<rect width="${WIDTH}" height="${HEIGHT}" rx="16" fill="url(#bgGlow)"/>
<rect width="${WIDTH}" height="${HEIGHT}" rx="16" fill="url(#scanlines)"/>
<rect x="0.75" y="0.75" width="${WIDTH - 1.5}" height="${HEIGHT - 1.5}" rx="16" fill="none" stroke="url(#borderGrad)" stroke-width="1.5"/>

<!-- HUD Header Bar -->
<g id="hud-header">
  <circle cx="26" cy="28" r="4.5" fill="#EF4444" opacity="0.8"/>
  <circle cx="42" cy="28" r="4.5" fill="#F59E0B" opacity="0.8"/>
  <circle cx="58" cy="28" r="4.5" fill="#10B981" opacity="0.8"/>

  <text x="76" y="32">
    <tspan class="term-prompt">${promptUser}@forge</tspan>
    <tspan class="term-path"> ~ /radar.sh --timeline</tspan>
  </text>

  <circle cx="870" cy="28" r="3.5" fill="#38BDF8">
    <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite"/>
  </circle>
  <text x="884" y="32">
    <tspan class="status-text">ORBIT: </tspan><tspan class="status-val">ACTIVE</tspan>
    <tspan class="status-text"> · TOTAL CONTRIBUTIONS: </tspan><tspan class="status-val">${displayTotal}</tspan>
  </text>

  <line x1="20" y1="46" x2="${WIDTH - 20}" y2="46" stroke="#1E293B" stroke-width="1"/>
  <line x1="20" y1="46" x2="160" y2="46" stroke="#22C55E" stroke-width="1" opacity="0.7"/>
  <line x1="${WIDTH - 160}" y1="46" x2="${WIDTH - 20}" y2="46" stroke="#38BDF8" stroke-width="1" opacity="0.7"/>
</g>

<!-- Crosshairs & Cosmic Starfield -->
${buildCrosshairs()}
${buildStars()}

<!-- Month and Day Grid Axes -->
<g id="axes">
${buildMonthLabels()}
${buildDayLabels()}
</g>

<!-- Heatmap Contribution Grid -->
<g id="grid">
${buildGrid(cells)}</g>

<!-- Bottom HUD Legend & Telemetry Metadata -->
${buildLegend()}
<text x="${WIDTH - 140}" y="${HEIGHT - 14}" class="hud-meta" text-anchor="end">[SYSTEM: RADAR SCANNER // SATELLITE LINKED]</text>

<!-- Symmetrical Supersonic Jet Fighter -->
${buildJet()}
</svg>`;
}

const QUERY = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount color}}}}}}`;

export async function fetchWeeks(username = USERNAME, token = TOKEN) {
  const endpoint = "https://api.github.com/graphql";
  if (!validateApiEndpoint(endpoint)) {
    throw new Error("Invalid GraphQL endpoint configuration");
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { login: username } }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API returned HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error("GraphQL query execution failed: " + JSON.stringify(json.errors));
  }
  return json.data.user.contributionsCollection.contributionCalendar.weeks;
}

export async function main() {
  console.log("Initializing Aerospace Radar Jet Heatmap Engine...");

  let weeks = [];
  let isMock = false;

  if (TOKEN && USERNAME) {
    try {
      console.log(`Querying live GitHub contributions for @${USERNAME}...`);
      weeks = await fetchWeeks(USERNAME, TOKEN);
      console.log(`Successfully retrieved ${weeks.length} weeks of live activity.`);
    } catch (err) {
      console.warn(`Live fetch failed (${err.message}). Falling back to high-fidelity deterministic radar telemetry.`);
      isMock = true;
    }
  } else {
    console.log("No GH_TOKEN detected in environment. Generating deterministic high-fidelity preview radar.");
    isMock = true;
  }

  const svg = buildSvg(weeks, { mock: isMock, username: USERNAME });
  const outPath = path.resolve(OUTPUT);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, svg, "utf8");
  console.log(`Wrote ${outPath} (${Buffer.byteLength(svg, "utf8")} bytes)`);

  // Also sync to root github-jet.svg if writing to dist/
  if (OUTPUT.includes("dist")) {
    const rootSvg = path.resolve("github-jet.svg");
    fs.writeFileSync(rootSvg, svg, "utf8");
    console.log(`Synced to ${rootSvg}`);
  }

  // Also write to dist/clone/pratikforge/github-jet.svg if path exists
  const cloneOut = path.resolve("dist/clone/pratikforge/github-jet.svg");
  if (fs.existsSync(path.dirname(cloneOut))) {
    fs.writeFileSync(cloneOut, svg, "utf8");
    console.log(`Synced to ${cloneOut}`);
  }
}

// Only auto-execute main() if invoked directly from CLI
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  main().catch(err => {
    console.error("FATAL:", err.message);
    process.exit(1);
  });
}
