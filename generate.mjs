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

export function selectTargets(cells) {
  const activeCells = cells.filter(c => c.count > 0);
  const byCol = new Map();
  for (const c of activeCells) {
    if (!byCol.has(c.col) || byCol.get(c.col).count < c.count) {
      byCol.set(c.col, c);
    }
  }

  let selectedCols = Array.from(byCol.keys()).sort((a, b) => a - b);
  // If fewer than 8 active columns, pick prominent columns evenly across the 52 weeks
  if (selectedCols.length < 8) {
    const fallbackCols = [3, 8, 14, 20, 26, 32, 38, 44, 49];
    for (const fCol of fallbackCols) {
      if (!byCol.has(fCol)) {
        const colCells = cells.filter(c => c.col === fCol);
        const repCell = colCells[Math.floor(colCells.length / 2)] || colCells[0];
        if (repCell) byCol.set(fCol, repCell);
      }
    }
    selectedCols = Array.from(byCol.keys()).sort((a, b) => a - b);
  }

  // Cap at 16 targets maximum to keep SVG lightweight and crisp
  if (selectedCols.length > 16) {
    const step = Math.ceil(selectedCols.length / 16);
    selectedCols = selectedCols.filter((_, idx) => idx % step === 0);
  }

  return selectedCols.map(col => {
    const cell = byCol.get(col);
    const cx = cell.x + CELL / 2;
    const cy = cell.y + CELL / 2;

    // Timing math for 18.0s loop (Forward: 0..9s, Return: 9..18s)
    const k_launch_fwd = Math.max(0.001, (col / 51) * 0.5);
    const k_hit_fwd = Math.min(0.490, k_launch_fwd + 0.010);
    const k_mid_fwd = Math.min(0.495, k_hit_fwd + 0.008);
    const k_settle_fwd = Math.min(0.499, k_hit_fwd + 0.020);

    const k_launch_ret = Math.max(0.501, 0.5 + ((51 - col) / 51) * 0.5);
    const k_hit_ret = Math.min(0.985, k_launch_ret + 0.010);
    const k_mid_ret = Math.min(0.990, k_hit_ret + 0.008);
    const k_settle_ret = Math.min(0.999, k_hit_ret + 0.020);

    return {
      col,
      x: cell.x,
      y: cell.y,
      cx,
      cy,
      count: cell.count || 1,
      color: cell.color,
      k_launch_fwd,
      k_hit_fwd,
      k_mid_fwd,
      k_settle_fwd,
      k_launch_ret,
      k_hit_ret,
      k_mid_ret,
      k_settle_ret
    };
  });
}

export function buildGrid(cells, targets = []) {
  const targetMap = new Map();
  targets.forEach(t => targetMap.set(`${t.x},${t.y}`, t));

  let svg = "";
  for (const c of cells) {
    const key = `${c.x},${c.y}`;
    const isTarget = targetMap.has(key);
    const isLevel0 = c.color === THEME.palette[0];
    const strokeAttr = isLevel0 ? ` stroke="${THEME.cellEmptyBorder}" stroke-width="0.75"` : ' stroke="#34D399" stroke-width="0.35"';

    if (isTarget) {
      const t = targetMap.get(key);
      svg += `  <rect x="${c.x}" y="${c.y}" width="${CELL}" height="${CELL}" rx="2.5" fill="${c.color}"${strokeAttr}>\n`;
      svg += `    <animate attributeName="fill" dur="18s" repeatCount="indefinite" values="${c.color}; ${c.color}; #FFFFFF; #86EFAC; ${c.color}; ${c.color}; #FFFFFF; #86EFAC; ${c.color}" keyTimes="0; ${t.k_launch_fwd.toFixed(4)}; ${t.k_hit_fwd.toFixed(4)}; ${t.k_mid_fwd.toFixed(4)}; ${t.k_settle_fwd.toFixed(4)}; ${t.k_launch_ret.toFixed(4)}; ${t.k_hit_ret.toFixed(4)}; ${t.k_mid_ret.toFixed(4)}; 1"/>\n`;
      svg += `    <animate attributeName="stroke" dur="18s" repeatCount="indefinite" values="#34D399; #34D399; #FFFFFF; #38BDF8; #34D399; #34D399; #FFFFFF; #38BDF8; #34D399" keyTimes="0; ${t.k_launch_fwd.toFixed(4)}; ${t.k_hit_fwd.toFixed(4)}; ${t.k_mid_fwd.toFixed(4)}; ${t.k_settle_fwd.toFixed(4)}; ${t.k_launch_ret.toFixed(4)}; ${t.k_hit_ret.toFixed(4)}; ${t.k_mid_ret.toFixed(4)}; 1"/>\n`;
      svg += `    <animate attributeName="stroke-width" dur="18s" repeatCount="indefinite" values="0.35; 0.35; 1.5; 0.8; 0.35; 0.35; 1.5; 0.8; 0.35" keyTimes="0; ${t.k_launch_fwd.toFixed(4)}; ${t.k_hit_fwd.toFixed(4)}; ${t.k_mid_fwd.toFixed(4)}; ${t.k_settle_fwd.toFixed(4)}; ${t.k_launch_ret.toFixed(4)}; ${t.k_hit_ret.toFixed(4)}; ${t.k_mid_ret.toFixed(4)}; 1"/>\n`;
      svg += `    <title>${c.count} power units on ${c.date || "untracked"}</title>\n`;
      svg += `  </rect>\n`;
    } else {
      svg += `  <rect x="${c.x}" y="${c.y}" width="${CELL}" height="${CELL}" rx="2.5" fill="${c.color}"${strokeAttr}><title>${c.count} power units on ${c.date || "untracked"}</title></rect>\n`;
    }
  }
  return svg;
}

