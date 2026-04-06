type SoundKey = 'start' | 'jump' | 'hit' | 'tap' | 'boost';
type Mode = 'intro' | 'loading' | 'playing' | 'gameover';

type SoundSpec = {
  src: string;
  frequency: number;
  duration: number;
  type: OscillatorType;
};

type Star = {
  x: number;
  y: number;
  size: number;
  depth: number;
  alpha: number;
};

type Obstacle = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  speedFactor: number;
};

type Metrics = {
  width: number;
  height: number;
  dpr: number;
  floorY: number;
  playerSize: number;
  playerX: number;
  baseScroll: number;
  gravity: number;
  jumpVelocity: number;
};

type Player = {
  x: number;
  y: number;
  displayY: number;
  width: number;
  height: number;
  velocityY: number;
  grounded: boolean;
  rotation: number;
  displayRotation: number;
};

const BEST_TIME_KEY = 'gsid.best-time-ms.v3';

const SOUND_SPECS: Record<SoundKey, SoundSpec> = {
  start: {
    src: new URL('./sounds/start.mp3', import.meta.url).href,
    frequency: 340,
    duration: 0.2,
    type: 'triangle',
  },
  jump: {
    src: new URL('./sounds/jump.mp3', import.meta.url).href,
    frequency: 560,
    duration: 0.12,
    type: 'square',
  },
  hit: {
    src: new URL('./sounds/hit.mp3', import.meta.url).href,
    frequency: 170,
    duration: 0.28,
    type: 'sawtooth',
  },
  tap: {
    src: new URL('./sounds/click.mp3', import.meta.url).href,
    frequency: 620,
    duration: 0.08,
    type: 'triangle',
  },
  boost: {
    src: new URL('./sounds/levelup.mp3', import.meta.url).href,
    frequency: 760,
    duration: 0.18,
    type: 'triangle',
  },
};

function mustGet<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing required element #${id}`);
  }

  return element as T;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function formatSeconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

