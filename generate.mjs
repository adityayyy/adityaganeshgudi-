#!/usr/bin/env node
/**
 * Generates an animated "jet over contribution grid" SVG using a GitHub
 * user's REAL contribution calendar (last 34 weeks, same layout as
 * GitHub's own heatmap: 34 columns x 7 rows).
 *
 * Mathematically locked jet-bullet synchronization:
 * Bullets spawn directly at the tip of the jet when the jet passes under each target column.
 */

import fs from "node:fs";
import path from "node:path";

const USERNAME = process.env.GH_USERNAME;
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const OUTPUT = process.env.OUTPUT_PATH || "dist/github-jet.svg";
const COLS = 34;
const ROWS = 7;
const CELL = 11;
const STEP = 14; // cell + gap
const GRID_X = 20;
const GRID_Y = 15;
const WIDTH = 513;
const HEIGHT = 170;

const JET_X_START = GRID_X + CELL / 2; // 25.5
const JET_X_END = GRID_X + (COLS - 1) * STEP + CELL / 2; // 487.5
const JET_Y = 140;
const JET_NOSE_Y = 124; // top tip of jet (polygon points="0,-16") -> 140 - 16 = 124
const LOOP_DUR = 20; // seconds, one full there-and-back pass
const MAX_TARGETS = 12; // how many "busiest" days the jet fires on
const FLASH_COLOR = "#39d353";
const BULLET_COLOR = "#7ee787";
const BLAST_COLOR = "#56d364";

if (!USERNAME) {
  console.error("Missing GH_USERNAME env var");
  process.exit(1);
}
if (!TOKEN) {
  console.error("Missing GH_TOKEN / GITHUB_TOKEN env var");
  process.exit(1);
}

const QUERY = `
  query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
              color
            }
          }
        }
      }
    }
  }
`;

async function fetchWeeks() {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: QUERY, variables: { login: USERNAME } }),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user.contributionsCollection.contributionCalendar.weeks;
}

function buildCells(weeks) {
  const recent = weeks.slice(-COLS);
  const padCount = COLS - recent.length;
  const padded = Array.from({ length: padCount }, () => ({
    contributionDays: Array.from({ length: ROWS }, () => ({
      contributionCount: 0,
      color: "#161b22",
      date: null,
    })),
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
        count: day.contributionCount || 0,
        date: day.date,
      });
    });
  });
  return cells;
}

function pickTargets(cells) {
  return [...cells]
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_TARGETS)
    .sort((a, b) => a.col - b.col || a.row - b.row);
}

// Exactly when the jet's nose reaches the center of this column
function timeWhenJetAtCol(col, direction) {
  const fraction = col / (COLS - 1);
  return direction === "forward" ? 0.5 * fraction : 1.0 - 0.5 * fraction;
}

function fmt(n) {
  return Number(n.toFixed(4));
}

function buildGrid(cells, targets) {
  const targetKey = new Set(targets.map((t) => `${t.col}-${t.row}`));
  let svg = "";
  const travelDur = 0.010;
  const flashDur = 0.012;

  for (const c of cells) {
    const isTarget = targetKey.has(`${c.col}-${c.row}`);
    if (!isTarget) {
      svg += `<rect x="${c.x.toFixed(2)}" y="${c.y.toFixed(2)}" width="${CELL}" height="${CELL}" rx="2" ry="2" fill="${c.color}"/>\n`;
      continue;
    }
    // Arrive times: when bullet hits the cell on forward and backward pass
    const tFwd = timeWhenJetAtCol(c.col, "forward") + travelDur;
    const tBack = timeWhenJetAtCol(c.col, "backward") + travelDur;
    const [t1, t2] = [Math.min(tFwd, tBack), Math.max(tFwd, tBack)];
    
    svg += `<rect x="${c.x.toFixed(2)}" y="${c.y.toFixed(2)}" width="${CELL}" height="${CELL}" rx="2" ry="2" fill="${c.color}">` +
      `<animate attributeName="fill" dur="${LOOP_DUR}s" repeatCount="indefinite" ` +
      `keyTimes="0;${fmt(t1)};${fmt(t1 + flashDur)};${fmt(t2)};${fmt(t2 + flashDur)};1" ` +
      `values="${c.color};${c.color};${FLASH_COLOR};${c.color};${FLASH_COLOR};${c.color}"/>` +
      `</rect>\n`;
  }
  return svg;
}

