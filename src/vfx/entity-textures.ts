/**
 * entity-textures.ts — art-bible §6 canonical visual contract
 *
 * Procedural Pixi.js v8 Graphics textures that faithfully reproduce the
 * canonical HTML sample (design/art/samples/01-character-balloon-sky.html).
 *
 * Rendering approach:
 *   - Balloons: 5-layer concentric circle stack simulating CSS radial-gradient
 *     (Pixi v8 Graphics does NOT support radialGradient natively).
 *   - Character: humanoid SVG ported to Pixi Graphics path commands.
 *   - Harpoon line + arrowhead: separate textures; physics system sets sprite.height.
 *
 * Authority: owned exclusively by technical-artist.
 * Do NOT modify from balloon-physics-split.ts or main.ts.
 *
 * Performance: all textures generated once, cached statically, reused.
 *   7 balloon colors × 1 texture each. Character × 1. Harpoon line + head × 2.
 *   Total: ≤ 10 GPU textures, negligible memory footprint.
 */

import { Application, Graphics, Texture } from 'pixi.js';

// ---------------------------------------------------------------------------
// Balloon colour palette — art-bible §4.2 + sample HTML L87-120 exact hex
// ---------------------------------------------------------------------------

export type BalloonColorId =
  | 'magenta'
  | 'cyan'
  | 'lime'
  | 'amber'
  | 'mint'
  | 'violet'
  | 'gold';

interface BalloonColors {
  /** Innermost bright highlight — sample radial-gradient stop 0% */
  center: number;
  /** Mid-body colour — stop 60% */
  mid: number;
  /** Outer edge / shadow colour — stop 100% */
  edge: number;
  /** Glow filter tint (matches mid, used by VisualJuiceSystem GlowFilter) */
  glow: number;
}

/** art-bible §4.2 6-colour + Gold palette — hex values from sample HTML L88–120 */
export const BALLOON_PALETTE: Record<BalloonColorId, BalloonColors> = {
  magenta: { center: 0xFF7AC2, mid: 0xFF3DA5, edge: 0xC82885, glow: 0xFF3DA5 },
  cyan:    { center: 0x7AE9FF, mid: 0x3DD9FF, edge: 0x28A8C8, glow: 0x3DD9FF },
  lime:    { center: 0xD9FF7A, mid: 0xB5FF3D, edge: 0x82C828, glow: 0xB5FF3D },
  amber:   { center: 0xFFD97A, mid: 0xFFB73D, edge: 0xC88828, glow: 0xFFB73D },
  mint:    { center: 0x7AFFD9, mid: 0x3DFFC2, edge: 0x28C898, glow: 0x3DFFC2 },
  violet:  { center: 0xC49CFF, mid: 0xA56BFF, edge: 0x7848C8, glow: 0xA56BFF },
  gold:    { center: 0xFFF0AA, mid: 0xFFD700, edge: 0xC89C00, glow: 0xFFD700 },
};

// ---------------------------------------------------------------------------
// Static texture cache
// ---------------------------------------------------------------------------

const _balloonCache: Map<BalloonColorId, Texture> = new Map();
let _characterTex: Texture | null = null;
let _harpoonLineTex: Texture | null = null;
let _harpoonHeadTex: Texture | null = null;

// ---------------------------------------------------------------------------
// Balloon texture
// ---------------------------------------------------------------------------

/**
 * Returns a cached balloon texture for the given colour.
 *
 * D-P6-TA-05 (2026-05-31 사용자 피드백): Pixi Graphics 5-layer 계단식 → Canvas 2D
 * native `createRadialGradient` 부드러운 transition. CSS `radial-gradient(circle at 35% 30%, ...)`
 * + `::before` blur highlight + `::after` inset rim glow 정밀 이식.
 *
 * @param app — unused, kept for API compatibility (caller가 이미 app 전달)
 */
