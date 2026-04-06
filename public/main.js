"use strict";
(() => {
    const STORAGE_KEYS = {
        settings: 'gsid.settings.v2',
        bestScore: 'gsid.best-score.v2',
        visitClicks: 'gsid.visit-clicks.v2',
    };
    const DEFAULT_SETTINGS = {
        volume: 0.7,
        difficulty: 'arcade',
        soundEnabled: true,
        animationsEnabled: true,
    };
    const THEMES = [
        {
            name: 'Soft Blue',
            primary: '#6dc8ff',
            secondary: '#83efff',
            danger: '#ff76bb',
            glow: 'rgba(109, 200, 255, 0.48)',
            shadow: '0 0 52px rgba(109, 200, 255, 0.34)',
            backgroundStart: '#06182f',
            backgroundEnd: '#0c3764',
            motionOpacity: 0.22,
            motionSpeed: 15,
        },
        {
            name: 'Purple Surge',
            primary: '#9b79ff',
            secondary: '#d19dff',
            danger: '#ff77df',
            glow: 'rgba(177, 125, 255, 0.5)',
            shadow: '0 0 56px rgba(177, 125, 255, 0.35)',
            backgroundStart: '#180a33',
            backgroundEnd: '#35226d',
            motionOpacity: 0.28,
            motionSpeed: 12,
        },
        {
            name: 'Red Shift',
            primary: '#ff7c72',
            secondary: '#ffb569',
            danger: '#ff445d',
            glow: 'rgba(255, 117, 98, 0.54)',
            shadow: '0 0 60px rgba(255, 117, 98, 0.36)',
            backgroundStart: '#330d17',
            backgroundEnd: '#6b1f30',
            motionOpacity: 0.35,
            motionSpeed: 9,
        },
        {
            name: 'Neon Danger',
            primary: '#e9ff52',
            secondary: '#43ffd1',
            danger: '#ff395f',
            glow: 'rgba(170, 255, 94, 0.58)',
            shadow: '0 0 68px rgba(170, 255, 94, 0.4)',
            backgroundStart: '#170d05',
            backgroundEnd: '#063b34',
            motionOpacity: 0.42,
            motionSpeed: 6,
        },
    ];
    const DIFFICULTIES = {
        casual: {
            label: 'Casual',
            speedBase: 0.92,
            spawnMs: 1380,
            minSpawnMs: 760,
            levelEverySeconds: 18,
        },
        arcade: {
            label: 'Arcade',
            speedBase: 1.06,
            spawnMs: 1220,
            minSpawnMs: 640,
            levelEverySeconds: 13,
        },
        expert: {
            label: 'Expert',
            speedBase: 1.2,
            spawnMs: 1060,
            minSpawnMs: 530,
            levelEverySeconds: 10,
        },
    };
    const SOUND_DEFINITIONS = {
        start: {
            path: './sounds/start.mp3',
            fallback: { frequency: 372, duration: 0.19, type: 'triangle' },
        },
        jump: {
            path: './sounds/jump.mp3',
            fallback: { frequency: 520, duration: 0.13, type: 'square' },
        },
        hit: {
            path: './sounds/hit.mp3',
            fallback: { frequency: 148, duration: 0.28, type: 'sawtooth' },
        },
        click: {
            path: './sounds/click.mp3',
            fallback: { frequency: 640, duration: 0.07, type: 'triangle' },
        },
        levelup: {
            path: './sounds/levelup.mp3',
            fallback: { frequency: 780, duration: 0.22, type: 'triangle' },
        },
    };
    const SPLASH_FALLBACK = `
    <section class="splash-screen" aria-labelledby="splashTitle">
      <div class="splash-noise" aria-hidden="true"></div>
      <div class="splash-card">
        <div class="splash-brand">
          <img src="./images/game-logo.svg" alt="Impossible Dodge logo" class="splash-logo" />
          <div>
            <p class="eyebrow">GamingStunt Presents</p>
            <h2 id="splashTitle">Impossible Dodge</h2>
          </div>
        </div>
        <p class="splash-copy">
          A premium neon runner built for instant play. Tap once to launch, jump over incoming hazards, and chase the color-shifting speed rush.
        </p>
        <div class="splash-actions">
          <button class="tap-cta" id="splashPlayButton" type="button">Tap to Play</button>
          <button class="ghost-action" id="splashSettingsButton" type="button">Open Settings</button>
        </div>
        <div class="splash-points">
          <span>One-touch controls</span>
          <span>Reactive sound</span>
          <span>Dynamic neon difficulty</span>
        </div>
      </div>
    </section>
  `;
    const docEl = document.documentElement;
    const body = document.body;
    function mustGet(id) {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error(`Missing required element #${id}`);
        }
        return element;
    }
    const dom = {
        appShell: mustGet('appShell'),
        sceneShell: mustGet('sceneShell'),
        scene: mustGet('scene'),
        player: mustGet('player'),
        obstacleLayer: mustGet('obstacleLayer'),
        scoreValue: mustGet('scoreValue'),
        bestValue: mustGet('bestValue'),
        levelValue: mustGet('levelValue'),
        speedValue: mustGet('speedValue'),
        themeValue: mustGet('themeValue'),
        soundStateValue: mustGet('soundStateValue'),
        animationStateValue: mustGet('animationStateValue'),
        visitCountValue: mustGet('visitCountValue'),
        statusLabel: mustGet('statusLabel'),
        scenePrompt: mustGet('scenePrompt'),
        settingsButton: mustGet('settingsButton'),
        visitButton: mustGet('visitButton'),
        jumpButton: mustGet('jumpButton'),
        pauseButton: mustGet('pauseButton'),
        restartButton: mustGet('restartButton'),
        overlaySettingsButton: mustGet('overlaySettingsButton'),
        resultOverlay: mustGet('resultOverlay'),
        resultTitle: mustGet('resultTitle'),
        resultText: mustGet('resultText'),
        resultScore: mustGet('resultScore'),
        settingsModal: mustGet('settingsModal'),
        closeSettingsButton: mustGet('closeSettingsButton'),
        saveSettingsButton: mustGet('saveSettingsButton'),
        resetBestButton: mustGet('resetBestButton'),
        volumeSlider: mustGet('volumeSlider'),
        difficultySelect: mustGet('difficultySelect'),
        soundToggle: mustGet('soundToggle'),
        animationToggle: mustGet('animationToggle'),
        splashRoot: mustGet('splashRoot'),
    };
    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }
    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }
    function loadNumber(key, fallback) {
        try {
            const raw = window.localStorage.getItem(key);
            const parsed = raw ? Number(raw) : fallback;
            return Number.isFinite(parsed) ? parsed : fallback;
        }
        catch {
            return fallback;
        }
    }
    function saveNumber(key, value) {
        try {
            window.localStorage.setItem(key, String(value));
        }
        catch {
            // Ignore storage failures inside restricted webviews.
        }
    }
    function loadSettings() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEYS.settings);
            if (!raw) {
                return { ...DEFAULT_SETTINGS };
            }
            const parsed = JSON.parse(raw);
            const difficulty = parsed.difficulty && parsed.difficulty in DIFFICULTIES
                ? parsed.difficulty
                : DEFAULT_SETTINGS.difficulty;
            return {
                volume: clamp(Number(parsed.volume ?? DEFAULT_SETTINGS.volume), 0, 1),
                difficulty,
                soundEnabled: Boolean(parsed.soundEnabled ?? DEFAULT_SETTINGS.soundEnabled),
                animationsEnabled: Boolean(parsed.animationsEnabled ?? DEFAULT_SETTINGS.animationsEnabled),
            };
        }
        catch {
            return { ...DEFAULT_SETTINGS };
        }
    }
    function saveSettings(settings) {
        try {
            window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
        }
        catch {
            // Ignore storage failures inside restricted webviews.
        }
    }
    class SoundManager {
        constructor(initialVolume, enabled) {
            this.audioContext = null;
            this.samples = Object.keys(SOUND_DEFINITIONS).reduce((accumulator, key) => {
                const soundKey = key;
                const definition = SOUND_DEFINITIONS[soundKey];
                const audio = new Audio(definition.path);
                audio.preload = 'auto';
                audio.volume = initialVolume;
                audio.muted = !enabled;
                accumulator[soundKey] = {
                    audio,
                    failed: false,
                    fallback: definition.fallback,
                };
                audio.addEventListener('error', () => {
                    accumulator[soundKey].failed = true;
                });
                try {
                    audio.load();
                }
                catch {
                    accumulator[soundKey].failed = true;
                }
                return accumulator;
            }, {});
        }
        setVolume(volume) {
            Object.keys(this.samples).forEach((key) => {
                this.samples[key].audio.volume = volume;
            });
        }
        setEnabled(enabled) {
            Object.keys(this.samples).forEach((key) => {
                this.samples[key].audio.muted = !enabled;
            });
        }
        unlock() {
            const context = this.getContext();
            if (context && context.state === 'suspended') {
                void context.resume();
            }
        }
        play(key, volumeBoost = 1) {
            if (!state.settings.soundEnabled || state.settings.volume <= 0) {
                return;
            }
            const sample = this.samples[key];
            const targetVolume = clamp(state.settings.volume * volumeBoost, 0, 1);
            if (!sample.failed) {
                const instance = sample.audio.cloneNode(true);
                instance.volume = targetVolume;
                instance.muted = false;
                const playback = instance.play();
                if (playback && typeof playback.catch === 'function') {
                    playback.catch(() => {
                        this.playFallback(sample.fallback, targetVolume);
                    });
                }
                return;
            }
            this.playFallback(sample.fallback, targetVolume);
        }
        getContext() {
            if (this.audioContext) {
                return this.audioContext;
            }
            const AudioContextCtor = window.AudioContext ??
                window
                    .webkitAudioContext;
            if (!AudioContextCtor) {
                return null;
            }
            this.audioContext = new AudioContextCtor();
            return this.audioContext;
        }
        playFallback(fallback, volume) {
            const context = this.getContext();
            if (!context) {
                return;
            }
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const startTime = context.currentTime;
            const endTime = startTime + fallback.duration;
            oscillator.type = fallback.type;
            oscillator.frequency.setValueAtTime(fallback.frequency, startTime);
            oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, fallback.frequency * 0.68), endTime);
            gain.gain.setValueAtTime(0.0001, startTime);
            gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.12), startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(startTime);
            oscillator.stop(endTime);
        }
    }
    const soundManager = new SoundManager(DEFAULT_SETTINGS.volume, DEFAULT_SETTINGS.soundEnabled);
    const state = {
        settings: loadSettings(),
        isPlaying: false,
        isPaused: false,
        pausedByModal: false,
        splashVisible: true,
        lastFrameTime: 0,
        animationFrame: 0,
        elapsedSeconds: 0,
        score: 0,
        bestScore: loadNumber(STORAGE_KEYS.bestScore, 0),
        visitClicks: loadNumber(STORAGE_KEYS.visitClicks, 0),
        level: 1,
        speedMultiplier: 1,
        spawnTimerMs: 640,
        obstacleCounter: 0,
        metrics: {
            width: 0,
            height: 0,
            unit: 7,
            groundHeight: 90,
            floorY: 360,
            playerSize: 58,
            playerX: 72,
            gravity: 1050,
            jumpVelocity: 430,
            baseScrollSpeed: 250,
        },
        player: {
            x: 72,
            y: 0,
            width: 58,
            height: 58,
            velocityY: 0,
            grounded: true,
            rotation: 0,
        },
        obstacles: [],
    };
    function setStatus(message) {
        dom.statusLabel.textContent = message;
    }
    function syncSettingsControls() {
        dom.volumeSlider.value = String(Math.round(state.settings.volume * 100));
        dom.difficultySelect.value = state.settings.difficulty;
        dom.soundToggle.checked = state.settings.soundEnabled;
        dom.animationToggle.checked = state.settings.animationsEnabled;
    }
    function applyAnimationMode() {
        body.classList.toggle('reduced-motion', !state.settings.animationsEnabled);
        dom.animationStateValue.textContent = state.settings.animationsEnabled ? 'On' : 'Off';
        const theme = THEMES[state.level - 1] ?? THEMES[0];
        docEl.style.setProperty('--motion-opacity', state.settings.animationsEnabled ? String(theme.motionOpacity) : '0');
    }
    function applyTheme(level) {
        const theme = THEMES[clamp(level, 1, THEMES.length) - 1];
        docEl.style.setProperty('--bg-start', theme.backgroundStart);
        docEl.style.setProperty('--bg-end', theme.backgroundEnd);
        docEl.style.setProperty('--theme-primary', theme.primary);
        docEl.style.setProperty('--theme-secondary', theme.secondary);
        docEl.style.setProperty('--theme-danger', theme.danger);
        docEl.style.setProperty('--theme-glow', theme.glow);
        docEl.style.setProperty('--theme-shadow', theme.shadow);
        docEl.style.setProperty('--motion-speed', `${theme.motionSpeed}s`);
        docEl.style.setProperty('--motion-opacity', state.settings.animationsEnabled ? String(theme.motionOpacity) : '0');
        dom.appShell.dataset.level = String(level);
        dom.themeValue.textContent = theme.name;
    }
    function updateHud() {
        dom.scoreValue.textContent = String(state.score);
        dom.bestValue.textContent = String(state.bestScore);
        dom.levelValue.textContent = String(state.level);
        dom.speedValue.textContent = `${state.speedMultiplier.toFixed(1)}x`;
        dom.soundStateValue.textContent = state.settings.soundEnabled ? 'On' : 'Off';
        dom.visitCountValue.textContent = String(state.visitClicks);
        dom.pauseButton.textContent = state.isPaused ? 'Resume' : 'Pause';
    }
    function drawPlayer() {
        dom.player.style.width = `${state.player.width}px`;
        dom.player.style.height = `${state.player.height}px`;
        dom.player.style.transform = `translate3d(${state.player.x}px, ${state.player.y}px, 0) rotate(${state.player.rotation}deg)`;
    }
    function drawObstacle(obstacle) {
        obstacle.element.style.width = `${obstacle.width}px`;
        obstacle.element.style.height = `${obstacle.height}px`;
        obstacle.element.style.transform = `translate3d(${obstacle.x}px, ${obstacle.y}px, 0)`;
    }
    function clearObstacles() {
        state.obstacles.forEach((obstacle) => obstacle.element.remove());
        state.obstacles = [];
    }
    function resizeGame() {
        const sceneWidth = dom.sceneShell.clientWidth;
        const desiredHeight = Math.round(clamp(Math.min(window.innerHeight * 0.58, sceneWidth * 0.63), 340, 700));
        docEl.style.setProperty('--scene-height', `${desiredHeight}px`);
        const previousMetrics = { ...state.metrics };
        const previousFloor = previousMetrics.floorY;
        const previousClearance = previousFloor - (state.player.y + state.player.height);
        const sceneHeight = dom.scene.clientHeight || desiredHeight;
        const unit = clamp(Math.min(sceneWidth / 100, sceneHeight / 50), 5.6, 16);
        const groundHeight = unit * 8.6;
        const floorY = sceneHeight - groundHeight;
        const playerSize = unit * 7.4;
        const playerX = sceneWidth * 0.16;
        state.metrics = {
            width: sceneWidth,
            height: sceneHeight,
            unit,
            groundHeight,
            floorY,
            playerSize,
            playerX,
            gravity: unit * 128,
            jumpVelocity: unit * 54,
            baseScrollSpeed: unit * 34,
        };
        docEl.style.setProperty('--ui-scale', (unit / 8).toFixed(2));
        state.player.width = playerSize;
        state.player.height = playerSize;
        state.player.x = playerX;
        state.player.y = floorY - playerSize - clamp(previousClearance, 0, sceneHeight * 0.45);
        if (state.player.grounded || !state.isPlaying) {
            state.player.y = floorY - playerSize;
        }
        state.obstacles.forEach((obstacle) => {
            const widthRatio = previousMetrics.width > 0 ? sceneWidth / previousMetrics.width : 1;
            obstacle.width = obstacle.widthUnits * unit;
            obstacle.height = obstacle.heightUnits * unit;
            obstacle.x *= widthRatio;
            obstacle.y = floorY - obstacle.height;
            drawObstacle(obstacle);
        });
        drawPlayer();
    }
    function updateBestScore(score) {
        if (score <= state.bestScore) {
            return;
        }
        state.bestScore = score;
        saveNumber(STORAGE_KEYS.bestScore, state.bestScore);
    }
    function showResultOverlay(title, description) {
        dom.resultTitle.textContent = title;
        dom.resultText.textContent = description;
        dom.resultScore.textContent = `Final Score: ${state.score}`;
        dom.resultOverlay.classList.remove('hidden');
    }
    function hideResultOverlay() {
        dom.resultOverlay.classList.add('hidden');
    }
    function setSplashVisible(visible) {
        state.splashVisible = visible;
        dom.splashRoot.classList.toggle('hidden', !visible);
        setStatus(visible ? 'Splash screen ready' : state.isPlaying ? 'Run live' : 'Ready to run');
    }
    function applySettings(shouldPersist = true) {
        state.settings.volume = clamp(Number(dom.volumeSlider.value) / 100, 0, 1);
        state.settings.difficulty = dom.difficultySelect.value;
        state.settings.soundEnabled = dom.soundToggle.checked;
        state.settings.animationsEnabled = dom.animationToggle.checked;
        soundManager.setVolume(state.settings.volume);
        soundManager.setEnabled(state.settings.soundEnabled);
        applyAnimationMode();
        applyTheme(state.level);
        updateHud();
        if (shouldPersist) {
            saveSettings(state.settings);
        }
    }
    function openSettings() {
        soundManager.unlock();
        soundManager.play('click');
        if (state.isPlaying && !state.isPaused) {
            state.pausedByModal = true;
            state.isPaused = true;
        }
        syncSettingsControls();
        dom.settingsModal.classList.remove('hidden');
        dom.settingsModal.setAttribute('aria-hidden', 'false');
        setStatus('Settings open');
        updateHud();
    }
    function closeSettings() {
        dom.settingsModal.classList.add('hidden');
        dom.settingsModal.setAttribute('aria-hidden', 'true');
        if (state.pausedByModal) {
            state.isPaused = false;
            state.pausedByModal = false;
            state.lastFrameTime = 0;
            setStatus('Run live');
        }
        else {
            setStatus(state.splashVisible ? 'Splash screen ready' : state.isPlaying ? 'Run live' : 'Ready to run');
        }
        updateHud();
    }
    function jump() {
        if (!state.isPlaying || state.isPaused || !state.player.grounded) {
            return;
        }
        state.player.grounded = false;
        state.player.velocityY = -state.metrics.jumpVelocity;
        dom.scenePrompt.textContent = 'Perfect timing keeps the streak alive.';
        soundManager.play('jump');
    }
    function createObstacle() {
        const unit = state.metrics.unit;
        const roll = Math.random();
        const variant = roll > 0.74 ? 'arc' : roll > 0.42 ? 'tower' : 'block';
        const widthUnits = variant === 'arc' ? randomBetween(6.8, 8.8) : randomBetween(5.1, 8.1);
        const heightUnits = variant === 'tower'
            ? randomBetween(7.4, 11.2)
            : variant === 'arc'
                ? randomBetween(5.1, 6.8)
                : randomBetween(4.8, 6.2);
        const element = document.createElement('div');
        const width = widthUnits * unit;
        const height = heightUnits * unit;
        element.className = `obstacle${variant === 'block' ? '' : ` ${variant}`}`;
        dom.obstacleLayer.appendChild(element);
        const obstacle = {
            id: state.obstacleCounter += 1,
            element,
            variant,
            x: state.metrics.width + width,
            y: state.metrics.floorY - height,
            width,
            height,
            widthUnits,
            heightUnits,
            speedFactor: randomBetween(0.97, 1.16),
        };
        drawObstacle(obstacle);
        state.obstacles.push(obstacle);
    }
    function checkCollision(obstacle) {
        const insetX = state.player.width * 0.14;
        const insetY = state.player.height * 0.1;
        const playerLeft = state.player.x + insetX;
        const playerRight = state.player.x + state.player.width - insetX;
        const playerTop = state.player.y + insetY;
        const playerBottom = state.player.y + state.player.height - insetY;
        const obstacleLeft = obstacle.x + obstacle.width * 0.08;
        const obstacleRight = obstacle.x + obstacle.width - obstacle.width * 0.08;
        const obstacleTop = obstacle.y + obstacle.height * 0.06;
        const obstacleBottom = obstacle.y + obstacle.height;
        return (playerLeft < obstacleRight &&
            playerRight > obstacleLeft &&
            playerTop < obstacleBottom &&
            playerBottom > obstacleTop);
    }
    function endGame() {
        state.isPlaying = false;
        state.isPaused = false;
        state.lastFrameTime = 0;
        updateBestScore(state.score);
        updateHud();
        showResultOverlay('You Crashed', 'Restart instantly and try to push beyond the next color zone.');
        dom.scenePrompt.textContent = 'Tap Play Again to launch a fresh run.';
        soundManager.play('hit', 1.1);
        setStatus('Run over');
    }
    function resetPlayer() {
        state.player.width = state.metrics.playerSize;
        state.player.height = state.metrics.playerSize;
        state.player.x = state.metrics.playerX;
        state.player.y = state.metrics.floorY - state.player.height;
        state.player.velocityY = 0;
        state.player.rotation = 0;
        state.player.grounded = true;
        drawPlayer();
    }
    function startGame() {
        soundManager.unlock();
        clearObstacles();
        resizeGame();
        hideResultOverlay();
        setSplashVisible(false);
        state.isPlaying = true;
        state.isPaused = false;
        state.pausedByModal = false;
        state.lastFrameTime = 0;
        state.elapsedSeconds = 0;
        state.score = 0;
        state.level = 1;
        state.speedMultiplier = DIFFICULTIES[state.settings.difficulty].speedBase;
        state.spawnTimerMs = 480;
        resetPlayer();
        applyTheme(1);
        updateHud();
        dom.scenePrompt.textContent = 'Tap, click, or press Space to jump.';
        setStatus('Run live');
        soundManager.play('start');
        dom.scene.focus();
        cancelAnimationFrame(state.animationFrame);
        state.animationFrame = requestAnimationFrame(gameLoop);
    }
    function togglePause() {
        if (!state.isPlaying) {
            return;
        }
        soundManager.unlock();
        soundManager.play('click');
        state.isPaused = !state.isPaused;
        state.lastFrameTime = 0;
        setStatus(state.isPaused ? 'Paused' : 'Run live');
        updateHud();
    }
    function triggerPrimaryAction() {
        soundManager.unlock();
        if (dom.settingsModal.getAttribute('aria-hidden') === 'false') {
            return;
        }
        if (state.splashVisible || !state.isPlaying) {
            startGame();
            return;
        }
        jump();
    }
    function updateGame(deltaSeconds) {
        const preset = DIFFICULTIES[state.settings.difficulty];
        const previousLevel = state.level;
        state.elapsedSeconds += deltaSeconds;
        state.level = clamp(1 + Math.floor(state.elapsedSeconds / preset.levelEverySeconds), 1, 4);
        state.speedMultiplier = preset.speedBase + state.elapsedSeconds * 0.035 + (state.level - 1) * 0.24;
        state.score = Math.floor(state.elapsedSeconds * 12 * state.speedMultiplier);
        updateBestScore(state.score);
        if (state.level !== previousLevel) {
            applyTheme(state.level);
            soundManager.play('levelup');
            dom.scenePrompt.textContent = `${THEMES[state.level - 1].name} engaged. Speed rising.`;
            setStatus(`Level ${state.level} unlocked`);
        }
        state.spawnTimerMs -= deltaSeconds * 1000;
        if (state.spawnTimerMs <= 0) {
            createObstacle();
            const rawInterval = preset.spawnMs / (1 + state.elapsedSeconds * 0.032);
            state.spawnTimerMs = randomBetween(Math.max(preset.minSpawnMs, rawInterval * 0.88), Math.max(preset.minSpawnMs, rawInterval * 1.12));
        }
        state.player.velocityY += state.metrics.gravity * deltaSeconds;
        state.player.y += state.player.velocityY * deltaSeconds;
        const groundY = state.metrics.floorY - state.player.height;
        if (state.player.y >= groundY) {
            state.player.y = groundY;
            state.player.velocityY = 0;
            state.player.grounded = true;
            state.player.rotation = 0;
        }
        else {
            state.player.rotation = clamp(state.player.velocityY * 0.04, -18, 18);
        }
        drawPlayer();
        const scrollSpeed = state.metrics.baseScrollSpeed * state.speedMultiplier;
        for (let index = state.obstacles.length - 1; index >= 0; index -= 1) {
            const obstacle = state.obstacles[index];
            obstacle.x -= scrollSpeed * obstacle.speedFactor * deltaSeconds;
            drawObstacle(obstacle);
            if (checkCollision(obstacle)) {
                endGame();
                return;
            }
            if (obstacle.x + obstacle.width < -24) {
                obstacle.element.remove();
                state.obstacles.splice(index, 1);
            }
        }
        updateHud();
    }
    function gameLoop(timestamp) {
        if (!state.isPlaying) {
            state.animationFrame = 0;
            return;
        }
        if (state.lastFrameTime === 0) {
            state.lastFrameTime = timestamp;
        }
        const deltaSeconds = Math.min((timestamp - state.lastFrameTime) / 1000, 0.034);
        state.lastFrameTime = timestamp;
        if (state.isPlaying && !state.isPaused) {
            updateGame(deltaSeconds);
        }
        state.animationFrame = requestAnimationFrame(gameLoop);
    }
    function handleVisitClick() {
        soundManager.unlock();
        soundManager.play('click');
        state.visitClicks += 1;
        saveNumber(STORAGE_KEYS.visitClicks, state.visitClicks);
        updateHud();
        setStatus('Opening GamingStunt.com');
        const popup = window.open('https://gamingstunt.com', '_blank', 'noopener,noreferrer');
        if (!popup) {
            window.location.href = 'https://gamingstunt.com';
        }
    }
    async function loadSplashMarkup() {
        try {
            const response = await fetch('./splash.html', { cache: 'no-store' });
            const markup = response.ok ? await response.text() : SPLASH_FALLBACK;
            dom.splashRoot.innerHTML = markup;
        }
        catch {
            dom.splashRoot.innerHTML = SPLASH_FALLBACK;
        }
        const splashPlayButton = dom.splashRoot.querySelector('#splashPlayButton');
        const splashSettingsButton = dom.splashRoot.querySelector('#splashSettingsButton');
        splashPlayButton?.addEventListener('click', () => {
            startGame();
        });
        splashSettingsButton?.addEventListener('click', () => {
            openSettings();
        });
    }
    function bindEvents() {
        window.addEventListener('resize', resizeGame);
        window.addEventListener('keydown', (event) => {
            if (event.code === 'Escape' && dom.settingsModal.getAttribute('aria-hidden') === 'false') {
                event.preventDefault();
                closeSettings();
                return;
            }
            if (event.code === 'KeyP') {
                event.preventDefault();
                togglePause();
                return;
            }
            if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
                event.preventDefault();
                triggerPrimaryAction();
            }
        });
        document.addEventListener('pointerdown', () => {
            soundManager.unlock();
        }, { once: true });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && state.isPlaying) {
                state.isPaused = true;
                state.lastFrameTime = 0;
                updateHud();
                setStatus('Paused while hidden');
            }
        });
        dom.settingsButton.addEventListener('click', openSettings);
        dom.visitButton.addEventListener('click', handleVisitClick);
        dom.jumpButton.addEventListener('click', triggerPrimaryAction);
        dom.pauseButton.addEventListener('click', togglePause);
        dom.restartButton.addEventListener('click', startGame);
        dom.overlaySettingsButton.addEventListener('click', openSettings);
        dom.closeSettingsButton.addEventListener('click', () => {
            soundManager.play('click');
            closeSettings();
        });
        dom.saveSettingsButton.addEventListener('click', () => {
            soundManager.play('click');
            applySettings(true);
            closeSettings();
        });
        dom.resetBestButton.addEventListener('click', () => {
            soundManager.play('click');
            state.bestScore = 0;
            saveNumber(STORAGE_KEYS.bestScore, 0);
            updateHud();
            setStatus('Best score reset');
        });
        dom.volumeSlider.addEventListener('input', () => {
            applySettings(false);
        });
        dom.difficultySelect.addEventListener('change', () => {
            applySettings(true);
            setStatus(`${DIFFICULTIES[state.settings.difficulty].label} mode selected`);
        });
        dom.soundToggle.addEventListener('change', () => {
            applySettings(true);
        });
        dom.animationToggle.addEventListener('change', () => {
            applySettings(true);
        });
        dom.scene.addEventListener('pointerdown', (event) => {
            const target = event.target;
            if (target instanceof HTMLElement && target.closest('button')) {
                return;
            }
            triggerPrimaryAction();
        });
        dom.resultOverlay.addEventListener('pointerdown', (event) => {
            if (event.target === dom.resultOverlay) {
                startGame();
            }
        });
        dom.settingsModal.addEventListener('pointerdown', (event) => {
            if (event.target === dom.settingsModal) {
                closeSettings();
            }
        });
    }
    function initialize() {
        state.settings = loadSettings();
        soundManager.setVolume(state.settings.volume);
        soundManager.setEnabled(state.settings.soundEnabled);
        syncSettingsControls();
        applyAnimationMode();
        applyTheme(1);
        resizeGame();
        resetPlayer();
        updateHud();
        hideResultOverlay();
        dom.settingsModal.setAttribute('aria-hidden', 'true');
        void loadSplashMarkup();
        bindEvents();
    }
    initialize();
})();
