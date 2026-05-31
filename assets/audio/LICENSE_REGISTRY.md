# POP! Audio License Registry

> **Policy**: 누락 0건 — 모든 오디오 자산은 라이선스 소스 + 제작자 + 사용 범위가
> 이 파일에 기재되어야 한다. BGM 슬롯이 비어있어도 빌드는 정상 작동 (AudioManager는
> `console.warn` 1회 후 silent fallback — visual-juice §E9).
> **Pattern reference**: Seed Money `assets/audio/DOWNLOAD_GUIDE.md` 차용.

## BGM (3 슬롯 — 사용자 다운로드 후 채움)

| Slot | Track ID | Source | Author | License | Local Path | LUFS | Notes |
|------|----------|--------|--------|---------|------------|------|-------|
| **Primary** ✅ | [#684184](https://freesound.org/s/684184/) | freesound.org | Seth_Makes_Sounds | **CC0** (Public Domain — 사용자 확인 2026-05-31) | `public/audio/bgm/primary.ogg` | TBD (Audacity 정규화 미적용 — 게임 master gain으로 조정) | "Some Game Background Music Or Something" — 2:16 loop. WAV 34.5MB → ffmpeg OGG q6 3.28MB (D-P6-BGM-01) |
| **Backup A** | TBD | TBD (freesound.org) | TBD | CC0 / CC-BY 4.0 | `assets/audio/bgm/backup-a.ogg` | -16 | Primary 거부 시 fallback 후보 1 |
| **Backup B** | TBD | TBD (freesound.org) | TBD | CC0 / CC-BY 4.0 | `assets/audio/bgm/backup-b.ogg` | -16 | Primary 거부 시 fallback 후보 2 |

**다운로드 절차 (사용자 손)**:
1. freesound.org에서 3 트랙 다운로드 (검색어: "arcade loop seamless")
2. Audacity로 루프포인트 정리 + OGG q6 export
3. LUFS -16 정규화 (Audacity → Effect → Loudness Normalization)
4. 위 표의 TBD 항목 채움 (Track ID URL / Author / License 정확히)

## SFX (7개 — Web Audio 런타임 합성, Phase 3 T-20 D-P3-01 결정)

> **D-P3-01 결정 (2026-05-31)**: Option B 채택 — Web Audio OscillatorNode 런타임 합성.
> 파일 0건, bundle 영향 0. `src/audio/sfx-synth.ts`에 모든 파라미터 코드 내장.
> 추후 freesound 파일 교체 시 `AudioManager.loadSample(id, url)` 메서드 추가로 dynamic swap 가능.

| ID | Source | Author | License | Local Path | Trigger |
|----|--------|--------|---------|------------|---------|
| harpoon-fire | Web Audio runtime synth (no file) | POP! 프로젝트 | Project-internal | N/A — `src/audio/sfx-synth.ts` | 작살 발사 (input:fire) |
| balloon-pop-small | Web Audio runtime synth (no file) | POP! 프로젝트 | Project-internal | N/A | Small balloon pop (balloon:popped size=Small) |
| balloon-pop-large | Web Audio runtime synth (no file) | POP! 프로젝트 | Project-internal | N/A | Large/Medium balloon pop (balloon:popped size!=Small) |
| critical-pop | Web Audio runtime synth (no file) | POP! 프로젝트 | Project-internal | N/A | Critical pop (criticalPop:fired) |
| combo-up-1 | Web Audio runtime synth (no file) | POP! 프로젝트 | Project-internal | N/A | combo ack 슬롯 (tier 1-4, M0 미사용 방어적 예약) |
| combo-up-2 | Web Audio runtime synth (no file) | POP! 프로젝트 | Project-internal | N/A | Combo 5 milestone (combo:milestone tier=5) |
| combo-up-3 | Web Audio runtime synth (no file) | POP! 프로젝트 | Project-internal | N/A | M1 슬롯 (combo:milestone tier≥10) |
| game-over | Web Audio runtime synth (no file) | POP! 프로젝트 | Project-internal | N/A | Game-over (game:over) |

> **참고**: visual-juice §Audio Note 표가 단일 권위. 위 ID 누락/추가는 GDD 갱신과
> 동시에 진행.

## UI 클릭 (1개 — 선택, freesound)

| ID | Source | Author | License | Local Path | Trigger |
|----|--------|--------|---------|------------|---------|
| ui-click | (선택) freesound.org | TBD | CC0 권장 | `assets/audio/sfx/ui-click.ogg` | RETRY 버튼 등 UI 인터랙션 |

**Pity timer**: 빌드 시점에 ui-click 누락 시 무음 fallback (visual-juice §E9).
