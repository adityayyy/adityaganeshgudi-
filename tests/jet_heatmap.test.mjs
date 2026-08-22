import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  sanitizeText, 
  buildCells, 
  buildSvg, 
  generateMockWeeks,
  computeStats,
  computeArcadeScore,
  buildShieldBar,
  selectTargets,
  buildDynamicReticle,
  buildProminentRailguns,
  buildExplosiveImpacts,
  THEME
} from '../generate.mjs';

describe('TDD: Dynamic Tracking Reticle & Prominent Synchronized Combat', () => {
  describe('Input Sanitization & Data Parsing', () => {
    it('should sanitize XML/HTML special characters and disarm inline event handlers', () => {
      const malicious = '<script>alert("xss")</script>&"\' onload="evil()"';
      const clean = sanitizeText(malicious);
      assert.strictEqual(clean.includes('<script>'), false);
      assert.strictEqual(clean.includes('onload='), false);
      assert.strictEqual(clean.includes('&lt;script&gt;'), true);
    });

    it('should correctly calculate arcade score from contribution count', () => {
      assert.strictEqual(computeArcadeScore(766), '766,000 PTS');
      assert.strictEqual(computeArcadeScore(0), '0 PTS');
      assert.strictEqual(computeArcadeScore(1250), '1,250,000 PTS');
    });

    it('should generate 10 segmented glowing shield health blocks', () => {
      const shieldSvg = buildShieldBar(100);
      assert.ok(shieldSvg.includes('<rect'));
      const blockCount = (shieldSvg.match(/<rect /g) || []).length;
      assert.strictEqual(blockCount, 10);
    });
  });

  describe('Dynamic Tracking Reticle & Sighting Laser Mechanics', () => {
    it('should generate dynamic reticle with vertical Y-tracking animation and sighting laser guide', () => {
      const mockWeeks = generateMockWeeks(52);
      const cells = buildCells(mockWeeks, 52);
      const targets = selectTargets(cells);
      const reticleSvg = buildDynamicReticle(targets);
      assert.ok(reticleSvg.includes('id="targeting-reticle"'));
      assert.ok(reticleSvg.includes('class="sighting-laser"'));
      assert.ok(reticleSvg.includes('attributeName="transform"'));
      assert.ok(reticleSvg.includes('type="translate"'));
    });
  });

  describe('Prominent Twin Plasma Railgun Blasts & Explosive Impact Bursts', () => {
    it('should generate prominent twin plasma bolts with white core and neon glow filter', () => {
      const railgunSvg = buildProminentRailguns();
      assert.ok(railgunSvg.includes('id="prominent-railguns"'));
      assert.ok(railgunSvg.includes('filter="url(#softGlow)"'));
      assert.ok(railgunSvg.includes('class="plasma-beam"'));
    });

    it('should generate 36px expanding explosive shockwave detonations with radiating spark stars', () => {
      const mockWeeks = generateMockWeeks(52);
      const cells = buildCells(mockWeeks, 52);
      const targets = selectTargets(cells);
      const impactSvg = buildExplosiveImpacts(targets);
      assert.ok(impactSvg.includes('class="explosive-impact"'));
      assert.ok(impactSvg.includes('class="shockwave-primary"'));
      assert.ok(impactSvg.includes('class="spark-star"'));
    });
  });

  describe('Arcade HUD Layout & Visual Structure', () => {
    it('should produce 1180x340 Arcade Space Defender canvas matching dark.svg aesthetics', () => {
      const svg = buildSvg([], { mock: true });
      assert.ok(svg.startsWith('<svg'));
      assert.ok(svg.endsWith('</svg>'));
      assert.ok(svg.includes('viewBox="0 0 1180 340"'));
      assert.ok(svg.includes('SCORE:'));
      assert.ok(svg.includes('LVL 42 · AIML ARCHITECT'));
      assert.ok(svg.includes('COMBO:'));
      assert.ok(svg.includes('x14 SHIPPER'));
      assert.ok(svg.includes('SHIELDS: 100%'));
      assert.ok(svg.includes('id="targeting-reticle"'));
    });
  });
});