export function buildDynamicReticle(targets = []) {
  // Build keyframe Y translations so the crosshair tracks the exact row height of each target
  const keyTimesArr = [0];
  const valuesArr = ["0,-130"]; // default elevation

  if (targets.length > 0) {
    // Forward pass keyframes
    targets.forEach(t => {
      const relY = Math.round(t.cy - 270);
      keyTimesArr.push(Number(t.k_launch_fwd.toFixed(4)));
      valuesArr.push(`0,${relY}`);
      keyTimesArr.push(Number(t.k_settle_fwd.toFixed(4)));
      valuesArr.push(`0,${relY}`);
    });

    keyTimesArr.push(0.5);
    valuesArr.push(`0,${Math.round(targets[targets.length - 1].cy - 270)}`);

    // Return pass keyframes (reverse order)
    const revTargets = [...targets].reverse();
    revTargets.forEach(t => {
      const relY = Math.round(t.cy - 270);
      keyTimesArr.push(Number(t.k_launch_ret.toFixed(4)));
      valuesArr.push(`0,${relY}`);
      keyTimesArr.push(Number(t.k_settle_ret.toFixed(4)));
      valuesArr.push(`0,${relY}`);
    });
  }

  keyTimesArr.push(1);
  valuesArr.push("0,-130");

  // Ensure monotonic ascending keyTimes
  const cleanKeyTimes = [];
  const cleanValues = [];
  let lastTime = -1;
  for (let i = 0; i < keyTimesArr.length; i++) {
    const cur = keyTimesArr[i];
    if (cur > lastTime && cur <= 1) {
      cleanKeyTimes.push(cur.toFixed(4));
      cleanValues.push(valuesArr[i]);
      lastTime = cur;
    }
  }
  if (cleanKeyTimes[cleanKeyTimes.length - 1] !== "1.0000") {
    cleanKeyTimes.push("1.0000");
    cleanValues.push(cleanValues[cleanValues.length - 1] || "0,-130");
  }

  const kTimesStr = cleanKeyTimes.join("; ");
  const valsStr = cleanValues.join("; ");

  return `<g id="targeting-reticle">
  <g class="reticle-tracker">
    <!-- Sighting Laser Guide connecting starfighter to target node -->
    <line x1="0" y1="0" x2="0" y2="240" stroke="#22D3EE" stroke-width="1.2" stroke-dasharray="4 3" class="sighting-laser" opacity="0.65"/>
    
    <!-- Outer Rotating Cyan HUD Ring -->
    <circle cx="0" cy="0" r="26" fill="none" stroke="#22D3EE" stroke-width="1.2" stroke-dasharray="8 4" opacity="0.8">
      <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="8s" repeatCount="indefinite"/>
    </circle>

    <!-- Inner Target Locking Emerald/Gold Ring -->
    <circle cx="0" cy="0" r="16" fill="none" stroke="#4ADE80" stroke-width="1.8" stroke-dasharray="4 2">
      <animate attributeName="r" values="15;21;15" dur="1.2s" repeatCount="indefinite"/>
      <animate attributeName="stroke" values="#4ADE80;#FACC15;#4ADE80" dur="1.2s" repeatCount="indefinite"/>
    </circle>

    <!-- Directional Crosshair Ticks -->
    <line x1="0" y1="-32" x2="0" y2="-20" stroke="#4ADE80" stroke-width="1.8"/>
    <line x1="0" y1="20" x2="0" y2="32" stroke="#4ADE80" stroke-width="1.8"/>
    <line x1="-32" y1="0" x2="-20" y2="0" stroke="#4ADE80" stroke-width="1.8"/>
    <line x1="20" y1="0" x2="32" y2="0" stroke="#4ADE80" stroke-width="1.8"/>

    <!-- Flashing Center Lock-On Pip -->
    <circle cx="0" cy="0" r="2.5" fill="#FACC15">
      <animate attributeName="opacity" values="1;0.2;1" dur="0.4s" repeatCount="indefinite"/>
    </circle>

    <!-- Dynamic Y-Axis Tracking Animation Locked to Active Row Height -->
    <animateTransform attributeName="transform" type="translate" dur="18s" repeatCount="indefinite" values="${valsStr}" keyTimes="${kTimesStr}"/>
  </g>
</g>`;
}

