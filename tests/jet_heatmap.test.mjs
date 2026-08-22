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
  THEME
} from '../generate.mjs';

describe('TDD: Concept 1 Retro Arcade Space Defender Generator', () => {
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
      assert.strictEqual(computeArcadeScore(null), '766,000 PTS');
    });

    it('should generate 10 segmented glowing shield health blocks', () => {
      const shieldSvg = buildShieldBar(100);
      assert.ok(shieldSvg.includes('<rect'));
      // Verify exactly 10 segment blocks
      const blockCount = (shieldSvg.match(/<rect /g) || []).length;
      assert.strictEqual(blockCount, 10);
    });
  });

  describe('Contribution Grid & Cell Calculations', () => {
    it('should pad weeks to exact 52 columns x 7 rows = 364 power-core cells', () => {
      const mockWeeks = [{
        contributionDays: [
          { contributionCount: 4, color: '#39d353', date: '2026-08-20' },
          { contributionCount: 0, color: '#161b22', date: '2026-08-21' }
        ]
      }];
      const cells = buildCells(mockWeeks, 52);
      assert.strictEqual(cells.length, 52 * 7);
    });

    it('should generate deterministic synthetic mock data when offline', () => {
      const mock = generateMockWeeks(52);
      assert.strictEqual(mock.length, 52);
      mock.forEach(w => assert.strictEqual(w.contributionDays.length, 7));
    });
  });

  describe('Dual-Hull Starfighter & Targeting Reticle Geometry', () => {
    it('should include dual-hull starfighter with twin plasma thrusters in SVG', () => {
      const svg = buildSvg([], { mock: true });
      assert.ok(svg.includes('id="starfighter"'));
      assert.ok(svg.includes('id="twin-thrusters"'));
      assert.ok(svg.includes('id="targeting-reticle"'));
      assert.ok(svg.includes('animateTransform'));
    });

    it('should contain concentric targeting crosshairs with pulsing lock-on animation', () => {
      const svg = buildSvg([], { mock: true });
      assert.ok(svg.includes('class="reticle-ring"'));
      assert.ok(svg.includes('class="reticle-tick"'));
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

    it('should render all 12 month labels and weekday indicators', () => {
      const svg = buildSvg([], { mock: true });
      ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].forEach(m => {
        assert.ok(svg.includes(m), `Expected month ${m} in SVG`);
      });
      ['MON', 'WED', 'FRI'].forEach(d => {
        assert.ok(svg.includes(d), `Expected day ${d} in SVG`);
      });
    });
  });
});
