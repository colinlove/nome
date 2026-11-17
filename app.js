/**
 * ClockSync Metronome
 * Device-clock synchronized metronome with guaranteed downbeat at :00.000 of every minute.
 */

(() => {
  'use strict';

  // --- State Configuration ---
  const state = {
    bpm: 120,
    beatsPerBar: 4,
    isPlaying: false,
    theme: 'dark',
    vizMode: 'auto', // 'auto' | 'ball' | 'circle' | 'both'
    strobeMode: 'all', // 'all' | 'downbeat' | 'subtle' | 'off'
    soundType: 'woodblock', // 'woodblock' | 'beep' | 'mechanical' | 'drum' | 'silent'
    volume: 0.85,
    calibrationOffsetMs: 0,
    
    // Runtime trackers
    lastBeatIndex: -1,
    lastMinuteTimestamp: 0,
    tapTimes: []
  };

  // Tempo markings table
  const TEMPO_MARKINGS = [
    { max: 40, label: 'Grave' },
    { max: 60, label: 'Largo' },
    { max: 66, label: 'Larghetto' },
    { max: 76, label: 'Adagio' },
    { max: 108, label: 'Andante' },
    { max: 120, label: 'Moderato' },
    { max: 168, label: 'Allegro' },
    { max: 200, label: 'Presto' },
    { max: 300, label: 'Prestissimo' }
  ];

  function getTempoMarking(bpm) {
    for (const item of TEMPO_MARKINGS) {
      if (bpm <= item.max) return item.label;
    }
    return 'Prestissimo';
  }

  // --- DOM Elements ---
  const el = {
    body: document.body,
    strobeOverlay: document.getElementById('strobe-overlay'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    themeSunIcon: document.getElementById('theme-sun-icon'),
    themeMoonIcon: document.getElementById('theme-moon-icon'),
    infoModalBtn: document.getElementById('info-modal-btn'),
    infoModal: document.getElementById('info-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    modalOkBtn: document.getElementById('modal-ok-btn'),
    deviceClock: document.getElementById('device-clock'),

    // Viz
    vizTabs: document.querySelectorAll('.viz-tab'),
    circlePanel: document.getElementById('circle-panel'),
    ballPanel: document.getElementById('ball-panel'),
    circleProgress: document.getElementById('circle-progress'),
    circleSegments: document.getElementById('circle-segments'),
    centerBeatNumber: document.getElementById('center-beat-number'),
    centerBeatLabel: document.getElementById('center-beat-label'),
    centerMsRemaining: document.getElementById('center-ms-remaining'),
    ballCanvas: document.getElementById('ball-canvas'),
    beatDotsContainer: document.getElementById('beat-dots-container'),

    // Tempo controls
    bpmInput: document.getElementById('bpm-input'),
    bpmSlider: document.getElementById('bpm-slider'),
    tempoMarking: document.getElementById('tempo-marking'),
    bpmMinus5: document.getElementById('bpm-minus-5'),
    bpmMinus1: document.getElementById('bpm-minus-1'),
    bpmPlus1: document.getElementById('bpm-plus-1'),
    bpmPlus5: document.getElementById('bpm-plus-5'),

    // Meter controls
    segButtons: document.querySelectorAll('.seg-btn'),

    // Play action
    playBtn: document.getElementById('play-btn'),
    playIcon: document.getElementById('play-icon'),
    stopIcon: document.getElementById('stop-icon'),
    playBtnText: document.getElementById('play-btn-text'),

    // Settings drawer
    drawerToggleBtn: document.getElementById('drawer-toggle-btn'),
    drawerContent: document.getElementById('drawer-content'),
    strobeSelect: document.getElementById('strobe-select'),
    soundSelect: document.getElementById('sound-select'),
    volumeSlider: document.getElementById('volume-slider'),
    volumeValText: document.getElementById('volume-val-text'),
    tapTempoBtn: document.getElementById('tap-tempo-btn'),
    offsetMinus10: document.getElementById('offset-minus-10'),
    offsetZero: document.getElementById('offset-zero'),
    offsetPlus10: document.getElementById('offset-plus-10'),
    offsetVal: document.getElementById('offset-val'),

    // Diagnostics
    diagMinElapsed: document.getElementById('diag-min-elapsed'),
    diagBeatInMin: document.getElementById('diag-beat-in-min'),
    diagNextMin: document.getElementById('diag-next-min')
  };

  // Canvas 2D context
  const ctx = el.ballCanvas.getContext('2d');

  // SVG circle calculation
  const CIRCLE_RADIUS = 82;
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

  // --- Web Audio Engine ---
  let audioCtx = null;
  const scheduledBeats = new Set();
  let audioSchedulerTimer = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // Synthesizes click sounds at a precise AudioContext target time
  function scheduleAudioClick(time, isDownbeat) {
    if (!audioCtx || state.soundType === 'silent') return;

    const gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);

    const baseVolume = state.volume;
    const peakVolume = isDownbeat ? baseVolume : baseVolume * 0.7;

    switch (state.soundType) {
      case 'beep': {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isDownbeat ? 1400 : 880, time);
        
        gainNode.gain.setValueAtTime(peakVolume, time);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

        osc.connect(gainNode);
        osc.start(time);
        osc.stop(time + 0.055);
        break;
      }

      case 'mechanical': {
        // High click transient
        const osc = audioCtx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(isDownbeat ? 1200 : 700, time);
        osc.frequency.exponentialRampToValueAtTime(80, time + 0.02);

        gainNode.gain.setValueAtTime(peakVolume, time);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);

        osc.connect(gainNode);
        osc.start(time);
        osc.stop(time + 0.04);
        break;
      }

      case 'drum': {
        if (isDownbeat) {
          // Punchy electronic kick
          const osc = audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(150, time);
          osc.frequency.exponentialRampToValueAtTime(40, time + 0.07);

          gainNode.gain.setValueAtTime(peakVolume, time);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);

          osc.connect(gainNode);
          osc.start(time);
          osc.stop(time + 0.085);
        } else {
          // Crisp hi-hat tick using filtered noise or high sine
          const osc = audioCtx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(2200, time);
          osc.frequency.exponentialRampToValueAtTime(800, time + 0.025);

          gainNode.gain.setValueAtTime(peakVolume * 0.7, time);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.028);

          osc.connect(gainNode);
          osc.start(time);
          osc.stop(time + 0.03);
        }
        break;
      }

      case 'woodblock':
      default: {
        // Resonant woodblock sound with harmonic overtone
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();

        const fundamental = isDownbeat ? 1250 : 800;
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(fundamental, time);
        osc1.frequency.exponentialRampToValueAtTime(fundamental * 0.7, time + 0.035);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(fundamental * 1.6, time);
        osc2.frequency.exponentialRampToValueAtTime(fundamental * 0.9, time + 0.02);

        gainNode.gain.setValueAtTime(peakVolume, time);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, time + (isDownbeat ? 0.05 : 0.035));

        osc1.connect(gainNode);
        osc2.connect(gainNode);

        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + 0.055);
        osc2.stop(time + 0.055);
        break;
      }
    }
  }

  // Look-ahead audio scheduler loop synced directly to wall clock
  function audioSchedulerLoop() {
    if (!state.isPlaying || !audioCtx) return;

    const nowWall = Date.now() + state.calibrationOffsetMs;
    const nowAudio = audioCtx.currentTime;
    const beatInterval = 60000 / state.bpm;

    // Look ahead 100ms
    const lookaheadWall = nowWall + 100;

    // Minute boundaries for scanning beats
    const minMinute = nowWall - (nowWall % 60000);
    const maxMinute = lookaheadWall - (lookaheadWall % 60000);

    for (let minuteStart = minMinute; minuteStart <= maxMinute; minuteStart += 60000) {
      for (let k = 0; k < state.bpm; k++) {
        const beatWallTime = minuteStart + (k * beatInterval);

        // Check if beat falls within upcoming lookahead window
        if (beatWallTime >= nowWall - 15 && beatWallTime <= lookaheadWall) {
          const beatKey = `${minuteStart}_${k}`;
          if (!scheduledBeats.has(beatKey)) {
            scheduledBeats.add(beatKey);

            // Clean up older keys to keep set small
            if (scheduledBeats.size > 200) {
              const oldIter = scheduledBeats.values();
              for (let i = 0; i < 50; i++) scheduledBeats.delete(oldIter.next().value);
            }

            const isDownbeat = (k % state.beatsPerBar === 0);
            const delaySec = (beatWallTime - nowWall) / 1000;
            const targetAudioTime = Math.max(nowAudio, nowAudio + delaySec);

            scheduleAudioClick(targetAudioTime, isDownbeat);
          }
        }
      }
    }
  }

  // --- Clock Sync Calculation ---
  function getClockState(customNow = null) {
    const wallTime = (customNow !== null ? customNow : Date.now()) + state.calibrationOffsetMs;
    const msInMinute = ((wallTime % 60000) + 60000) % 60000;
    const beatInterval = 60000 / state.bpm;

    const beatIndex = Math.min(Math.floor(msInMinute / beatInterval), state.bpm - 1);
    const beatStartMs = beatIndex * beatInterval;
    const phase = Math.min(Math.max((msInMinute - beatStartMs) / beatInterval, 0), 0.9999);
    const msRemaining = Math.max(0, Math.round(beatInterval - (msInMinute - beatStartMs)));

    // Downbeat at start of every minute: beatIndex 0 is ALWAYS beat 1 (downbeat)
    const beatInBar = (beatIndex % state.beatsPerBar) + 1;
    const isDownbeat = (beatInBar === 1);

    return {
      wallTime,
      msInMinute,
      beatInterval,
      beatIndex,
      phase,
      msRemaining,
      beatInBar,
      isDownbeat
    };
  }

  // --- Visuals: Strobe Cue ---
  let strobeTimeout = null;

  function triggerStrobe(isDownbeat) {
    if (state.strobeMode === 'off') return;
    if (state.strobeMode === 'downbeat' && !isDownbeat) return;

    if (strobeTimeout) clearTimeout(strobeTimeout);

    el.strobeOverlay.className = '';
    void el.strobeOverlay.offsetWidth; // Force DOM reflow

    if (isDownbeat) {
      el.strobeOverlay.classList.add('flash-downbeat');
    } else {
      el.strobeOverlay.classList.add('flash-beat');
    }

    // Slight fade out after beat
    strobeTimeout = setTimeout(() => {
      el.strobeOverlay.className = '';
    }, 120);
  }

  // --- Visuals: Segment Markers in Circular Progress ---
  function updateCircleSegments() {
    el.circleSegments.innerHTML = '';
    const n = state.beatsPerBar;
    const cx = 100;
    const cy = 100;
    const rInner = 74;
    const rOuter = 90;

    for (let i = 0; i < n; i++) {
      const angle = (i / n) * 2 * Math.PI - (Math.PI / 2);
      const x1 = cx + rInner * Math.cos(angle);
      const y1 = cy + rInner * Math.sin(angle);
      const x2 = cx + rOuter * Math.cos(angle);
      const y2 = cy + rOuter * Math.sin(angle);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1.toFixed(2));
      line.setAttribute('y1', y1.toFixed(2));
      line.setAttribute('x2', x2.toFixed(2));
      line.setAttribute('y2', y2.toFixed(2));
      if (i === 0) {
        line.setAttribute('stroke', 'var(--accent-downbeat)');
        line.setAttribute('stroke-width', '4');
      }
      el.circleSegments.appendChild(line);
    }
  }

  // --- Visuals: Beat Dots in Bar ---
  function updateBeatDots(currentBeatInBar, isBeatTrigger) {
    if (el.beatDotsContainer.children.length !== state.beatsPerBar) {
      el.beatDotsContainer.innerHTML = '';
      for (let i = 1; i <= state.beatsPerBar; i++) {
        const dot = document.createElement('div');
        dot.className = 'beat-dot' + (i === 1 ? ' downbeat-dot' : '');
        dot.title = `Beat ${i}`;
        el.beatDotsContainer.appendChild(dot);
      }
    }

    const dots = el.beatDotsContainer.children;
    for (let i = 0; i < dots.length; i++) {
      const dotIndex = i + 1;
      if (dotIndex === currentBeatInBar && state.isPlaying) {
        dots[i].classList.add('active');
      } else {
        dots[i].classList.remove('active');
      }
    }
  }

  // --- Visuals: Canvas Bouncing Ball ---
  let canvasWidth = 460;
  let canvasHeight = 190;

  function resizeCanvas() {
    const rect = el.ballCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvasWidth = rect.width || 460;
    canvasHeight = rect.height || 190;
    el.ballCanvas.width = canvasWidth * dpr;
    el.ballCanvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);
  }

  window.addEventListener('resize', resizeCanvas);

  // Shockwave particle effects on bounce impact
  const ripples = [];

  function addBounceRipple(x, y, isDownbeat) {
    ripples.push({
      x,
      y,
      radius: 4,
      maxRadius: isDownbeat ? 36 : 24,
      alpha: 1.0,
      color: isDownbeat ? 'rgba(0, 242, 254, ' : 'rgba(79, 172, 254, '
    });
  }

  function renderBallVisualizer(beatInBar, phase, isDownbeat, isPlaying) {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const padCount = state.beatsPerBar;
    const paddingX = 50;
    const floorY = canvasHeight - 38;
    const peakHeight = canvasHeight - 85;

    // Draw floor line & beat pads
    ctx.strokeStyle = state.theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(paddingX - 20, floorY + 14);
    ctx.lineTo(canvasWidth - paddingX + 20, floorY + 14);
    ctx.stroke();

    const padPositions = [];
    for (let i = 0; i < padCount; i++) {
      const px = paddingX + (i / (padCount - 1)) * (canvasWidth - (paddingX * 2));
      padPositions.push(px);

      // Pad indicator
      const isCurrentPad = (i + 1 === beatInBar && isPlaying);
      const isPadDownbeat = (i === 0);

      ctx.fillStyle = isCurrentPad
        ? (isPadDownbeat ? '#00f2fe' : '#4facfe')
        : (state.theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)');

      ctx.beginPath();
      ctx.arc(px, floorY + 14, isCurrentPad ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();

      // Pad label
      ctx.fillStyle = isCurrentPad
        ? (isPadDownbeat ? '#00f2fe' : '#4facfe')
        : (state.theme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)');
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, px, floorY + 32);
    }

    // Render ripple particles
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.radius += 1.8;
      r.alpha -= 0.05;
      if (r.alpha <= 0) {
        ripples.splice(i, 1);
        continue;
      }
      ctx.strokeStyle = `${r.color}${r.alpha.toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (!isPlaying) {
      // Idle ball sitting quietly on pad 1
      const idleX = padPositions[0];
      const idleY = floorY;
      ctx.fillStyle = '#00f2fe';
      ctx.shadowColor = 'rgba(0, 242, 254, 0.5)';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(idleX, idleY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      return;
    }

    // Physics Parabolic Bounce
    // y = 4 * h * phase * (1 - phase) -> hits 0 at phase=0 and phase=1, reaches 1 at phase=0.5
    const bounceY = 4 * phase * (1 - phase);
    const currentBallY = floorY - (bounceY * peakHeight);

    // Horizontal movement across pads
    const fromIndex = beatInBar - 1;
    const toIndex = (fromIndex + 1) % padCount;
    const fromX = padPositions[fromIndex];
    const toX = padPositions[toIndex];
    const currentBallX = fromX + (toX - fromX) * phase;

    // Squash & Stretch physics
    let scaleX = 1;
    let scaleY = 1;
    if (bounceY < 0.15) {
      // Squashing near floor impact
      const squashFactor = (0.15 - bounceY) / 0.15;
      scaleX = 1 + 0.3 * squashFactor;
      scaleY = 1 - 0.25 * squashFactor;
    } else if (bounceY > 0.8) {
      // Slight vertical stretch near apex
      scaleX = 0.95;
      scaleY = 1.08;
    }

    const ballRadius = 14;
    const ballColor = isDownbeat ? '#00f2fe' : '#4facfe';

    // Ball glow & render
    ctx.save();
    ctx.translate(currentBallX, currentBallY);
    ctx.scale(scaleX, scaleY);

    ctx.fillStyle = ballColor;
    ctx.shadowColor = isDownbeat ? 'rgba(0, 242, 254, 0.7)' : 'rgba(79, 172, 254, 0.5)';
    ctx.shadowBlur = isDownbeat ? 22 : 14;

    ctx.beginPath();
    ctx.arc(0, 0, ballRadius, 0, Math.PI * 2);
    ctx.fill();

    // Internal highlight for 3D sphere look
    const grad = ctx.createRadialGradient(-4, -5, 2, 0, 0, ballRadius);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, ballRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // --- Visual Mode Handler ---
  function updateVisualizerLayout() {
    let showBall = false;
    let showCircle = false;

    if (state.vizMode === 'auto') {
      if (state.bpm >= 100) {
        showBall = true;
        showCircle = false;
      } else {
        showBall = false;
        showCircle = true;
      }
    } else if (state.vizMode === 'ball') {
      showBall = true;
      showCircle = false;
    } else if (state.vizMode === 'circle') {
      showBall = false;
      showCircle = true;
    } else if (state.vizMode === 'both') {
      showBall = true;
      showCircle = true;
    }

    el.ballPanel.classList.toggle('hidden', !showBall);
    el.circlePanel.classList.toggle('hidden', !showCircle);

    if (showBall) {
      resizeCanvas();
    }
  }

  // --- Main Animation & UI Update Frame Loop ---
  function renderFrame() {
    const clock = getClockState();

    // Format wall clock HH:MM:SS.mmm
    const date = new Date(clock.wallTime);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    const mmm = String(date.getMilliseconds()).padStart(3, '0');
    el.deviceClock.textContent = `${hh}:${mm}:${ss}.${mmm}`;

    // Diagnostics update
    const secInMin = (clock.msInMinute / 1000).toFixed(2);
    el.diagMinElapsed.textContent = `${secInMin}s`;
    el.diagBeatInMin.textContent = `${clock.beatIndex + 1} / ${state.bpm}`;
    const msUntilNextMin = 60000 - clock.msInMinute;
    el.diagNextMin.textContent = `in ${(msUntilNextMin / 1000).toFixed(1)}s`;

    // Detect Beat Transition
    const isNewBeat = (clock.beatIndex !== state.lastBeatIndex);
    if (isNewBeat && state.isPlaying) {
      state.lastBeatIndex = clock.beatIndex;

      // Visual Strobe
      triggerStrobe(clock.isDownbeat);

      // Pulse number in circular progress
      el.centerBeatNumber.classList.add('pulse');
      setTimeout(() => el.centerBeatNumber.classList.remove('pulse'), 120);

      // Impact ripple for ball visualizer
      const padPositions = [50, 170, 290, 410]; // will be accurately sampled
      const padCount = state.beatsPerBar;
      const px = 50 + ((clock.beatInBar - 1) / (padCount - 1)) * (canvasWidth - 100);
      addBounceRipple(px, canvasHeight - 24, clock.isDownbeat);
    }

    // Circular Progress Visualizer updates
    if (!el.circlePanel.classList.contains('hidden')) {
      const strokeOffset = CIRCLE_CIRCUMFERENCE * (1 - clock.phase);
      el.circleProgress.style.strokeDashoffset = state.isPlaying ? strokeOffset.toFixed(2) : '0';

      if (clock.isDownbeat) {
        el.circleProgress.classList.remove('regular-beat');
      } else {
        el.circleProgress.classList.add('regular-beat');
      }

      el.centerBeatNumber.textContent = state.isPlaying ? clock.beatInBar : '1';
      el.centerBeatLabel.textContent = clock.isDownbeat ? 'DOWNBEAT' : `BEAT ${clock.beatInBar}`;
      el.centerBeatLabel.classList.toggle('downbeat-text', clock.isDownbeat);
      el.centerMsRemaining.textContent = state.isPlaying ? `${clock.msRemaining} ms` : 'Stopped';
    }

    // Ball visualizer updates
    if (!el.ballPanel.classList.contains('hidden')) {
      renderBallVisualizer(clock.beatInBar, clock.phase, clock.isDownbeat, state.isPlaying);
    }

    // Beat Dots
    updateBeatDots(clock.beatInBar, isNewBeat);

    requestAnimationFrame(renderFrame);
  }

  // --- Tempo Setters ---
  function setBPM(val) {
    const intVal = Math.round(Number(val));
    if (isNaN(intVal)) return;
    const clamped = Math.max(20, Math.min(300, intVal));
    state.bpm = clamped;

    el.bpmInput.value = clamped;
    el.bpmSlider.value = Math.min(Math.max(clamped, 30), 250);
    el.tempoMarking.textContent = getTempoMarking(clamped);

    updateVisualizerLayout();
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    // BPM +/- and +5/-5
    el.bpmMinus1.addEventListener('click', () => setBPM(state.bpm - 1));
    el.bpmPlus1.addEventListener('click', () => setBPM(state.bpm + 1));
    el.bpmMinus5.addEventListener('click', () => setBPM(state.bpm - 5));
    el.bpmPlus5.addEventListener('click', () => setBPM(state.bpm + 5));

    el.bpmInput.addEventListener('change', (e) => setBPM(e.target.value));
    el.bpmInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') el.bpmInput.blur();
    });

    el.bpmSlider.addEventListener('input', (e) => setBPM(e.target.value));

    // Meter buttons (3 / 4 / 6)
    el.segButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        el.segButtons.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        state.beatsPerBar = parseInt(btn.dataset.beats, 10);
        updateCircleSegments();
        updateBeatDots(1, false);
      });
    });

    // Play / Stop Toggle
    function togglePlay() {
      initAudio();
      state.isPlaying = !state.isPlaying;

      if (state.isPlaying) {
        el.playBtn.classList.add('playing');
        el.playIcon.classList.add('hidden');
        el.stopIcon.classList.remove('hidden');
        el.playBtnText.textContent = 'STOP METRONOME';

        scheduledBeats.clear();
        state.lastBeatIndex = -1;

        // Start lookahead audio scheduler timer
        if (audioSchedulerTimer) clearInterval(audioSchedulerTimer);
        audioSchedulerTimer = setInterval(audioSchedulerLoop, 25);
        audioSchedulerLoop();
      } else {
        el.playBtn.classList.remove('playing');
        el.playIcon.classList.remove('hidden');
        el.stopIcon.classList.add('hidden');
        el.playBtnText.textContent = 'START METRONOME';

        if (audioSchedulerTimer) {
          clearInterval(audioSchedulerTimer);
          audioSchedulerTimer = null;
        }
        scheduledBeats.clear();
        el.circleProgress.style.strokeDashoffset = '0';
        updateBeatDots(1, false);
      }
    }

    el.playBtn.addEventListener('click', togglePlay);

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setBPM(state.bpm + 5);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setBPM(state.bpm - 5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setBPM(state.bpm + 1);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setBPM(state.bpm - 1);
      }
    });

    // Theme Switcher (Dark / Light)
    function toggleTheme() {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      el.body.setAttribute('data-theme', state.theme);
      el.themeSunIcon.classList.toggle('hidden', state.theme === 'light');
      el.themeMoonIcon.classList.toggle('hidden', state.theme === 'dark');
      localStorage.setItem('metronome_theme', state.theme);
      resizeCanvas();
    }

    el.themeToggleBtn.addEventListener('click', toggleTheme);

    // Visualizer tabs (Auto, Ball, Circle, Both)
    el.vizTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        el.vizTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.vizMode = tab.dataset.mode;
        updateVisualizerLayout();
      });
    });

    // Strobe Select
    el.strobeSelect.addEventListener('change', (e) => {
      state.strobeMode = e.target.value;
    });

    // Sound Select
    el.soundSelect.addEventListener('change', (e) => {
      state.soundType = e.target.value;
      initAudio();
    });

    // Volume Slider
    el.volumeSlider.addEventListener('input', (e) => {
      state.volume = parseInt(e.target.value, 10) / 100;
      el.volumeValText.textContent = `${e.target.value}%`;
    });

    // Settings Drawer Accordion
    el.drawerToggleBtn.addEventListener('click', () => {
      const isExpanded = el.drawerToggleBtn.getAttribute('aria-expanded') === 'true';
      el.drawerToggleBtn.setAttribute('aria-expanded', !isExpanded);
      el.drawerContent.classList.toggle('hidden', isExpanded);
    });

    // Tap Tempo
    el.tapTempoBtn.addEventListener('click', () => {
      const now = Date.now();
      state.tapTimes.push(now);
      if (state.tapTimes.length > 5) state.tapTimes.shift();

      if (state.tapTimes.length >= 2) {
        // Calculate average delta between taps
        const deltas = [];
        for (let i = 1; i < state.tapTimes.length; i++) {
          const dt = state.tapTimes[i] - state.tapTimes[i - 1];
          if (dt < 2500) deltas.push(dt);
        }
        if (deltas.length > 0) {
          const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
          const calculatedBPM = Math.round(60000 / avgDelta);
          setBPM(calculatedBPM);
        }
      }
    });

    // Latency calibration offsets
    function updateOffsetDisplay() {
      el.offsetVal.textContent = state.calibrationOffsetMs > 0
        ? `+${state.calibrationOffsetMs}`
        : `${state.calibrationOffsetMs}`;
    }

    el.offsetMinus10.addEventListener('click', () => {
      state.calibrationOffsetMs -= 10;
      updateOffsetDisplay();
    });
    el.offsetPlus10.addEventListener('click', () => {
      state.calibrationOffsetMs += 10;
      updateOffsetDisplay();
    });
    el.offsetZero.addEventListener('click', () => {
      state.calibrationOffsetMs = 0;
      updateOffsetDisplay();
    });

    // Info Modal
    function openModal() {
      el.infoModal.classList.remove('hidden');
    }
    function closeModal() {
      el.infoModal.classList.add('hidden');
    }
    el.infoModalBtn.addEventListener('click', openModal);
    el.closeModalBtn.addEventListener('click', closeModal);
    el.modalOkBtn.addEventListener('click', closeModal);
    el.infoModal.addEventListener('click', (e) => {
      if (e.target === el.infoModal) closeModal();
    });
  }

  // --- Initialization ---
  function init() {
    // Restore saved theme
    const savedTheme = localStorage.getItem('metronome_theme');
    if (savedTheme) {
      state.theme = savedTheme;
      el.body.setAttribute('data-theme', state.theme);
      el.themeSunIcon.classList.toggle('hidden', state.theme === 'light');
      el.themeMoonIcon.classList.toggle('hidden', state.theme === 'dark');
    }

    updateCircleSegments();
    updateVisualizerLayout();
    resizeCanvas();
    setupEventListeners();
    setBPM(120);

    // Kick off animation frame loop
    requestAnimationFrame(renderFrame);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
