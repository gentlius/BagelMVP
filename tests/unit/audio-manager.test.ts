/**
 * AudioManager unit tests — POP!
 *
 * Web Audio API는 브라우저 환경 전용이므로 AudioContext를 mock으로 대체.
 * unlock 상태 머신 + play() SoundId 호출 검증 + duck() gain schedule 검증.
 *
 * Design doc: design/gdd/visual-juice-system.md AC.9, AC.20
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioManager } from '../../src/audio/audio-manager.js';

// ---------------------------------------------------------------------------
// AudioContext mock
// ---------------------------------------------------------------------------

function makeMockCtx(state: AudioContextState = 'suspended') {
  const gainNode = {
    gain: {
      value: 1.0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    },
    connect: vi.fn().mockReturnThis(),
  };

  return {
    state,
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    createGain: vi.fn().mockReturnValue(gainNode),
    createOscillator: vi.fn().mockReturnValue({
      type: 'sine',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn().mockReturnThis(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createBufferSource: vi.fn().mockReturnValue({
      buffer: null,
      loop: false,
      connect: vi.fn().mockReturnThis(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createBuffer: vi.fn().mockReturnValue({
      getChannelData: vi.fn().mockReturnValue(new Float32Array(1024)),
    }),
    createBiquadFilter: vi.fn().mockReturnValue({
      type: 'lowpass',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn().mockReturnThis(),
    }),
    decodeAudioData: vi.fn().mockResolvedValue({}),
    _gainNode: gainNode, // test용 참조
  };
}

// ---------------------------------------------------------------------------
// AudioManager 테스트용 서브클래스 — private ctx 주입
// ---------------------------------------------------------------------------

class TestableAudioManager extends AudioManager {
  injectCtx(mockCtx: ReturnType<typeof makeMockCtx>): void {
    // @ts-expect-error private field injection for testing
    this._ctx = mockCtx;
    // @ts-expect-error
    this._masterGain = mockCtx.createGain();
    // @ts-expect-error
    this._sfxGain = mockCtx.createGain();
    // @ts-expect-error
    this._bgmGain = mockCtx.createGain();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AudioManager', () => {
  let am: TestableAudioManager;
  let mockCtx: ReturnType<typeof makeMockCtx>;

  beforeEach(() => {
    am = new TestableAudioManager();
    mockCtx = makeMockCtx('suspended');
    am.injectCtx(mockCtx);
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC.20 — AudioContext unlock 상태 머신
  // -------------------------------------------------------------------------

  describe('unlock()', () => {
    it('AC.20: suspended 상태에서 unlock() 호출 시 ctx.resume() 실행', () => {
      am.unlock();
      expect(mockCtx.resume).toHaveBeenCalledTimes(1);
    });

    it('AC.20: running 상태에서 unlock() 호출 시 ctx.resume() 미호출 (이미 활성)', () => {
      const runningCtx = makeMockCtx('running');
      am.injectCtx(runningCtx);
      am.unlock();
      expect(runningCtx.resume).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // AC.9 — harpoon-fire 동시 1회 제한
  // -------------------------------------------------------------------------

  describe('play() harpoon-fire concurrency', () => {
    it('AC.9: suspended 상태에서 play()는 synthSfx를 실행하지 않음 (E10 silent fallback)', () => {
      // suspended ctx → synthSfx 내부에서 early return
      // createOscillator가 호출되지 않아야 함
      am.play('harpoon-fire');
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });

    it('AC.9: running 상태에서 harpoon-fire 연속 2회 호출 시 1회만 소리 생성', () => {
      const runningCtx = makeMockCtx('running');
      am.injectCtx(runningCtx);

      am.play('harpoon-fire');
      const firstCallCount = runningCtx.createOscillator.mock.calls.length;

      am.play('harpoon-fire'); // _harpoonActive = true → skip
      const secondCallCount = runningCtx.createOscillator.mock.calls.length;

      expect(firstCallCount).toBeGreaterThan(0);
      expect(secondCallCount).toBe(firstCallCount); // 두 번째 호출 무시
    });
  });

  // -------------------------------------------------------------------------
  // play() — 각 SoundId가 createOscillator를 호출하는지 검증 (running ctx)
  // -------------------------------------------------------------------------

  describe('play() SoundId routing', () => {
    const soundIds = [
      'balloon-pop-small',
      'balloon-pop-large',
      'critical-pop',
      'combo-up-1',
      'combo-up-2',
      'combo-up-3',
      'game-over',
    ] as const;

    for (const id of soundIds) {
      it(`play('${id}') → OscillatorNode 생성 확인`, () => {
        const runningCtx = makeMockCtx('running');
        am.injectCtx(runningCtx);
        am.play(id);
        expect(runningCtx.createOscillator).toHaveBeenCalled();
      });
    }

    it("play('balloon-pop-large') → noise burst (createBuffer 호출)", () => {
      const runningCtx = makeMockCtx('running');
      am.injectCtx(runningCtx);
      am.play('balloon-pop-large');
      expect(runningCtx.createBuffer).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // duck() — BGM gain schedule 검증 (visual-juice §4.2)
  // -------------------------------------------------------------------------

  describe('duck()', () => {
    it('duck() → BGM gainNode에 linearRampToValueAtTime 스케줄 (cancelScheduledValues 포함)', () => {
      const runningCtx = makeMockCtx('running');
      am.injectCtx(runningCtx);
      // @ts-expect-error
      const bgmGain = am._bgmGain;

      am.duck(0.2, -6);

      expect(bgmGain.gain.cancelScheduledValues).toHaveBeenCalled();
      expect(bgmGain.gain.linearRampToValueAtTime).toHaveBeenCalledTimes(3);
      // 두 번째 호출: BGM_DUCK_GAIN (0.28)
      expect(bgmGain.gain.linearRampToValueAtTime.mock.calls[0][0]).toBeCloseTo(0.28);
      // 마지막 호출: BGM_GAIN 복귀 (0.55)
      expect(
        bgmGain.gain.linearRampToValueAtTime.mock.calls[2][0],
      ).toBeCloseTo(0.55);
    });
  });

  // -------------------------------------------------------------------------
  // bgmStop() + reset()
  // -------------------------------------------------------------------------

  describe('bgmStop()', () => {
    it('bgmStop(): bgmSource가 없으면 에러 없이 종료', () => {
      expect(() => am.bgmStop()).not.toThrow();
    });
  });

  describe('reset()', () => {
    it('reset(): bgmStop 호출 + harpoonActive 해제 + warnedBgm 리셋', () => {
      // @ts-expect-error
      am._harpoonActive = true;
      // @ts-expect-error
      am._warnedBgm = true;

      am.reset();

      // @ts-expect-error
      expect(am._harpoonActive).toBe(false);
      // @ts-expect-error
      expect(am._warnedBgm).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // bgmStart() — E9 silent fallback (url 미제공)
  // -------------------------------------------------------------------------

  describe('bgmStart()', () => {
    it('E9: url 미제공 시 console.warn 1회 후 무음 fallback', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const runningCtx = makeMockCtx('running');
      am.injectCtx(runningCtx);

      await am.bgmStart(/* url 없음 */);
      await am.bgmStart(/* 두 번째 호출 */);

      // warn은 1회만
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('BGM URL not provided');
      warnSpy.mockRestore();
    });
  });
});
