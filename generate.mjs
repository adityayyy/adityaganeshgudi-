#!/usr/bin/env node
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

// Jet travel endpoints: exactly aligned with first and last column centers
const COL_CENTER = (col) => GRID_X + col * STEP + CELL / 2;
const JET_X_START = COL_CENTER(0);   // 25.5
const JET_X_END   = COL_CENTER(COLS - 1); // 487.5
const JET_Y = 140;
const JET_NOSE_Y = JET_Y - 16; // 124
const LOOP_DUR = 20;
const MAX_TARGETS = 12;
const FLASH_COLOR = "#39d353";
const BULLET_COLOR = "#7ee787";
const BLAST_COLOR  = "#56d364";

if (!USERNAME) { console.error("Missing GH_USERNAME"); process.exit(1); }
if (!TOKEN)    { console.error("Missing GH_TOKEN");    process.exit(1); }

const QUERY = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount color}}}}}}`;

async function fetchWeeks() {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { login: USERNAME } }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
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
      cells.push({ col, row, x: GRID_X + col * STEP, y: GRID_Y + row * STEP,
        color: day.color || "#161b22", count: day.contributionCount || 0 });
    });
  });
  return cells;
}

function pickTargets(cells) {
  return [...cells].filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count).slice(0, MAX_TARGETS)
    .sort((a, b) => a.col - b.col || a.row - b.row);
}

// When the jet center is directly above column col
// Forward: linear from t=0 (col 0) to t=0.5 (col 33)
// Backward: linear from t=0.5 (col 33) to t=1.0 (col 0)
function jetTimeAtCol(col, dir) {
  const frac = col / (COLS - 1);
  return dir === "forward" ? 0.5 * frac : 0.5 + 0.5 * (1 - frac);
}

const F = n => Number(n.toFixed(5));

function buildGrid(cells, targets) {
  const tgtSet = new Set(targets.map(t => `${t.col}-${t.row}`));
  let svg = "";
  // Bullet flight: 0.002 of loop = 0.04s real time (near-instant)
  const BULLET_FLIGHT = 0.002;
  const FLASH_DUR = 0.008;
  for (const c of cells) {
    if (!tgtSet.has(`${c.col}-${c.row}`)) {
      svg += `<rect x="${c.x}" y="${c.y}" width="${CELL}" height="${CELL}" rx="2" ry="2" fill="${c.color}"/>\n`;
      continue;
    }
    // Flash when bullet arrives (jet time + flight time)
    const tFwd  = jetTimeAtCol(c.col, "forward") + BULLET_FLIGHT;
    const tBack = jetTimeAtCol(c.col, "backward") + BULLET_FLIGHT;
    const [t1, t2] = [Math.min(tFwd, tBack), Math.max(tFwd, tBack)];
    svg += `<rect x="${c.x}" y="${c.y}" width="${CELL}" height="${CELL}" rx="2" ry="2" fill="${c.color}">` +
      `<animate attributeName="fill" dur="${LOOP_DUR}s" repeatCount="indefinite" calcMode="discrete" ` +
      `keyTimes="0;${F(t1)};${F(t1+FLASH_DUR)};${F(t2)};${F(t2+FLASH_DUR)};1" ` +
      `values="${c.color};${FLASH_COLOR};${c.color};${FLASH_COLOR};${c.color};${c.color}"/>` +
      `</rect>\n`;
  }
  return svg;
}

function buildBulletsAndBlasts(targets) {
  let bullets = "", blasts = "";
  // Near-instant flight: 0.002 of 20s = 40ms real time
  // During 40ms the jet moves only ~1.8px — imperceptible offset
  const FLIGHT = 0.002;
  const BLAST_DUR = 0.010;

  for (const dir of ["forward", "backward"]) {
    for (const c of (dir === "forward" ? targets : [...targets].reverse())) {
      const tFire   = jetTimeAtCol(c.col, dir);      // jet directly above
      const tHit    = tFire + FLIGHT;                 // bullet arrives
      const tGone   = tHit + 0.001;                   // bullet disappears
      const cx = F(c.x + CELL / 2);
      const ty = F(c.y + CELL / 2);

      // Bullet: discrete opacity so it snaps on/off with zero interpolation
      bullets += `<circle cx="${cx}" cy="${JET_NOSE_Y}" r="2.4" fill="${BULLET_COLOR}" opacity="0">` +
        `<animate attributeName="cy" dur="${LOOP_DUR}s" repeatCount="indefinite" calcMode="discrete" ` +
        `keyTimes="0;${F(tFire)};${F(tHit)};1" values="${JET_NOSE_Y};${JET_NOSE_Y};${ty};${ty}"/>` +
        `<animate attributeName="opacity" dur="${LOOP_DUR}s" repeatCount="indefinite" calcMode="discrete" ` +
        `keyTimes="0;${F(tFire)};${F(tGone)};1" values="0;1;0;0"/>` +
        `</circle>\n`;

      // Blast ring
      blasts += `<circle cx="${cx}" cy="${ty}" r="0" fill="none" stroke="${BLAST_COLOR}" stroke-width="1.6" opacity="0">` +
        `<animate attributeName="r" dur="${LOOP_DUR}s" repeatCount="indefinite" ` +
        `keyTimes="0;${F(tHit)};${F(tHit+BLAST_DUR)};1" values="0;1;9;9"/>` +
        `<animate attributeName="opacity" dur="${LOOP_DUR}s" repeatCount="indefinite" calcMode="discrete" ` +
        `keyTimes="0;${F(tHit)};${F(tHit+BLAST_DUR)};1" values="0;1;0;0"/>` +
        `</circle>\n`;
    }
  }
  return { bullets, blasts };
}

function buildStars() {
  return [[8,20,1.2],[8,60,1.6],[8,100,2.0],[505,25,1.2],[505,70,1.6],[505,110,2.0],[30,164,1.2],[483,164,1.6]]
    .map(([x,y,d]) => `<circle cx="${x}" cy="${y}" r="1.1" fill="#8b949e"><animate attributeName="opacity" values="0.2;1;0.2" dur="${d}s" repeatCount="indefinite"/></circle>`)
    .join("\n");
}

function buildJet() {
  return `<g id="jet">
  <g>
    <polygon points="0,-16 8,6 4,3 -4,3 -8,6" fill="#58a6ff" stroke="#1f6feb" stroke-width="1"/>
    <polygon points="-8,6 -14,12 -4,7" fill="#388bfd"/>
    <polygon points="8,6 14,12 4,7" fill="#388bfd"/>
    <circle cx="0" cy="-6" r="2.2" fill="#c9e6ff"/>
    <polygon points="-3,7 3,7 0,15" fill="#f0883e">
      <animate attributeName="opacity" values="0.5;1;0.6;1" dur="0.18s" repeatCount="indefinite"/>
    </polygon>
  </g>
  <animateTransform attributeName="transform" attributeType="XML" type="translate"
    dur="${LOOP_DUR}s" repeatCount="indefinite" calcMode="linear"
    keyTimes="0;0.5;1"
    values="${JET_X_START},${JET_Y};${JET_X_END},${JET_Y};${JET_X_START},${JET_Y}"/>
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
  const out = path.resolve(OUTPUT);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, svg, "utf8");
  console.log(`Wrote ${out}`);
}

main().catch(e => { console.error(e); process.exit(1); });
