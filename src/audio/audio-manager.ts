/**
 * AudioManager — POP!
 *
 * Web Audio API 직접 구현. @pixi/sound 미사용 (technical-preferences.md lock, AC.15).
 * SFX 7개 런타임 합성 (Option B — D-P3-01). 파일 0건. Bundle 영향 0.
 * BGM 슬롯: lazy import() 분리 (art-bible §8.5). 파일 없으면 E9 silent fallback.
 * AudioContext unlock: 첫 user gesture 시 ctx.resume() (E10, visual-juice §3.7).
 *
 * Design doc: design/gdd/visual-juice-system.md §Audio Note
 * EventBus: src/events/event-bus.ts
 */

import type { EventBus } from '../events/event-bus.js';
import { synthSfx } from './sfx-synth.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * 8 SFX ID — visual-juice §Audio Note P-01 ~ P-07 + game-over.
 * combo-up-1: balloon:popped non-critical ack (P-04 참조, wiring optional).
 * combo-up-2: combo:milestone tier=5 (P-05).
 * combo-up-3: M1 슬롯 (10/20 마일스톤).
 */
export type SoundId =
  | 'harpoon-fire'
  | 'balloon-pop-small'
  | 'balloon-pop-large'
  | 'critical-pop'
  | 'combo-up-1'
  | 'combo-up-2'
  | 'combo-up-3'
  | 'game-over';

// ---------------------------------------------------------------------------
// Mix constants — visual-juice §Audio Note Mix/Ducking 표
// ---------------------------------------------------------------------------

const MASTER_VOLUME = 0.7;   // 모바일 web 권장
const BGM_GAIN = 0.55;       // BGM 기본 볼륨 (-5 dBFS) — D-P6-BGM-04 사용자 피드백 +4dB
const BGM_DUCK_GAIN = 0.28;  // Critical 중 BGM ducking (-5 dBFS → -11 dBFS, 약 -6dB 폭 유지, GDD §4.2)
const SFX_GAIN = 1.0;        // SFX bus gain (per-call volume이 세부 조정)

// Per-SFX volume — visual-juice §Audio Note Mix 표
const SFX_VOLUME: Record<SoundId, number> = {
  'harpoon-fire':       0.7,
  'balloon-pop-small':  0.55,
  'balloon-pop-large':  0.7,
  'critical-pop':       1.0,  // Critical SFX: 0 dBFS
  'combo-up-1':         0.6,
  'combo-up-2':         0.65,
  'combo-up-3':         0.7,
  'game-over':          0.8,  // Game Over: -2 dBFS
};

// ---------------------------------------------------------------------------
// AudioManager class
// ---------------------------------------------------------------------------

export class AudioManager {
  private _ctx: AudioContext | null = null;
  private _unlocked = false;
  private _warnedBgm = false; // E9: BGM 미존재 경고 1회만

  // GainNode graph: destination ← master ← sfxBus / bgmBus
  private _masterGain: GainNode | null = null;
  private _sfxGain: GainNode | null = null;
  private _bgmGain: GainNode | null = null;

  private _bgmSource: AudioBufferSourceNode | null = null;

  // harpoon-fire 동시 재생 1회 제한 (AC.9)
  private _harpoonActive = false;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  private _ensureCtx(): AudioContext {
    if (!this._ctx) {
      this._ctx = new AudioContext();

      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = MASTER_VOLUME;
      this._masterGain.connect(this._ctx.destination);

      this._bgmGain = this._ctx.createGain();
      this._bgmGain.gain.value = BGM_GAIN;
      this._bgmGain.connect(this._masterGain);

      this._sfxGain = this._ctx.createGain();
      this._sfxGain.gain.value = SFX_GAIN;
      this._sfxGain.connect(this._masterGain);
    }
    return this._ctx;
  }

  /**
   * 첫 user gesture 시 호출 — AudioContext.resume() (E10).
   * GameLoop.init() 내 eventBus.once('input:fire') 에서 wired (game-loop.ts L121-124).
   */
  // D-P6-BGM-02 (사용자): About 모달 pause/resume — AudioContext suspend/resume
  suspend(): void {
    if (this._ctx && this._ctx.state === 'running') {
      void this._ctx.suspend();
    }
  }
  resume(): void {
    if (this._ctx && this._ctx.state === 'suspended') {
      void this._ctx.resume();
    }
  }

