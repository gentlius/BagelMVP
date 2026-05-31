/**
 * Input System — POP!
 *
 * Implements: design/gdd/input-system.md (AC.1 ~ AC.9 전부)
 * Design Doc: design/gdd/input-system.md
 *
 * State machine: IDLE → POINTER_DOWN → DRAGGING → IDLE
 * Supports V1 (single-tap fire) and V2 (double-tap fire) variants.
 *
 * Touch + Mouse unified via PointerEvent.
 * Pixi v8 Federated Events for coordinate transformation (F2).
 *
 * AudioContext unlock contract (visual-juice §3.7 + input-system §2차 Consumer):
 *   GameLoop registers once('input:fire') and once('input:dragStart') to call
 *   audioManager.unlock() on first user gesture. This system emits the events;
 *   the unlock wiring is GameLoop's responsibility.
 *
 * Phase 2 Decision (D-P2-05): InputSystem extends Pixi EventEmitter directly
 * (as specified in GDD §Public Interface) rather than using the shared EventBus.
 * This preserves the typed EventEmitter<{...}> generic from the GDD spec.
 * Other systems listen to InputSystem events via GameLoop DI.
 */

import { EventEmitter, Application } from 'pixi.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Vec2 {
  x: number;
  y: number;
}

export interface InputSystemOptions {
  variant: 'V1_SINGLE_TAP' | 'V2_DOUBLE_TAP';
  /** DRAG_THRESHOLD: px beyond which a move is drag intent (default 10) */
  dragThreshold: number;
  /** TAP_MAX_DURATION: max ms for a press to count as tap (default 250) */
  tapMaxDuration: number;
  /** DOUBLE_TAP_WINDOW: max ms between two taps for double-tap (V2, default 300) */
  doubleTapWindow: number;
  /** DOUBLE_TAP_MAX_DISTANCE: max px between first and second tap (V2, default 30) */
  doubleTapMaxDistance: number;
  /** V1_GUARD_MS: ignore taps within this ms after drag end (V1, default 50) */
  v1GuardMs: number;
}

type InputState = 'IDLE' | 'POINTER_DOWN' | 'DRAGGING';

