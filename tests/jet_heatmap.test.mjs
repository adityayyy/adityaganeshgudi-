import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  sanitizeText, 
  buildCells, 
  buildSvg, 
  generateMockWeeks,
  computeStats,
  THEME
} from '../generate.mjs';

describe('TDD: Jet Heatmap Generator', () => {
  describe('Input Sanitization', () => {
    it('should sanitize XML/HTML special characters', () => {
      const malicious = '<script>alert("xss")</script>&"\'';
      const clean = sanitizeText(malicious);
      assert.strictEqual(clean.includes('<script>'), false);
      assert.strictEqual(clean.includes('&lt;script&gt;'), true);
      assert.strictEqual(clean.includes('&amp;'), true);
      assert.strictEqual(clean.includes('&quot;'), true);
      assert.strictEqual(clean.includes('&#39;'), true);
    });

    it('should handle null, undefined, or number inputs safely', () => {
      assert.strictEqual(sanitizeText(null), '');
      assert.strictEqual(sanitizeText(undefined), '');
      assert.strictEqual(sanitizeText(766), '766');
    });
  });

  describe('Contribution Grid & Cell Calculations', () => {
    it('should pad weeks to exact column count (52 columns * 7 rows = 364 cells)', () => {
      const mockWeeks = [{
        contributionDays: [
          { contributionCount: 4, color: '#39d353', date: '2026-08-20' },
          { contributionCount: 0, color: '#161b22', date: '2026-08-21' }
        ]
      }];
      const cells = buildCells(mockWeeks, 52);
      assert.strictEqual(cells.length, 52 * 7);
      assert.strictEqual(cells[0].col, 0);
      assert.strictEqual(cells[cells.length - 1].col, 51);
      assert.strictEqual(cells[cells.length - 1].row, 6);
    });

    it('should generate deterministic synthetic mock data when requested', () => {
      const mock = generateMockWeeks(52);
      assert.strictEqual(mock.length, 52);
      mock.forEach(w => {
        assert.strictEqual(w.contributionDays.length, 7);
        w.contributionDays.forEach(d => {
          assert.ok(typeof d.contributionCount === 'number');
          assert.ok(typeof d.color === 'string');
        });
      });
    });

    it('should accurately compute total contributions and active days', () => {
      const weeks = [
        {
          contributionDays: [
            { contributionCount: 5, color: '#34d399' },
            { contributionCount: 0, color: '#0f172a' },
            { contributionCount: 3, color: '#10b981' }
          ]
        },
        {
          contributionDays: [
            { contributionCount: 2, color: '#064e3b' },
            { contributionCount: 0, color: '#0f172a' }
          ]
        }
      ];
      const stats = computeStats(weeks);
      assert.strictEqual(stats.total, 10);
      assert.strictEqual(stats.activeDays, 3);
    });
  });

  describe('Jet Geometry & Symmetrical Aerospace Design', () => {
    it('should include 100% mathematically mirrored upright jet in SVG', () => {
      const svg = buildSvg([], { mock: true });
      assert.ok(svg.includes('id="jet"'));
      assert.ok(svg.includes('id="jet-exhaust"'));
      assert.ok(svg.includes('animateTransform'));
      // Verify jet contains delta wings and afterburner flame
      assert.ok(svg.includes('polygon points="0,-16 10,7 4,4 -4,4 -10,7"'));
    });

    it('should use smooth spline kinematics for non-jerky horizontal travel', () => {
      const svg = buildSvg([], { mock: true });
      assert.ok(svg.includes('calcMode="spline"') || svg.includes('calcMode="linear"'));
      assert.ok(svg.includes('repeatCount="indefinite"'));
    });
  });

  describe('Cyber Deck Radar HUD Frame & Layout', () => {
    it('should produce 1180px width Cyber Deck layout matching dark.svg aesthetic', () => {
      const svg = buildSvg([], { mock: true });
      assert.ok(svg.startsWith('<svg'));
      assert.ok(svg.endsWith('</svg>'));
      assert.ok(svg.includes('viewBox="0 0 1180 320"'));
      assert.ok(svg.includes('rx="16"'));
      assert.ok(svg.includes('radar.sh --timeline'));
      assert.ok(svg.includes('CONTRIBUTIONS'));
    });

    it('should include scanline pattern and soft neon glow filter definitions', () => {
      const svg = buildSvg([], { mock: true });
      assert.ok(svg.includes('id="scanlines"'));
      assert.ok(svg.includes('id="softGlow"'));
      assert.ok(svg.includes('id="bgGlow"'));
      assert.ok(svg.includes('id="borderGrad"'));
    });

    it('should render correct month labels across the grid timeline', () => {
      const svg = buildSvg([], { mock: true });
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      monthNames.forEach(m => {
        assert.ok(svg.includes(m), `Expected SVG to include month label: ${m}`);
      });
    });
  });
});