  unlock(): void {
    const ctx = this._ensureCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => {
        this._unlocked = true;
      });
    } else {
      this._unlocked = true;
    }
  }

  // ---------------------------------------------------------------------------
  // SFX
  // ---------------------------------------------------------------------------

  /**
   * SFX 재생.
   * AudioContext suspended 시 silent fallback (E10).
   * harpoon-fire: max 1 active instance (AC.9).
   *
   * @param soundId  - visual-juice §Audio Note SFX ID
   * @param options  - volume override (0–1), pitch (reserved, no-op), delayMs
   */
  play(
    soundId: SoundId,
    options?: { volume?: number; pitch?: number; delayMs?: number },
  ): void {
    const ctx = this._ensureCtx();
    if (!this._sfxGain) return;

    // AC.9: harpoon-fire 동시 1회 제한
    if (soundId === 'harpoon-fire') {
      if (this._harpoonActive) return;
      this._harpoonActive = true;
      // 약 140ms 후 flag 해제 (P-06 최대 120ms + 여유)
      setTimeout(() => { this._harpoonActive = false; }, 140);
    }

    const volume = (options?.volume ?? SFX_VOLUME[soundId]);
    const delayMs = options?.delayMs ?? 0;

    synthSfx(ctx, this._sfxGain, soundId, volume, delayMs);
  }

  // ---------------------------------------------------------------------------
  // BGM
  // ---------------------------------------------------------------------------

  /**
   * BGM 시작 — lazy import()로 AudioBuffer 로드 후 loop 재생.
   * 파일 없거나 로드 실패 시 E9: console.warn 1회 후 silent fallback.
   * E11: stop 후 재사용 불가 → 매번 새 AudioBufferSourceNode.
   *
   * @param url - OGG URL (예: '/assets/audio/bgm/primary.ogg'). 미제공 시 E9 fallback.
   */
  async bgmStart(url?: string): Promise<void> {
    this.bgmStop(); // E11: 기존 소스 정리

    if (!url) {
      if (!this._warnedBgm) {
        console.warn('[AudioManager] BGM URL not provided — silent fallback (visual-juice §E9)');
        this._warnedBgm = true;
      }
      return;
    }

    const ctx = this._ensureCtx();
    if (!this._bgmGain) return;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // E11: 항상 새 AudioBufferSourceNode (stop 후 재사용 불가)
      this._bgmSource = ctx.createBufferSource();
      this._bgmSource.buffer = audioBuffer;
      this._bgmSource.loop = true;
      this._bgmSource.connect(this._bgmGain);
      this._bgmSource.start();
    } catch (err) {
      if (!this._warnedBgm) {
        console.warn('[AudioManager] BGM load failed — silent fallback (visual-juice §E9)', err);
        this._warnedBgm = true;
      }
    }
  }

  /** BGM 정지. AudioBufferSourceNode.stop() — 재사용 불가 (E11). */
  bgmStop(): void {
    if (this._bgmSource) {
      try { this._bgmSource.stop(); } catch { /* 이미 정지됨 — 무시 */ }
      this._bgmSource = null;
    }
  }

  /**
   * BGM fade-out — game:over 시 0.3s (visual-juice §3.7 GameLoop.end).
   * gainNode ramp으로 구현 (Ticker 독립 — Web Audio scheduler 사용).
   */
  bgmFadeOut(durationSec = 0.3): void {
    if (!this._bgmGain || !this._ctx) return;
    const ctx = this._ctx;
    const gain = this._bgmGain;
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationSec);
    // fade 완료 후 bgmStop
    setTimeout(() => this.bgmStop(), (durationSec + 0.05) * 1000);
  }

  // ---------------------------------------------------------------------------
  // Ducking
  // ---------------------------------------------------------------------------

  /**
   * Critical 중 BGM ducking.
   * visual-juice §4.2 타임라인: 0.05s ramp 다운 → (durationSec − 0.05)s 유지 → 0.05s ramp 업.
   * GDD 정확 값: BGM_GAIN 0.55 → BGM_DUCK_GAIN 0.28 → 0.55.
   *
   * @param durationSec  - 총 ducking 지속 (GDD: 0.1s ramp in + hold + 0.05s ramp out ≈ 0.2s 총합)
   * @param _attenuation - dBFS 값 (reserved, 실제 gain은 BGM_DUCK_GAIN 상수 사용)
   */
  duck(durationSec = 0.2, _attenuation = -6): void {
    if (!this._bgmGain || !this._ctx) return;
    const ctx = this._ctx;
    const gain = this._bgmGain;
    const rampIn = 0.05;
    const rampOut = 0.05;

    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(BGM_GAIN, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(BGM_DUCK_GAIN, ctx.currentTime + rampIn);
    gain.gain.linearRampToValueAtTime(
      BGM_DUCK_GAIN,
      ctx.currentTime + durationSec - rampOut,
    );
    gain.gain.linearRampToValueAtTime(BGM_GAIN, ctx.currentTime + durationSec);
  }

  // ---------------------------------------------------------------------------
  // EventBus wiring
  // ---------------------------------------------------------------------------

  /**
   * 모든 EventBus 구독 등록.
   * visual-juice §3.7 Listener 등록 순서 (P2 lock):
   *   VisualJuice.attachListeners() AFTER this — AudioManager wiring은 P2 lock 외부.
   *
   * 구독 이벤트:
   *   balloon:popped    → pop SFX (size 기반, isCritical=true는 criticalPop:fired가 담당)
   *   criticalPop:fired → critical-pop SFX + ducking
   *   combo:milestone   → combo-up-2 SFX (tier=5), combo-up-3 (tier≥10, M1 준비)
   *   game:over         → game-over SFX + BGM fade-out
   *   game:start        → bgmStart() (BGM URL placeholder — E9 silent fallback)
   *   input:fire        → harpoon-fire SFX (EventBus forward — GameLoop L114 input 'input:fire' → balloonSystem.onFire)
   */
  attachListeners(eventBus: EventBus): void {
    // balloon:popped — size별 SFX
    // isCritical=true 케이스는 criticalPop:fired가 별도 처리 → 중복 재생 방지
    eventBus.on('balloon:popped', (p) => {
      if (p.isCritical) return; // criticalPop:fired에서 처리
      const id: SoundId =
        (p.size === 'Small' || p.size === 'XS') ? 'balloon-pop-small' : 'balloon-pop-large';
      this.play(id);
    });

    // D-P6-AUDIO-02 (사용자): balloon:split 시각 burst와 동기화 — parent.size 기준 pop SFX
    eventBus.on('balloon:split', (p) => {
      const id: SoundId =
        (p.parent.size === 'Small' || p.parent.size === 'XS') ? 'balloon-pop-small' : 'balloon-pop-large';
      this.play(id);
    });

    // criticalPop:fired — critical SFX + BGM ducking (visual-juice §4.2)
    eventBus.on('criticalPop:fired', () => {
      this.play('critical-pop');
      this.duck(0.2, -6); // GDD §4.2: 총합 0.2s, 0.05s ramp in/out
    });

    // combo:milestone — tier별 SFX + 10ms delay (visual-juice §3.4 AC.6)
    eventBus.on('combo:milestone', (p) => {
      let id: SoundId;
      if (p.tier >= 10) {
        id = 'combo-up-3'; // M1 슬롯
      } else if (p.tier >= 5) {
        id = 'combo-up-2'; // tier=5 → P-05 (AC.6)
      } else {
        id = 'combo-up-1'; // tier 1-4 (M0에서는 발생 안 함, 방어적 처리)
      }
      this.play(id, { delayMs: 10 }); // 10ms delay — 마스킹 방지 (visual-juice §3.4)
    });

    // game:over — game-over SFX + BGM fade-out 0.3s (visual-juice §3.7)
    eventBus.on('game:over', () => {
      this.play('game-over');
      this.bgmFadeOut(0.3);
    });

    // game:start — BGM Primary 트랙 시작 (D-P6-BGM-01 사용자 다운로드 완료)
    // freesound.org/s/684184/ — "Some Game Background Music or Something" by Seth_Makes_Sounds
    // WAV 34.5MB → ffmpeg OGG q6 변환 3.28MB. public/audio/bgm/primary.ogg (Vite static serve).
    eventBus.on('game:start', () => {
      // base path 자동 적용 (local '/'와 GitHub Pages '/BagelMVP/' 둘 다 정합)
      void this.bgmStart(`${import.meta.env.BASE_URL}audio/bgm/primary.ogg`);
    });

    // input:fire → harpoon-fire SFX
    // GameLoop.init()에 input.on('input:fire') → balloonSystem.onFire() wiring 존재 (game-loop.ts L114).
    // EventBus 'input:fire' 는 GameLoop에서 audioManager.unlock()으로만 사용 (L121-124).
    // sound-designer 결정 (D-P3-02): InputSystem Pixi EventEmitter 'input:fire' 이벤트를
    // EventBus로 forward하는 대신, GameLoop가 이미 소유한 wiring을 활용.
    // → main.ts에서 audioManager.attachInputFire(inputSystem) 호출 권장 (아래 메서드).
    // attachListeners()는 EventBus 전용. InputSystem wiring은 attachInputFire()로 분리.
    eventBus.on('input:fire', () => {
      this.play('harpoon-fire'); // EventBus 'input:fire' emit 시 SFX 재생
    });
  }

  /**
   * InputSystem Pixi EventEmitter 직접 구독 — harpoon-fire SFX 보조 경로.
   * GameLoop가 InputSystem instance를 소유하므로, main.ts 또는 GameLoop.init()에서 호출.
   * EventBus 'input:fire'가 이미 emit된다면 이 메서드 호출 불필요 (중복 방지).
   */
  attachInputFire(
    inputSystem: { on: (event: 'input:fire', handler: () => void) => void },
  ): void {
    inputSystem.on('input:fire', () => {
      this.play('harpoon-fire');
    });
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  /**
   * GameLoop.reset() 시 호출 (visual-juice §3.7, AC.13).
   * BGM stop + 재시작은 GameLoop가 bgmStart()를 다시 호출해야 함 (E11 패턴).
   */
  reset(): void {
    this.bgmStop();
    this._warnedBgm = false; // 다음 bgmStart()에서 E9 경고 재발생 허용
    this._harpoonActive = false;
  }
}

/** Singleton AudioManager — globalThis.audioManager 로 GameLoop unlock hook에서 참조 */
export const audioManager = new AudioManager();