type InputEventMap = {
  'input:fire': [];
  'input:dragStart': [Vec2];
  'input:dragMove': [Vec2];
  'input:dragEnd': [Vec2];
  'input:dragCancel': [];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS: InputSystemOptions = {
  variant: 'V1_SINGLE_TAP',
  dragThreshold: 10,
  tapMaxDuration: 250,
  doubleTapWindow: 300,
  doubleTapMaxDistance: 30,
  v1GuardMs: 50,
};

// ---------------------------------------------------------------------------
// InputSystem
// ---------------------------------------------------------------------------

/**
 * InputSystem
 *
 * Extends Pixi EventEmitter with typed payload map (GDD §Public Interface).
 * Attach to the Pixi Application stage after app.init() is complete.
 */
export class InputSystem extends EventEmitter<InputEventMap> {
  private readonly _app: Application;
  private _options: InputSystemOptions;
  private _state: InputState = 'IDLE';

  // Internal state variables (GDD §Detailed Rules State Machine)
  private _activePointerId: number | null = null;
  private _startPos: Vec2 = { x: 0, y: 0 };
  private _startTime = 0;
  private _lastTapPos: Vec2 = { x: 0, y: 0 };
  private _lastTapTime = 0;
  private _lastDragEndTime = 0;

  // Bound handlers (for proper removeListener)
  private readonly _onPointerDown: (e: PointerEvent) => void;
  private readonly _onPointerMove: (e: PointerEvent) => void;
  private readonly _onPointerUp: (e: PointerEvent) => void;
  private readonly _onPointerCancel: (e: PointerEvent) => void;
  private readonly _onVisibilityChange: () => void;

  constructor(app: Application, options: Partial<InputSystemOptions> = {}) {
    super();
    this._app = app;
    this._options = { ...DEFAULT_OPTIONS, ...options };

    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onPointerCancel = this._handlePointerCancel.bind(this);
    this._onVisibilityChange = this._handleVisibilityChange.bind(this);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Attach Pixi stage federated event listeners. Call after app.init(). */
  public attach(): void {
    const stage = this._app.stage;
    stage.eventMode = 'static';
    stage.hitArea = this._app.screen;

    // Using canvas-level PointerEvent for reliable multi-touch filtering
    // and to match GDD Federated Events spec (Pixi v8 pointer unification)
    const canvas = this._app.canvas;
    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('pointerup', this._onPointerUp);
    canvas.addEventListener('pointerupoutside' as 'pointerup', this._onPointerUp);
    canvas.addEventListener('pointercancel', this._onPointerCancel);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  /** Detach all listeners + cleanup. */
  public detach(): void {
    const canvas = this._app.canvas;
    canvas.removeEventListener('pointerdown', this._onPointerDown);
    canvas.removeEventListener('pointermove', this._onPointerMove);
    canvas.removeEventListener('pointerup', this._onPointerUp);
    canvas.removeEventListener('pointercancel', this._onPointerCancel);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    this._resetInternalState();
  }

  public getState(): InputState {
    return this._state;
  }

  /** Switch V1/V2 variant at runtime (A/B test via URL param). */
  public setVariant(variant: 'V1_SINGLE_TAP' | 'V2_DOUBLE_TAP'): void {
    this._options = { ...this._options, variant };
    this._resetInternalState();
  }

  // ---------------------------------------------------------------------------
  // Coordinate transformation (GDD §F2)
  // ---------------------------------------------------------------------------

  private _toWorld(e: PointerEvent): Vec2 {
    // app.stage.toLocal converts CSS pixel → game world coordinates
    // respecting DPR, stage scale, and transforms.
    const global = { x: e.clientX, y: e.clientY };
    const local = this._app.stage.toLocal(global);
    return { x: local.x, y: local.y };
  }

  // ---------------------------------------------------------------------------
  // Pointer handlers
  // ---------------------------------------------------------------------------

  private _handlePointerDown(e: PointerEvent): void {
    // Multi-touch: ignore secondary pointers (GDD §E.1)
    if (this._activePointerId !== null && e.pointerId !== this._activePointerId) return;
    if (this._state !== 'IDLE') return;

    this._activePointerId = e.pointerId;
    this._state = 'POINTER_DOWN';
    const pos = this._toWorld(e);
    this._startPos = pos;
    this._startTime = performance.now();
  }

  private _handlePointerMove(e: PointerEvent): void {
    if (e.pointerId !== this._activePointerId) return;
    if (this._state === 'IDLE') return;

    const pos = this._toWorld(e);

    if (this._state === 'POINTER_DOWN') {
      const dx = pos.x - this._startPos.x;
      const dy = pos.y - this._startPos.y;
      const distSq = dx * dx + dy * dy;
      const threshSq = this._options.dragThreshold * this._options.dragThreshold;

      if (distSq > threshSq) {
        // Transition to DRAGGING
        this._lastTapTime = 0; // invalidate double-tap (V2 §E.3)
        this._state = 'DRAGGING';
        this.emit('input:dragStart', pos);
      }
      // else: stay in POINTER_DOWN
    } else if (this._state === 'DRAGGING') {
      this.emit('input:dragMove', pos);
    }
  }

  private _handlePointerUp(e: PointerEvent): void {
    if (e.pointerId !== this._activePointerId) return;
    if (this._state === 'IDLE') return;

    const now = performance.now();
    const pos = this._toWorld(e);
    const duration = now - this._startTime;

    if (this._state === 'DRAGGING') {
      this._lastDragEndTime = now;
      this._state = 'IDLE';
      this._activePointerId = null;
      this.emit('input:dragEnd', pos);
      return;
    }

    // state === POINTER_DOWN — tap classification
    const isValidTap = duration <= this._options.tapMaxDuration;

    this._state = 'IDLE';
    this._activePointerId = null;

    if (!isValidTap) {
      // Long-press: invalidate double-tap
      this._lastTapTime = 0;
      return;
    }

    if (this._options.variant === 'V1_SINGLE_TAP') {
      const guardClear = (now - this._lastDragEndTime) >= this._options.v1GuardMs;
      if (guardClear) {
        this.emit('input:fire');
      }
      // guard not clear: swallow
    } else {
      // V2_DOUBLE_TAP
      const timeDiff = now - this._lastTapTime;
      const dx = this._startPos.x - this._lastTapPos.x;
      const dy = this._startPos.y - this._lastTapPos.y;
      const distSq = dx * dx + dy * dy;
      const maxDistSq = this._options.doubleTapMaxDistance * this._options.doubleTapMaxDistance;

      if (
        this._lastTapTime > 0 &&
        timeDiff <= this._options.doubleTapWindow &&
        distSq <= maxDistSq
      ) {
        // Valid double-tap
        this._lastTapTime = 0;
        this.emit('input:fire');
      } else {
        // First tap in a potential double-tap sequence
        this._lastTapTime = now;
        this._lastTapPos = { ...this._startPos };
      }
    }
  }

  private _handlePointerCancel(e: PointerEvent): void {
    if (e.pointerId !== this._activePointerId) return;
    if (this._state === 'DRAGGING') {
      this._lastDragEndTime = performance.now();
      this.emit('input:dragCancel');
    }
    this._resetInternalState();
  }

  // GDD §E.1: visibilitychange → force cancel (stuck-character prevention)
  private _handleVisibilityChange(): void {
    if (document.hidden && this._state === 'DRAGGING') {
      this._lastDragEndTime = performance.now();
      this.emit('input:dragCancel');
    }
    if (document.hidden) {
      this._resetInternalState();
    }
  }

  // ---------------------------------------------------------------------------
  // Internal reset
  // ---------------------------------------------------------------------------

  private _resetInternalState(): void {
    this._state = 'IDLE';
    this._activePointerId = null;
    this._lastTapTime = 0;
    this._lastDragEndTime = 0;
  }
}
