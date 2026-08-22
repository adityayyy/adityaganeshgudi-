#!/usr/bin/env node
/**
 * Cyber-Stealth Interceptor: Level Flight Engine
 * 
 * Clean, level flight:
 * - Upright level flight (no tilting/banking).
 * - Smooth horizontal flight translation.
 * - Pulsing afterburner flame and particle wake.
 * - Multi-layered deep space cosmic starfield.
 * - 100% Real-time GitHub GraphQL contributions.
 */

import fs from "node:fs";
import path from "node:path";

const USERNAME = process.env.GH_USERNAME;
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const OUTPUT = process.env.OUTPUT_PATH || "dist/github-jet.svg";
const COLS = 34;
const ROWS = 7;
const CELL = 11;
const STEP = 14;
const GRID_X = 20;
const GRID_Y = 15;
const WIDTH = 513;
const HEIGHT = 170;

const COL_CENTER = (col) => GRID_X + col * STEP + CELL / 2;
const JET_X_START = COL_CENTER(0);        // 25.5
const JET_X_END   = COL_CENTER(COLS - 1); // 487.5
const JET_Y = 142;
const LOOP_DUR = 20; // seconds per full cycle

if (!USERNAME) { console.error("Missing GH_USERNAME"); process.exit(1); }
if (!TOKEN)    { console.error("Missing GH_TOKEN");    process.exit(1); }

const QUERY = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount color}}}}}}`;

async function fetchWeeks() {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { login: USERNAME } }),
  });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user.contributionsCollection.contributionCalendar.weeks;
}

function buildCells(weeks) {
  const recent = weeks.slice(-COLS);
  const pad = COLS - recent.length;
  const padded = Array.from({ length: pad }, () => ({
    contributionDays: Array.from({ length: ROWS }, () => ({ contributionCount: 0, color: "#161b22", date: null })),
  })).concat(recent);
  const cells = [];
  padded.forEach((week, col) => {
    week.contributionDays.forEach((day, row) => {
      cells.push({
        col,
        row,
        x: GRID_X + col * STEP,
        y: GRID_Y + row * STEP,
        color: day.color || "#161b22",
        count: day.contributionCount || 0
      });
    });
  });
  return cells;
}

function buildGrid(cells) {
  let svg = "";
  for (const c of cells) {
    svg += `<rect x="${c.x}" y="${c.y}" width="${CELL}" height="${CELL}" rx="2" ry="2" fill="${c.color}"/>\n`;
  }
  return svg;
}

function buildStars() {
  const stars = [
    [8, 22, 1.1, 1.4], [12, 65, 0.9, 2.2], [6, 105, 1.2, 1.8], [15, 150, 0.8, 3.0],
    [120, 155, 1.0, 2.5], [180, 8, 0.8, 1.9], [250, 162, 1.2, 2.8], [340, 10, 0.9, 2.1],
    [410, 158, 1.0, 1.7], [490, 15, 0.8, 2.6], [504, 55, 1.2, 1.5], [498, 95, 0.9, 2.3],
    [506, 140, 1.1, 1.9], [45, 125, 0.7, 3.5], [470, 128, 0.8, 3.2]
  ];
  return stars.map(([x, y, r, dur]) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#94A3B8"><animate attributeName="opacity" values="0.15;0.9;0.15" dur="${dur}s" repeatCount="indefinite"/></circle>`
  ).join("\n");
}

function buildJet() {
  return `<g id="jet-interceptor">
  <!-- Smooth Linear Flight Translation -->
  <animateTransform attributeName="transform" attributeType="XML" type="translate"
    dur="${LOOP_DUR}s" repeatCount="indefinite" calcMode="linear"
    keyTimes="0;0.5;1"
    values="${JET_X_START},${JET_Y};${JET_X_END},${JET_Y};${JET_X_START},${JET_Y}"/>

  <!-- Level Jet Chassis (No Tilt) -->
  <g id="jet-chassis">
    <!-- Plasma Exhaust Wake -->
    <circle cx="0" cy="14" r="3" fill="#38BDF8" opacity="0.35">
      <animate attributeName="r" values="3;5.5;2" dur="0.22s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.4;0.1;0.4" dur="0.22s" repeatCount="indefinite"/>
    </circle>
    <polygon points="-2.5,7 2.5,7 0,16" fill="#38BDF8">
      <animate attributeName="points" values="-2.5,7 2.5,7 0,16; -2,7 2,7 0,19; -2.5,7 2.5,7 0,14; -2.5,7 2.5,7 0,16" dur="0.16s" repeatCount="indefinite"/>
      <animate attributeName="fill" values="#38BDF8;#67E8F9;#F97316;#38BDF8" dur="0.32s" repeatCount="indefinite"/>
    </polygon>

    <!-- Main Fuselage -->
    <polygon points="0,-16 7,5 3,3 -3,3 -7,5" fill="#38BDF8" stroke="#0284C7" stroke-width="0.9"/>
    <!-- Delta Wings -->
    <polygon points="-7,5 -14,11 -3,6" fill="#0EA5E9"/>
    <polygon points="7,5 14,11 3,6" fill="#0EA5E9"/>
    <!-- Cockpit Canopy -->
    <polygon points="0,-11 2,-3 -2,-3" fill="#F0FDF4" opacity="0.95"/>
    <circle cx="0" cy="-6" r="1.8" fill="#BAE6FD"/>
  </g>
</g>`;
}

function buildSvg(weeks) {
  const cells = buildCells(weeks);

  return `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="#0B1120"/>
<g id="stars">
${buildStars()}</g>
<g id="grid">
${buildGrid(cells)}</g>
${buildJet()}
</svg>`;
}

async function main() {
  console.log(`Fetching contributions for ${USERNAME}...`);
  const weeks = await fetchWeeks();
  const svg = buildSvg(weeks);
  const out = path.resolve(OUTPUT);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, svg, "utf8");
  console.log(`Wrote ${out}`);
}

main().catch(e => { console.error(e); process.exit(1); });
