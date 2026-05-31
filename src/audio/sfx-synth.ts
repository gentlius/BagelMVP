/**
 * SFX Synth — POP!
 *
 * Web Audio API 런타임 합성. 파일 0건, bundle 영향 0.
 * visual-juice §Audio Note P-01 ~ P-07 파라미터 기준.
 *
 * Design doc: design/gdd/visual-juice-system.md §Audio Note
 * Decision: D-P3-01 (2026-05-31) — Option B (runtime synth)
 */

import type { SoundId } from './audio-manager.js';

/**
 * OscillatorNode 기반 단일 SFX 합성 유틸리티.
 * AudioContext가 suspended 상태이면 silent fallback (E10).
 */
export function synthSfx(
  ctx: AudioContext,
  sfxGain: GainNode,
  id: SoundId,
  volume = 1.0,
  delayMs = 0,
): void {
  if (ctx.state === 'suspended') return; // E10: silent before unlock

  const startTime = ctx.currentTime + delayMs / 1000;

  switch (id) {
    case 'harpoon-fire':
      // P-06: Laser shoot, pitch 상승, 80-120ms
      _sweep(ctx, sfxGain, volume, startTime, 'sawtooth', 880, 220, 0.005, 0.1);
      break;

    case 'balloon-pop-small':
      // P-01: 작은 유리알 팝, 고음 600-900Hz, 80-100ms
      _blip(ctx, sfxGain, volume, startTime, 'square', 700, 0.005, 0.085);
      break;

    case 'balloon-pop-large':
      // P-02: 큰 유리 팝, 저음 200-400Hz, 150-200ms + noise burst
      _blip(ctx, sfxGain, volume, startTime, 'square', 300, 0.008, 0.18);
      _noise(ctx, sfxGain, volume * 0.3, startTime, 0.12);
      break;

    case 'critical-pop':
      // P-03: pitch 상승 아르페지오 + 반짝임, 250-350ms
      _sweep(ctx, sfxGain, volume, startTime, 'triangle', 220, 880, 0.01, 0.3);
      _blip(ctx, sfxGain, volume * 0.5, startTime + 0.1, 'sine', 1320, 0.005, 0.08);
      _blip(ctx, sfxGain, volume * 0.4, startTime + 0.2, 'sine', 1760, 0.005, 0.06);
      break;

    case 'combo-up-1':
      // P-04 참조: 단음 중음 ~440Hz, 60-80ms (combo 1-4 ack 슬롯)
      _blip(ctx, sfxGain, volume, startTime, 'sine', 660, 0.005, 0.07);
      break;

    case 'combo-up-2':
      // P-05: 반음 높음 ~523Hz, 밝게, 80-100ms (5콤보 마일스톤)
      _blip(ctx, sfxGain, volume, startTime, 'sine', 880, 0.005, 0.09);
      break;

    case 'combo-up-3':
      // M1 슬롯 (10/20 마일스톤): 더 높음, 더 밝게
      _blip(ctx, sfxGain, volume, startTime, 'sine', 1100, 0.005, 0.09);
      _blip(ctx, sfxGain, volume * 0.6, startTime + 0.05, 'sine', 1320, 0.005, 0.07);
      break;

    case 'game-over':
      // P-07: 하강 sweeping tone, 400-600ms
      _sweep(ctx, sfxGain, volume, startTime, 'sawtooth', 440, 110, 0.01, 0.6);
      break;

    default: {
      const _exhaustive: never = id;
      void _exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Primitive builders
// ---------------------------------------------------------------------------

/** 단일 blip — AD envelope (attack + decay), 단일 주파수 */
function _blip(
  ctx: AudioContext,
  destination: GainNode,
  volume: number,
  startTime: number,
  waveform: OscillatorType,
  freq: number,
  attackSec: number,
  decaySec: number,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = waveform;
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + attackSec);
  gain.gain.linearRampToValueAtTime(0, startTime + attackSec + decaySec);

  osc.connect(gain);
  gain.connect(destination);

  osc.start(startTime);
  osc.stop(startTime + attackSec + decaySec + 0.005);
}

/** Pitch sweep — start freq → end freq over duration */
function _sweep(
  ctx: AudioContext,
  destination: GainNode,
  volume: number,
  startTime: number,
  waveform: OscillatorType,
  freqStart: number,
  freqEnd: number,
  attackSec: number,
  durationSec: number,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = waveform;
  osc.frequency.setValueAtTime(freqStart, startTime);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(freqEnd, 10),
    startTime + durationSec,
  );

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + attackSec);
  gain.gain.linearRampToValueAtTime(0, startTime + durationSec);

  osc.connect(gain);
  gain.connect(destination);

  osc.start(startTime);
  osc.stop(startTime + durationSec + 0.01);
}

/** White noise burst — BufferSourceNode 기반, balloon-pop-large 저음 보완 */
function _noise(
  ctx: AudioContext,
  destination: GainNode,
  volume: number,
  startTime: number,
  durationSec: number,
): void {
  const bufferSize = Math.ceil(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * volume;
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  // Low-pass filter — 유리 팝의 저역 물성
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(800, startTime);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.linearRampToValueAtTime(0, startTime + durationSec);

  src.connect(lpf);
  lpf.connect(gain);
  gain.connect(destination);

  src.start(startTime);
  src.stop(startTime + durationSec + 0.005);
}