export function buildProminentRailguns() {
  return `<g id="prominent-railguns">
  <!-- Left Heavy Plasma Railgun Beam (6px wide, white core, cyan glow aura) -->
  <g class="plasma-beam" filter="url(#softGlow)" opacity="0">
    <rect x="-23" y="-40" width="6" height="40" rx="3" fill="#FFFFFF" stroke="#38BDF8" stroke-width="1.5"/>
    <polygon points="-24,0 -20,0 -22,16" fill="#FACC15"/>
    <animateTransform attributeName="transform" type="translate" dur="1.8s" repeatCount="indefinite" values="0,0; 0,-260" keyTimes="0; 0.16" fill="remove"/>
    <animate attributeName="opacity" dur="1.8s" repeatCount="indefinite" calcMode="discrete" values="0; 1; 0; 0" keyTimes="0; 0.02; 0.16; 1"/>
  </g>

  <!-- Right Heavy Plasma Railgun Beam (6px wide, white core, cyan glow aura) -->
  <g class="plasma-beam" filter="url(#softGlow)" opacity="0">
    <rect x="17" y="-40" width="6" height="40" rx="3" fill="#FFFFFF" stroke="#38BDF8" stroke-width="1.5"/>
    <polygon points="16,0 20,0 18,16" fill="#FACC15"/>
    <animateTransform attributeName="transform" type="translate" dur="1.8s" repeatCount="indefinite" values="0,0; 0,-260" keyTimes="0; 0.16" fill="remove"/>
    <animate attributeName="opacity" dur="1.8s" repeatCount="indefinite" calcMode="discrete" values="0; 1; 0; 0" keyTimes="0; 0.02; 0.16; 1"/>
  </g>

  <!-- Alternating Center Twin Heavy Blaster Cannons -->
  <g class="plasma-beam" filter="url(#softGlow)" opacity="0">
    <rect x="-8.5" y="-34" width="5" height="34" rx="2.5" fill="#FFFFFF" stroke="#4ADE80" stroke-width="1.4"/>
    <rect x="3.5" y="-34" width="5" height="34" rx="2.5" fill="#FFFFFF" stroke="#4ADE80" stroke-width="1.4"/>
    <polygon points="-9,0 -5,0 -7,14" fill="#FACC15"/>
    <polygon points="3,0 7,0 5,14" fill="#FACC15"/>
    <animateTransform attributeName="transform" type="translate" dur="1.8s" repeatCount="indefinite" values="0,0; 0,-260" keyTimes="0.5; 0.66" fill="remove"/>
    <animate attributeName="opacity" dur="1.8s" repeatCount="indefinite" calcMode="discrete" values="0; 0; 1; 0; 0" keyTimes="0; 0.50; 0.52; 0.66; 1"/>
  </g>
</g>`;
}

