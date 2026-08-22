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
  buildLaserProjectiles,
  buildImpactBursts,
  THEME
} from '../generate.mjs';

describe('TDD: Live Target-Hit Combat & Interactive Cell Ionization', () => {
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

  describe('Target Selection & Live Shooting Mechanics', () => {
    it('should select active contribution cells as shooting targets along the timeline', () => {
      const mockWeeks = generateMockWeeks(52);
      const cells = buildCells(mockWeeks, 52);
      const targets = selectTargets(cells);
      assert.ok(Array.isArray(targets));
      assert.ok(targets.length > 0, 'Should select active target cells');
      targets.forEach(t => {
        assert.ok(t.x >= 140);
        assert.ok(t.y >= 88);
        assert.ok(t.col >= 0 && t.col < 52);
        assert.ok(t.count > 0, 'Target cell should have positive contributions');
      });
    });

    it('should generate laser projectiles flying from y=250 to target cell y with discrete clamping', () => {
      const mockWeeks = generateMockWeeks(52);
      const cells = buildCells(mockWeeks, 52);
      const targets = selectTargets(cells);
      const laserSvg = buildLaserProjectiles(targets);
      assert.ok(laserSvg.includes('class="laser-bolt"'));
      assert.ok(laserSvg.includes('calcMode="discrete"'));
      assert.ok(laserSvg.includes('animateTransform'));
    });

    it('should generate synchronized impact shockwaves at exact target cell centers', () => {
      const mockWeeks = generateMockWeeks(52);
      const cells = buildCells(mockWeeks, 52);
      const targets = selectTargets(cells);
      const burstsSvg = buildImpactBursts(targets);
      assert.ok(burstsSvg.includes('class="impact-burst"'));
      assert.ok(burstsSvg.includes('calcMode="discrete"') || burstsSvg.includes('keyTimes'));
    });

    it('should inject animated fill flash (<animate attributeName="fill">) directly into hit cells', () => {
      const mockWeeks = generateMockWeeks(52);
      const svg = buildSvg(mockWeeks, { mock: false });
      assert.ok(svg.includes('attributeName="fill"'));
      assert.ok(svg.includes('#FFFFFF'));
      assert.ok(svg.includes('#86EFAC'));
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
    });
  });
});
