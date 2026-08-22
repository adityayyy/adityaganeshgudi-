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
  buildPhotonTorpedoes,
  THEME
} from '../generate.mjs';

describe('TDD: Retro Arcade Space Defender with Homing Photon Torpedoes', () => {
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
  });

  describe('Option 3: Lock-On Homing Photon Torpedoes Weapon System', () => {
    it('should generate photon torpedoes with curved launch arcs and zero-ghosting discrete clamping', () => {
      const torpedoSvg = buildPhotonTorpedoes();
      assert.ok(torpedoSvg.includes('id="photon-torpedoes"'));
      assert.ok(torpedoSvg.includes('calcMode="discrete"'));
      assert.ok(torpedoSvg.includes('class="torpedo-payload"'));
    });

    it('should include synchronized impact shockwaves with expanding rings and spark rays', () => {
      const torpedoSvg = buildPhotonTorpedoes();
      assert.ok(torpedoSvg.includes('class="impact-shockwave"'));
      assert.ok(torpedoSvg.includes('class="shockwave-ring"'));
    });

    it('should mount photon torpedoes into root SVG starfighter group', () => {
      const svg = buildSvg([], { mock: true });
      assert.ok(svg.includes('id="photon-torpedoes"'));
      assert.ok(svg.includes('id="targeting-reticle"'));
      assert.ok(svg.includes('id="starfighter"'));
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
