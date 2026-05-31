/**
 * EventBus — POP!
 *
 * Implements: design/gdd/systems-index.md (cross-system event communication)
 * Design Doc: 5 GDD §6 Dependencies (event payload contracts)
 *
 * Tiny typed event emitter — zero external dependencies.
 * Listener registration order is FIFO-guaranteed (Array push).
 *
 * P2 listener order lock (score-combo §1, visual-juice §3.7):
 *   GameLoop registers Visual Juice listeners BEFORE Score & Combo listeners.
 *   EventBus guarantees FIFO dispatch → visual response fires before score update.
 *
 * Phase 2 Decision (D-P2-03): Chose self-contained emitter over Pixi EventEmitter
 * inheritance at the bus level. Systems that need Pixi-specific typed events
 * (e.g. InputSystem) extend Pixi EventEmitter directly (as per GDD §Public Interface).
 * The bus is a separate coordination layer for cross-system gameplay events.
 */

// ---------------------------------------------------------------------------
// Payload types for all 5-system events
// ---------------------------------------------------------------------------

/** Balloon size identifiers */
// D-P6-SPLIT-01 (사용자 2026-05-31): 5단계 분열 chain (XL → Large → Medium → Small → XS)
// XL = Large × 2 (시작 크기), XS = Small × 0.5 (최소)
export type BalloonSize = 'XL' | 'Large' | 'Medium' | 'Small' | 'XS';

/** balloon:spawned — emitted when balloon entity is created */
export interface BalloonSpawnedPayload {
  id: string;
  x: number;
  y: number;
  size: BalloonSize;
  color: number;
  isCritical: boolean;
}

/** balloon:popped — emitted on harpoon hit (balloon-physics-split §3.4, §6) */
export interface BalloonPoppedPayload {
  /** Unique balloon id — used by Score & Combo frame-guard (M-SC-1 lock) */
  id: string;
  size: BalloonSize;
  x: number;
  y: number;
  color: number;
  isCritical: boolean;
}

/** balloon:split — emitted alongside balloon:popped for normal splits (visual-juice) */
export interface BalloonSplitPayload {
  parent: {
    id: string;
    x: number;
    y: number;
    size: BalloonSize;
    color: number;
  };
  /** children[0] = left (vx = -SPLIT_VEL_X), children[1] = right */
  children: [
    { id: string; x: number; y: number; size: BalloonSize; color: number },
    { id: string; x: number; y: number; size: BalloonSize; color: number },
  ];
}

/** harpoon:fired — emitted when harpoon is spawned */
export interface HarpoonFiredPayload {
  x: number;
  y: number;
}

/** harpoon:hit — emitted when harpoon connects (before removal) */
export interface HarpoonHitPayload {
  x: number;
  y: number;
  balloonId: string;
}

/** criticalPop:fired — emitted by CriticalPopSystem (M-CP-1 lock) */
export interface CriticalPopFiredPayload {
  x: number;
  y: number;
  /** Critical body size at time of hit — used by Score & Combo (M-CP-1 lock) */
  criticalSize: BalloonSize;
  /** Always an array, [] when chain count is 0 */
  chainedBalloons: Array<{
    id: string;
    x: number;
    y: number;
    size: BalloonSize;
    color: number;
  }>;
}

/** score:updated — emitted by ScoreComboSystem per balloon (8-field payload, score-combo §6) */
export interface ScoreUpdatedPayload {
  totalScore: number;
  delta: number;
  combo: number;
  size: BalloonSize;
  x: number;
  y: number;
  sizeMultiplier: number;
  comboMultiplier: number;
}

/** combo:milestone — emitted when combo crosses MILESTONE_COMBO threshold */
export interface ComboMilestonePayload {
  tier: number;
  combo: number;
}

/** combo:reset — emitted when combo resets after COMBO_RESET_SEC */
export interface ComboResetPayload {
  finalCombo: number;
}

/** game:over — emitted by BalloonPhysicsSplitSystem on character collision */
export type GameOverPayload = Record<string, never>;

/** game:start — emitted by GameLoop.start() */
export type GameStartPayload = Record<string, never>;

/** input:fire — emitted by InputSystem */
export type InputFirePayload = Record<string, never>;

/** input:retry — emitted by UI RETRY button tap */
export type InputRetryPayload = Record<string, never>;

