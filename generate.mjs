#!/usr/bin/env node
/**
 * Concept 1: Retro Arcade Space Defender Jet & Heatmap Generator
 * 
 * - 1180px x 340px Retro Arcade Canvas with CRT scanlines and neon borders
 * - Dual-hull interceptor starfighter with twin plasma thrusters and railguns
 * - Holographic target-locking reticle sweeping over contribution power-nodes
 * - Retro Arcade HUD: Score (PTS), Level (Rank), Combo multiplier, Shield health bar
 * - Strict TDD & STRIDE / OWASP Top 10 security defenses
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
export const HEIGHT = 340;

export const GRID_X = 140;
export const GRID_Y = 88;

export const JET_X_START = GRID_X + CELL / 2; // 147
export const JET_X_END = GRID_X + (COLS - 1) * STEP + CELL / 2; // 1065
export const JET_Y = 270;
export const LOOP_DUR = 18; // seconds

export const THEME = {
  bgStart: "#080C16",
  bgEnd: "#03060F",
  border1: "#22C55E",
  border2: "#10B981",
  border3: "#38BDF8",
  gold: "#FACC15",
  cyan: "#38BDF8",
  rose: "#FB7185",
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

export function computeArcadeScore(count) {
  const safeCount = Number(count);
  if (count === null || count === undefined || isNaN(safeCount)) {
    return "766,000 PTS";
  }
  if (safeCount === 0) return "0 PTS";
  const pts = safeCount * 1000;
  return pts.toLocaleString("en-US") + " PTS";
}

export function buildShieldBar(pct = 100) {
  const totalBlocks = 10;
  const activeBlocks = Math.max(0, Math.min(totalBlocks, Math.round((pct / 100) * totalBlocks)));
  let svg = '<g id="shield-segments">\n';
  for (let i = 0; i < totalBlocks; i++) {
    const x = i * 10;
    const isFilled = i < activeBlocks;
    const fill = isFilled ? "#22D3EE" : "#0F172A";
    const opacity = isFilled ? "0.95" : "0.3";
    svg += `  <rect x="${x}" y="0" width="7.5" height="12" rx="1.5" fill="${fill}" opacity="${opacity}" stroke="#0284C7" stroke-width="0.5"/>\n`;
  }
  svg += "</g>";
  return svg;
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
    const strokeAttr = isLevel0 ? ` stroke="${THEME.cellEmptyBorder}" stroke-width="0.75"` : ' stroke="#34D399" stroke-width="0.35"';
    svg += `  <rect x="${c.x}" y="${c.y}" width="${CELL}" height="${CELL}" rx="2.5" fill="${c.color}"${strokeAttr}><title>${c.count} power units on ${c.date || "untracked"}</title></rect>\n`;
  }
  return svg;
}

export function buildMonthLabels() {
  let svg = "";
  const monthCols = [0, 4, 9, 13, 17, 22, 26, 30, 35, 39, 43, 48];
  monthCols.forEach((col, idx) => {
    const x = GRID_X + col * STEP;
    const label = MONTH_NAMES[idx % MONTH_NAMES.length];
    svg += `  <text x="${x}" y="74" class="axis-label">${label}</text>\n`;
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
    [22, 60], [WIDTH - 22, 60],
    [22, HEIGHT - 22], [WIDTH - 22, HEIGHT - 22]
  ];
  return points.map(([x, y]) =>
    `  <path d="M${x - 4} ${y} H${x + 4} M${x} ${y - 4} V${y + 4}" stroke="#22D3EE" stroke-width="1" opacity="0.4"/>`
  ).join("\n");
}

export function buildStars() {
  const stars = [
    [35, 110, 2.2], [45, 190, 3.1], [75, 140, 1.8], [95, 230, 2.7],
    [1090, 110, 2.5], [1120, 180, 1.9], [1145, 130, 3.4], [1105, 220, 2.1],
    [320, 290, 2.0], [580, 290, 3.0], [840, 290, 1.7]
  ];
  return stars.map(([x, y, dur]) =>
    `  <circle cx="${x}" cy="${y}" r="1.1" fill="#7DD3FC">` +
    `<animate attributeName="opacity" values="0.15;0.9;0.15" dur="${dur}s" repeatCount="indefinite"/>` +
    `</circle>`
  ).join("\n");
}

export function buildLegend() {
  let svg = `<g transform="translate(${GRID_X}, ${HEIGHT - 20})">\n`;
  svg += `  <text x="0" y="8" class="legend-text">POWER NODES: LOW</text>\n`;
  THEME.palette.forEach((color, i) => {
    const x = 115 + i * 14;
    const stroke = color === THEME.palette[0] ? ` stroke="${THEME.cellEmptyBorder}" stroke-width="0.75"` : "";
    svg += `  <rect x="${x}" y="0" width="10" height="10" rx="2" fill="${color}"${stroke}/>\n`;
  });
  svg += `  <text x="${115 + 5 * 14 + 4}" y="8" class="legend-text">OVERDRIVE</text>\n`;
  svg += `</g>\n`;
  return svg;
}

export function buildPhotonTorpedoes() {
  return `<g id="photon-torpedoes">
  <!-- Left Homing Photon Torpedo Payload -->
  <g class="torpedo-payload" transform="translate(-9, 0)" opacity="0">
    <ellipse cx="0" cy="0" rx="2.2" ry="4.5" fill="#FFFFFF"/>
    <polygon points="-2,3 2,3 0,10" fill="#FACC15"/>
    <ellipse cx="0" cy="5" rx="3.5" ry="1.8" fill="#38BDF8" opacity="0.8"/>
    <!-- Curved Left Arc Motion (Outward then Inward to Matrix Node) -->
    <animateTransform attributeName="transform" type="translate" dur="4.5s" repeatCount="indefinite" calcMode="spline"
      keyTimes="0; 0.044; 0.222; 0.223; 1"
      keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 1 1; 0 0 1 1"
      values="-9,0; -26,-60; -14,-120; -9,0; -9,0"/>
    <animate attributeName="opacity" dur="4.5s" repeatCount="indefinite" calcMode="discrete"
      keyTimes="0; 0.044; 0.222; 1" values="0; 1; 0; 0"/>
  </g>

  <!-- Right Homing Photon Torpedo Payload -->
  <g class="torpedo-payload" transform="translate(9, 0)" opacity="0">
    <ellipse cx="0" cy="0" rx="2.2" ry="4.5" fill="#FFFFFF"/>
    <polygon points="-2,3 2,3 0,10" fill="#FACC15"/>
    <ellipse cx="0" cy="5" rx="3.5" ry="1.8" fill="#38BDF8" opacity="0.8"/>
    <!-- Curved Right Arc Motion (Outward then Inward to Matrix Node) -->
    <animateTransform attributeName="transform" type="translate" dur="4.5s" repeatCount="indefinite" calcMode="spline"
      keyTimes="0; 0.044; 0.222; 0.223; 1"
      keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 1 1; 0 0 1 1"
      values="9,0; 26,-60; 14,-120; 9,0; 9,0"/>
    <animate attributeName="opacity" dur="4.5s" repeatCount="indefinite" calcMode="discrete"
      keyTimes="0; 0.044; 0.222; 1" values="0; 1; 0; 0"/>
  </g>

  <!-- Impact Shockwave Burst Over Matrix Nodes -->
  <g class="impact-shockwave">
    <!-- Left Impact Expanding Rings & Sparks -->
    <circle cx="-14" cy="-120" r="0" fill="none" stroke="#FACC15" stroke-width="1.6" class="shockwave-ring" opacity="0">
      <animate attributeName="r" dur="4.5s" repeatCount="indefinite" keyTimes="0; 0.222; 0.333; 1" values="0; 2; 22; 0"/>
      <animate attributeName="opacity" dur="4.5s" repeatCount="indefinite" keyTimes="0; 0.222; 0.333; 1" values="0; 1; 0; 0"/>
    </circle>
    <circle cx="-14" cy="-120" r="0" fill="none" stroke="#38BDF8" stroke-width="1.2" class="shockwave-ring" opacity="0">
      <animate attributeName="r" dur="4.5s" repeatCount="indefinite" keyTimes="0; 0.222; 0.377; 1" values="0; 4; 28; 0"/>
      <animate attributeName="opacity" dur="4.5s" repeatCount="indefinite" keyTimes="0; 0.222; 0.377; 1" values="0; 0.85; 0; 0"/>
    </circle>
    <line x1="-20" y1="-120" x2="-8" y2="-120" stroke="#FFFFFF" stroke-width="1.2" opacity="0">
      <animate attributeName="opacity" dur="4.5s" repeatCount="indefinite" keyTimes="0; 0.222; 0.311; 1" values="0; 1; 0; 0"/>
    </line>
    <line x1="-14" y1="-126" x2="-14" y2="-114" stroke="#FFFFFF" stroke-width="1.2" opacity="0">
      <animate attributeName="opacity" dur="4.5s" repeatCount="indefinite" keyTimes="0; 0.222; 0.311; 1" values="0; 1; 0; 0"/>
    </line>

    <!-- Right Impact Expanding Rings & Sparks -->
    <circle cx="14" cy="-120" r="0" fill="none" stroke="#FACC15" stroke-width="1.6" class="shockwave-ring" opacity="0">
      <animate attributeName="r" dur="4.5s" repeatCount="indefinite" keyTimes="0; 0.222; 0.333; 1" values="0; 2; 22; 0"/>
      <animate attributeName="opacity" dur="4.5s" repeatCount="indefinite" keyTimes="0; 0.222; 0.333; 1" values="0; 1; 0; 0"/>
    </circle>
    <circle cx="14" cy="-120" r="0" fill="none" stroke="#38BDF8" stroke-width="1.2" class="shockwave-ring" opacity="0">
      <animate attributeName="r" dur="4.5s" repeatCount="indefinite" keyTimes="0; 0.222; 0.377; 1" values="0; 4; 28; 0"/>
      <animate attributeName="opacity" dur="4.5s" repeatCount="indefinite" keyTimes="0; 0.222; 0.377; 1" values="0; 0.85; 0; 0"/>
    </circle>
    <line x1="8" y1="-120" x2="20" y2="-120" stroke="#FFFFFF" stroke-width="1.2" opacity="0">
      <animate attributeName="opacity" dur="4.5s" repeatCount="indefinite" keyTimes="0; 0.222; 0.311; 1" values="0; 1; 0; 0"/>
    </line>
    <line x1="14" y1="-126" x2="14" y2="-114" stroke="#FFFFFF" stroke-width="1.2" opacity="0">
      <animate attributeName="opacity" dur="4.5s" repeatCount="indefinite" keyTimes="0; 0.222; 0.311; 1" values="0; 1; 0; 0"/>
    </line>
  </g>
</g>`;
}

export function buildArcadeStarfighter() {
  return `<g id="starfighter">
  <!-- Option 3: Lock-On Homing Photon Torpedoes Weapon System -->
  ${buildPhotonTorpedoes()}

  <!-- Holographic Target Locking Reticle Locked over Matrix Grid -->
  <g id="targeting-reticle">
    <circle cx="0" cy="-120" r="18" fill="none" stroke="#4ADE80" stroke-width="1.2" stroke-dasharray="4 2" class="reticle-ring">
      <animate attributeName="r" values="16;22;16" dur="1.8s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.45;0.95;0.45" dur="1.8s" repeatCount="indefinite"/>
    </circle>
    <circle cx="0" cy="-120" r="28" fill="none" stroke="#22D3EE" stroke-width="1" opacity="0.65" stroke-dasharray="8 4">
      <animateTransform attributeName="transform" type="rotate" from="0 0 -120" to="360 0 -120" dur="10s" repeatCount="indefinite"/>
    </circle>
    <!-- Crosshair Directional Ticks -->
    <line x1="0" y1="-152" x2="0" y2="-140" stroke="#4ADE80" stroke-width="1.5" class="reticle-tick"/>
    <line x1="0" y1="-100" x2="0" y2="-88" stroke="#4ADE80" stroke-width="1.5" class="reticle-tick"/>
    <line x1="-32" y1="-120" x2="-20" y2="-120" stroke="#4ADE80" stroke-width="1.5" class="reticle-tick"/>
    <line x1="20" y1="-120" x2="32" y2="-120" stroke="#4ADE80" stroke-width="1.5" class="reticle-tick"/>
    <!-- Lock-on Center Pip -->
    <circle cx="0" cy="-120" r="2.2" fill="#86EFAC">
      <animate attributeName="opacity" values="1;0.2;1" dur="0.5s" repeatCount="indefinite"/>
    </circle>
  </g>

  <!-- Dual-Hull Arcade Starfighter Chassis -->
  <g transform="translate(0,0)">
    <!-- Expanding Ion Particle Glow -->
    <ellipse cx="0" cy="18" rx="14" ry="3" fill="url(#ionGlow)" opacity="0.7">
      <animate attributeName="rx" values="12;18;13;17" dur="0.2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.5;0.85;0.4;0.9" dur="0.2s" repeatCount="indefinite"/>
    </ellipse>

    <!-- Twin Wingtip Plasma Railgun Cannons -->
    <rect x="-21" y="-8" width="2.5" height="18" rx="1" fill="#7DD3FC"/>
    <rect x="18.5" y="-8" width="2.5" height="18" rx="1" fill="#7DD3FC"/>
    <circle cx="-19.75" cy="-8" r="1.8" fill="#22D3EE">
      <animate attributeName="opacity" values="0.6;1;0.6" dur="0.6s" repeatCount="indefinite"/>
    </circle>
    <circle cx="19.75" cy="-8" r="1.8" fill="#22D3EE">
      <animate attributeName="opacity" values="0.6;1;0.6" dur="0.6s" repeatCount="indefinite"/>
    </circle>

    <!-- Port & Starboard Twin Fuselage Pods -->
    <polygon points="-14,-16 -7,-16 -5,9 -16,9" fill="#38BDF8" stroke="#0284C7" stroke-width="1.2"/>
    <polygon points="7,-16 14,-16 16,9 5,9" fill="#38BDF8" stroke="#0284C7" stroke-width="1.2"/>

    <!-- Center Deck Armor & Delta Wing Bridge -->
    <polygon points="-7,-7 7,-7 18,9 5,6 -5,6 -18,9" fill="#0284C7"/>
    <polygon points="0,-12 6,4 0,1 -6,4" fill="#0F172A"/>

    <!-- Crystalline Pilot Canopy -->
    <ellipse cx="0" cy="-3" rx="3.2" ry="5.8" fill="#E0F2FE" opacity="0.95"/>
    <ellipse cx="0" cy="-4.5" rx="1.5" ry="2.6" fill="#FFFFFF"/>

    <!-- Twin High-Frequency Plasma Thruster Flames -->
    <g id="twin-thrusters">
      <!-- Left Thruster Flame -->
      <polygon points="-13,9 -8,9 -10.5,26" fill="url(#plasmaFlame)">
        <animate attributeName="opacity" values="0.75;1;0.6;0.95;0.7;1" dur="0.16s" repeatCount="indefinite"/>
      </polygon>
      <polygon points="-12,9 -9,9 -10.5,15" fill="#FFFFFF">
        <animate attributeName="opacity" values="0.8;1;0.7;1" dur="0.16s" repeatCount="indefinite"/>
      </polygon>

      <!-- Right Thruster Flame -->
      <polygon points="8,9 13,9 10.5,26" fill="url(#plasmaFlame)">
        <animate attributeName="opacity" values="0.75;1;0.6;0.95;0.7;1" dur="0.16s" repeatCount="indefinite"/>
      </polygon>
      <polygon points="9,9 12,9 10.5,15" fill="#FFFFFF">
        <animate attributeName="opacity" values="0.8;1;0.7;1" dur="0.16s" repeatCount="indefinite"/>
      </polygon>
    </g>
  </g>

  <!-- Smooth Spline Horizontal Patrol Kinematics -->
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

  const scoreText = sanitizeText(computeArcadeScore(stats.total || (isMock ? 766 : 0)));

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
    .hud-label-gold { font-family: 'Courier New', Consolas, monospace; font-size: 13px; fill: #FACC15; font-weight: bold; letter-spacing: 0.5px; }
    .hud-val-gold   { font-family: 'Courier New', Consolas, monospace; font-size: 13px; fill: #FEF08A; font-weight: bold; }
    .hud-label-cyan { font-family: 'Courier New', Consolas, monospace; font-size: 12px; fill: #38BDF8; font-weight: bold; letter-spacing: 0.5px; }
    .hud-val-cyan   { font-family: 'Courier New', Consolas, monospace; font-size: 12px; fill: #E0F2FE; font-weight: bold; }
    .hud-label-rose { font-family: 'Courier New', Consolas, monospace; font-size: 12px; fill: #FB7185; font-weight: bold; letter-spacing: 0.5px; }
    .hud-val-rose   { font-family: 'Courier New', Consolas, monospace; font-size: 12px; fill: #FECDD3; font-weight: bold; }
    .axis-label     { font-family: 'Courier New', Consolas, monospace; font-size: 10px; fill: #64748B; font-weight: bold; }
    .legend-text    { font-family: 'Courier New', Consolas, monospace; font-size: 9px; fill: #64748B; font-weight: bold; letter-spacing: 0.5px; }
    .hud-meta       { font-family: 'Courier New', Consolas, monospace; font-size: 10px; fill: #475569; letter-spacing: 1px; font-weight: bold; }
    text { white-space: pre; }
  </style>
</defs>

<!-- Retro Arcade Cosmic Backdrop -->
<rect width="${WIDTH}" height="${HEIGHT}" rx="16" fill="url(#bgGlow)"/>
<rect width="${WIDTH}" height="${HEIGHT}" rx="16" fill="url(#scanlines)"/>
<rect x="1" y="1" width="${WIDTH - 2}" height="${HEIGHT - 2}" rx="16" fill="none" stroke="url(#borderGrad)" stroke-width="1.5"/>
<rect x="6" y="6" width="${WIDTH - 12}" height="${HEIGHT - 12}" rx="12" fill="none" stroke="#22C55E" stroke-width="0.5" opacity="0.25"/>

<!-- Retro Arcade Top HUD -->
<g id="arcade-hud">
  <!-- SCORE -->
  <text x="24" y="32"><tspan class="hud-label-gold">SCORE: </tspan><tspan class="hud-val-gold">${scoreText}</tspan></text>

  <!-- RANK / LEVEL -->
  <text x="320" y="32"><tspan class="hud-label-cyan">RANK: </tspan><tspan class="hud-val-cyan">LVL 42 · AIML ARCHITECT</tspan></text>

  <!-- COMBO MULTIPLIER -->
  <text x="680" y="32"><tspan class="hud-label-rose">COMBO: </tspan><tspan class="hud-val-rose">x14 SHIPPER</tspan></text>

  <!-- SHIELDS -->
  <text x="930" y="32" class="hud-label-cyan">SHIELDS: 100%</text>
  <g transform="translate(1045, 22)">
    ${buildShieldBar(100)}
  </g>

  <!-- HUD Divider -->
  <line x1="20" y1="46" x2="${WIDTH - 20}" y2="46" stroke="#1E293B" stroke-width="1"/>
  <line x1="20" y1="46" x2="160" y2="46" stroke="#FACC15" stroke-width="1" opacity="0.8"/>
  <line x1="${WIDTH - 160}" y1="46" x2="${WIDTH - 20}" y2="46" stroke="#22D3EE" stroke-width="1" opacity="0.8"/>
</g>

<!-- Crosshairs & Cosmic Starfield -->
${buildCrosshairs()}
${buildStars()}

<!-- Month and Day Grid Axes -->
<g id="axes">
${buildMonthLabels()}
${buildDayLabels()}
</g>

<!-- Heatmap Contribution Power-Core Grid -->
<g id="grid">
${buildGrid(cells)}</g>

<!-- Bottom HUD Legend & Defense Grid Metadata -->
${buildLegend()}
<text x="${WIDTH - 140}" y="${HEIGHT - 12}" class="hud-meta" text-anchor="end">[ARCADE DEFENSE GRID // SECTOR: PRATIK-FORGE]</text>

<!-- Dual-Hull Starfighter Jet & Holographic Target Lock-On -->
${buildArcadeStarfighter()}
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
  console.log("Initializing Retro Arcade Space Defender Heatmap Engine...");

  let weeks = [];
  let isMock = false;

  if (TOKEN && USERNAME) {
    try {
      console.log(`Querying live GitHub contributions for @${USERNAME}...`);
      weeks = await fetchWeeks(USERNAME, TOKEN);
      console.log(`Successfully retrieved ${weeks.length} weeks of live activity.`);
    } catch (err) {
      console.warn(`Live fetch failed (${err.message}). Falling back to deterministic arcade telemetry.`);
      isMock = true;
    }
  } else {
    console.log("No GH_TOKEN detected in environment. Generating deterministic arcade preview.");
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
