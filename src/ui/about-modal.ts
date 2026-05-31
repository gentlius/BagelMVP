/**
 * AboutModal — POP! credits + pause/resume
 *
 * D-P6-BGM-02 (사용자 2026-05-31): About 버튼 (우하단 ⓘ) → 게임 pause + 크레딧 모달.
 *
 * Layout:
 *   - Info button (32×32) at bottom-right corner of uiContainer (L4)
 *   - Fullscreen modal: dim background + centered content panel
 *   - Tap dim area or X button → close + resume
 *
 * Credits content (CC0 BGM 사용자 확인 — D-P6-BGM-01):
 *   - BGM: Seth_Makes_Sounds (CC0, freesound.org/s/684184/)
 *   - SFX: procedural Web Audio synth (Project-internal)
 *   - Art: procedural Pixi Graphics (Project-internal)
 *   - Engine: Pixi.js v8 (MIT)
 *   - Build: Vite (MIT)
 *
 * Authority: ui-programmer 영역 (src/ui/**).
 */

import { Application, Container, Graphics, Text } from 'pixi.js';

export interface AboutModalDeps {
  uiContainer: Container;
  app: Application;
  pause: () => void;
  resume: () => void;
}

const VERSION = '0.1.0-proto.1';

const CREDITS_LINES = [
  { text: 'POP! Prototype', size: 28, color: 0xFFFFFF, bold: true, gap: 8 },
  { text: `v${VERSION}`, size: 14, color: 0xCCCCCC, bold: false, gap: 24 },
  { text: '— Credits —', size: 16, color: 0xFFD700, bold: true, gap: 16 },
  { text: 'BGM: "Some Game Background Music Or Something"', size: 13, color: 0xFFFFFF, bold: false, gap: 4 },
  { text: '  by Seth_Makes_Sounds (CC0)', size: 12, color: 0xAAAAAA, bold: false, gap: 4 },
  { text: '  freesound.org/s/684184/', size: 12, color: 0x88CCFF, bold: false, gap: 16 },
  { text: 'SFX: Procedural Web Audio synthesis', size: 13, color: 0xFFFFFF, bold: false, gap: 4 },
  { text: '  (Project-internal)', size: 12, color: 0xAAAAAA, bold: false, gap: 16 },
  { text: 'Art: Procedural Pixi Graphics', size: 13, color: 0xFFFFFF, bold: false, gap: 4 },
  { text: '  (Project-internal)', size: 12, color: 0xAAAAAA, bold: false, gap: 16 },
  { text: 'Engine: Pixi.js v8 (MIT)', size: 12, color: 0xAAAAAA, bold: false, gap: 4 },
  { text: 'Build: Vite (MIT)', size: 12, color: 0xAAAAAA, bold: false, gap: 28 },
  { text: '— TAP TO CLOSE —', size: 14, color: 0x00E5FF, bold: true, gap: 0 },
] as const;

export class AboutModal {
  private readonly _app: Application;
  private readonly _uiContainer: Container;
  private readonly _pause: () => void;
  private readonly _resume: () => void;

  private _infoButton!: Container;
  private _modal!: Container;
  private _isOpen = false;

  constructor(deps: AboutModalDeps) {
    this._app = deps.app;
    this._uiContainer = deps.uiContainer;
    this._pause = deps.pause;
    this._resume = deps.resume;
    this._buildInfoButton();
    this._buildModal();
  }

  private _buildInfoButton(): void {
    const btn = new Container();
    const size = 36;
    const w = this._app.screen.width;
    const h = this._app.screen.height;

    // Circle background with white outline
    const g = new Graphics();
    g.circle(size / 2, size / 2, size / 2).fill({ color: 0x000000, alpha: 0.55 });
    g.circle(size / 2, size / 2, size / 2 - 1).stroke({ width: 1.5, color: 0xFFFFFF, alpha: 0.85 });
    btn.addChild(g);

    // "i" letter
    const letter = new Text({
      text: 'i',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 22,
        fontWeight: 'bold',
        fill: 0xFFFFFF,
      },
    });
    letter.anchor.set(0.5, 0.5);
    letter.x = size / 2;
    letter.y = size / 2;
    btn.addChild(letter);

    btn.x = w - size - 16;
    btn.y = h - size - 16;
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointertap', () => this._open());
    btn.zIndex = 50;

    this._uiContainer.addChild(btn);
    this._infoButton = btn;
  }

  private _buildModal(): void {
    const modal = new Container();
    const w = this._app.screen.width;
    const h = this._app.screen.height;

    // Dim background (fullscreen, tap to close)
    const dim = new Graphics();
    dim.rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.78 });
    dim.eventMode = 'static';
    dim.cursor = 'pointer';
    dim.on('pointertap', () => this._close());
    modal.addChild(dim);

    // Content panel (centered)
    const panelW = Math.min(w - 40, 360);
    const panelH = Math.min(h - 80, 520);
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;

    const panelBg = new Graphics();
    panelBg
      .roundRect(panelX, panelY, panelW, panelH, 16)
      .fill({ color: 0x10182A, alpha: 0.95 })
      .stroke({ width: 1.5, color: 0xFFFFFF, alpha: 0.25 });
    // Stop tap propagation by attaching a no-op listener on the panel container
    panelBg.eventMode = 'static';
    panelBg.on('pointertap', (e) => e.stopPropagation());
    modal.addChild(panelBg);

    // Credits text lines
    let cursorY = panelY + 32;
    for (const line of CREDITS_LINES) {
      const t = new Text({
        text: line.text,
        style: {
          fontFamily: 'system-ui, sans-serif',
          fontSize: line.size,
          fontWeight: line.bold ? 'bold' : 'normal',
          fill: line.color,
          align: 'center',
          wordWrap: true,
          wordWrapWidth: panelW - 32,
        },
      });
      t.anchor.set(0.5, 0);
      t.x = panelX + panelW / 2;
      t.y = cursorY;
      modal.addChild(t);
      cursorY += t.height + line.gap;
    }

    modal.visible = false;
    modal.zIndex = 100;
    this._uiContainer.addChild(modal);
    this._modal = modal;
  }

  private _open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this._modal.visible = true;
    this._pause();
  }

  private _close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._modal.visible = false;
    this._resume();
  }

  destroy(): void {
    this._uiContainer.removeChild(this._infoButton);
    this._uiContainer.removeChild(this._modal);
    this._infoButton.destroy({ children: true });
    this._modal.destroy({ children: true });
  }
}

/**
 * Factory — main.ts에서 호출. uiContainer + app + GameLoop pause/resume refs 전달.
 */
export function attachAboutModal(deps: AboutModalDeps): AboutModal {
  return new AboutModal(deps);
}