function buildBulletsAndBlasts(targets) {
  let bullets = "";
  let blasts = "";
  const travelDur = 0.010; // time in fraction of LOOP_DUR to fly upward
  const blastDur = 0.014;

  for (const dir of ["forward", "backward"]) {
    const ordered = dir === "forward" ? targets : [...targets].reverse();
    for (const c of ordered) {
      const tLaunch = timeWhenJetAtCol(c.col, dir);
      const tArrive = tLaunch + travelDur;
      const tFade = tArrive + 0.002;
      
      const cx = fmt(c.x + CELL / 2);
      const targetY = fmt(c.y + CELL / 2);

      // Bullet starts exactly at JET_NOSE_Y at tLaunch when jet is directly at cx
      bullets += `<circle cx="${cx}" cy="${JET_NOSE_Y}" r="2.4" fill="${BULLET_COLOR}">` +
        `<animate attributeName="cy" dur="${LOOP_DUR}s" repeatCount="indefinite" ` +
        `keyTimes="0;${fmt(tLaunch)};${fmt(tArrive)};1" values="${JET_NOSE_Y};${JET_NOSE_Y};${targetY};${targetY}"/>` +
        `<animate attributeName="opacity" dur="${LOOP_DUR}s" repeatCount="indefinite" ` +
        `keyTimes="0;${fmt(tLaunch)};${fmt(tArrive)};${fmt(tFade)};1" values="0;1;1;0;0"/>` +
        `</circle>\n`;

      // Blast wave expands at target point immediately upon arrival
      blasts += `<circle cx="${cx}" cy="${targetY}" r="0" fill="none" stroke="${BLAST_COLOR}" stroke-width="1.6" opacity="0">` +
        `<animate attributeName="r" dur="${LOOP_DUR}s" repeatCount="indefinite" ` +
        `keyTimes="0;${fmt(tArrive)};${fmt(tArrive + blastDur)};1" values="0;1;9;9"/>` +
        `<animate attributeName="opacity" dur="${LOOP_DUR}s" repeatCount="indefinite" ` +
        `keyTimes="0;${fmt(tArrive)};${fmt(tArrive + blastDur)};1" values="0;1;1;0"/>` +
        `</circle>\n`;
    }
  }
  return { bullets, blasts };
}

function buildStars() {
  const pts = [
    [8, 20, 1.2], [8, 60, 1.6], [8, 100, 2.0],
    [505, 25, 1.2], [505, 70, 1.6], [505, 110, 2.0],
    [30, 164, 1.2], [483, 164, 1.6],
  ];
  return pts.map(([x, y, dur]) =>
    `<circle cx="${x}" cy="${y}" r="1.1" fill="#8b949e"><animate attributeName="opacity" values="0.2;1;0.2" dur="${dur}s" repeatCount="indefinite"/></circle>`
  ).join("\n");
}

function buildJet() {
  return `<g id="jet">
  <g transform="translate(0,0)">
    <polygon points="0,-16 8,6 4,3 -4,3 -8,6" fill="#58a6ff" stroke="#1f6feb" stroke-width="1"/>
    <polygon points="-8,6 -14,12 -4,7" fill="#388bfd"/>
    <polygon points="8,6 14,12 4,7" fill="#388bfd"/>
    <circle cx="0" cy="-6" r="2.2" fill="#c9e6ff"/>
    <polygon points="-3,7 3,7 0,15" fill="#f0883e">
      <animate attributeName="opacity" values="0.5;1;0.6;1" dur="0.18s" repeatCount="indefinite"/>
    </polygon>
  </g>
  <animateTransform attributeName="transform" attributeType="XML" type="translate"
    dur="${LOOP_DUR}s" repeatCount="indefinite"
    keyTimes="0;0.5;1"
    values="${fmt(JET_X_START)},${JET_Y}.00;${fmt(JET_X_END)},${JET_Y}.00;${fmt(JET_X_START)},${JET_Y}.00"/>
</g>`;
}

function buildSvg(weeks) {
  const cells = buildCells(weeks);
  const targets = pickTargets(cells);
  const { bullets, blasts } = buildBulletsAndBlasts(targets);

  return `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="#0d1117"/>
${buildStars()}
<g id="grid">
${buildGrid(cells, targets)}</g>
<g id="bullets">
${bullets}</g>
<g id="blasts">
${blasts}</g>
${buildJet()}
</svg>`;
}

async function main() {
  console.log(`Fetching contributions for ${USERNAME}...`);
  const weeks = await fetchWeeks();
  const svg = buildSvg(weeks);
  const outPath = path.resolve(OUTPUT);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, svg, "utf8");
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