function loadBestTime(): number {
  try {
    const value = Number(window.localStorage.getItem(BEST_TIME_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function saveBestTime(value: number): void {
  try {
    window.localStorage.setItem(BEST_TIME_KEY, String(value));
  } catch {
    // Ignore storage failures in sandboxed webviews.
  }
}

function hsl(hue: number, saturation: number, lightness: number, alpha = 1): string {
  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

class AudioBus {
  private readonly samples: Record<SoundKey, HTMLAudioElement>;

  private audioContext: AudioContext | null = null;

  private unlocked = false;

  private volume = 0.74;

  constructor() {
    this.samples = (Object.keys(SOUND_SPECS) as SoundKey[]).reduce((all, key) => {
      const audio = new Audio(SOUND_SPECS[key].src);
      audio.preload = 'auto';
      audio.playsInline = true;
      all[key] = audio;
      return all;
    }, {} as Record<SoundKey, HTMLAudioElement>);

    this.preload();
  }

  preload(): void {
    Object.values(this.samples).forEach((audio) => {
      try {
        audio.load();
      } catch {
        // Ignore invalid asset or blocked preload.
      }
    });
  }

  async unlock(): Promise<void> {
    if (this.unlocked) {
      return;
    }

    const context = this.getContext();

    if (context && context.state === 'suspended') {
      await context.resume();
    }

    if (context) {
      const buffer = context.createBuffer(1, 1, 22050);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start(0);
    }

    await Promise.allSettled(
      Object.values(this.samples).map(async (audio) => {
        try {
          audio.muted = true;
          audio.currentTime = 0;
          await audio.play();
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        } catch {
          // iOS webviews may reject HTMLAudio. Oscillator fallback remains active.
        }
      }),
    );

    this.unlocked = true;
  }

  play(key: SoundKey, boost = 1): void {
    const volume = clamp(this.volume * boost, 0, 1);
    const sample = this.samples[key];

    if (this.unlocked) {
      try {
        const clone = sample.cloneNode(true) as HTMLAudioElement;
        clone.playsInline = true;
        clone.volume = volume;
        clone.currentTime = 0;
        const playback = clone.play();

        if (playback && typeof playback.catch === 'function') {
          playback.catch(() => {
            this.playTone(key, volume);
          });
        }

        return;
      } catch {
        // Fall through to tone playback.
      }
    }

    this.playTone(key, volume);
  }

  private getContext(): AudioContext | null {
    if (this.audioContext) {
      return this.audioContext;
    }

    const Ctor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!Ctor) {
      return null;
    }

    this.audioContext = new Ctor();
    return this.audioContext;
  }

  private playTone(key: SoundKey, volume: number): void {
    const context = this.getContext();

    if (!context) {
      return;
    }

    if (context.state === 'suspended') {
      void context.resume();
    }

    const spec = SOUND_SPECS[key];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;
    const end = start + spec.duration;

    oscillator.type = spec.type;
    oscillator.frequency.setValueAtTime(spec.frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(100, spec.frequency * 0.74), end);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.12), start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end);
  }
}

const appShell = mustGet<HTMLDivElement>('appShell');
const menuShell = mustGet<HTMLElement>('menuShell');
const sceneWrap = mustGet<HTMLDivElement>('sceneWrap');
const canvas = mustGet<HTMLCanvasElement>('gameCanvas');
const splashRoot = mustGet<HTMLElement>('splashRoot');
const playButton = mustGet<HTMLButtonElement>('playButton');
const playStatus = mustGet<HTMLElement>('playStatus');
const visitButton = mustGet<HTMLButtonElement>('visitButton');
const timeValue = mustGet<HTMLElement>('timeValue');
const speedValue = mustGet<HTMLElement>('speedValue');
const exitButton = mustGet<HTMLButtonElement>('exitButton');
const resultChip = mustGet<HTMLDivElement>('resultChip');
const resultTitle = mustGet<HTMLElement>('resultTitle');
const resultMeta = mustGet<HTMLElement>('resultMeta');
const context = canvas.getContext('2d');

if (!context) {
  throw new Error('Could not create 2D canvas context.');
}

const sound = new AudioBus();

const stars: Star[] = Array.from({ length: 36 }, () => ({
  x: Math.random(),
  y: Math.random(),
  size: randomBetween(1.4, 4.4),
  depth: randomBetween(0.35, 1),
  alpha: randomBetween(0.24, 0.82),
}));

const state = {
  mode: 'intro' as Mode,
  lastTimestamp: 0,
  raf: 0,
  obstacleId: 0,
  bestTimeMs: loadBestTime(),
  survivalMs: 0,
  speed: 1,
  hueShift: 0,
  spawnTimer: 0.9,
  lastBoostBand: 0,
  metrics: {
    width: 0,
    height: 0,
    dpr: 1,
    floorY: 0,
    playerSize: 48,
    playerX: 88,
    baseScroll: 280,
    gravity: 1400,
    jumpVelocity: 620,
  } as Metrics,
  player: {
    x: 88,
    y: 0,
    displayY: 0,
    width: 48,
    height: 48,
    velocityY: 0,
    grounded: true,
    rotation: 0,
    displayRotation: 0,
  } as Player,
  obstacles: [] as Obstacle[],
};

function setViewportVars(): void {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  document.documentElement.style.setProperty('--vh-safe', `${viewportHeight * 0.01}px`);
  document.documentElement.style.setProperty('--vw-safe', `${viewportWidth * 0.01}px`);
}

function setPlayMode(enabled: boolean): void {
  document.body.classList.toggle('play-mode', enabled);
  menuShell.setAttribute('aria-hidden', enabled ? 'true' : 'false');
}

function updateHud(): void {
  timeValue.textContent = formatSeconds(state.survivalMs);
  speedValue.textContent = `${state.speed.toFixed(2)}x`;
}

function updateTheme(): void {
  const hueA = 204 + state.hueShift;
  const hueB = 322 - state.hueShift * 0.42;
  const accentA = 188 + state.hueShift * 0.55;
  const accentB = 330 - state.hueShift * 0.28;

  appShell.style.setProperty('--bg-a', hsl(hueA, 84, 10));
  appShell.style.setProperty('--bg-b', hsl(hueA + 18, 88, 15));
  appShell.style.setProperty('--bg-c', hsl(hueB, 88, 16));
  appShell.style.setProperty('--accent-a', hsl(accentA, 92, 70));
  appShell.style.setProperty('--accent-b', hsl(accentB, 92, 68));
}

function resizeScene(): void {
  const previousWidth = state.metrics.width;
  const previousHeight = state.metrics.height;
  const width = Math.max(320, Math.round(sceneWrap.clientWidth));
  const height = Math.max(320, Math.round(sceneWrap.clientHeight));
  const dpr = clamp(window.devicePixelRatio || 1, 1, 2);

  state.metrics = {
    width,
    height,
    dpr,
    floorY: height - clamp(height * 0.16, 62, 120),
    playerSize: clamp(Math.min(width, height) * 0.09, 38, 66),
    playerX: clamp(width * 0.22, 58, 180),
    baseScroll: clamp(width * 0.46, 240, 620),
    gravity: clamp(height * 3.25, 980, 1820),
    jumpVelocity: clamp(height * 0.94, 360, 760),
  };

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const groundedY = state.metrics.floorY - state.player.height;
  state.player.width = state.metrics.playerSize;
  state.player.height = state.metrics.playerSize;
  state.player.x = state.metrics.playerX;

  if (state.mode === 'intro' || state.player.grounded) {
    state.player.y = groundedY;
    state.player.displayY = groundedY;
  } else if (previousWidth > 0 && previousHeight > 0) {
    const widthRatio = width / previousWidth;
    const heightRatio = height / previousHeight;
    state.player.y *= heightRatio;
    state.player.displayY *= heightRatio;

    state.obstacles.forEach((obstacle) => {
      obstacle.x *= widthRatio;
      obstacle.y = state.metrics.floorY - obstacle.height;
    });
  }

  updateTheme();
}

function resetPlayer(): void {
  state.player.width = state.metrics.playerSize;
  state.player.height = state.metrics.playerSize;
  state.player.x = state.metrics.playerX;
  state.player.y = state.metrics.floorY - state.player.height;
  state.player.displayY = state.player.y;
  state.player.velocityY = 0;
  state.player.grounded = true;
  state.player.rotation = 0;
  state.player.displayRotation = 0;
}

function resetRound(): void {
  state.survivalMs = 0;
  state.speed = 1;
  state.hueShift = 0;
  state.spawnTimer = 0.75;
  state.lastBoostBand = 0;
  state.obstacles = [];
  resetPlayer();
  updateHud();
  updateTheme();
  resultChip.classList.add('hidden');
}

function setSplashLoading(isLoading: boolean): void {
  splashRoot.classList.toggle('arming', isLoading);
  playButton.disabled = isLoading;
  playStatus.textContent = isLoading ? 'Get Ready...' : 'Tap to Start';
}

function queueNextSpawn(): void {
  const ramp = clamp(state.survivalMs / 18000, 0, 1);
  const base = lerp(1.04, 0.4, ramp);
  state.spawnTimer = base * randomBetween(0.82, 1.12);
}

function spawnObstacle(): void {
  const height = randomBetween(state.metrics.playerSize * 0.78, state.metrics.playerSize * 1.7);
  const width = randomBetween(state.metrics.playerSize * 0.7, state.metrics.playerSize * 1.34);

  state.obstacles.push({
    id: state.obstacleId += 1,
    x: state.metrics.width + width + randomBetween(12, 72),
    y: state.metrics.floorY - height,
    width,
    height,
    radius: clamp(width * 0.24, 8, 22),
    speedFactor: randomBetween(0.94, 1.14),
  });
}

function jump(): void {
  if (state.mode !== 'playing' || !state.player.grounded) {
    return;
  }

  state.player.grounded = false;
  state.player.velocityY = -state.metrics.jumpVelocity;
  sound.play('jump', 1.04);
}

function startRun(): void {
  state.mode = 'playing';
  setPlayMode(true);
  resetRound();
  sound.play('start', 1.06);
}

function restartRun(): void {
  startRun();
}

function exitRun(): void {
  state.mode = 'intro';
  state.lastTimestamp = 0;
  setPlayMode(false);
  setSplashLoading(false);
  resetRound();
}

function collide(obstacle: Obstacle): boolean {
  const insetX = state.player.width * 0.18;
  const insetY = state.player.height * 0.14;
  const playerLeft = state.player.x + insetX;
  const playerRight = state.player.x + state.player.width - insetX;
  const playerTop = state.player.y + insetY;
  const playerBottom = state.player.y + state.player.height - insetY;
  const obstacleLeft = obstacle.x + obstacle.width * 0.1;
  const obstacleRight = obstacle.x + obstacle.width - obstacle.width * 0.1;
  const obstacleTop = obstacle.y + obstacle.height * 0.08;
  const obstacleBottom = obstacle.y + obstacle.height;

  return (
    playerLeft < obstacleRight &&
    playerRight > obstacleLeft &&
    playerTop < obstacleBottom &&
    playerBottom > obstacleTop
  );
}

function handleCrash(): void {
  state.mode = 'gameover';
  state.bestTimeMs = Math.max(state.bestTimeMs, state.survivalMs);
  saveBestTime(state.bestTimeMs);
  sceneWrap.classList.remove('camera-hit');
  void sceneWrap.offsetWidth;
  sceneWrap.classList.add('camera-hit');
  resultTitle.textContent = 'Run Over';
  resultMeta.textContent = `Survived ${formatSeconds(state.survivalMs)}. Best ${formatSeconds(state.bestTimeMs)}. Tap anywhere to restart instantly.`;
  resultChip.classList.remove('hidden');
  sound.play('hit', 1.12);

  window.setTimeout(() => {
    sceneWrap.classList.remove('camera-hit');
  }, 360);
}

function handlePrimaryAction(): void {
  if (state.mode === 'intro') {
    void beginFromSplash();
    return;
  }

  if (state.mode === 'loading') {
    return;
  }

  if (state.mode === 'gameover') {
    restartRun();
    return;
  }

  jump();
}

async function beginFromSplash(): Promise<void> {
  if (state.mode !== 'intro') {
    return;
  }

  state.mode = 'loading';
  setSplashLoading(true);
  await sound.unlock();
  sound.play('tap');

  window.setTimeout(() => {
    setSplashLoading(false);
    startRun();
  }, 200);
}

function updateGameplay(deltaSeconds: number): void {
  state.survivalMs += deltaSeconds * 1000;
  state.speed = 1 + Math.min(4.75, state.survivalMs / 8200);
  state.hueShift = Math.min(92, (state.speed - 1) * 26 + Math.sin(state.survivalMs / 1800) * 6);
  updateTheme();

  const boostBand = Math.floor((state.speed - 1) / 0.9);

  if (boostBand > state.lastBoostBand) {
    state.lastBoostBand = boostBand;
    sound.play('boost', 0.9);
  }

  state.spawnTimer -= deltaSeconds;

  if (state.spawnTimer <= 0) {
    spawnObstacle();
    queueNextSpawn();
  }

  state.player.velocityY += state.metrics.gravity * deltaSeconds;
  state.player.y += state.player.velocityY * deltaSeconds;

  const groundedY = state.metrics.floorY - state.player.height;

  if (state.player.y >= groundedY) {
    state.player.y = groundedY;
    state.player.velocityY = 0;
    state.player.grounded = true;
    state.player.rotation = 0;
  } else {
    state.player.rotation = clamp(state.player.velocityY * 0.028, -16, 20);
  }

  const scrollSpeed = state.metrics.baseScroll * state.speed;

  for (let index = state.obstacles.length - 1; index >= 0; index -= 1) {
    const obstacle = state.obstacles[index];
    obstacle.x -= scrollSpeed * obstacle.speedFactor * deltaSeconds;

    if (collide(obstacle)) {
      handleCrash();
      return;
    }

    if (obstacle.x + obstacle.width < -40) {
      state.obstacles.splice(index, 1);
    }
  }

  state.player.displayY = lerp(state.player.displayY, state.player.y, 1 - Math.exp(-18 * deltaSeconds));
  state.player.displayRotation = lerp(
    state.player.displayRotation,
    state.player.rotation,
    1 - Math.exp(-18 * deltaSeconds),
  );

  updateHud();
}

function updateStars(deltaSeconds: number): void {
  const multiplier = state.mode === 'playing' ? state.speed : 1;

  stars.forEach((star) => {
    star.x -= deltaSeconds * (0.04 + star.depth * 0.18) * multiplier;

    if (star.x < -0.08) {
      star.x = 1.08;
      star.y = Math.random();
      star.size = randomBetween(1.4, 4.4);
      star.depth = randomBetween(0.35, 1);
      star.alpha = randomBetween(0.24, 0.82);
    }
  });
}

function updateIdle(deltaSeconds: number): void {
  updateStars(deltaSeconds);
  const groundedY = state.metrics.floorY - state.player.height;
  const hover = Math.sin(performance.now() / 460) * 6;
  state.player.y = groundedY + hover;
  state.player.displayY = lerp(state.player.displayY, state.player.y, 1 - Math.exp(-9 * deltaSeconds));
  state.player.rotation = Math.sin(performance.now() / 520) * 2;
  state.player.displayRotation = lerp(
    state.player.displayRotation,
    state.player.rotation,
    1 - Math.exp(-9 * deltaSeconds),
  );
}

function drawBackground(): void {
  const width = state.metrics.width;
  const height = state.metrics.height;
  const topHue = 204 + state.hueShift;
  const bottomHue = 324 - state.hueShift * 0.44;

  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, hsl(topHue, 86, 10));
  gradient.addColorStop(0.56, hsl(topHue + 18, 84, 15));
  gradient.addColorStop(1, hsl(bottomHue, 88, 16));
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const bloom = context.createRadialGradient(
    width * 0.5,
    height * 0.3,
    20,
    width * 0.5,
    height * 0.3,
    width * 0.56,
  );
  bloom.addColorStop(0, hsl(184 + state.hueShift * 0.45, 90, 72, 0.3));
  bloom.addColorStop(0.45, hsl(214 + state.hueShift * 0.2, 88, 60, 0.14));
  bloom.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = bloom;
  context.fillRect(0, 0, width, height);

  stars.forEach((star) => {
    context.fillStyle = hsl(188 + state.hueShift * 0.35, 88, 80, star.alpha);
    context.beginPath();
    context.arc(star.x * width, star.y * height * 0.78, star.size, 0, Math.PI * 2);
    context.fill();
  });

  context.save();
  context.translate(0, height * 0.55);
  context.strokeStyle = hsl(186 + state.hueShift * 0.3, 90, 76, 0.22);
  context.lineWidth = 1;

  for (let x = -width; x <= width * 2; x += 40) {
    const offset = (performance.now() * 0.03 * Math.max(1, state.speed)) % 40;
    context.beginPath();
    context.moveTo(x - offset, 0);
    context.lineTo(width / 2, height * 0.36);
    context.stroke();
  }

  for (let y = 0; y < height * 0.4; y += 28) {
    const ratio = y / (height * 0.4);
    context.globalAlpha = 0.18 - ratio * 0.12;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  context.restore();

  const groundGlow = context.createLinearGradient(0, state.metrics.floorY - 60, 0, height);
  groundGlow.addColorStop(0, hsl(180 + state.hueShift * 0.42, 88, 66, 0.08));
  groundGlow.addColorStop(1, hsl(220 + state.hueShift * 0.18, 52, 8, 0.94));
  context.fillStyle = groundGlow;
  context.fillRect(0, state.metrics.floorY - 60, width, height - state.metrics.floorY + 60);

  context.strokeStyle = hsl(186 + state.hueShift * 0.34, 90, 76, 0.46);
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, state.metrics.floorY + 1);
  context.lineTo(width, state.metrics.floorY + 1);
  context.stroke();
}

function drawObstacles(): void {
  state.obstacles.forEach((obstacle) => {
    const gradient = context.createLinearGradient(
      obstacle.x,
      obstacle.y,
      obstacle.x,
      obstacle.y + obstacle.height,
    );
    gradient.addColorStop(0, hsl(26 + state.hueShift * 0.1, 92, 72));
    gradient.addColorStop(1, hsl(348 - state.hueShift * 0.14, 88, 58));

    context.shadowColor = hsl(350, 88, 60, 0.56);
    context.shadowBlur = 18;
    roundedRectPath(
      context,
      obstacle.x,
      obstacle.y,
      obstacle.width,
      obstacle.height,
      obstacle.radius,
    );
    context.fillStyle = gradient;
    context.fill();

    context.shadowBlur = 0;
    roundedRectPath(
      context,
      obstacle.x + obstacle.width * 0.14,
      obstacle.y + obstacle.height * 0.12,
      obstacle.width * 0.32,
      obstacle.height * 0.12,
      obstacle.radius * 0.4,
    );
    context.fillStyle = 'rgba(255, 255, 255, 0.22)';
    context.fill();
  });
}

function drawPlayer(): void {
  const width = state.player.width;
  const height = state.player.height;

  context.save();
  context.translate(state.player.x + width / 2, state.player.displayY + height / 2);
  context.rotate((state.player.displayRotation * Math.PI) / 180);
  context.translate(-width / 2, -height / 2);

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, hsl(188 + state.hueShift * 0.42, 92, 72));
  gradient.addColorStop(1, hsl(322 - state.hueShift * 0.18, 90, 68));

  context.shadowColor = hsl(188 + state.hueShift * 0.38, 90, 68, 0.72);
  context.shadowBlur = 24;
  roundedRectPath(context, 0, 0, width, height, width * 0.2);
  context.fillStyle = gradient;
  context.fill();

  context.shadowBlur = 0;
  roundedRectPath(context, width * 0.18, height * 0.18, width * 0.64, height * 0.64, width * 0.15);
  context.fillStyle = 'rgba(255, 255, 255, 0.28)';
  context.fill();

  context.restore();
}