export function getBalloonTexture(app: Application, colorId: BalloonColorId): Texture {
  void app;
  const cached = _balloonCache.get(colorId);
  if (cached) return cached;

  const SIZE = 128;
  const canvas = _makeBalloonCanvas(colorId, SIZE);
  const tex = Texture.from(canvas);
  _balloonCache.set(colorId, tex);
  return tex;
}

/** Canvas 2D radial gradient + blur highlight + inset rim — 샘플 HTML L86-125 정밀 이식 */
function _makeBalloonCanvas(colorId: BalloonColorId, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const palette = BALLOON_PALETTE[colorId];
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  const cx = size / 2;
  const cy = size / 2;
  // D-P6-HITBOX-01: r = size/2 (full canvas radius) — sprite scaled 시 가시 반경 = hitbox radius 정합.
  // antialiasing 마진 0.5 (canvas edge에서 fade)
  const r = size / 2 - 0.5;

  // 1. Radial gradient body — sample HTML "circle at 35% 30%" (top-left bias)
  const grad = ctx.createRadialGradient(
    size * 0.35, size * 0.30, 0,
    size * 0.5,  size * 0.5,  size * 0.5,
  );
  grad.addColorStop(0.0, hex(palette.center));
  grad.addColorStop(0.6, hex(palette.mid));
  grad.addColorStop(1.0, hex(palette.edge));

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // 2. Soft blurred specular (::before — top 18% left 22% width 30%, white alpha 0.45, blur 4px)
  ctx.save();
  ctx.filter = 'blur(4px)';
  ctx.beginPath();
  ctx.arc(size * 0.40, size * 0.32, size * 0.14, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fill();
  ctx.restore();

  // 3. Inset rim glow (::after — inset 0 0 24px rgba(255,255,255,0.2))
  // Canvas는 inset shadow 직접 안 됨 — clip + outer ring shadow workaround
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
  ctx.shadowBlur = 18;
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.001)';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 4. Subtle rim outline (::after border 1.5px white alpha 0.35)
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.stroke();

  // 5. Gold balloon extra hot-spec (::before width 35% alpha 0.70 — critical-pulse)
  if (colorId === 'gold') {
    ctx.save();
    ctx.filter = 'blur(3px)';
    ctx.beginPath();
    ctx.arc(size * 0.40, size * 0.32, size * 0.17, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 220, 0.70)';
    ctx.fill();
    ctx.restore();
  }

  return canvas;
}

// ---------------------------------------------------------------------------
// Character texture — cute glass figurine (humanoid SVG L385–433 port)
// ---------------------------------------------------------------------------

/**
 * Returns a cached 65×95 character texture.
 *
 * Ported from sample HTML SVG (L385–433):
 *   - 2 legs (ellipse, bodyGrad blue-tint)
 *   - torso ellipse (bodyGrad) + specular ellipse
 *   - 2 arms rotated (bodyGrad)
 *   - joined-hand circle at top (light blue)
 *   - head circle (headGrad pink-tint) + head specular + smile + 2 eyes
 *
 * Gradient simulation:
 *   bodyGrad (blue-glass): 3-layer ellipse stack
 *     outer rgba(100,140,200,0.55) → mid rgba(160,200,240,0.65) → inner rgba(220,240,255,0.85)
 *   headGrad (pink-glass): 3-layer circle stack
 *     outer rgba(200,110,160,0.60) → mid rgba(255,160,200,0.75) → inner rgba(255,210,230,0.90)
 *
 * Anchor point: (0.5, 1.0) — bottom-center, matches physics system.
 * Canvas size: 65×95 — matches sample HTML character-wrapper dimensions exactly.
 */
