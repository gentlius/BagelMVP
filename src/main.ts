import { Application, Container } from 'pixi.js';
import { GameLoop } from './systems/game-loop.js';
import { attachHUD } from './ui/hud.js';
import { attachAboutModal } from './ui/about-modal.js';
import { audioManager } from './audio/audio-manager.js';
import { eventBus } from './events/event-bus.js';
import { createFrostedSkyBackground } from './vfx/background.js';

/**
 * POP! Game Engine Bootstrap
 *
 * Initializes Pixi.js v8 application with 5-layer container hierarchy:
 * L1: bgContainer (background elements)
 * L2: balloonContainer (balloon entities)
 * L3: harpoonContainer (harpoon projectiles)
 * L4: vfxContainer (visual effects, particles)
 * L5: uiContainer (HUD text, buttons)
 *
 * Phase 2: GameLoop wired to Ticker. 5 systems instantiated via GameLoop.init().
 * Phase 3: ui-programmer adds HUD to uiContainer; sound-designer assigns globalThis.audioManager.
 */
async function bootstrap() {
  const app = new Application();

  // Initialize Pixi with device pixel ratio for Retina displays
  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    resolution: window.devicePixelRatio,
    autoDensity: true,
    background: '#B5D8E8', // Frosted Sky (art-bible §1.2)
    antialias: false, // Mobile performance priority
  });

  // Mount canvas to DOM
  const gameContainer = document.getElementById('game');
  if (!gameContainer) {
    throw new Error('Game container element not found');
  }
  gameContainer.appendChild(app.canvas);

  // Create 5-layer container hierarchy
  const bgContainer = new Container();
  const balloonContainer = new Container();
  const harpoonContainer = new Container();
  const vfxContainer = new Container();
  const uiContainer = new Container();

  app.stage.addChild(bgContainer);
  // Frosted Sky 3색 그라데이션 (art-bible §6 + D-P6-TA-04). bgContainer L1.
  // app.init({ background }) 단색은 fallback — sky sprite가 덮어씀.
  bgContainer.addChild(createFrostedSkyBackground(app));
  app.stage.addChild(balloonContainer);
  app.stage.addChild(harpoonContainer);
  app.stage.addChild(vfxContainer);
  app.stage.addChild(uiContainer);

  // Handle window resize
  window.addEventListener('resize', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
  });

  // Initialize Ticker (Pixi game loop — autoStart true by default)
  app.ticker.autoStart = true;

  // Log successful initialization
  console.log('POP! Engine initialized', {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio,
    containers: 5,
    background: '#B5D8E8',
  });

  return {
    app,
    containers: {
      bgContainer,
      balloonContainer,
      harpoonContainer,
      vfxContainer,
      uiContainer,
    },
  };
}

// Start bootstrap → wire GameLoop → start game
bootstrap()
  .then(({ app, containers }) => {
    // Audio: register globally (GameLoop unlock hook) + EventBus listeners
    (globalThis as unknown as { audioManager: typeof audioManager }).audioManager = audioManager;
    audioManager.attachListeners(eventBus);

    const gameLoop = new GameLoop(app, containers);
    gameLoop.init();

    // HUD overlay (uiContainer L4) — listens to score/combo/game:over events
    attachHUD(containers.uiContainer, app);

    // D-P6-BGM-02 (사용자): About 버튼 + 모달 + pause/resume (크레딧)
    // uiContainer sortableChildren 활성 — 버튼/모달 zIndex 50/100이 HUD 위에 표시되도록
    containers.uiContainer.sortableChildren = true;
    attachAboutModal({
      uiContainer: containers.uiContainer,
      app,
      pause: () => gameLoop.pause(),
      resume: () => gameLoop.resume(),
    });

    gameLoop.start();
  })
  .catch((err) => {
    // D-06: DOM fallback — no process.exit() in browser context
    console.error('Failed to initialize POP! engine:', err);
    const fallback = document.getElementById('game');
    if (fallback) {
      const msg = err instanceof Error ? err.message : String(err);
      fallback.innerHTML = `<pre style="color:#900;padding:1rem;font-family:monospace;">POP! init failed: ${msg}</pre>`;
    }
  });