function render(): void {
  context.setTransform(state.metrics.dpr, 0, 0, state.metrics.dpr, 0, 0);
  context.clearRect(0, 0, state.metrics.width, state.metrics.height);
  drawBackground();
  drawObstacles();
  drawPlayer();
}

function tick(timestamp: number): void {
  if (!state.lastTimestamp) {
    state.lastTimestamp = timestamp;
  }

  const deltaSeconds = Math.min((timestamp - state.lastTimestamp) / 1000, 0.033);
  state.lastTimestamp = timestamp;

  updateStars(deltaSeconds);

  if (state.mode === 'playing') {
    updateGameplay(deltaSeconds);
  } else if (state.mode === 'intro' || state.mode === 'loading') {
    updateIdle(deltaSeconds);
  } else if (state.mode === 'gameover') {
    state.player.displayY = lerp(state.player.displayY, state.player.y, 1 - Math.exp(-14 * deltaSeconds));
    state.player.displayRotation = lerp(
      state.player.displayRotation,
      14,
      1 - Math.exp(-8 * deltaSeconds),
    );
  }

  render();
  state.raf = window.requestAnimationFrame(tick);
}

function openVisit(): void {
  sound.play('tap');
  const popup = window.open('https://gamingstunt.com', '_blank', 'noopener,noreferrer');

  if (!popup) {
    window.location.href = 'https://gamingstunt.com';
  }
}

