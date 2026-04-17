// ============================================================
// FitPlan – Main Application Logic (v2 with all features)
// ============================================================
(function() {
  'use strict';

  const STORAGE_KEYS = {
    profile: 'fitplan_profile', plan: 'fitplan_plan',
    logs: 'fitplan_logs', onboarded: 'fitplan_onboarded',
    darkMode: 'fitplan_darkmode', notes: 'fitplan_notes',
    weightLog: 'fitplan_weightlog', currentWorkout: 'fitplan_current_workout',
    stepLog: 'fitplan_step_log'
  };

  let state = {
    profile: null, plan: null, logs: [], notes: {},
    weightLog: [], stepLog: [], currentWorkout: null, activeScreen: 'onboarding'
  };

  let workoutStartTime = null, workoutElapsedInterval = null;
  let restTimerInterval = null, restTimerRemaining = 0;
  let exerciseTimerInterval = null, exerciseTimerRemaining = 0;
  let exerciseTimerTotal = 0, exerciseTimerRunning = false, exerciseTimerCallback = null;
  let progressChart = null;

  // Audio context for beeps
  let audioCtx = null;
  function beep(freq, duration) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.3;
      osc.start(); osc.stop(audioCtx.currentTime + duration / 1000);
    } catch(e) {}
  }
  function countdownBeep() { beep(800, 100); }
  function doneBeep() { beep(1200, 300); }
  function haptic(pattern) { if (navigator.vibrate) navigator.vibrate(pattern); }
  function hapticLight() { haptic(10); }
  function hapticMedium() { haptic(25); }
  function hapticHeavy() { haptic([50, 30, 50]); }

  // ── Wake Lock ────────────────────────────────────────────
  let wakeLock = null;
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch(e) {}
  }
  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
  }
  // Re-acquire on visibility change (e.g. tab switch back)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.currentWorkout) requestWakeLock();
  });

  // ── Persistence ──────────────────────────────────────────

  function save(key, data) { try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {} }
  function load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch(e) { return null; } }

  function loadState() {
    state.profile = load(STORAGE_KEYS.profile);
    state.plan = load(STORAGE_KEYS.plan);
    state.logs = load(STORAGE_KEYS.logs) || [];
    state.notes = load(STORAGE_KEYS.notes) || {};
    state.weightLog = load(STORAGE_KEYS.weightLog) || [];
    state.stepLog = load(STORAGE_KEYS.stepLog) || [];
  }

  function saveProfile() { save(STORAGE_KEYS.profile, state.profile); if (window.FireSync) window.FireSync.saveProfile(state.profile); }
  function savePlan() { save(STORAGE_KEYS.plan, state.plan); if (window.FireSync) window.FireSync.savePlan(state.plan); }
  function saveLogs() { save(STORAGE_KEYS.logs, state.logs); if (window.FireSync) window.FireSync.saveLogs(state.logs); }
  function saveNotes() { save(STORAGE_KEYS.notes, state.notes); if (window.FireSync) window.FireSync.saveNotes(state.notes); }
  function saveWeightLog() { save(STORAGE_KEYS.weightLog, state.weightLog); if (window.FireSync) window.FireSync.saveWeightLog(state.weightLog); }
  function saveStepLog() { save(STORAGE_KEYS.stepLog, state.stepLog); }
  function saveCurrentWorkout() { save(STORAGE_KEYS.currentWorkout, state.currentWorkout ? { workout: state.currentWorkout, startedAt: workoutStartTime } : null); }
  function clearSavedWorkout() { localStorage.removeItem(STORAGE_KEYS.currentWorkout); }

  // ── PR Detection ─────────────────────────────────────────

  function checkForPR(exerciseId, sets) {
    if (!sets || sets.length === 0) return false;
    const completedSets = sets.filter(s => s.completed);
    if (completedSets.length === 0) return false;

    // Get historical best
    let bestVolume = 0;
    let bestWeight = 0;
    let bestDuration = 0;

    state.logs.forEach(log => {
      (log.exercises || []).forEach(ex => {
        if (ex.exerciseId !== exerciseId) return;
        ex.sets.filter(s => s.completed).forEach(s => {
          if (s.weight && s.weight > bestWeight) bestWeight = s.weight;
          if (s.duration && s.duration > bestDuration) bestDuration = s.duration;
          if (s.reps && s.weight) {
            const vol = s.reps * s.weight;
            if (vol > bestVolume) bestVolume = vol;
          }
        });
      });
    });

    // Check current sets
    for (const s of completedSets) {
      if (s.weight && s.weight > bestWeight && bestWeight > 0) return true;
      if (s.duration && s.duration > bestDuration && bestDuration > 0) return true;
      if (s.reps && s.weight) {
        const vol = s.reps * s.weight;
        if (vol > bestVolume && bestVolume > 0) return true;
      }
    }
    return false;
  }

  // ── Last performance lookup ──────────────────────────────

  function getLastPerformance(exerciseId) {
    for (let i = state.logs.length - 1; i >= 0; i--) {
      const log = state.logs[i];
      const ex = (log.exercises || []).find(e => e.exerciseId === exerciseId && !e.isWarmup);
      if (ex) {
        const completed = ex.sets.filter(s => s.completed);
        if (completed.length > 0) return completed;
      }
    }
    return null;
  }

  // ── Confetti ─────────────────────────────────────────────

  function showConfetti() {
    const canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:999;pointer-events:none;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#007AFF','#34C759','#FF9F0A','#FF3B30','#AF52DE','#5AC8FA'];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 15,
        vy: Math.random() * -15 - 5,
        size: Math.random() * 8 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10
      });
    }

    let frame = 0;
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.3;
        p.rotation += p.rotSpeed;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });
      frame++;
      if (frame < 90) requestAnimationFrame(animate);
      else canvas.remove();
    }
    animate();
  }

  // ── Navigation ───────────────────────────────────────────

  let previousScreen = null;
  let navigatingBack = false;

  function showScreen(id, skipHistory) {
    const slideScreens = ['plan-detail', 'settings'];
    const slideUpScreens = ['workout', 'complete'];

    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active', 'screen-slide-in', 'screen-slide-up');
    });
    const screen = document.getElementById('screen-' + id);
    if (screen) {
      screen.classList.add('active');
      if (slideScreens.includes(id)) screen.classList.add('screen-slide-in');
      else if (slideUpScreens.includes(id)) screen.classList.add('screen-slide-up');
    }
    previousScreen = state.activeScreen;
    state.activeScreen = id;

    // Push browser history for back button support
    if (!skipHistory && !navigatingBack) {
      history.pushState({ screen: id }, '', '');
    }

    const nav = document.getElementById('bottom-nav');
    nav.classList.toggle('hidden', ['onboarding', 'workout', 'complete'].includes(id));

    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.screen === id);
    });

    if (id === 'dashboard') renderDashboard();
    if (id === 'progress') renderProgress();
    if (id === 'achievements') renderAchievements();
    if (id === 'settings') populateSettings();
  }

  // Handle Android/browser back button
  window.addEventListener('popstate', e => {
    // Close any open modal first
    const openModal = document.querySelector('.modal:not(.hidden)');
    if (openModal) {
      openModal.classList.add('hidden');
      history.pushState({ screen: state.activeScreen }, '', '');
      return;
    }

    // Close rest/exercise timer overlay
    const restOverlay = document.getElementById('rest-overlay');
    const exOverlay = document.getElementById('exercise-timer-overlay');
    if (restOverlay && !restOverlay.classList.contains('hidden')) {
      clearInterval(restTimerInterval);
      restOverlay.classList.add('hidden');
      history.pushState({ screen: state.activeScreen }, '', '');
      return;
    }
    if (exOverlay && !exOverlay.classList.contains('hidden')) {
      closeExerciseTimer(null);
      history.pushState({ screen: state.activeScreen }, '', '');
      return;
    }

    // Navigate back between screens
    navigatingBack = true;
    const current = state.activeScreen;

    if (current === 'dashboard' || current === 'onboarding') {
      // At home screen → let the browser/app close
      return;
    } else if (current === 'workout') {
      // In workout → confirm before leaving
      history.pushState({ screen: 'workout' }, '', '');
      document.getElementById('btn-quit-workout').click();
    } else {
      // All other screens → go to dashboard
      showScreen('dashboard', true);
    }
    navigatingBack = false;
  });

  // ── Onboarding ───────────────────────────────────────────

  let onboardingStep = 1;
  const totalSteps = 6;
  const onboardingData = {
    name: '', age: null, weight: null, height: null,
    fitnessLevel: null, goal: null,
    daysPerWeek: 3, minutesPerSession: 45,
    preferredDays: [], restMode: 'auto',
    strengthTest: null
  };

  function initOnboarding() {
    renderStepIndicator();
    updateOnboardingNav();

    document.getElementById('ob-days').addEventListener('input', e => {
      document.getElementById('ob-days-val').textContent = e.target.value;
      onboardingData.daysPerWeek = +e.target.value;
    });
    document.getElementById('ob-minutes').addEventListener('input', e => {
      document.getElementById('ob-minutes-val').textContent = e.target.value;
      onboardingData.minutesPerSession = +e.target.value;
    });

    ['ob-level', 'ob-goal', 'ob-rest'].forEach(groupId => {
      const group = document.getElementById(groupId);
      if (!group) return;
      group.querySelectorAll('.option-card').forEach(card => {
        card.addEventListener('click', () => {
          group.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          const value = card.dataset.value;
          if (groupId === 'ob-level') onboardingData.fitnessLevel = value;
          if (groupId === 'ob-goal') onboardingData.goal = value;
          if (groupId === 'ob-rest') onboardingData.restMode = value;
        });
      });
    });

    document.querySelectorAll('#ob-preferred-days .day-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const day = btn.dataset.day;
        if (onboardingData.preferredDays.includes(day)) {
          onboardingData.preferredDays = onboardingData.preferredDays.filter(d => d !== day);
        } else {
          onboardingData.preferredDays.push(day);
        }
      });
    });

    document.getElementById('ob-next').addEventListener('click', nextOnboardingStep);
    document.getElementById('ob-back').addEventListener('click', prevOnboardingStep);

    // Strength test
    document.getElementById('ob-test-start').addEventListener('click', () => startStrengthTest(result => {
      onboardingData.strengthTest = result;
      nextOnboardingStep();
    }));
    document.getElementById('ob-test-skip').addEventListener('click', () => {
      onboardingData.strengthTest = null;
      nextOnboardingStep();
    });
  }

  // ── Strength Test ────────────────────────────────────────
  const STRENGTH_TEST_EXERCISES = [
    { id: 'pushups', name: 'Liegestütze', instructions: 'Maximale Liegestütze in 60 Sekunden (auf Knien erlaubt).', durationSec: 60, label: 'Geschafft:', unit: 'Reps' },
    { id: 'squats', name: 'Kniebeugen', instructions: 'Maximale Kniebeugen in 60 Sekunden.', durationSec: 60, label: 'Geschafft:', unit: 'Reps' },
    { id: 'plank', name: 'Plank', instructions: 'Halte die Plank so lange wie möglich. Timer läuft bis 3 Minuten.', durationSec: 180, label: 'Gehalten:', unit: 'Sekunden', isHold: true }
  ];

  let strengthTestState = null;

  function startStrengthTest(onComplete) {
    document.getElementById('strength-test-intro').classList.add('hidden');
    document.getElementById('strength-test-runner').classList.remove('hidden');
    strengthTestState = { index: 0, results: {}, onComplete, timerInterval: null, startTime: null };
    showStrengthTestExercise();
  }

  function showStrengthTestExercise() {
    const idx = strengthTestState.index;
    const ex = STRENGTH_TEST_EXERCISES[idx];
    document.getElementById('strength-test-name').textContent = `${idx + 1}/3 ${ex.name}`;
    document.getElementById('strength-test-instructions').textContent = ex.instructions;
    document.getElementById('strength-test-label').textContent = `${ex.label} (${ex.unit})`;
    document.getElementById('strength-test-result').value = '';
    document.getElementById('strength-test-value').textContent = ex.durationSec;
    document.getElementById('strength-test-next').textContent = idx < 2 ? 'Start' : 'Start';

    const btn = document.getElementById('strength-test-next');
    btn.onclick = null; // reset
    btn.onclick = () => runStrengthTestTimer(ex);
  }

  function runStrengthTestTimer(ex) {
    const btn = document.getElementById('strength-test-next');
    const progressEl = document.getElementById('strength-test-progress');
    const valueEl = document.getElementById('strength-test-value');
    const circumference = 2 * Math.PI * 54;
    progressEl.style.strokeDasharray = circumference;

    strengthTestState.startTime = Date.now();
    btn.textContent = ex.isHold ? 'Stop' : 'Fertig';

    const total = ex.durationSec;
    clearInterval(strengthTestState.timerInterval);
    strengthTestState.timerInterval = setInterval(() => {
      const elapsed = (Date.now() - strengthTestState.startTime) / 1000;
      const remaining = Math.max(0, total - elapsed);
      valueEl.textContent = ex.isHold ? Math.floor(elapsed) : Math.ceil(remaining);
      progressEl.style.strokeDashoffset = circumference * (1 - remaining / total);
      if (remaining <= 0) {
        clearInterval(strengthTestState.timerInterval);
        hapticHeavy(); doneBeep();
        finishStrengthTestExercise(ex);
      }
    }, 100);

    btn.onclick = () => {
      clearInterval(strengthTestState.timerInterval);
      finishStrengthTestExercise(ex);
    };
  }

  function finishStrengthTestExercise(ex) {
    const elapsed = (Date.now() - strengthTestState.startTime) / 1000;
    const inputEl = document.getElementById('strength-test-result');
    const btn = document.getElementById('strength-test-next');
    if (ex.isHold) {
      strengthTestState.results[ex.id] = Math.round(elapsed);
      inputEl.value = Math.round(elapsed);
    } else {
      inputEl.value = '';
      inputEl.focus();
    }
    btn.textContent = 'Weiter';
    btn.onclick = () => {
      const val = +inputEl.value;
      if (isNaN(val) || val < 0) { alert('Bitte Wert eingeben.'); return; }
      strengthTestState.results[ex.id] = val;
      strengthTestState.index++;
      if (strengthTestState.index >= STRENGTH_TEST_EXERCISES.length) {
        const result = { ...strengthTestState.results, date: new Date().toISOString() };
        const callback = strengthTestState.onComplete;
        strengthTestState = null;
        callback(result);
      } else {
        showStrengthTestExercise();
      }
    };
  }

  function renderStepIndicator() {
    const c = document.getElementById('step-indicator');
    c.innerHTML = '';
    for (let i = 1; i <= totalSteps; i++) {
      const d = document.createElement('div');
      d.className = 'step-dot' + (i === onboardingStep ? ' active' : '') + (i < onboardingStep ? ' done' : '');
      c.appendChild(d);
    }
  }

  function showOnboardingStep(step) {
    document.querySelectorAll('.onboarding-step').forEach(s => s.classList.remove('active'));
    const el = document.querySelector(`.onboarding-step[data-step="${step}"]`);
    if (el) el.classList.add('active');
    renderStepIndicator();
    updateOnboardingNav();
  }

  function updateOnboardingNav() {
    document.getElementById('ob-back').style.visibility = onboardingStep === 1 ? 'hidden' : 'visible';
    // Step 6 (strength test) has its own buttons, hide the main nav
    const navBar = document.querySelector('.onboarding-nav');
    if (onboardingStep === 6) {
      navBar.style.display = 'none';
      // Reset test state when entering step
      document.getElementById('strength-test-intro').classList.remove('hidden');
      document.getElementById('strength-test-runner').classList.add('hidden');
    } else {
      navBar.style.display = '';
    }
    document.getElementById('ob-next').textContent = 'Weiter';
  }

  function validateStep(step) {
    switch (step) {
      case 1:
        onboardingData.name = document.getElementById('ob-name').value.trim();
        onboardingData.age = +document.getElementById('ob-age').value;
        onboardingData.weight = +document.getElementById('ob-weight').value;
        onboardingData.height = +document.getElementById('ob-height').value;
        if (!onboardingData.name) { alert('Bitte gib deinen Namen ein.'); return false; }
        if (!onboardingData.age || onboardingData.age < 14) { alert('Bitte gib ein gültiges Alter ein.'); return false; }
        if (!onboardingData.weight) { alert('Bitte gib dein Gewicht ein.'); return false; }
        if (!onboardingData.height) { alert('Bitte gib deine Größe ein.'); return false; }
        return true;
      case 2: if (!onboardingData.fitnessLevel) { alert('Bitte wähle dein Fitnesslevel.'); return false; } return true;
      case 3: if (!onboardingData.goal) { alert('Bitte wähle dein Trainingsziel.'); return false; } return true;
      case 4: return true;
      case 5: if (!onboardingData.restMode) { alert('Bitte wähle eine Option.'); return false; } return true;
      case 6: return true; // Strength test is optional
    }
    return true;
  }

  function nextOnboardingStep() {
    if (!validateStep(onboardingStep)) return;
    if (onboardingStep < totalSteps) { onboardingStep++; showOnboardingStep(onboardingStep); }
    else completeOnboarding();
  }

  function prevOnboardingStep() {
    if (onboardingStep > 1) { onboardingStep--; showOnboardingStep(onboardingStep); }
  }

  function completeOnboarding() {
    state.profile = { ...onboardingData };
    saveProfile();
    save(STORAGE_KEYS.onboarded, true);
    // Save initial weight
    state.weightLog.push({ date: new Date().toISOString(), weight: state.profile.weight });
    saveWeightLog();
    state.plan = window.Planner.generatePlan(state.profile, state.logs);
    savePlan();
    showScreen('dashboard');
  }

  // ── Dashboard ────────────────────────────────────────────

  const DAY_NAME_MAP = {
    mon: 'Montag', tue: 'Dienstag', wed: 'Mittwoch', thu: 'Donnerstag',
    fri: 'Freitag', sat: 'Samstag', sun: 'Sonntag'
  };
  const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  function getPreferredSorted() {
    return (state.profile.preferredDays || []).slice().sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  }

  function getTodayKey() {
    const d = new Date().getDay();
    return DAY_ORDER[d === 0 ? 6 : d - 1];
  }

  function renderRecoveryHint(logs) {
    let hint = document.getElementById('recovery-hint');
    if (!hint) return;

    if (logs.length === 0) { hint.classList.add('hidden'); return; }

    const today = new Date(); today.setHours(0,0,0,0);
    const dates = logs.map(l => { const d = new Date(l.date); d.setHours(0,0,0,0); return d.getTime(); });
    const uniqueDates = [...new Set(dates)].sort((a,b) => b - a);

    // Days since last workout
    const lastWorkout = new Date(uniqueDates[0]);
    const daysSinceLast = Math.floor((today - lastWorkout) / 86400000);

    // Consecutive training days
    let consecutiveDays = 0;
    let checkDate = new Date(uniqueDates[0]);
    for (const ts of uniqueDates) {
      if (ts === checkDate.getTime()) { consecutiveDays++; checkDate.setDate(checkDate.getDate() - 1); }
      else break;
    }

    let message = '';
    let icon = '';

    if (consecutiveDays >= 4 && daysSinceLast === 0) {
      icon = '⚠️'; message = `${consecutiveDays} Tage am Stück – selbst Maschinen brauchen Öl. Morgen Pause!`;
    } else if (daysSinceLast === 0 && consecutiveDays >= 2) {
      icon = '💪'; message = `${consecutiveDays} Tage am Stück – du bist on fire!`;
    } else if (daysSinceLast >= 2 && daysSinceLast <= 3) {
      icon = '🔋'; message = `${daysSinceLast} Tage Pause – Akkus geladen. Die Hanteln warten!`;
    } else if (daysSinceLast >= 4 && daysSinceLast <= 7) {
      icon = '👀'; message = `${daysSinceLast} Tage Funkstille – deine Matte fragt, ob du noch lebst.`;
    } else if (daysSinceLast > 7) {
      icon = '🔥'; message = `${daysSinceLast} Tage weg – Comeback-Story startet jetzt!`;
    }

    if (message) {
      hint.classList.remove('hidden');
      hint.innerHTML = `<span class="recovery-icon">${icon}</span> ${message}`;
    } else {
      hint.classList.add('hidden');
    }
  }

  // ── Cycle Tracking ───────────────────────────────────────

  function getCyclePhase() {
    const p = state.profile;
    if (!p || !p.cycleTracking || !p.lastPeriodStart) return null;
    const start = new Date(p.lastPeriodStart);
    const now = new Date();
    const diffDays = Math.floor((now - start) / 86400000);
    const cycleLen = p.cycleLength || 28;
    const dayInCycle = ((diffDays % cycleLen) + cycleLen) % cycleLen + 1;

    if (dayInCycle <= 5) return { phase: 'menstruation', day: dayInCycle, icon: '🌙', label: 'Menstruation',
      tip: 'Hör auf deinen Körper – leichteres Training ist völlig OK.' };
    if (dayInCycle <= 13) return { phase: 'follicular', day: dayInCycle, icon: '🚀', label: 'Follikelphase',
      tip: 'Power-Phase! Beste Zeit für schwere Gewichte und neue PRs.' };
    if (dayInCycle <= 16) return { phase: 'ovulation', day: dayInCycle, icon: '⚡', label: 'Ovulation',
      tip: 'Peak-Power – aber achte besonders auf saubere Ausführung.' };
    return { phase: 'luteal', day: dayInCycle, icon: '🧘', label: 'Lutealphase',
      tip: 'Entspannte Phase – moderate Gewichte, mehr Mobility.' };
  }

  function renderCycleHint() {
    const hint = document.getElementById('cycle-hint');
    if (!hint) return;
    const phase = getCyclePhase();
    if (!phase) { hint.classList.add('hidden'); return; }
    hint.classList.remove('hidden');
    hint.innerHTML = `
      <span class="cycle-icon">${phase.icon}</span>
      <div class="cycle-info">
        <div class="cycle-label">${phase.label} <span class="cycle-day">Tag ${phase.day}</span></div>
        <div class="cycle-tip">${phase.tip}</div>
      </div>
    `;
  }

  function renderDashboard() {
    if (!state.profile) return;
    if (!state.plan || !state.plan.days || state.plan.days.length === 0) {
      try { state.plan = window.Planner.generatePlan(state.profile, state.logs); savePlan(); } catch(e) { console.error(e); }
    }
    if (!state.plan) return;

    // Greeting (with Easter Eggs)
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    let greetTime = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Hey' : 'Guten Abend';

    // Easter Eggs
    if (hour < 6) greetTime = 'Du Verrückte';
    else if (dayOfWeek === 5) greetTime = 'Happy Freitag';
    else if (state.logs.length === 42) greetTime = 'Die Antwort ist 42';
    else if (dayOfWeek === 1) greetTime = 'Montag = Legday';

    document.getElementById('greeting').textContent = `${greetTime}, ${state.profile.name}!`;

    const goalNames = { lose_weight: 'Abnehmen', build_muscle: 'Muskelaufbau', general_fitness: 'Allgemeine Fitness', tone: 'Körper straffen' };
    const subtitles = [
      `Ziel: ${goalNames[state.profile.goal] || ''}`,
      state.logs.length === 0 ? 'Dein erstes Workout wartet!' : null,
      state.logs.length === 100 ? '💯 100 Workouts – absolute Legende!' : null,
    ].filter(Boolean);
    document.getElementById('dash-subtitle').textContent = subtitles[subtitles.length - 1];

    // Deload badge
    const deloadBadge = document.getElementById('deload-badge');
    if (deloadBadge) deloadBadge.classList.toggle('hidden', !state.plan.isDeload);

    // Stats (clickable)
    const logs = state.logs;
    const streakVal = calculateStreak(logs);
    document.getElementById('stat-streak').textContent = streakVal;
    document.getElementById('stat-workouts').textContent = logs.length;
    document.getElementById('stat-week').textContent = countThisWeek(logs);

    // Stat card click handlers
    const statCards = document.querySelectorAll('#stats-row .stat-card');
    statCards.forEach(c => c.style.cursor = 'pointer');

    statCards[0].onclick = () => {
      if (streakVal === 0) return;
      const dates = [...new Set(logs.map(l => new Date(l.date).toDateString()))].sort((a, b) => new Date(b) - new Date(a));
      const streakLogs = [];
      let check = new Date(); check.setHours(0,0,0,0);
      if (dates[0] !== check.toDateString()) { check.setDate(check.getDate() - 1); }
      for (const d of dates) {
        if (d === check.toDateString()) { streakLogs.push(...logs.filter(l => new Date(l.date).toDateString() === d)); check.setDate(check.getDate() - 1); }
        else break;
      }
      showStatDetail(`🔥 ${streakVal}-Tage-Streak`, streakLogs);
    };

    statCards[1].onclick = () => {
      if (logs.length === 0) return;
      showStatDetail(`💪 ${logs.length} Workouts insgesamt`, [...logs].reverse().slice(0, 30));
    };

    statCards[2].onclick = () => {
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
      start.setHours(0,0,0,0);
      const weekLogs = logs.filter(l => new Date(l.date) >= start);
      if (weekLogs.length === 0) return;
      showStatDetail(`📅 Diese Woche: ${weekLogs.length} Workouts`, weekLogs);
    };

    // Week calendar
    renderWeekCalendar();

    const preferred = getPreferredSorted();
    const todayKey = getTodayKey();
    const today = new Date().toDateString();

    // Rest day / recovery hint
    renderRecoveryHint(logs);
    renderCycleHint();
    renderStepsWidget();

    // Identify today's workout
    let todayIdx = -1;
    preferred.forEach((pDay, idx) => { if (pDay === todayKey && idx < state.plan.days.length) todayIdx = idx; });

    // Today's workout highlight
    const todayCard = document.getElementById('today-workout');
    if (todayIdx >= 0) {
      const day = state.plan.days[todayIdx];
      const doneToday = logs.some(l => l.dayIndex === todayIdx && new Date(l.date).toDateString() === today);
      const mainExCount = day.exercises.filter(e => !e.isWarmup && !e.isCooldown && !e.isWarmupSet).length;
      todayCard.classList.remove('hidden');
      todayCard.innerHTML = `
        <div class="today-workout-inner ${doneToday ? 'done' : ''}">
          <div class="today-label">${doneToday ? '✅ Erledigt' : '📍 Heute'}</div>
          <div class="today-name">${day.name}</div>
          <div class="today-nameDE">${day.nameDE} · ${mainExCount} Übungen</div>
          ${doneToday ? '' : '<button class="btn btn-primary btn-block" id="btn-start-today">Training starten</button>'}
        </div>
        ${!doneToday ? '<button class="btn-mobility-alt" id="btn-mobility-alt">🧘 Lieber Mobility heute?</button>' : ''}
      `;
      if (!doneToday) {
        todayCard.querySelector('#btn-start-today').addEventListener('click', () => startWorkout(todayIdx));
        todayCard.querySelector('#btn-mobility-alt').addEventListener('click', () => startMobilitySession());
      }
    } else {
      // Rest day → show mobility card with daily motivation
      const restDayQuotes = [
        'Muskeln wachsen auf dem Sofa, nicht im Gym. Also Hose aus und dehnen.',
        'Dein Körper ist heiß, Mäuschen – aber nur weil alles entzündet ist. Dehn dich.',
        'Stretching ist wie Vorspiel. Keiner will\'s, aber danach läuft\'s besser.',
        'Ruhetag heißt nicht: den ganzen Tag flach liegen. Das ist für heute Nacht.',
        'Deine Faszien sind verklebter als altes Kaugummi. Kümmere dich drum.',
        'Wer nicht dehnt, wird steif. Und nicht auf die gute Art. 😏',
        'Heute darfst du stöhnen. Beim Dehnen natürlich.',
        'Rest Day Queen. 👑 Komm Mäuschen, mach die Beine breit – für den Couch Stretch.',
        'Regeneration ist wie Netflix & Chill – aber für deine Muskeln.',
        'Dein Muskelkater findet dich geil. Zeig ihm, wer hier Boss ist.',
        'Mobility ist Selbstliebe. Und Selbstliebe ist nie verkehrt. 💅',
        'Selbst dein Hintern braucht mal Aufmerksamkeit. Glute Stretch, los.',
        'Du bist heiß Mäuschen, aber deine Hüften sind kalt. Aufwärmen!',
        'Splits üben? Fang erstmal mit der Tauben-Dehnung an, Wildkatze.',
        'Dein Körper ist ein Tempel. Und heute wird der Tempel gedehnt.',
        'Geschmeidig wie ein Aal – das ist das Ziel. Nicht steif wie ein Brett.',
        'Heute Abend dankt dir dein Rücken. Oder dein Partner. Oder beide.',
        'Die beste Position? Die, die du nach dem Stretching halten kannst.',
        'Du musst nicht kommen. Also zum Training. Dehnen reicht heute.',
        'Flex mal was anderes als deine Muskeln. Zum Beispiel deine Hüften.',
        'Deine Oberschenkel sind enger als dein Terminkalender. Fix das.',
        'Wenn du dich nicht dehnst, dehnst du nur die Wahrheit über deine Fitness.',
        'Pigeon Pose sieht komisch aus, fühlt sich aber göttlich an. Trust me.',
        'Dein Beckenboden will auch mal beachtet werden. Nur so als Tipp.',
        'Heute ist Beweglichkeits-Tag. Morgen profitiert das ganze Schlafzimmer.',
        'Dein Nacken ist verspannter als du nach dem dritten Glas Wein.',
        'Die tiefe Hocke ist nicht nur fürs Klo. Üb sie.',
        'Wenn du beim Schuhe-Binden stöhnst, brauchst du das hier. Dringend.',
        'Dein Körper ist wie eine Beziehung – ohne Pflege wird\'s steif und unbeweglich.',
        'Happy End? Gibt\'s nur mit warmem Cool-Down. 💆‍♀️',
        'Dehnen ist billiger als Physiotherapie. Und weniger peinlich.',
        'Deine Hüftbeuger sitzen den ganzen Tag. Die brauchen Liebe.',
        'Wer sich nicht bewegt, rostet. Und Rost ist nicht sexy.',
        'Heute ölen wir die Gelenke. Kein Witz, mach die Kreise.',
        'Dein Foam Roller wartet. Er ist der Einzige, der dich heute rollen darf.',
        'Leg dich hin und mach die Beine hoch, Mäuschen. Für die Dehnung. Wofür denn sonst?',
        'Mobility ist wie guter Sex – regelmäßig und mit voller Hingabe.',
        'Auch Ruhetage haben einen G-Punkt: den Gluteus. Dehn ihn.',
        'Cat-Cow ist nicht das Einzige, was du auf allen Vieren machen solltest.',
        'Dein Körper schreit nach Aufmerksamkeit, Mäuschen. Gib sie ihm. Heute sanft.',
        'Steife Schultern? Das kommt vom vielen Handy. Und von sonst nix. Klar.',
        'Die Kobra-Dehnung ist wie aufwachen nach einer guten Nacht. Nur besser.',
        'Deine Muskeln haben gestern geliefert, Mäuschen. Heute werden sie verwöhnt.',
        'Beweglichkeit ist Freiheit. Freiheit ist geil. Also: Dehnen!',
        'Dein innerer Schweinehund macht heute Yoga. Mach mit.',
        'Ruhetag-Motto: langsam, tief, kontrolliert. Wie beim... Atmen natürlich.',
        'Wer geschmeidig ist, hat mehr vom Leben, Mäuschen. In jeder Hinsicht. 😘',
        'Dein Rücken ist krummer als deine Ausreden. Streck dich mal.',
        'Heute wird nicht geschwitzt, sondern geseufzt. Vor Erleichterung.',
        'Deine Hüften lügen nicht, Mäuschen – und die sagen: DEHN MICH.',
      ];
      const quoteIdx = Math.floor(new Date().getTime() / 86400000) % restDayQuotes.length;

      todayCard.classList.remove('hidden');
      todayCard.innerHTML = `
        <div class="today-workout-inner mobility-day">
          <div class="today-label">🧘 Ruhetag</div>
          <div class="today-name">Mobility & Stretching</div>
          <div class="today-nameDE">Dehnung, Beweglichkeit & Recovery · ~12 Min.</div>
          <div class="rest-day-quote">${restDayQuotes[quoteIdx]}</div>
          <button class="btn btn-primary btn-block" id="btn-start-mobility">Session starten</button>
        </div>
      `;
      todayCard.querySelector('#btn-start-mobility').addEventListener('click', () => startMobilitySession());
    }

    // Plan days list
    const list = document.getElementById('plan-days-list');
    list.innerHTML = '';

    state.plan.days.forEach((day, idx) => {
      const card = document.createElement('div');
      card.className = 'plan-day-card';

      const doneToday = logs.some(l => l.dayIndex === idx && new Date(l.date).toDateString() === today);
      const mainExercises = day.exercises.filter(e => !e.isWarmup && !e.isCooldown && !e.isWarmupSet);
      const assignedDay = preferred[idx] ? DAY_NAME_MAP[preferred[idx]] : null;
      const isToday = preferred[idx] === todayKey;

      if (doneToday) card.classList.add('completed-today');
      if (isToday && !doneToday) card.classList.add('is-today');

      card.innerHTML = `
        <div class="plan-day-name">${assignedDay ? assignedDay + ' — ' : ''}${day.name}</div>
        <div class="plan-day-nameDE">${day.nameDE}</div>
        <div class="plan-day-meta">${mainExercises.length} Übungen${day.isDeload ? ' · 🔄 Deload' : ''}${isToday && !doneToday ? ' · 📍 Heute' : ''}${doneToday ? ' · ✅ Erledigt' : ''}</div>
      `;
      card.addEventListener('click', () => showPlanDetail(idx));
      list.appendChild(card);
    });
  }

  function showStatDetail(title, logsToShow) {
    const modal = document.getElementById('modal-day-detail');
    const content = document.getElementById('day-detail-content');

    let totalDuration = 0, totalSets = 0, totalVolume = 0;
    logsToShow.forEach(log => {
      totalDuration += log.duration || 0;
      (log.exercises || []).forEach(ex => {
        if (ex.isWarmup || ex.isCooldown || ex.isWarmupSet) return;
        ex.sets.filter(s => s.completed).forEach(s => {
          totalSets++;
          if (s.reps && s.weight) totalVolume += s.reps * s.weight;
        });
      });
    });

    let html = `<h3>${title}</h3>`;
    html += `<div class="stat-detail-summary">
      <span>${Math.round(totalDuration / 60)} Min. gesamt</span>
      <span>${totalSets} Sätze</span>
      ${totalVolume > 0 ? `<span>${Math.round(totalVolume).toLocaleString('de-DE')} kg Volumen</span>` : ''}
    </div>`;

    logsToShow.forEach(log => {
      const dateStr = new Date(log.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
      const min = Math.floor((log.duration || 0) / 60);
      const sets = (log.exercises || []).reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0);
      html += `<div class="stat-detail-row">
        <span class="stat-detail-date">${dateStr}</span>
        <span class="stat-detail-name">${log.dayName}</span>
        <span class="stat-detail-meta">${min} Min. · ${sets} Sets</span>
      </div>`;
    });

    content.innerHTML = html;
    modal.classList.remove('hidden');
  }

  // ── Activity Logging ─────────────────────────────────────

  function formatLocalDatetime(date) {
    const d = date instanceof Date ? date : new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function openActivityModal() {
    document.getElementById('activity-type').value = 'cycling';
    document.getElementById('activity-duration').value = '';
    document.getElementById('activity-distance').value = '';
    document.getElementById('activity-notes').value = '';
    document.getElementById('activity-date').value = formatLocalDatetime(new Date());
    document.getElementById('modal-activity').classList.remove('hidden');
  }

  function saveActivity() {
    const type = document.getElementById('activity-type').value;
    const duration = +document.getElementById('activity-duration').value;
    const distance = +document.getElementById('activity-distance').value || null;
    const dateStr = document.getElementById('activity-date').value;
    const notes = document.getElementById('activity-notes').value.trim();

    if (!duration || duration < 1) { alert('Bitte Dauer in Minuten eingeben.'); return; }

    const log = {
      id: 'log_' + Date.now(),
      date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
      type: 'activity',
      activityType: type,
      dayName: ACTIVITY_NAMES[type] || 'Aktivität',
      duration: duration * 60,
      distance,
      notes,
      exercises: []
    };
    state.logs.push(log);
    saveLogs();
    hapticMedium();
    document.getElementById('modal-activity').classList.add('hidden');
    if (state.activeScreen === 'dashboard') renderDashboard();
    if (state.activeScreen === 'progress') renderProgress();
  }

  // ── Quick Exercise Logging ───────────────────────────────

  function openQuickLogModal() {
    const select = document.getElementById('quick-exercise');
    select.innerHTML = '';
    const mainCategories = ['upper_push', 'upper_pull', 'lower', 'core', 'compound'];
    window.EXERCISES
      .filter(e => mainCategories.includes(e.category))
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(ex => {
        const opt = document.createElement('option');
        opt.value = ex.id;
        opt.textContent = `${ex.name} (${ex.nameDE})`;
        select.appendChild(opt);
      });

    document.getElementById('quick-sets').value = '1';
    document.getElementById('quick-reps').value = '';
    document.getElementById('quick-weight').value = '';
    document.getElementById('quick-date').value = formatLocalDatetime(new Date());
    document.getElementById('modal-quick-log').classList.remove('hidden');
  }

  function saveQuickLog() {
    const exerciseId = document.getElementById('quick-exercise').value;
    const setsCount = +document.getElementById('quick-sets').value || 1;
    const reps = +document.getElementById('quick-reps').value;
    const weight = +document.getElementById('quick-weight').value || null;
    const dateStr = document.getElementById('quick-date').value;

    if (!reps || reps < 1) { alert('Bitte Wiederholungen eingeben.'); return; }
    const exercise = window.getExercise(exerciseId);
    if (!exercise) { alert('Bitte Übung wählen.'); return; }

    const totalReps = setsCount * reps;
    const sets = [];
    for (let i = 0; i < setsCount; i++) {
      sets.push({ reps, weight, duration: null, completed: true });
    }

    const log = {
      id: 'log_' + Date.now(),
      date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
      type: 'quick',
      dayName: `⚡ ${totalReps}× ${exercise.name}`,
      duration: 0,
      exercises: [{
        exerciseId,
        isWarmup: false, isCooldown: false, isWarmupSet: false,
        sets
      }]
    };
    state.logs.push(log);
    saveLogs();
    hapticMedium();
    document.getElementById('modal-quick-log').classList.add('hidden');
    if (state.activeScreen === 'dashboard') renderDashboard();
    if (state.activeScreen === 'progress') renderProgress();
  }

  // ── Steps Tracking ───────────────────────────────────────

  function getTodaySteps() {
    const today = new Date().toDateString();
    const entry = state.stepLog.find(e => new Date(e.date).toDateString() === today);
    return entry ? entry.steps : 0;
  }

  function openStepsModal() {
    document.getElementById('steps-input').value = getTodaySteps() || '';
    document.getElementById('modal-steps').classList.remove('hidden');
    setTimeout(() => document.getElementById('steps-input').focus(), 100);
  }

  function saveSteps() {
    const steps = +document.getElementById('steps-input').value;
    if (isNaN(steps) || steps < 0) { alert('Bitte gültige Zahl eingeben.'); return; }
    const today = new Date().toDateString();
    const existing = state.stepLog.findIndex(e => new Date(e.date).toDateString() === today);
    const entry = { date: new Date().toISOString(), steps };
    if (existing >= 0) state.stepLog[existing] = entry;
    else state.stepLog.push(entry);
    saveStepLog();
    hapticLight();
    document.getElementById('modal-steps').classList.add('hidden');
    renderStepsWidget();
  }

  function renderStepsWidget() {
    const widget = document.getElementById('steps-widget');
    if (!widget) return;
    if (!state.profile || state.profile.stepsTracking === false) {
      widget.classList.add('hidden');
      return;
    }
    widget.classList.remove('hidden');
    const today = getTodaySteps();
    const goal = state.profile.stepGoal || 8000;
    const pct = Math.min(100, (today / goal) * 100);
    const circumference = 2 * Math.PI * 26;
    const offset = circumference * (1 - pct / 100);

    widget.innerHTML = `
      <div class="steps-ring">
        <svg viewBox="0 0 64 64" width="64" height="64">
          <circle cx="32" cy="32" r="26" fill="none" stroke="var(--border)" stroke-width="5"/>
          <circle cx="32" cy="32" r="26" fill="none" stroke="var(--primary)" stroke-width="5"
            stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
            transform="rotate(-90 32 32)" style="transition:stroke-dashoffset 0.4s"/>
        </svg>
        <div class="steps-ring-num">${today >= 1000 ? Math.round(today/100)/10 + 'k' : today}</div>
      </div>
      <div class="steps-info">
        <div class="steps-label">Schritte heute</div>
        <div class="steps-value">${today.toLocaleString('de-DE')} / ${goal.toLocaleString('de-DE')}</div>
      </div>
      <button class="steps-edit-btn" id="steps-edit" type="button">✎</button>
    `;
    widget.onclick = openStepsModal;
  }

  // ── Week Calendar ────────────────────────────────────────

  let calendarWeekOffset = 0;

  function renderWeekCalendar() {
    const cal = document.getElementById('week-calendar');
    if (!cal) return;
    cal.innerHTML = '';

    const now = new Date();
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + calendarWeekOffset * 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const dayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateStr = d.toDateString();
      const isToday = d.toDateString() === now.toDateString();
      const dayLogs = state.logs.filter(l => new Date(l.date).toDateString() === dateStr);
      const hasWorkout = dayLogs.length > 0;

      const div = document.createElement('div');
      div.className = 'cal-day' + (isToday ? ' today' : '') + (hasWorkout ? ' done' : '');
      div.innerHTML = `<span class="cal-label">${dayLabels[i]}</span><span class="cal-num">${d.getDate()}</span>`;

      if (hasWorkout) {
        div.style.cursor = 'pointer';
        div.addEventListener('click', () => showDayDetail(dateStr, dayLogs));
      }

      cal.appendChild(div);
    }

    // Week label
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const label = document.getElementById('cal-week-label');
    if (label) {
      const fmt = d => `${d.getDate()}. ${d.toLocaleDateString('de-DE', { month: 'short' })}`;
      if (calendarWeekOffset === 0) {
        label.textContent = 'Diese Woche';
      } else {
        label.textContent = `${fmt(startOfWeek)} – ${fmt(endOfWeek)}`;
      }
    }

    // Nav button visibility
    const prevBtn = document.getElementById('cal-prev');
    const nextBtn = document.getElementById('cal-next');
    const todayBtn = document.getElementById('cal-today-btn');
    if (nextBtn) nextBtn.style.visibility = calendarWeekOffset >= 0 ? 'hidden' : 'visible';
    if (prevBtn) prevBtn.style.visibility = 'visible';
    if (todayBtn) todayBtn.classList.toggle('hidden', calendarWeekOffset === 0);
  }

  function initCalendarSwipe() {
    const cal = document.getElementById('week-calendar');
    if (!cal) return;
    let touchStartX = 0;

    cal.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    cal.addEventListener('touchend', e => {
      const diff = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(diff) > 50) {
        calendarWeekOffset += diff > 0 ? -1 : 1;
        if (calendarWeekOffset > 0) calendarWeekOffset = 0;
        renderWeekCalendar();
      }
    }, { passive: true });

    document.getElementById('cal-prev').addEventListener('click', () => {
      calendarWeekOffset--;
      renderWeekCalendar();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
      if (calendarWeekOffset < 0) { calendarWeekOffset++; renderWeekCalendar(); }
    });
    document.getElementById('cal-today-btn').addEventListener('click', () => {
      calendarWeekOffset = 0; renderWeekCalendar();
    });
  }

  function showDayDetail(dateStr, dayLogs) {
    const modal = document.getElementById('modal-day-detail');
    const content = document.getElementById('day-detail-content');

    const dateFormatted = new Date(dateStr).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
    let html = `<h3>${dateFormatted}</h3>`;

    dayLogs.forEach(log => {
      const min = Math.floor((log.duration || 0) / 60);
      const exList = log.exercises || [];

      // Activity log: show simple header
      if (log.type === 'activity') {
        const icon = ACTIVITY_ICONS[log.activityType] || '🎯';
        const distStr = log.distance ? ` · ${log.distance} km` : '';
        html += `
          <div class="day-detail-workout">
            <div class="day-detail-header">
              <span class="day-detail-name">${icon} ${log.dayName}</span>
              <span class="day-detail-meta">${min} Min.${distStr}</span>
            </div>
            ${log.notes ? `<div style="font-size:0.85rem;color:var(--text-light);margin-top:4px">${log.notes}</div>` : ''}
          </div>
        `;
        return;
      }

      const mainExercises = exList.filter(e => !e.isWarmup && !e.isCooldown && !e.isWarmupSet);
      const totalSets = mainExercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0);

      html += `
        <div class="day-detail-workout">
          <div class="day-detail-header">
            <span class="day-detail-name">${log.dayName}</span>
            <span class="day-detail-meta">${min} Min. · ${totalSets} Sätze</span>
          </div>
          <div class="day-detail-exercises">
      `;

      const allExercises = exList.filter(e => !e.isWarmup && !e.isCooldown && !e.isWarmupSet);
      if (allExercises.length === 0) {
        // Show all exercises if no main ones (shouldn't happen, but safety)
        exList.forEach(ex => allExercises.push(ex));
      }

      allExercises.forEach(ex => {
        const exercise = window.getExercise(ex.exerciseId);
        if (!exercise) return;
        const completed = ex.sets.filter(s => s.completed);

        let detail = '';
        if (completed.length === 0) {
          detail = '–';
        } else if (completed[0].duration) {
          detail = completed.map(s => `${s.duration}s`).join(', ');
        } else if (completed[0].weight) {
          detail = completed.map(s => `${s.reps}× ${s.weight}kg`).join(', ');
        } else {
          detail = completed.map(s => `${s.reps} Wdh.`).join(', ');
        }

        html += `
          <div class="day-detail-ex">
            <span class="day-detail-ex-name">${exercise.name}</span>
            <span class="day-detail-ex-sets">${detail}</span>
          </div>
        `;
      });

      html += '</div></div>';
    });

    content.innerHTML = html;
    modal.classList.remove('hidden');
  }

  function calculateStreak(logs) {
    if (logs.length === 0) return 0;
    const dates = [...new Set(logs.map(l => new Date(l.date).toDateString()))].sort((a, b) => new Date(b) - new Date(a));
    let streak = 0;
    let checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);
    if (dates[0] !== checkDate.toDateString()) {
      checkDate.setDate(checkDate.getDate() - 1);
      if (dates[0] !== checkDate.toDateString()) return 0;
    }
    for (const d of dates) {
      if (d === checkDate.toDateString()) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
      else break;
    }
    return streak;
  }

  function countThisWeek(logs) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    start.setHours(0, 0, 0, 0);
    return logs.filter(l => new Date(l.date) >= start).length;
  }

  // ── Plan Detail ──────────────────────────────────────────

  function regenerateDayExercises(dayIdx, newSplit) {
    const profile = state.profile;
    const day = state.plan.days[dayIdx];

    const splitNames = {
      full_body: { name: 'Full Body', nameDE: 'Ganzkörper' },
      upper: { name: 'Upper Body', nameDE: 'Oberkörper' },
      lower: { name: 'Lower Body', nameDE: 'Unterkörper' },
      push: { name: 'Push', nameDE: 'Drücken' },
      pull: { name: 'Pull', nameDE: 'Ziehen' },
      legs: { name: 'Legs', nameDE: 'Beine' },
      core: { name: 'Core', nameDE: 'Core & Bauch' }
    };

    const info = splitNames[newSplit] || splitNames.full_body;
    day.split = newSplit;
    day.name = info.name;
    day.nameDE = info.nameDE;

    const warmupTime = 5, cooldownTime = 4;
    const minutesPerExercise = profile.goal === 'build_muscle' ? 6 : 5;
    const availableMinutes = (profile.minutesPerSession || 45) - warmupTime - cooldownTime;
    const exerciseCount = Math.max(3, Math.min(10, Math.floor(availableMinutes / minutesPerExercise)));
    const restSec = { lose_weight: 30, build_muscle: 75, general_fitness: 60, tone: 45 }[profile.goal] || 60;
    const isDeload = day.isDeload;

    const warmup = window.Planner._generateWarmup(newSplit);
    const cooldown = day.exercises.filter(e => e.isCooldown);
    const exercises = window.Planner._selectExercises(newSplit, profile, exerciseCount);

    const repScheme = { lose_weight: { sets: 3, reps: 15 }, build_muscle: { sets: 4, reps: 10 },
      general_fitness: { sets: 3, reps: 12 }, tone: { sets: 3, reps: 15 } }[profile.goal] || { sets: 3, reps: 12 };

    const newEntries = exercises.map(ex => {
      const weight = window.Planner._getStartWeight(profile.fitnessLevel, ex, profile.strengthTest);
      if (ex.isTimed) {
        const base = ex.defaultDuration || 30;
        return { exerciseId: ex.id, sets: 3, reps: null, duration: base, weight: null,
          restSeconds: restSec, isWarmup: false, isCooldown: false, isWarmupSet: false };
      }
      return { exerciseId: ex.id, sets: repScheme.sets, reps: repScheme.reps, duration: null,
        weight: weight, restSeconds: restSec, isWarmup: false, isCooldown: false, isWarmupSet: false };
    });

    day.exercises = [...warmup, ...newEntries, ...cooldown];
    savePlan();
  }

  function showPlanDetail(dayIdx) {
    if (!state.plan || !state.plan.days || !state.profile) return;
    const day = state.plan.days[dayIdx];
    if (!day) return;

    const preferred = getPreferredSorted();
    const assigned = preferred[dayIdx] ? DAY_NAME_MAP[preferred[dayIdx]] : null;
    document.getElementById('plan-detail-title').textContent = `${assigned ? assigned + ' — ' : ''}${day.name}`;

    // Day selector
    const daySelect = document.getElementById('day-select');
    const currentDayKey = preferred[dayIdx] || '';
    daySelect.value = currentDayKey;
    daySelect.onchange = () => {
      const newDay = daySelect.value;
      const days = state.profile.preferredDays || [];

      // Remove old assignment for this slot
      if (currentDayKey && days.includes(currentDayKey)) {
        state.profile.preferredDays = days.filter(d => d !== currentDayKey);
      }

      if (newDay) {
        // If another slot uses this day, swap them
        const otherIdx = preferred.indexOf(newDay);
        if (otherIdx >= 0 && otherIdx !== dayIdx && currentDayKey) {
          // Replace the other slot's day with our old day
          const pos = state.profile.preferredDays.indexOf(newDay);
          if (pos >= 0) state.profile.preferredDays[pos] = currentDayKey;
        } else if (otherIdx >= 0 && otherIdx !== dayIdx) {
          // Other slot loses its day
          state.profile.preferredDays = state.profile.preferredDays.filter(d => d !== newDay);
        }

        if (!state.profile.preferredDays.includes(newDay)) {
          state.profile.preferredDays.push(newDay);
        }
      }

      saveProfile();
      showPlanDetail(dayIdx);
    };

    // Split selector
    const splitSelect = document.getElementById('split-select');
    splitSelect.value = day.split;
    splitSelect.onchange = () => {
      regenerateDayExercises(dayIdx, splitSelect.value);
      showPlanDetail(dayIdx);
    };

    const container = document.getElementById('plan-detail-exercises');
    container.innerHTML = '';

    let warmupStarted = false, mainStarted = false, cooldownStarted = false;
    let num = 0;

    day.exercises.forEach(ex => {
      const exercise = window.getExercise(ex.exerciseId);
      if (!exercise) return;

      if (ex.isWarmup && !warmupStarted) {
        warmupStarted = true;
        const lbl = document.createElement('div');
        lbl.className = 'warmup-section-label';
        lbl.textContent = 'Aufwärmen';
        container.appendChild(lbl);
      }
      if (!ex.isWarmup && !ex.isCooldown && !ex.isWarmupSet && !mainStarted) {
        mainStarted = true; num = 0;
        const lbl = document.createElement('div');
        lbl.className = 'main-section-label';
        lbl.textContent = 'Training';
        container.appendChild(lbl);
      }
      if (ex.isCooldown && !cooldownStarted) {
        cooldownStarted = true;
        const lbl = document.createElement('div');
        lbl.className = 'cooldown-section-label';
        lbl.textContent = 'Cooldown';
        container.appendChild(lbl);
      }

      num++;
      const card = document.createElement('div');
      card.className = 'exercise-card' + (ex.isWarmup ? ' warmup' : '') + (ex.isCooldown ? ' cooldown' : '') + (ex.isWarmupSet ? ' warmup-set' : '');

      let meta = '';
      if (ex.duration) meta = `${ex.sets}× ${ex.duration}s`;
      else { meta = `${ex.sets}× ${ex.reps} Wdh.`; if (ex.weight) meta += ` · ${ex.weight} kg`; }
      if (ex.restSeconds && !ex.isWarmup && !ex.isCooldown) meta += ` · ${ex.restSeconds}s Pause`;
      if (ex.isWarmupSet) meta = `Aufwärmsatz · ${meta}`;

      // Last performance
      const lastPerf = getLastPerformance(ex.exerciseId);
      let lastStr = '';
      if (lastPerf && !ex.isWarmup && !ex.isCooldown && !ex.isWarmupSet) {
        const last = lastPerf[0];
        if (last.weight) lastStr = `Letztes Mal: ${last.reps}× ${last.weight}kg`;
        else if (last.reps) lastStr = `Letztes Mal: ${last.reps} Wdh.`;
        else if (last.duration) lastStr = `Letztes Mal: ${last.duration}s`;
      }

      const isMain = !ex.isWarmup && !ex.isCooldown && !ex.isWarmupSet;
      const mainExercises = day.exercises.filter(e => !e.isWarmup && !e.isCooldown && !e.isWarmupSet);
      const mainIdx = mainExercises.indexOf(ex);
      const exGlobalIdx = day.exercises.indexOf(ex);

      card.innerHTML = `
        <div class="exercise-num">${num}</div>
        <div class="exercise-info">
          <div class="exercise-name">${exercise.name}${exercise.isUnilateral ? ' <span class="unilateral-badge">pro Seite</span>' : ''}</div>
          <div class="exercise-nameDE">${exercise.nameDE}</div>
          <div class="exercise-meta">${meta}</div>
          ${lastStr ? `<div class="exercise-last">${lastStr}</div>` : ''}
        </div>
        ${isMain ? `<div class="exercise-reorder">
          <button type="button" class="reorder-btn reorder-up" ${mainIdx === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" class="reorder-btn reorder-down" ${mainIdx === mainExercises.length - 1 ? 'disabled' : ''}>▼</button>
        </div>` : ''}
        <button class="exercise-info-btn">ℹ</button>
      `;

      if (isMain) {
        const upBtn = card.querySelector('.reorder-up');
        const downBtn = card.querySelector('.reorder-down');
        if (upBtn && mainIdx > 0) {
          upBtn.addEventListener('click', e => {
            e.stopPropagation(); hapticLight();
            const prevMainEx = mainExercises[mainIdx - 1];
            const prevGlobalIdx = day.exercises.indexOf(prevMainEx);
            [day.exercises[exGlobalIdx], day.exercises[prevGlobalIdx]] = [day.exercises[prevGlobalIdx], day.exercises[exGlobalIdx]];
            savePlan(); showPlanDetail(dayIdx);
          });
        }
        if (downBtn && mainIdx < mainExercises.length - 1) {
          downBtn.addEventListener('click', e => {
            e.stopPropagation(); hapticLight();
            const nextMainEx = mainExercises[mainIdx + 1];
            const nextGlobalIdx = day.exercises.indexOf(nextMainEx);
            [day.exercises[exGlobalIdx], day.exercises[nextGlobalIdx]] = [day.exercises[nextGlobalIdx], day.exercises[exGlobalIdx]];
            savePlan(); showPlanDetail(dayIdx);
          });
        }
      }

      card.querySelector('.exercise-info-btn').addEventListener('click', e => {
        e.stopPropagation();
        showExerciseModal(exercise.id);
      });

      container.appendChild(card);
    });

    document.getElementById('btn-start-workout').onclick = () => startWorkout(dayIdx);
    showScreen('plan-detail');
  }

  // ── Exercise Modal ───────────────────────────────────────

  function showExerciseModal(exerciseId) {
    const ex = window.getExercise(exerciseId);
    if (!ex) return;

    document.getElementById('modal-ex-name').textContent = ex.name;
    document.getElementById('modal-ex-nameDE').textContent = ex.nameDE;
    document.getElementById('modal-ex-desc').textContent = ex.description;

    const badges = document.getElementById('modal-ex-badges');
    badges.innerHTML = '';
    const muscleMap = {
      chest: 'Brust', shoulders: 'Schultern', triceps: 'Trizeps', biceps: 'Bizeps',
      back: 'Rücken', core: 'Core', quads: 'Quadrizeps', glutes: 'Gesäß',
      hamstrings: 'Beinbeuger', calves: 'Waden', obliques: 'Schräge Bauchm.',
      full_body: 'Ganzkörper', hips: 'Hüfte', legs: 'Beine', hip_flexors: 'Hüftbeuger',
      adductors: 'Adduktoren'
    };
    const equipMap = {
      bodyweight: 'Körpergewicht', kettlebell: 'Kettlebell', dumbbell: 'Kurzhantel',
      dip_bars: 'Dip-Barren', pull_up_bar: 'Klimmzugstange', rings: 'Ringe',
      resistance_band: 'Gymnastikband'
    };
    ex.muscleGroups.forEach(m => { badges.innerHTML += `<span class="badge badge-muscle">${muscleMap[m] || m}</span>`; });
    ex.equipment.forEach(e => { badges.innerHTML += `<span class="badge badge-equipment">${equipMap[e] || e}</span>`; });

    document.getElementById('modal-video-link').href = `https://www.youtube.com/results?search_query=${ex.videoSearch}`;

    // Notes
    const noteInput = document.getElementById('modal-note-input');
    noteInput.value = state.notes[exerciseId] || '';
    noteInput.dataset.exerciseId = exerciseId;

    document.getElementById('modal-exercise').classList.remove('hidden');
  }

  // ── Active Workout ───────────────────────────────────────

  function startMobilitySession() {
    const exercises = window.Planner.generateMobilitySession();
    state.currentWorkout = {
      dayIndex: -1, dayName: 'Mobility & Stretching',
      exercises: exercises.map(ex => ({
        exerciseId: ex.exerciseId,
        isWarmup: false, isCooldown: false, isWarmupSet: false,
        targetSets: ex.sets, targetReps: ex.reps, targetDuration: ex.duration,
        targetWeight: null, restSeconds: ex.restSeconds,
        sets: [{ reps: null, weight: null, duration: null, completed: false }]
      })),
      startedAt: new Date().toISOString(),
      prs: []
    };

    document.getElementById('workout-title').textContent = 'Mobility & Stretching';
    renderWorkout();
    showScreen('workout');
    startWorkoutTimer();
    requestWakeLock();
  }

  function startWorkout(dayIdx) {
    if (!state.plan || !state.plan.days) return;
    const day = state.plan.days[dayIdx];
    if (!day) return;

    state.currentWorkout = {
      dayIndex: dayIdx, dayName: day.name,
      exercises: day.exercises.map(ex => ({
        exerciseId: ex.exerciseId,
        isWarmup: ex.isWarmup, isCooldown: ex.isCooldown, isWarmupSet: ex.isWarmupSet,
        targetSets: ex.sets, targetReps: ex.reps, targetDuration: ex.duration,
        targetWeight: ex.weight, restSeconds: ex.restSeconds,
        sets: Array.from({ length: ex.sets }, () => ({
          reps: null, weight: ex.weight, duration: null, completed: false
        }))
      })),
      startedAt: new Date().toISOString(),
      prs: []
    };

    document.getElementById('workout-title').textContent = day.name;
    renderWorkout();
    showScreen('workout');
    startWorkoutTimer();
    requestWakeLock();
  }

  function renderWorkout() {
    const wo = state.currentWorkout;
    const container = document.getElementById('workout-content');
    container.innerHTML = '';

    let warmupStarted = false, mainStarted = false, cooldownStarted = false;
    let totalSets = 0, completedSets = 0;

    wo.exercises.forEach((ex, exIdx) => {
      const exercise = window.getExercise(ex.exerciseId);
      if (!exercise) return;

      if (ex.isWarmup && !warmupStarted) {
        warmupStarted = true;
        const label = document.createElement('div');
        label.className = 'warmup-section-label';
        label.textContent = 'Aufwärmen';
        container.appendChild(label);
      }
      if (!ex.isWarmup && !ex.isCooldown && !ex.isWarmupSet && !mainStarted) {
        mainStarted = true;
        const label = document.createElement('div');
        label.className = 'main-section-label';
        label.textContent = 'Training';
        container.appendChild(label);
      }
      if (ex.isCooldown && !cooldownStarted) {
        cooldownStarted = true;
        const label = document.createElement('div');
        label.className = 'cooldown-section-label';
        label.textContent = 'Cooldown / Stretching';
        container.appendChild(label);
      }

      const card = document.createElement('div');
      card.className = 'workout-exercise-card';
      card.dataset.exIdx = exIdx;

      // Last performance hint
      const lastPerf = getLastPerformance(ex.exerciseId);
      let lastHint = '';
      if (lastPerf && !ex.isWarmup && !ex.isCooldown && !ex.isWarmupSet) {
        const l = lastPerf[0];
        if (l.weight) lastHint = `<div class="last-perf-hint">Letztes Mal: ${l.reps}× ${l.weight}kg</div>`;
        else if (l.duration) lastHint = `<div class="last-perf-hint">Letztes Mal: ${l.duration}s</div>`;
      }

      // Notes indicator
      const hasNote = state.notes[ex.exerciseId];

      const header = document.createElement('div');
      header.className = 'workout-ex-header';
      header.innerHTML = `
        <div>
          <div class="workout-ex-name">${exercise.name}${ex.isWarmupSet ? ' <span class="warmup-set-badge">Aufwärmsatz</span>' : ''}${exercise.isUnilateral ? ' <span class="unilateral-badge">pro Seite</span>' : ''}</div>
          <div class="workout-ex-nameDE">${exercise.nameDE}</div>
          ${lastHint}
          ${hasNote ? `<div class="note-hint">📝 ${hasNote}</div>` : ''}
        </div>
        <div class="workout-ex-actions">
          <button type="button" class="exercise-info-btn">ℹ</button>
          ${!ex.isWarmup && !ex.isCooldown && !ex.isWarmupSet ?
            '<button type="button" class="exercise-swap-btn" title="Übung tauschen">🔄</button>' : ''}
        </div>
      `;

      header.querySelector('.exercise-info-btn').addEventListener('click', e => {
        e.stopPropagation(); showExerciseModal(exercise.id);
      });

      const swapBtn = header.querySelector('.exercise-swap-btn');
      if (swapBtn) {
        swapBtn.addEventListener('click', e => {
          e.stopPropagation();
          const usedIds = wo.exercises.map(e => e.exerciseId);
          const alt = window.Planner.getAlternative(ex.exerciseId, usedIds);
          if (alt) {
            ex.exerciseId = alt.id;
            ex.sets.forEach(s => { s.completed = false; s.reps = null; s.duration = null; });
            renderWorkout();
          } else {
            alert('Keine Alternative verfügbar.');
          }
        });
      }

      card.appendChild(header);

      const setsDiv = document.createElement('div');
      setsDiv.className = 'workout-sets';

      ex.sets.forEach((set, setIdx) => {
        totalSets++;
        if (set.completed) completedSets++;

        const row = document.createElement('div');
        row.className = 'workout-set-row' + (set.completed ? ' completed' : '');

        const setNum = document.createElement('span');
        setNum.className = 'set-number';
        setNum.textContent = `Satz ${setIdx + 1}`;
        row.appendChild(setNum);

        if (exercise.isTimed || ex.targetDuration) {
          const target = document.createElement('span');
          target.className = 'set-target';
          target.textContent = `Ziel: ${ex.targetDuration}s`;
          row.appendChild(target);

          if (!set.completed) {
            const timerBtn = document.createElement('button');
            timerBtn.type = 'button';
            timerBtn.className = 'btn-timer-start';
            timerBtn.textContent = '⏱ Timer';
            timerBtn.addEventListener('click', () => {
              openExerciseTimer(exercise.name, ex.targetDuration, finalTime => {
                set.duration = finalTime;
                set.completed = true;
                renderWorkout();
                maybeShowRestTimer(ex, exIdx, setIdx);
              });
            });
            row.appendChild(timerBtn);
          } else {
            const done = document.createElement('span');
            done.className = 'set-target';
            done.style.color = 'var(--success)';
            done.textContent = `✓ ${set.duration}s`;
            row.appendChild(done);
          }
        } else {
          const target = document.createElement('span');
          target.className = 'set-target';
          target.textContent = `Ziel: ${ex.targetReps}× ${ex.targetWeight ? ex.targetWeight + 'kg' : ''}`;
          row.appendChild(target);

          if (!set.completed) {
            const inputGroup = document.createElement('div');
            inputGroup.className = 'set-input-group';

            // Reps stepper
            const repsMinus = document.createElement('button');
            repsMinus.type = 'button'; repsMinus.className = 'stepper-btn';
            repsMinus.textContent = '−';
            repsMinus.addEventListener('click', e => { e.stopPropagation(); hapticLight(); set.reps = Math.max(1, (set.reps || ex.targetReps) - 1); repsInput.value = set.reps; });
            inputGroup.appendChild(repsMinus);

            const repsInput = document.createElement('input');
            repsInput.type = 'number'; repsInput.className = 'set-input';
            repsInput.placeholder = ex.targetReps; repsInput.inputMode = 'numeric';
            repsInput.value = set.reps || '';
            repsInput.addEventListener('input', e => { set.reps = +e.target.value; });
            inputGroup.appendChild(repsInput);

            const repsPlus = document.createElement('button');
            repsPlus.type = 'button'; repsPlus.className = 'stepper-btn';
            repsPlus.textContent = '+';
            repsPlus.addEventListener('click', e => { e.stopPropagation(); hapticLight(); set.reps = (set.reps || ex.targetReps) + 1; repsInput.value = set.reps; });
            inputGroup.appendChild(repsPlus);

            const repsLabel = document.createElement('span');
            repsLabel.className = 'set-input-label';
            repsLabel.textContent = 'Wdh';
            inputGroup.appendChild(repsLabel);

            // Weight input (always shown – optional for bodyweight exercises)
            if (!ex.isWarmup && !ex.isCooldown) {
              const sep = document.createElement('span');
              sep.className = 'set-input-sep';
              inputGroup.appendChild(sep);

              const defaultW = ex.targetWeight || 0;
              const wMinus = document.createElement('button');
              wMinus.type = 'button'; wMinus.className = 'stepper-btn';
              wMinus.textContent = '−';
              wMinus.addEventListener('click', e => { e.stopPropagation(); hapticLight(); set.weight = Math.max(0, (set.weight || defaultW) - 0.5); wInput.value = set.weight || ''; });
              inputGroup.appendChild(wMinus);

              const wInput = document.createElement('input');
              wInput.type = 'number'; wInput.className = 'set-input' + (!ex.targetWeight ? ' set-input-optional' : '');
              wInput.placeholder = ex.targetWeight || '–';
              wInput.inputMode = 'decimal'; wInput.step = '0.5';
              wInput.value = set.weight || '';
              wInput.addEventListener('input', e => { set.weight = +e.target.value || null; });
              inputGroup.appendChild(wInput);

              const wPlus = document.createElement('button');
              wPlus.type = 'button'; wPlus.className = 'stepper-btn';
              wPlus.textContent = '+';
              wPlus.addEventListener('click', e => { e.stopPropagation(); hapticLight(); set.weight = (set.weight || defaultW) + 0.5; wInput.value = set.weight; });
              inputGroup.appendChild(wPlus);

              const kgLabel = document.createElement('span');
              kgLabel.className = 'set-input-label';
              kgLabel.textContent = 'kg';
              inputGroup.appendChild(kgLabel);
            }
            row.appendChild(inputGroup);
          } else {
            const done = document.createElement('span');
            done.className = 'set-target';
            done.style.color = 'var(--success)';
            done.textContent = `✓ ${set.reps}× ${set.weight ? set.weight + 'kg' : ''}`;
            row.appendChild(done);
          }
        }

        // Done button
        const doneBtn = document.createElement('button');
        doneBtn.type = 'button';
        doneBtn.className = 'btn-set-done' + (set.completed ? ' done' : '');
        doneBtn.textContent = '✓';
        if (!set.completed) {
          doneBtn.addEventListener('click', () => {
            if (!(exercise.isTimed || ex.targetDuration)) {
              if (!set.reps) set.reps = ex.targetReps;
              if (!set.weight && ex.targetWeight) set.weight = ex.targetWeight;
            }
            set.completed = true;

            // PR check
            if (!ex.isWarmup && !ex.isCooldown && !ex.isWarmupSet) {
              if (checkForPR(ex.exerciseId, ex.sets)) {
                if (!wo.prs.includes(ex.exerciseId)) {
                  wo.prs.push(ex.exerciseId);
                  showConfetti();
                  doneBeep();
                  hapticHeavy();
                }
              }
            }

            hapticMedium();
            renderWorkout();
            maybeShowRestTimer(ex, exIdx, setIdx);
          });
        }
        row.appendChild(doneBtn);
        setsDiv.appendChild(row);
      });

      card.appendChild(setsDiv);
      container.appendChild(card);
    });

    // Progress bar + percentage
    const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
    const pct = Math.round(progress);
    document.getElementById('workout-progress-fill').style.width = progress + '%';

    let progressEl = document.getElementById('workout-progress-text');
    if (!progressEl) {
      progressEl = document.createElement('div');
      progressEl.id = 'workout-progress-text';
      progressEl.className = 'workout-progress-text';
      document.querySelector('#screen-workout .workout-progress-bar').insertAdjacentElement('afterend', progressEl);
    }
    const motivations = {
      0:   ['Auf die Matte, Prinzessin! 👑', 'Dein Schweinehund hat heute frei. Du nicht.', 'Eisen biegt sich nicht von allein!'],
      25:  [`${pct}% – Läuft bei dir!`, `${pct}% – Aufwärmen war gestern, jetzt wird\'s ernst!`, `${pct}% – Dranbleiben, Süße!`],
      50:  [`${pct}% – Halbzeit, Baby!`, `${pct}% – Die Hälfte gehört dir!`, `${pct}% – Dein Sofa vermisst dich. Ignorier es.`],
      75:  [`${pct}% – Du bist eine Maschine!`, `${pct}% – Fast durch, gib alles!`, `${pct}% – Aufgeben? Kennen wir nicht.`],
      100: ['100% – Kriegerin! 👑🔥', '100% – Das Sofa hat dich verdient!', '100% – Absolut legendär! 🎉']
    };
    const bracket = pct === 0 ? 0 : pct < 25 ? 25 : pct < 50 ? 25 : pct < 75 ? 50 : pct < 100 ? 75 : 100;
    // Pick based on day so it varies but stays consistent within a workout
    const dayIdx = new Date().getDate() % motivations[bracket].length;
    progressEl.textContent = motivations[bracket][dayIdx];

    // Persist workout progress
    saveCurrentWorkout();

    // Check if all done
    if (wo.exercises.every(ex => ex.sets.every(s => s.completed)) && completedSets > 0) {
      setTimeout(() => finishWorkout(), 500);
    }

    const spacer = document.createElement('div');
    spacer.style.height = '100px';
    container.appendChild(spacer);
  }

  function maybeShowRestTimer(entry, exIdx, setIdx) {
    if (state.profile.restMode !== 'auto') return;
    if (entry.isCooldown) return;
    if (entry.isWarmup) {
      if (entry.restSeconds > 0) showRestTimer(entry.restSeconds, exIdx, setIdx);
      return;
    }
    const wo = state.currentWorkout;
    const isLastSet = setIdx >= entry.sets.length - 1;
    const isLastExercise = exIdx >= wo.exercises.length - 1;
    if (isLastSet && isLastExercise) return;
    showRestTimer(entry.restSeconds || 60, exIdx, setIdx);
  }

  // ── Timers ───────────────────────────────────────────────

  function startWorkoutTimer() {
    workoutStartTime = Date.now();
    clearInterval(workoutElapsedInterval);
    workoutElapsedInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - workoutStartTime) / 1000);
      document.getElementById('workout-elapsed').textContent =
        `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
    }, 1000);
  }

  function stopWorkoutTimer() { clearInterval(workoutElapsedInterval); }

  function showRestTimer(seconds, currentExIdx, currentSetIdx) {
    const overlay = document.getElementById('rest-overlay');
    overlay.classList.remove('hidden');
    restTimerRemaining = seconds;
    const total = seconds;
    const circumference = 2 * Math.PI * 54;

    const valueEl = document.getElementById('rest-timer-value');
    const progressEl = document.getElementById('rest-timer-progress');
    progressEl.style.strokeDasharray = circumference;

    const wo = state.currentWorkout;
    const nextInfo = document.getElementById('rest-next-exercise');
    const currentEx = wo.exercises[currentExIdx];
    const isLastSet = currentSetIdx >= currentEx.sets.length - 1;
    if (isLastSet && currentExIdx < wo.exercises.length - 1) {
      const next = window.getExercise(wo.exercises[currentExIdx + 1].exerciseId);
      nextInfo.textContent = next ? `Nächste Übung: ${next.name}` : '';
    } else if (!isLastSet) {
      nextInfo.textContent = `Nächster Satz: ${currentSetIdx + 2}`;
    } else {
      nextInfo.textContent = '';
    }

    clearInterval(restTimerInterval);
    const startTime = Date.now();

    restTimerInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      restTimerRemaining = Math.max(0, total - elapsed);
      valueEl.textContent = Math.ceil(restTimerRemaining);
      progressEl.style.strokeDashoffset = circumference * (1 - restTimerRemaining / total);

      // Countdown beeps at 3, 2, 1
      const rem = Math.ceil(restTimerRemaining);
      if (rem <= 3 && rem > 0 && Math.abs(restTimerRemaining - rem) < 0.06) countdownBeep();

      if (restTimerRemaining <= 0) {
        clearInterval(restTimerInterval);
        overlay.classList.add('hidden');
        doneBeep();
        hapticHeavy();
      }
    }, 50);
  }

  function openExerciseTimer(name, duration, callback) {
    const overlay = document.getElementById('exercise-timer-overlay');
    overlay.classList.remove('hidden');
    document.getElementById('timer-exercise-name').textContent = name;
    exerciseTimerTotal = duration;
    exerciseTimerRemaining = duration;
    exerciseTimerRunning = false;
    exerciseTimerCallback = callback;
    document.getElementById('exercise-timer-progress').style.strokeDasharray = 2 * Math.PI * 54;
    updateExerciseTimerDisplay();
    document.getElementById('btn-timer-toggle').textContent = 'Start';
  }

  function updateExerciseTimerDisplay() {
    const seconds = Math.floor(exerciseTimerRemaining);
    const cs = Math.floor((exerciseTimerRemaining % 1) * 100);
    document.getElementById('exercise-timer-value').textContent = `${seconds}.${String(cs).padStart(2, '0')}`;
    const circumference = 2 * Math.PI * 54;
    document.getElementById('exercise-timer-progress').style.strokeDashoffset =
      circumference * (1 - exerciseTimerRemaining / exerciseTimerTotal);
  }

  function toggleExerciseTimer() {
    if (exerciseTimerRunning) {
      exerciseTimerRunning = false;
      clearInterval(exerciseTimerInterval);
      document.getElementById('btn-timer-toggle').textContent = 'Weiter';
    } else {
      exerciseTimerRunning = true;
      document.getElementById('btn-timer-toggle').textContent = 'Pause';
      const startTime = Date.now();
      const startRemaining = exerciseTimerRemaining;
      clearInterval(exerciseTimerInterval);
      exerciseTimerInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        exerciseTimerRemaining = Math.max(0, startRemaining - elapsed);
        updateExerciseTimerDisplay();

        const rem = Math.ceil(exerciseTimerRemaining);
        if (rem <= 3 && rem > 0 && Math.abs(exerciseTimerRemaining - rem) < 0.02) countdownBeep();

        if (exerciseTimerRemaining <= 0) {
          clearInterval(exerciseTimerInterval);
          exerciseTimerRunning = false;
          doneBeep();
          hapticHeavy();
          document.getElementById('btn-timer-toggle').textContent = 'Start';
          closeExerciseTimer(exerciseTimerTotal);
        }
      }, 10);
    }
  }

  function resetExerciseTimer() {
    clearInterval(exerciseTimerInterval);
    exerciseTimerRunning = false;
    exerciseTimerRemaining = exerciseTimerTotal;
    updateExerciseTimerDisplay();
    document.getElementById('btn-timer-toggle').textContent = 'Start';
  }

  function closeExerciseTimer(finalTime) {
    clearInterval(exerciseTimerInterval);
    exerciseTimerRunning = false;
    document.getElementById('exercise-timer-overlay').classList.add('hidden');
    if (exerciseTimerCallback) exerciseTimerCallback(Math.round(finalTime || (exerciseTimerTotal - exerciseTimerRemaining)));
  }

  // ── Finish Workout ───────────────────────────────────────

  function finishWorkout() {
    stopWorkoutTimer();
    releaseWakeLock();
    clearInterval(restTimerInterval);
    document.getElementById('rest-overlay').classList.add('hidden');

    const wo = state.currentWorkout;
    const elapsed = Math.floor((Date.now() - workoutStartTime) / 1000);

    const log = {
      id: 'log_' + Date.now(), date: new Date().toISOString(),
      dayIndex: wo.dayIndex, dayName: wo.dayName, duration: elapsed,
      exercises: wo.exercises.map(ex => ({
        exerciseId: ex.exerciseId, isWarmup: ex.isWarmup,
        isCooldown: ex.isCooldown, isWarmupSet: ex.isWarmupSet,
        sets: ex.sets.map(s => ({ ...s }))
      }))
    };

    state.logs.push(log);
    saveLogs();

    const min = Math.floor(elapsed / 60);
    const totalSetsCompleted = wo.exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0);
    const mainExercises = wo.exercises.filter(e => !e.isWarmup && !e.isCooldown && !e.isWarmupSet).length;
    const prCount = wo.prs.length;

    document.getElementById('complete-summary').textContent = `${wo.dayName} abgeschlossen`;
    document.getElementById('complete-stats').innerHTML = `
      <div class="complete-stat"><span class="complete-stat-value">${min}</span><span class="complete-stat-label">Minuten</span></div>
      <div class="complete-stat"><span class="complete-stat-value">${mainExercises}</span><span class="complete-stat-label">Übungen</span></div>
      <div class="complete-stat"><span class="complete-stat-value">${totalSetsCompleted}</span><span class="complete-stat-label">Sätze</span></div>
      ${prCount > 0 ? `<div class="complete-stat"><span class="complete-stat-value pr-value">🏆 ${prCount}</span><span class="complete-stat-label">Neue PRs!</span></div>` : ''}
    `;

    if (prCount > 0) showConfetti();

    state.currentWorkout = null;
    clearSavedWorkout();
    checkNewAchievements();
    showScreen('complete');
  }

  // ── Achievements ─────────────────────────────────────────

  const ACHIEVEMENTS = [
    { id: 'first_workout', name: 'Erste Schritte', icon: '🏅', desc: 'Erstes Workout abgeschlossen',
      check: logs => logs.length >= 1, progress: logs => `${Math.min(logs.length, 1)}/1` },
    { id: 'five_workouts', name: 'Dranbleiberin', icon: '💪', desc: '5 Workouts absolviert',
      check: logs => logs.length >= 5, progress: logs => `${Math.min(logs.length, 5)}/5` },
    { id: 'ten_workouts', name: '10er Club', icon: '🔟', desc: '10 Workouts geschafft',
      check: logs => logs.length >= 10, progress: logs => `${Math.min(logs.length, 10)}/10` },
    { id: 'streak_7', name: 'Auf Kurs', icon: '🔥', desc: '7-Tage-Streak erreicht',
      check: logs => calculateMaxStreak(logs) >= 7, progress: logs => `${Math.min(calculateMaxStreak(logs), 7)}/7 Tage` },
    { id: 'streak_30', name: 'Unaufhaltsam', icon: '⚡', desc: '30-Tage-Streak erreicht',
      check: logs => calculateMaxStreak(logs) >= 30, progress: logs => `${Math.min(calculateMaxStreak(logs), 30)}/30 Tage` },
    { id: 'first_pr', name: 'Neuer Rekord', icon: '🏆', desc: 'Ersten PR aufgestellt',
      check: logs => countTotalPRs(logs) >= 1, progress: logs => `${Math.min(countTotalPRs(logs), 1)}/1` },
    { id: 'ten_prs', name: 'PR-Jägerin', icon: '🎯', desc: '10 PRs gesammelt',
      check: logs => countTotalPRs(logs) >= 10, progress: logs => `${Math.min(countTotalPRs(logs), 10)}/10` },
    { id: 'tonnage_1k', name: 'Tonnage', icon: '🏋️', desc: '1.000 kg Gesamtvolumen bewegt',
      check: logs => getTotalVolume(logs) >= 1000, progress: logs => `${Math.min(Math.round(getTotalVolume(logs)), 1000)}/ 1.000 kg` },
    { id: 'tonnage_10k', name: 'Powerhouse', icon: '💎', desc: '10.000 kg Gesamtvolumen',
      check: logs => getTotalVolume(logs) >= 10000, progress: logs => `${Math.round(getTotalVolume(logs) / 100) / 10}/ 10k kg` },
    { id: 'variety_20', name: 'Allrounderin', icon: '🌈', desc: '20 verschiedene Übungen gemacht',
      check: logs => getUniqueExercises(logs) >= 20, progress: logs => `${Math.min(getUniqueExercises(logs), 20)}/20` },
    { id: 'early_bird', name: 'Frühaufsteherin', icon: '🌅', desc: 'Workout vor 8 Uhr gestartet',
      check: logs => logs.some(l => new Date(l.date).getHours() < 8), progress: () => '' },
    { id: 'night_owl', name: 'Nachteule', icon: '🦉', desc: 'Workout nach 20 Uhr gestartet',
      check: logs => logs.some(l => new Date(l.date).getHours() >= 20), progress: () => '' }
  ];

  function calculateMaxStreak(logs) {
    if (logs.length === 0) return 0;
    const dates = [...new Set(logs.map(l => new Date(l.date).toDateString()))].map(d => new Date(d)).sort((a, b) => a - b);
    let max = 1, current = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff = (dates[i] - dates[i - 1]) / 86400000;
      if (diff === 1) { current++; max = Math.max(max, current); }
      else if (diff > 1) current = 1;
    }
    return max;
  }

  function countTotalPRs(logs) {
    // Count exercises where user has improved over their first logged performance
    const firstPerf = {};
    const bestPerf = {};
    logs.forEach(log => {
      (log.exercises || []).forEach(ex => {
        if (ex.isWarmup || ex.isCooldown || ex.isWarmupSet) return;
        ex.sets.filter(s => s.completed).forEach(s => {
          const vol = (s.reps || 0) * (s.weight || 0);
          const key = ex.exerciseId;
          if (!firstPerf[key]) firstPerf[key] = vol || s.duration || 0;
          if (!bestPerf[key]) bestPerf[key] = 0;
          const val = vol || s.duration || 0;
          if (val > bestPerf[key]) bestPerf[key] = val;
        });
      });
    });
    let prs = 0;
    Object.keys(firstPerf).forEach(k => {
      if (bestPerf[k] > firstPerf[k] && firstPerf[k] > 0) prs++;
    });
    return prs;
  }

  function getTotalVolume(logs) {
    let vol = 0;
    logs.forEach(log => {
      (log.exercises || []).forEach(ex => {
        if (ex.isWarmup || ex.isCooldown || ex.isWarmupSet) return;
        ex.sets.filter(s => s.completed).forEach(s => {
          if (s.reps && s.weight) vol += s.reps * s.weight;
        });
      });
    });
    return vol;
  }

  function getUniqueExercises(logs) {
    const ids = new Set();
    logs.forEach(log => {
      (log.exercises || []).forEach(ex => {
        if (!ex.isWarmup && !ex.isCooldown && !ex.isWarmupSet) ids.add(ex.exerciseId);
      });
    });
    return ids.size;
  }

  function computeAchievements() {
    return ACHIEVEMENTS.map(a => ({
      ...a,
      earned: a.check(state.logs),
      progressText: a.progress(state.logs)
    }));
  }

  function renderAchievements() {
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const achievements = computeAchievements();
    const earned = achievements.filter(a => a.earned);
    const locked = achievements.filter(a => !a.earned);

    const summary = document.createElement('div');
    summary.className = 'achievements-summary';
    summary.textContent = `${earned.length} von ${achievements.length} freigeschaltet`;
    grid.appendChild(summary);

    [...earned, ...locked].forEach(a => {
      const card = document.createElement('div');
      card.className = 'achievement-card' + (a.earned ? ' earned' : ' locked');
      card.innerHTML = `
        <div class="achievement-icon">${a.icon}</div>
        <div class="achievement-info">
          <div class="achievement-name">${a.name}</div>
          <div class="achievement-desc">${a.desc}</div>
          ${!a.earned && a.progressText ? `<div class="achievement-progress">${a.progressText}</div>` : ''}
        </div>
        ${a.earned ? '<div class="achievement-check">✓</div>' : ''}
      `;
      grid.appendChild(card);
    });
  }

  function checkNewAchievements() {
    const seen = load('fitplan_seen_achievements') || [];
    const achievements = computeAchievements();
    const newOnes = achievements.filter(a => a.earned && !seen.includes(a.id));
    if (newOnes.length > 0) {
      showConfetti();
      hapticHeavy();
      save('fitplan_seen_achievements', achievements.filter(a => a.earned).map(a => a.id));
    }
  }

  // ── Progress Screen ──────────────────────────────────────

  function renderProgress() {
    renderHistory();
    renderVolumeChart();
    renderMuscleBalance();
    populateExerciseSelect();
    renderWeightChart();
  }

  // ── Volume Trends Chart ─────────────────────────────────

  let volumeChart = null;
  function renderVolumeChart() {
    const container = document.getElementById('volume-chart-container');
    const canvas = document.getElementById('volume-chart');
    if (!canvas) return;

    if (state.logs.length < 2) { container.style.display = 'none'; return; }
    container.style.display = '';

    // Aggregate volume per week (last 8 weeks)
    const now = new Date();
    const weeks = [];
    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1) - w * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      let volume = 0;
      state.logs.forEach(log => {
        const d = new Date(log.date);
        if (d >= weekStart && d < weekEnd) {
          (log.exercises || []).forEach(ex => {
            if (ex.isWarmup || ex.isCooldown || ex.isWarmupSet) return;
            ex.sets.filter(s => s.completed).forEach(s => {
              if (s.reps && s.weight) volume += s.reps * s.weight;
            });
          });
        }
      });

      const label = `${weekStart.getDate()}.${weekStart.getMonth() + 1}`;
      weeks.push({ label, volume: Math.round(volume) });
    }

    if (volumeChart) volumeChart.destroy();
    volumeChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: weeks.map(w => w.label),
        datasets: [{
          label: 'Volumen (kg)',
          data: weeks.map(w => w.volume),
          backgroundColor: 'rgba(0, 122, 255, 0.6)',
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => v + ' kg' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // ── Muscle Balance Radar Chart ──────────────────────────

  let muscleChart = null;
  function renderMuscleBalance() {
    const container = document.getElementById('muscle-balance-container');
    const canvas = document.getElementById('muscle-chart');
    if (!canvas) return;

    // Last 28 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);
    const recentLogs = state.logs.filter(l => new Date(l.date) >= cutoff);

    if (recentLogs.length < 1) { container.style.display = 'none'; return; }
    container.style.display = '';

    // Muscle group mapping
    const groupMap = {
      chest: 'Brust', shoulders: 'Schultern',
      back: 'Rücken', biceps: 'Arme', triceps: 'Arme',
      core: 'Core', obliques: 'Core',
      quads: 'Beine', hamstrings: 'Beine', calves: 'Beine', legs: 'Beine',
      glutes: 'Gesäß', hips: 'Gesäß', hip_flexors: 'Gesäß', adductors: 'Beine',
      full_body: null // distribute to all
    };
    const groups = ['Brust', 'Rücken', 'Schultern', 'Arme', 'Core', 'Beine', 'Gesäß'];
    const counts = {};
    groups.forEach(g => counts[g] = 0);

    recentLogs.forEach(log => {
      (log.exercises || []).forEach(ex => {
        if (ex.isWarmup || ex.isCooldown || ex.isWarmupSet) return;
        const exercise = window.getExercise(ex.exerciseId);
        if (!exercise) return;
        const completedSets = ex.sets.filter(s => s.completed).length;
        if (completedSets === 0) return;

        exercise.muscleGroups.forEach(mg => {
          if (mg === 'full_body') {
            groups.forEach(g => counts[g] += completedSets * 0.5);
          } else {
            const mapped = groupMap[mg];
            if (mapped && counts[mapped] !== undefined) counts[mapped] += completedSets;
          }
        });
      });
    });

    if (muscleChart) muscleChart.destroy();
    muscleChart = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: groups,
        datasets: [{
          label: 'Sets (4 Wochen)',
          data: groups.map(g => Math.round(counts[g])),
          backgroundColor: 'rgba(0, 122, 255, 0.15)',
          borderColor: 'rgba(0, 122, 255, 0.8)',
          borderWidth: 2,
          pointBackgroundColor: '#007AFF',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            beginAtZero: true,
            ticks: { stepSize: 5, display: false },
            pointLabels: { font: { size: 11, weight: '600' } }
          }
        }
      }
    });
  }

  const ACTIVITY_ICONS = {
    cycling: '🚴', hiking: '🥾', walking: '🚶', running: '🏃',
    swimming: '🏊', yoga: '🧘', other: '🎯'
  };
  const ACTIVITY_NAMES = {
    cycling: 'Fahrradfahren', hiking: 'Wandern', walking: 'Spazieren',
    running: 'Laufen', swimming: 'Schwimmen', yoga: 'Yoga', other: 'Aktivität'
  };

  function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    if (state.logs.length === 0) {
      list.innerHTML = '<div class="no-data">Noch keine Trainings absolviert.</div>';
      return;
    }
    [...state.logs].reverse().slice(0, 20).forEach(log => {
      const item = document.createElement('div');
      item.className = 'history-item';
      const dateStr = new Date(log.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const min = Math.floor((log.duration || 0) / 60);

      let icon = '💪';
      let metaLine = `${min} Min.`;
      if (log.type === 'activity') {
        icon = ACTIVITY_ICONS[log.activityType] || '🎯';
        if (log.distance) metaLine = `${min} Min. · ${log.distance} km`;
      } else if (log.type === 'quick') {
        icon = '⚡';
      } else if (log.type === 'mobility' || log.dayName === 'Mobility & Stretching') {
        icon = '🧘';
      }

      item.innerHTML = `
        <div class="history-icon">${icon}</div>
        <div style="flex:1"><div class="history-date">${dateStr}</div><div class="history-name">${log.dayName}</div></div>
        <div class="history-meta">${metaLine}</div>
      `;
      list.appendChild(item);
    });
  }

  function populateExerciseSelect() {
    const select = document.getElementById('progress-exercise-select');
    select.innerHTML = '<option value="">Übung wählen...</option>';
    const logged = new Set();
    state.logs.forEach(log => {
      if (!log.exercises) return;
      log.exercises.forEach(ex => { if (!ex.isWarmup) logged.add(ex.exerciseId); });
    });
    logged.forEach(id => {
      const ex = window.getExercise(id);
      if (ex) { const opt = document.createElement('option'); opt.value = id; opt.textContent = `${ex.name} (${ex.nameDE})`; select.appendChild(opt); }
    });
  }

  function renderProgressChart(exerciseId) {
    const canvas = document.getElementById('progress-chart');
    if (progressChart) progressChart.destroy();
    if (!exerciseId) return;

    const dataPoints = [];
    state.logs.forEach(log => {
      log.exercises.forEach(ex => {
        if (ex.exerciseId !== exerciseId) return;
        const completed = ex.sets.filter(s => s.completed);
        if (completed.length === 0) return;
        const exercise = window.getExercise(exerciseId);
        if (exercise && (exercise.isTimed || completed[0].duration)) {
          dataPoints.push({ date: new Date(log.date), value: Math.max(...completed.map(s => s.duration || 0)), label: 'Sekunden' });
        } else {
          const hasW = completed.some(s => s.weight);
          if (hasW) {
            dataPoints.push({ date: new Date(log.date), value: completed.reduce((s, c) => s + (c.reps || 0) * (c.weight || 0), 0), label: 'Volumen (kg)' });
          } else {
            dataPoints.push({ date: new Date(log.date), value: completed.reduce((s, c) => s + (c.reps || 0), 0), label: 'Wiederholungen' });
          }
        }
      });
    });
    if (dataPoints.length === 0) return;

    progressChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: dataPoints.map(d => d.date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })),
        datasets: [{
          label: dataPoints[0].label, data: dataPoints.map(d => d.value),
          borderColor: '#FF6B6B', backgroundColor: 'rgba(255,107,107,0.1)',
          fill: true, tension: 0.3, pointBackgroundColor: '#FF6B6B', pointRadius: 5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,0.05)' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderWeightChart() {
    const container = document.getElementById('weight-chart-container');
    if (!container || state.weightLog.length < 2) {
      if (container) container.classList.add('hidden');
      return;
    }
    container.classList.remove('hidden');
    const canvas = document.getElementById('weight-chart');
    if (canvas._chart) canvas._chart.destroy();

    const labels = state.weightLog.map(e => new Date(e.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }));
    const values = state.weightLog.map(e => e.weight);

    // Wider Y-axis range so small changes don't look dramatic
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const padding = Math.max(3, (maxVal - minVal) * 0.5);
    const yMin = Math.floor(minVal - padding);
    const yMax = Math.ceil(maxVal + padding);

    canvas._chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Gewicht (kg)', data: values,
          borderColor: '#34C759', backgroundColor: 'rgba(52,199,89,0.08)',
          fill: true, tension: 0.3, pointBackgroundColor: '#34C759', pointRadius: 5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: yMin, max: yMax, ticks: { callback: v => v + ' kg' }, grid: { color: 'rgba(0,0,0,0.05)' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // ── Settings ─────────────────────────────────────────────

  function populateSettings() {
    if (!state.profile) return;
    const p = state.profile;
    document.getElementById('set-name').value = p.name || '';
    document.getElementById('set-age').value = p.age || '';
    document.getElementById('set-weight').value = p.weight || '';
    document.getElementById('set-height').value = p.height || '';
    document.getElementById('set-level').value = p.fitnessLevel || 'beginner';
    document.getElementById('set-goal').value = p.goal || 'general_fitness';
    document.getElementById('set-days').value = p.daysPerWeek || 3;
    document.getElementById('set-days-val').textContent = p.daysPerWeek || 3;
    document.getElementById('set-minutes').value = p.minutesPerSession || 45;
    document.getElementById('set-minutes-val').textContent = p.minutesPerSession || 45;
    document.getElementById('set-rest').value = p.restMode || 'auto';
    document.getElementById('set-equipment').value = p.preferredEquipment || '';

    // Steps tracking
    document.getElementById('set-steps-tracking').checked = p.stepsTracking !== false;
    const goalEl = document.getElementById('set-step-goal');
    goalEl.value = p.stepGoal || 8000;
    document.getElementById('set-step-goal-val').textContent = (p.stepGoal || 8000).toLocaleString('de-DE');
    goalEl.oninput = () => {
      document.getElementById('set-step-goal-val').textContent = (+goalEl.value).toLocaleString('de-DE');
    };

    // Cycle tracking
    const cycleCheckbox = document.getElementById('set-cycle-tracking');
    cycleCheckbox.checked = !!p.cycleTracking;
    document.getElementById('set-cycle-length').value = p.cycleLength || 28;
    document.getElementById('set-period-start').value = p.lastPeriodStart || '';
    document.getElementById('cycle-settings-detail').classList.toggle('hidden', !p.cycleTracking);
    cycleCheckbox.onchange = () => {
      document.getElementById('cycle-settings-detail').classList.toggle('hidden', !cycleCheckbox.checked);
    };
  }

  function showSettings() { populateSettings(); showScreen('settings'); }

  function saveSettings() {
    if (!state.profile) return;
    const oldWeight = state.profile.weight;
    state.profile.name = document.getElementById('set-name').value.trim();
    state.profile.age = +document.getElementById('set-age').value;
    state.profile.weight = +document.getElementById('set-weight').value;
    state.profile.height = +document.getElementById('set-height').value;
    state.profile.fitnessLevel = document.getElementById('set-level').value;
    state.profile.goal = document.getElementById('set-goal').value;
    state.profile.daysPerWeek = +document.getElementById('set-days').value;
    state.profile.minutesPerSession = +document.getElementById('set-minutes').value;
    state.profile.restMode = document.getElementById('set-rest').value;
    state.profile.preferredEquipment = document.getElementById('set-equipment').value || null;
    state.profile.stepsTracking = document.getElementById('set-steps-tracking').checked;
    state.profile.stepGoal = +document.getElementById('set-step-goal').value || 8000;
    state.profile.cycleTracking = document.getElementById('set-cycle-tracking').checked;
    state.profile.cycleLength = +document.getElementById('set-cycle-length').value || 28;
    state.profile.lastPeriodStart = document.getElementById('set-period-start').value || null;

    // Track weight change
    if (state.profile.weight !== oldWeight && state.profile.weight > 0) {
      state.weightLog.push({ date: new Date().toISOString(), weight: state.profile.weight });
      saveWeightLog();
    }

    saveProfile();
    showScreen('dashboard');
  }

  // ── Confirm Modal ────────────────────────────────────────

  function showConfirm(title, message, onOk) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('modal-confirm').classList.remove('hidden');

    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');

    const cleanup = () => {
      document.getElementById('modal-confirm').classList.add('hidden');
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', handleCancel);
    };
    const handleOk = () => { cleanup(); onOk(); };
    const handleCancel = () => { cleanup(); };
    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
  }

  // ── Dark Mode ────────────────────────────────────────────

  function applyDarkMode(dark) {
    document.body.classList.toggle('dark', dark);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#000000' : '#F2F2F7';
  }

  function toggleDarkMode() {
    const isDark = !document.body.classList.contains('dark');
    applyDarkMode(isDark);
    save(STORAGE_KEYS.darkMode, isDark);
  }

  function initDarkMode() {
    const saved = load(STORAGE_KEYS.darkMode);
    if (saved === true) applyDarkMode(true);
    else if (saved === null && window.matchMedia('(prefers-color-scheme: dark)').matches) applyDarkMode(true);
  }

  // ── Event Listeners ──────────────────────────────────────

  function initEventListeners() {
    initCalendarSwipe();

    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => showScreen(btn.dataset.screen));
    });

    document.getElementById('btn-settings').addEventListener('click', showSettings);
    document.getElementById('btn-darkmode').addEventListener('click', toggleDarkMode);

    // Activity/Quick/Steps logging
    document.getElementById('btn-log-activity').addEventListener('click', openActivityModal);
    document.getElementById('btn-log-quick').addEventListener('click', openQuickLogModal);
    document.getElementById('activity-close').addEventListener('click', () => document.getElementById('modal-activity').classList.add('hidden'));
    document.getElementById('activity-cancel').addEventListener('click', () => document.getElementById('modal-activity').classList.add('hidden'));
    document.getElementById('activity-save').addEventListener('click', saveActivity);
    document.getElementById('quick-close').addEventListener('click', () => document.getElementById('modal-quick-log').classList.add('hidden'));
    document.getElementById('quick-cancel').addEventListener('click', () => document.getElementById('modal-quick-log').classList.add('hidden'));
    document.getElementById('quick-save').addEventListener('click', saveQuickLog);
    document.getElementById('steps-close').addEventListener('click', () => document.getElementById('modal-steps').classList.add('hidden'));
    document.getElementById('steps-cancel').addEventListener('click', () => document.getElementById('modal-steps').classList.add('hidden'));
    document.getElementById('steps-save').addEventListener('click', saveSteps);

    // Close on backdrop click (modal container === target check)
    ['modal-activity', 'modal-quick-log', 'modal-steps'].forEach(id => {
      document.getElementById(id).addEventListener('click', e => {
        if (e.target === e.currentTarget) document.getElementById(id).classList.add('hidden');
      });
    });

    document.getElementById('btn-new-plan').addEventListener('click', () => {
      const isDeload = window.Planner.shouldDeload(state.logs);
      const msg = isDeload
        ? 'Du hast in den letzten 4 Wochen viel trainiert! Der neue Plan wird eine Deload-Woche mit reduzierter Intensität.'
        : 'Möchtest du einen neuen Plan generieren? Der aktuelle wird ersetzt.';
      showConfirm('Neuer Trainingsplan', msg, () => {
        // Remember custom splits from current plan
        const oldSplits = state.plan && state.plan.days ? state.plan.days.map(d => d.split) : null;

        state.plan = state.logs.length > 0
          ? window.Planner.generateProgressivePlan(state.profile, state.logs, state.plan)
          : window.Planner.generatePlan(state.profile, state.logs);

        // Restore custom splits if day count matches
        if (oldSplits && state.plan.days.length === oldSplits.length) {
          oldSplits.forEach((split, idx) => {
            if (split !== state.plan.days[idx].split) {
              regenerateDayExercises(idx, split);
            }
          });
        }

        savePlan();
        renderDashboard();
      });
    });

    document.getElementById('btn-back-plan').addEventListener('click', () => showScreen('dashboard'));

    // Event delegation for workout content (robust fallback for dynamic elements)
    const workoutContainer = document.getElementById('workout-content');
    workoutContainer.addEventListener('click', e => {
      const wo = state.currentWorkout;
      if (!wo) return;

      const infoBtn = e.target.closest('.exercise-info-btn');
      const swapBtn = e.target.closest('.exercise-swap-btn');
      const timerBtn = e.target.closest('.btn-timer-start');
      const doneBtn = e.target.closest('.btn-set-done');

      // Helper: get exercise index and set index from a clicked element
      function getExSetIdx(el) {
        const card = el.closest('.workout-exercise-card');
        if (!card) return null;
        const exIdx = parseInt(card.dataset.exIdx);
        const row = el.closest('.workout-set-row');
        let setIdx = -1;
        if (row) {
          const setsDiv = card.querySelector('.workout-sets');
          setIdx = Array.from(setsDiv.children).indexOf(row);
        }
        return { exIdx, setIdx, card };
      }

      if (infoBtn) {
        const info = getExSetIdx(infoBtn);
        if (info) {
          const ex = wo.exercises[info.exIdx];
          if (ex) showExerciseModal(ex.exerciseId);
        }
        return;
      }

      if (swapBtn) {
        const info = getExSetIdx(swapBtn);
        if (info) {
          const ex = wo.exercises[info.exIdx];
          const usedIds = wo.exercises.map(e => e.exerciseId);
          const alt = window.Planner.getAlternative(ex.exerciseId, usedIds);
          if (alt) {
            ex.exerciseId = alt.id;
            ex.sets.forEach(s => { s.completed = false; s.reps = null; s.duration = null; });
            renderWorkout();
          } else {
            alert('Keine Alternative verfügbar.');
          }
        }
        return;
      }

      if (timerBtn) {
        const info = getExSetIdx(timerBtn);
        if (info && info.setIdx >= 0) {
          const ex = wo.exercises[info.exIdx];
          const exercise = window.getExercise(ex.exerciseId);
          const set = ex.sets[info.setIdx];
          if (ex && exercise && set) {
            hapticLight();
            openExerciseTimer(exercise.name, ex.targetDuration, finalTime => {
              set.duration = finalTime;
              set.completed = true;
              renderWorkout();
              maybeShowRestTimer(ex, info.exIdx, info.setIdx);
            });
          }
        }
        return;
      }

      if (doneBtn) {
        const info = getExSetIdx(doneBtn);
        if (info && info.setIdx >= 0) {
          const ex = wo.exercises[info.exIdx];
          const exercise = window.getExercise(ex.exerciseId);
          const set = ex.sets[info.setIdx];
          if (ex && exercise && set) {
            if (set.completed) {
              // Undo: mark as not completed
              set.completed = false;
              hapticLight();
              renderWorkout();
            } else {
              // Complete set
              if (!(exercise.isTimed || ex.targetDuration)) {
                if (!set.reps) set.reps = ex.targetReps;
                if (!set.weight && ex.targetWeight) set.weight = ex.targetWeight;
              }
              set.completed = true;
              hapticMedium();

              if (!ex.isWarmup && !ex.isCooldown && !ex.isWarmupSet) {
                if (checkForPR(ex.exerciseId, ex.sets)) {
                  if (!wo.prs.includes(ex.exerciseId)) {
                    wo.prs.push(ex.exerciseId);
                    showConfetti();
                    doneBeep();
                    hapticHeavy();
                  }
                }
              }

              renderWorkout();
              maybeShowRestTimer(ex, info.exIdx, info.setIdx);
            }
          }
        }
        return;
      }
    });

    document.getElementById('btn-quit-workout').addEventListener('click', () => {
      showConfirm('Training abbrechen?', 'Dein Fortschritt geht verloren.', () => {
        stopWorkoutTimer(); releaseWakeLock(); clearInterval(restTimerInterval); clearInterval(exerciseTimerInterval);
        document.getElementById('rest-overlay').classList.add('hidden');
        document.getElementById('exercise-timer-overlay').classList.add('hidden');
        state.currentWorkout = null;
        clearSavedWorkout();
        showScreen('dashboard');
      });
    });

    document.getElementById('btn-skip-rest').addEventListener('click', () => {
      clearInterval(restTimerInterval);
      document.getElementById('rest-overlay').classList.add('hidden');
    });

    document.getElementById('btn-timer-toggle').addEventListener('click', toggleExerciseTimer);
    document.getElementById('btn-timer-reset').addEventListener('click', resetExerciseTimer);
    document.getElementById('btn-timer-done').addEventListener('click', () => {
      closeExerciseTimer(exerciseTimerTotal - exerciseTimerRemaining);
    });

    document.getElementById('btn-complete-done').addEventListener('click', () => showScreen('dashboard'));

    document.getElementById('btn-back-settings').addEventListener('click', () => showScreen('dashboard'));
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);

    document.getElementById('set-days').addEventListener('input', e => {
      document.getElementById('set-days-val').textContent = e.target.value;
    });
    document.getElementById('set-minutes').addEventListener('input', e => {
      document.getElementById('set-minutes-val').textContent = e.target.value;
    });

    document.getElementById('btn-reset-all').addEventListener('click', () => {
      showConfirm('Alle Daten löschen?', 'Alles wird unwiderruflich gelöscht.', () => {
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        location.reload();
      });
    });

    // Modal
    document.getElementById('modal-close').addEventListener('click', () => {
      // Save note
      const noteInput = document.getElementById('modal-note-input');
      const exId = noteInput.dataset.exerciseId;
      if (exId) {
        if (noteInput.value.trim()) state.notes[exId] = noteInput.value.trim();
        else delete state.notes[exId];
        saveNotes();
      }
      document.getElementById('modal-exercise').classList.add('hidden');
    });
    document.getElementById('modal-exercise').addEventListener('click', e => {
      if (e.target === e.currentTarget) document.getElementById('modal-close').click();
    });

    document.getElementById('modal-confirm').addEventListener('click', e => {
      if (e.target === e.currentTarget) document.getElementById('modal-confirm').classList.add('hidden');
    });

    // Day detail modal
    document.getElementById('day-detail-close').addEventListener('click', () => {
      document.getElementById('modal-day-detail').classList.add('hidden');
    });
    document.getElementById('modal-day-detail').addEventListener('click', e => {
      if (e.target === e.currentTarget) document.getElementById('modal-day-detail').classList.add('hidden');
    });

    document.getElementById('progress-exercise-select').addEventListener('change', e => {
      renderProgressChart(e.target.value);
    });
  }

  // ── Init ─────────────────────────────────────────────────

  function init() {
    loadState();
    initDarkMode();
    initOnboarding();
    initEventListeners();
    history.replaceState({ screen: 'dashboard' }, '', '');

    const isOnboarded = load(STORAGE_KEYS.onboarded);
    if (isOnboarded && state.profile) {
      // Restore in-progress workout
      const savedWorkout = load(STORAGE_KEYS.currentWorkout);
      if (savedWorkout && savedWorkout.workout) {
        state.currentWorkout = savedWorkout.workout;
        workoutStartTime = savedWorkout.startedAt || Date.now();
        document.getElementById('workout-title').textContent = state.currentWorkout.dayName;
        renderWorkout();
        showScreen('workout');
        startWorkoutTimer();
        requestWakeLock();
      } else {
        showScreen('dashboard');
      }
    } else {
      showScreen('onboarding');
    }

    // Sync with Firebase in background (non-blocking)
    if (window.FireSync) {
      window.FireSync.syncAll(state).then(merged => {
        const hadProfile = !!state.profile;
        state.profile = merged.profile || state.profile;
        state.plan = merged.plan || state.plan;
        state.logs = merged.logs || state.logs;
        state.notes = merged.notes || state.notes;
        state.weightLog = merged.weightLog || state.weightLog;
        if (state.profile) save(STORAGE_KEYS.profile, state.profile);
        if (state.plan) save(STORAGE_KEYS.plan, state.plan);
        save(STORAGE_KEYS.logs, state.logs);
        save(STORAGE_KEYS.notes, state.notes);
        save(STORAGE_KEYS.weightLog, state.weightLog);

        // If we recovered a profile from Firebase, go to dashboard
        if (!hadProfile && state.profile) {
          save(STORAGE_KEYS.onboarded, true);
          showScreen('dashboard');
        } else if (state.activeScreen === 'dashboard') {
          renderDashboard(); // Refresh with merged data
        }
      }).catch(e => console.error('Firebase sync failed:', e));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