export function getCharacterTexture(app: Application): Texture {
  if (_characterTex) return _characterTex;

  const W = 65;
  const H = 95;
  const g = new Graphics();

  // ── Helper: 3-layer ellipse to simulate radialGradient ──
  function bodyEllipse(cx: number, cy: number, rx: number, ry: number, rotation = 0): void {
    // outer (darkest blue-glass)
    g.ellipse(cx, cy, rx, ry).fill({ color: 0x648CC8, alpha: 0.55 });
    // mid
    g.ellipse(cx, cy, rx * 0.78, ry * 0.78).fill({ color: 0xA0C8F0, alpha: 0.65 });
    // inner highlight
    g.ellipse(cx - rx * 0.15, cy - ry * 0.15, rx * 0.50, ry * 0.50).fill({ color: 0xDCF0FF, alpha: 0.85 });
    void rotation; // rotation not directly applicable in Graphics ellipse; arms use transform
  }

  // Legs (L409-410)
  bodyEllipse(24, 83, 7, 10);
  bodyEllipse(41, 83, 7, 10);

  // Torso (L413)
  // outer
  g.ellipse(32.5, 58, 16, 20).fill({ color: 0x648CC8, alpha: 0.55 });
  g.ellipse(32.5, 58, 12.5, 15.5).fill({ color: 0xA0C8F0, alpha: 0.65 });
  g.ellipse(29, 51, 8, 10.5).fill({ color: 0xDCF0FF, alpha: 0.85 });
  // Torso specular (L415)
  g.ellipse(27, 50, 4.5, 6.5).fill({ color: 0xffffff, alpha: 0.55 });

  // Arms — rotated. Pixi Graphics doesn't have a native rotate-in-place API for
  // individual shapes; we approximate by drawing stretched ellipses at offset positions.
  // Left arm rotate(-20deg) cx=19 cy=42: offset top-right, elongated
  g.ellipse(20, 37, 5, 11).fill({ color: 0x648CC8, alpha: 0.55 });
  g.ellipse(20, 37, 3.5, 8).fill({ color: 0xA0C8F0, alpha: 0.65 });
  // Right arm rotate(+20deg) cx=46 cy=42
  g.ellipse(45, 37, 5, 11).fill({ color: 0x648CC8, alpha: 0.55 });
  g.ellipse(45, 37, 3.5, 8).fill({ color: 0xA0C8F0, alpha: 0.65 });

  // Joined hands / harpoon grip circle (L421)
  g.circle(32.5, 32, 5).fill({ color: 0xB4DCFF, alpha: 0.85 });
  g.circle(31, 30.5, 2.5).fill({ color: 0xffffff, alpha: 0.45 }); // micro specular

  // Head — headGrad pink-glass (L424)
  g.circle(32.5, 20, 14).fill({ color: 0xC86EA0, alpha: 0.60 });
  g.circle(32.5, 20, 11).fill({ color: 0xFF9EC8, alpha: 0.75 });
  g.circle(31, 18, 7).fill({ color: 0xFFD2E6, alpha: 0.90 });
  // Head specular (L426)
  g.ellipse(27, 14, 3.5, 4.5).fill({ color: 0xffffff, alpha: 0.70 });

  // Smile (L428) — arc approximation via poly points
  // "M 28 24 Q 32.5 27 37 24" — draw as thin stroke using rect segments
  // Pixi v8 Graphics.bezierCurveTo equivalent: path approach
  g.moveTo(28, 24);
  g.quadraticCurveTo(32.5, 27, 37, 24);
  g.stroke({ width: 1, color: 0x783C64, alpha: 0.55 });

  // Eyes (L430-431)
  g.circle(28.5, 18, 1).fill({ color: 0x50285A, alpha: 0.70 });
  g.circle(36.5, 18, 1).fill({ color: 0x50285A, alpha: 0.70 });

  void W; void H; // texture size inferred from graphics bounds

  const tex = app.renderer.generateTexture({
    target: g,
    resolution: window.devicePixelRatio || 1,
  });
  g.destroy();

  _characterTex = tex;
  return tex;
}