function bindEvents(): void {
  const unlock = (): void => {
    void sound.unlock();
  };

  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('touchend', unlock, { passive: true });
  document.addEventListener('keydown', unlock);

  const resize = (): void => {
    setViewportVars();
    resizeScene();
  };

  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);

  window.addEventListener(
    'touchmove',
    (event) => {
      event.preventDefault();
    },
    { passive: false },
  );

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mode === 'playing') {
      state.mode = 'gameover';
      resultTitle.textContent = 'Paused';
      resultMeta.textContent = 'Tap anywhere to jump back in instantly.';
      resultChip.classList.remove('hidden');
    }
  });

  playButton.addEventListener('click', () => {
    void beginFromSplash();
  });

  visitButton.addEventListener('click', openVisit);

  exitButton.addEventListener('click', () => {
    sound.play('tap');
    exitRun();
  });

  sceneWrap.addEventListener('pointerdown', (event) => {
    const target = event.target;

    if (target instanceof HTMLElement && target.closest('#exitButton')) {
      return;
    }

    handlePrimaryAction();
  });

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
      event.preventDefault();
      handlePrimaryAction();
    }

    if (event.code === 'Escape') {
      event.preventDefault();

      if (state.mode === 'playing' || state.mode === 'gameover') {
        exitRun();
      }
    }
  });
}

function init(): void {
  setViewportVars();
  resizeScene();
  resetRound();
  setPlayMode(false);
  updateHud();
  updateTheme();
  bindEvents();
  state.raf = window.requestAnimationFrame(tick);
}

init();