/** input:dragStart — emitted by InputSystem */
export interface InputDragStartPayload {
  x: number;
  y: number;
}

/** input:dragMove — emitted by InputSystem */
export interface InputDragMovePayload {
  x: number;
  y: number;
}

/** input:dragEnd — emitted by InputSystem */
export interface InputDragEndPayload {
  x: number;
  y: number;
}

/** input:dragCancel — emitted by InputSystem */
export type InputDragCancelPayload = Record<string, never>;

// ---------------------------------------------------------------------------
// EventMap: type-safe union of all event names → payload
// ---------------------------------------------------------------------------

export interface EventMap {
  'balloon:spawned': BalloonSpawnedPayload;
  'balloon:popped': BalloonPoppedPayload;
  'balloon:split': BalloonSplitPayload;
  'harpoon:fired': HarpoonFiredPayload;
  'harpoon:hit': HarpoonHitPayload;
  'criticalPop:fired': CriticalPopFiredPayload;
  'score:updated': ScoreUpdatedPayload;
  'combo:milestone': ComboMilestonePayload;
  'combo:reset': ComboResetPayload;
  'game:over': GameOverPayload;
  'game:start': GameStartPayload;
  'input:fire': InputFirePayload;
  'input:retry': InputRetryPayload;
  'input:dragStart': InputDragStartPayload;
  'input:dragMove': InputDragMovePayload;
  'input:dragEnd': InputDragEndPayload;
  'input:dragCancel': InputDragCancelPayload;
}

// ---------------------------------------------------------------------------
// EventBus implementation
// ---------------------------------------------------------------------------

type Handler<T> = (payload: T) => void;
type AnyHandler = Handler<unknown>;

/**
 * Typed EventBus.
 *
 * Listener order is FIFO within each event type.
 * on() / once() / off() / emit() / clear()
 */
export class EventBus {
  private readonly _listeners: Map<string, AnyHandler[]> = new Map();
  private readonly _onceSet: WeakSet<AnyHandler> = new WeakSet();

  /** Register a persistent listener. Returns the handler for off() convenience. */
  on<K extends keyof EventMap>(type: K, handler: Handler<EventMap[K]>): Handler<EventMap[K]> {
    const list = this._getList(type as string);
    list.push(handler as AnyHandler);
    return handler;
  }

  /** Register a one-time listener that auto-removes after first call. */
  once<K extends keyof EventMap>(type: K, handler: Handler<EventMap[K]>): Handler<EventMap[K]> {
    const wrapper: AnyHandler = (payload) => {
      this.off(type, handler);
      handler(payload as EventMap[K]);
    };
    // Track wrapper → original mapping via once set on wrapper
    this._onceSet.add(wrapper);
    const list = this._getList(type as string);
    list.push(wrapper);
    // Keep wrapper reference on original handler so off() can find it
    (handler as unknown as { _onceWrapper?: AnyHandler })._onceWrapper = wrapper;
    return handler;
  }

  /** Remove a listener registered with on() or once(). */
  off<K extends keyof EventMap>(type: K, handler: Handler<EventMap[K]>): void {
    const list = this._listeners.get(type as string);
    if (!list) return;

    // Handle once wrapper
    const h = handler as unknown as { _onceWrapper?: AnyHandler };
    const target = h._onceWrapper ?? (handler as AnyHandler);
    const idx = list.indexOf(target);
    if (idx !== -1) {
      list.splice(idx, 1);
      delete h._onceWrapper;
    }
  }

  /** Emit an event synchronously to all registered listeners in registration order. */
  emit<K extends keyof EventMap>(type: K, payload: EventMap[K]): void {
    const list = this._listeners.get(type as string);
    if (!list || list.length === 0) return;
    // Snapshot to handle once() mutations during iteration
    const snapshot = list.slice();
    for (const fn of snapshot) {
      fn(payload as unknown);
    }
  }

  /** Remove all listeners for a specific event type, or all if no type given. */
  clear(type?: keyof EventMap): void {
    if (type !== undefined) {
      this._listeners.delete(type as string);
    } else {
      this._listeners.clear();
    }
  }

  private _getList(type: string): AnyHandler[] {
    let list = this._listeners.get(type);
    if (!list) {
      list = [];
      this._listeners.set(type, list);
    }
    return list;
  }
}

/** Singleton EventBus instance shared by all gameplay systems. */
export const eventBus = new EventBus();