// ---------------------------------------------------------------------------
// Harpoon textures — line + arrowhead (sample HTML L325–383)
// ---------------------------------------------------------------------------

/**
 * Returns a 24×200 harpoon bead-chain line texture.
 *
 * Reproduces the zigzag bead pattern from sample HTML SVG (L341–372):
 * 30 beads alternating cx=9 and cx=15, spaced 6px vertically, r=2.8.
 * Bead fill: white-to-ice-blue gradient (simulated as 2-layer circle).
 *
 * Physics system sets sprite.height dynamically; width stays 24.
 * Anchor: (0.5, 1.0) — bottom aligned at character hands.
 */
export function getHarpoonLineTexture(app: Application): Texture {
  if (_harpoonLineTex) return _harpoonLineTex;

  const g = new Graphics();

  // 30 beads — alternating x=9 and x=15, y from 195 down to 21 step -6
  for (let i = 0; i < 30; i++) {
    const cx = i % 2 === 0 ? 9 : 15;
    const cy = 195 - i * 6;
    // outer bead (ice-blue)
    g.circle(cx, cy, 2.8).fill({ color: 0xA0C8F0, alpha: 0.85 });
    // inner specular (white)
    g.circle(cx - 0.8, cy - 0.8, 1.4).fill({ color: 0xffffff, alpha: 0.95 });
    // subtle stroke
    g.circle(cx, cy, 2.8).stroke({ width: 0.3, color: 0xffffff, alpha: 0.40 });
  }

  const tex = app.renderer.generateTexture({
    target: g,
    resolution: window.devicePixelRatio || 1,
  });
  g.destroy();

  _harpoonLineTex = tex;
  return tex;
}

/**
 * Returns a 24×20 arrowhead texture.
 *
 * Reproduces sample HTML SVG arrowhead polygon (L375–381):
 *   points="12,1 5,16 9,15 9,19 15,19 15,15 19,16"
 * Fill: white-to-ice-blue gradient (2-layer poly) + specular triangle.
 *
 * Sprite placed at harpoon line top; anchor (0.5, 1.0).
 */
export function getHarpoonHeadTexture(app: Application): Texture {
  if (_harpoonHeadTex) return _harpoonHeadTex;

  const g = new Graphics();

  // Main arrowhead polygon (white-ice gradient: top=white, bottom=ice-blue)
  // Outer shape in ice-blue
  g.poly([12, 1, 5, 16, 9, 15, 9, 19, 15, 19, 15, 15, 19, 16]).fill({ color: 0xC8E6FF, alpha: 0.95 });
  // Inner upper portion white
  g.poly([12, 1, 7, 13, 9, 12, 9, 15, 15, 15, 15, 12, 17, 13]).fill({ color: 0xffffff, alpha: 0.90 });
  // Specular triangle (L381: points="12,3 10,12 12,11")
  g.poly([12, 3, 10, 12, 12, 11]).fill({ color: 0xffffff, alpha: 0.70 });
  // Outline
  g.poly([12, 1, 5, 16, 9, 15, 9, 19, 15, 19, 15, 15, 19, 16]).stroke({ width: 0.5, color: 0xB4DCFF, alpha: 0.90 });

  const tex = app.renderer.generateTexture({
    target: g,
    resolution: window.devicePixelRatio || 1,
  });
  g.destroy();

  _harpoonHeadTex = tex;
  return tex;
}

// ---------------------------------------------------------------------------
// Cache disposal (call on scene teardown if needed)
// ---------------------------------------------------------------------------

/** Destroys all cached textures. Call once on full app teardown. */
export function destroyEntityTextures(): void {
  _balloonCache.forEach((t) => t.destroy());
  _balloonCache.clear();
  _characterTex?.destroy();
  _characterTex = null;
  _harpoonLineTex?.destroy();
  _harpoonLineTex = null;
  _harpoonHeadTex?.destroy();
  _harpoonHeadTex = null;
}