export function buildExplosiveImpacts(targets) {
  let svg = '<g id="explosive-impacts">\n';
  for (const t of targets) {
    svg += `  <g class="explosive-impact">\n`;
    // Primary Expanding Gold Shockwave
    svg += `    <circle cx="${t.cx}" cy="${t.cy}" r="0" fill="none" stroke="#FACC15" stroke-width="2.5" class="shockwave-primary" opacity="0">\n`;
    svg += `      <animate attributeName="r" dur="18s" repeatCount="indefinite" values="0; 0; 3; 28; 0; 0; 3; 28; 0" keyTimes="0; ${t.k_launch_fwd.toFixed(4)}; ${t.k_hit_fwd.toFixed(4)}; ${t.k_settle_fwd.toFixed(4)}; ${(t.k_settle_fwd + 0.001).toFixed(4)}; ${t.k_launch_ret.toFixed(4)}; ${t.k_hit_ret.toFixed(4)}; ${t.k_settle_ret.toFixed(4)}; 1"/>\n`;
    svg += `      <animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0; 0; 1; 0; 0; 0; 1; 0; 0" keyTimes="0; ${t.k_launch_fwd.toFixed(4)}; ${t.k_hit_fwd.toFixed(4)}; ${t.k_settle_fwd.toFixed(4)}; ${(t.k_settle_fwd + 0.001).toFixed(4)}; ${t.k_launch_ret.toFixed(4)}; ${t.k_hit_ret.toFixed(4)}; ${t.k_settle_ret.toFixed(4)}; 1"/>\n`;
    svg += `    </circle>\n`;

    // Secondary Expanding Cyan Shockwave
    svg += `    <circle cx="${t.cx}" cy="${t.cy}" r="0" fill="none" stroke="#38BDF8" stroke-width="2.0" class="shockwave-secondary" opacity="0">\n`;
    svg += `      <animate attributeName="r" dur="18s" repeatCount="indefinite" values="0; 0; 5; 36; 0; 0; 5; 36; 0" keyTimes="0; ${t.k_launch_fwd.toFixed(4)}; ${t.k_hit_fwd.toFixed(4)}; ${t.k_settle_fwd.toFixed(4)}; ${(t.k_settle_fwd + 0.001).toFixed(4)}; ${t.k_launch_ret.toFixed(4)}; ${t.k_hit_ret.toFixed(4)}; ${t.k_settle_ret.toFixed(4)}; 1"/>\n`;
    svg += `      <animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0; 0; 0.9; 0; 0; 0; 0.9; 0; 0" keyTimes="0; ${t.k_launch_fwd.toFixed(4)}; ${t.k_hit_fwd.toFixed(4)}; ${t.k_settle_fwd.toFixed(4)}; ${(t.k_settle_fwd + 0.001).toFixed(4)}; ${t.k_launch_ret.toFixed(4)}; ${t.k_hit_ret.toFixed(4)}; ${t.k_settle_ret.toFixed(4)}; 1"/>\n`;
    svg += `    </circle>\n`;

    // 8-Point Radiating Spark Lines
    svg += `    <g class="spark-star" opacity="0">\n`;
    svg += `      <line x1="${t.cx - 24}" y1="${t.cy}" x2="${t.cx + 24}" y2="${t.cy}" stroke="#FFFFFF" stroke-width="1.8"/>\n`;
    svg += `      <line x1="${t.cx}" y1="${t.cy - 24}" x2="${t.cx}" y2="${t.cy + 24}" stroke="#FFFFFF" stroke-width="1.8"/>\n`;
    svg += `      <line x1="${t.cx - 16}" y1="${t.cy - 16}" x2="${t.cx + 16}" y2="${t.cy + 16}" stroke="#4ADE80" stroke-width="1.4"/>\n`;
    svg += `      <line x1="${t.cx - 16}" y1="${t.cy + 16}" x2="${t.cx + 16}" y2="${t.cy - 16}" stroke="#4ADE80" stroke-width="1.4"/>\n`;
    svg += `      <animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0; 0; 1; 0; 0; 0; 1; 0; 0" keyTimes="0; ${t.k_launch_fwd.toFixed(4)}; ${t.k_hit_fwd.toFixed(4)}; ${t.k_mid_fwd.toFixed(4)}; ${(t.k_mid_fwd + 0.001).toFixed(4)}; ${t.k_launch_ret.toFixed(4)}; ${t.k_hit_ret.toFixed(4)}; ${t.k_mid_ret.toFixed(4)}; 1"/>\n`;
    svg += `    </g>\n`;
    svg += `  </g>\n`;
  }
  svg += '</g>\n';
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

export function buildArcadeStarfighter(targets = []) {
  return `<g id="starfighter">
  <!-- Prominent Dual Plasma Railguns (Tethered to Starfighter for 100% Synchronization) -->
  ${buildProminentRailguns()}

  <!-- Dynamic Target-Tracking Reticle with Sighting Laser Guide -->
  ${buildDynamicReticle(targets)}

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
  const { mock = false, username = USERNAME, cols = 52 } = options;
  if (mock || !weeks || weeks.length === 0) {
    weeks = generateMockWeeks(cols);
  }

  const cells = buildCells(weeks, cols);
  const targets = selectTargets(cells);
  const stats = computeStats(cells);
  const scoreText = computeArcadeScore(stats.total);

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
${buildGrid(cells, targets)}</g>

<!-- Explosive Impact Detonations on Struck Cells -->
${buildExplosiveImpacts(targets)}

<!-- Bottom HUD Legend & Defense Grid Metadata -->
${buildLegend()}
<text x="${WIDTH - 140}" y="${HEIGHT - 12}" class="hud-meta" text-anchor="end">[ARCADE DEFENSE GRID // SECTOR: PRATIK-FORGE]</text>

<!-- Dual-Hull Starfighter Jet & Dynamic Target Tracking Reticle -->
${buildArcadeStarfighter(targets)}
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
