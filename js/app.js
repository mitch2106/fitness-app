// ============================================================
// FitPlan – Main Application Logic (v2 with all features)
// ============================================================
(function() {
  'use strict';

  const STORAGE_KEYS = {
    profile: 'fitplan_profile', plan: 'fitplan_plan',
    logs: 'fitplan_logs', onboarded: 'fitplan_onboarded',
    darkMode: 'fitplan_darkmode', notes: 'fitplan_notes',
    weightLog: 'fitplan_weightlog'
  };

  let state = {
    profile: null, plan: null, logs: [], notes: {},
    weightLog: [], currentWorkout: null, activeScreen: 'onboarding'
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

  // ── Persistence ──────────────────────────────────────────

  function save(key, data) { try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {} }
  function load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch(e) { return null; } }

  function loadState() {
    state.profile = load(STORAGE_KEYS.profile);
    state.plan = load(STORAGE_KEYS.plan);
    state.logs = load(STORAGE_KEYS.logs) || [];
    state.notes = load(STORAGE_KEYS.notes) || {};
    state.weightLog = load(STORAGE_KEYS.weightLog) || [];
  }

  function saveProfile() { save(STORAGE_KEYS.profile, state.profile); if (window.FireSync) window.FireSync.saveProfile(state.profile); }
  function savePlan() { save(STORAGE_KEYS.plan, state.plan); if (window.FireSync) window.FireSync.savePlan(state.plan); }
  function saveLogs() { save(STORAGE_KEYS.logs, state.logs); if (window.FireSync) window.FireSync.saveLogs(state.logs); }
  function saveNotes() { save(STORAGE_KEYS.notes, state.notes); if (window.FireSync) window.FireSync.saveNotes(state.notes); }
  function saveWeightLog() { save(STORAGE_KEYS.weightLog, state.weightLog); if (window.FireSync) window.FireSync.saveWeightLog(state.weightLog); }

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
      log.exercises.forEach(ex => {
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
      const ex = log.exercises.find(e => e.exerciseId === exerciseId && !e.isWarmup);
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
    const colors = ['#FF6B6B','#4ECDC4','#FFE66D','#FF8E8E','#00B894','#6C5CE7'];
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

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById('screen-' + id);
    if (screen) screen.classList.add('active');
    state.activeScreen = id;

    const nav = document.getElementById('bottom-nav');
    nav.classList.toggle('hidden', ['onboarding', 'workout', 'complete'].includes(id));

    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.screen === id);
    });

    if (id === 'dashboard') renderDashboard();
    if (id === 'progress') renderProgress();
    if (id === 'settings') populateSettings();
  }

  // ── Onboarding ───────────────────────────────────────────

  let onboardingStep = 1;
  const totalSteps = 5;
  const onboardingData = {
    name: '', age: null, weight: null, height: null,
    fitnessLevel: null, goal: null,
    daysPerWeek: 3, minutesPerSession: 45,
    preferredDays: [], restMode: 'auto'
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
    document.getElementById('ob-next').textContent = onboardingStep === totalSteps ? 'Los geht\'s!' : 'Weiter';
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

  function renderDashboard() {
    if (!state.profile) return;
    if (!state.plan || !state.plan.days || state.plan.days.length === 0) {
      try { state.plan = window.Planner.generatePlan(state.profile, state.logs); savePlan(); } catch(e) { console.error(e); }
    }
    if (!state.plan) return;

    // Greeting
    const hour = new Date().getHours();
    let greetTime = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
    document.getElementById('greeting').textContent = `${greetTime}, ${state.profile.name}!`;

    const goalNames = { lose_weight: 'Abnehmen', build_muscle: 'Muskelaufbau', general_fitness: 'Allgemeine Fitness', tone: 'Körper straffen' };
    document.getElementById('dash-subtitle').textContent = `Ziel: ${goalNames[state.profile.goal] || ''}`;

    // Deload badge
    const deloadBadge = document.getElementById('deload-badge');
    if (deloadBadge) deloadBadge.classList.toggle('hidden', !state.plan.isDeload);

    // Stats
    const logs = state.logs;
    document.getElementById('stat-streak').textContent = calculateStreak(logs);
    document.getElementById('stat-workouts').textContent = logs.length;
    document.getElementById('stat-week').textContent = countThisWeek(logs);

    // Week calendar
    renderWeekCalendar();

    const preferred = getPreferredSorted();
    const todayKey = getTodayKey();
    const today = new Date().toDateString();

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
      `;
      if (!doneToday) {
        todayCard.querySelector('#btn-start-today').addEventListener('click', () => startWorkout(todayIdx));
      }
    } else {
      todayCard.classList.add('hidden');
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

  // ── Week Calendar ────────────────────────────────────────

  function renderWeekCalendar() {
    const cal = document.getElementById('week-calendar');
    if (!cal) return;
    cal.innerHTML = '';

    const now = new Date();
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
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
  }

  function showDayDetail(dateStr, dayLogs) {
    const modal = document.getElementById('modal-day-detail');
    const content = document.getElementById('day-detail-content');

    const dateFormatted = new Date(dateStr).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
    let html = `<h3>${dateFormatted}</h3>`;

    dayLogs.forEach(log => {
      const min = Math.floor((log.duration || 0) / 60);
      const mainExercises = log.exercises.filter(e => !e.isWarmup && !e.isCooldown && !e.isWarmupSet);
      const totalSets = mainExercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0);

      html += `
        <div class="day-detail-workout">
          <div class="day-detail-header">
            <span class="day-detail-name">${log.dayName}</span>
            <span class="day-detail-meta">${min} Min. · ${totalSets} Sätze</span>
          </div>
          <div class="day-detail-exercises">
      `;

      mainExercises.forEach(ex => {
        const exercise = window.getExercise(ex.exerciseId);
        if (!exercise) return;
        const completed = ex.sets.filter(s => s.completed);
        if (completed.length === 0) return;

        let detail = '';
        if (completed[0].duration) {
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

  function showPlanDetail(dayIdx) {
    if (!state.plan || !state.plan.days || !state.profile) return;
    const day = state.plan.days[dayIdx];
    if (!day) return;

    const preferred = getPreferredSorted();
    const assigned = preferred[dayIdx] ? DAY_NAME_MAP[preferred[dayIdx]] : null;
    document.getElementById('plan-detail-title').textContent = `${assigned ? assigned + ' — ' : ''}${day.name}`;

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

      card.innerHTML = `
        <div class="exercise-num">${num}</div>
        <div class="exercise-info">
          <div class="exercise-name">${exercise.name}</div>
          <div class="exercise-nameDE">${exercise.nameDE}</div>
          <div class="exercise-meta">${meta}</div>
          ${lastStr ? `<div class="exercise-last">${lastStr}</div>` : ''}
        </div>
        <button class="exercise-info-btn">ℹ</button>
      `;

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
      dip_bars: 'Dip-Barren', pull_up_bar: 'Klimmzugstange', rings: 'Ringe'
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
          <div class="workout-ex-name">${exercise.name}${ex.isWarmupSet ? ' <span class="warmup-set-badge">Aufwärmsatz</span>' : ''}</div>
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

            const repsInput = document.createElement('input');
            repsInput.type = 'number'; repsInput.className = 'set-input';
            repsInput.placeholder = ex.targetReps; repsInput.inputMode = 'numeric';
            repsInput.value = set.reps || '';
            repsInput.addEventListener('input', e => { set.reps = +e.target.value; });

            inputGroup.appendChild(repsInput);
            const repsLabel = document.createElement('span');
            repsLabel.className = 'set-input-label';
            repsLabel.textContent = 'Wdh';
            inputGroup.appendChild(repsLabel);

            if (ex.targetWeight) {
              const wInput = document.createElement('input');
              wInput.type = 'number'; wInput.className = 'set-input';
              wInput.placeholder = ex.targetWeight; wInput.inputMode = 'decimal'; wInput.step = '0.5';
              wInput.value = set.weight || '';
              wInput.addEventListener('input', e => { set.weight = +e.target.value; });
              inputGroup.appendChild(wInput);
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
                  if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
                }
              }
            }

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

    // Progress bar
    const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
    document.getElementById('workout-progress-fill').style.width = progress + '%';

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
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
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
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
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
    showScreen('complete');
  }

  // ── Progress Screen ──────────────────────────────────────

  function renderProgress() {
    renderHistory();
    populateExerciseSelect();
    renderWeightChart();
  }

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
      item.innerHTML = `
        <div><div class="history-date">${dateStr}</div><div class="history-name">${log.dayName}</div></div>
        <div class="history-meta">${Math.floor((log.duration || 0) / 60)} Min.</div>
      `;
      list.appendChild(item);
    });
  }

  function populateExerciseSelect() {
    const select = document.getElementById('progress-exercise-select');
    select.innerHTML = '<option value="">Übung wählen...</option>';
    const logged = new Set();
    state.logs.forEach(log => log.exercises.forEach(ex => { if (!ex.isWarmup) logged.add(ex.exerciseId); }));
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

    canvas._chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Gewicht (kg)', data: values,
          borderColor: '#4ECDC4', backgroundColor: 'rgba(78,205,196,0.1)',
          fill: true, tension: 0.3, pointBackgroundColor: '#4ECDC4', pointRadius: 5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: 'rgba(0,0,0,0.05)' } },
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
    if (meta) meta.content = dark ? '#0F0F1A' : '#1a1a2e';
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
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => showScreen(btn.dataset.screen));
    });

    document.getElementById('btn-settings').addEventListener('click', showSettings);
    document.getElementById('btn-darkmode').addEventListener('click', toggleDarkMode);

    document.getElementById('btn-new-plan').addEventListener('click', () => {
      const isDeload = window.Planner.shouldDeload(state.logs);
      const msg = isDeload
        ? 'Du hast in den letzten 4 Wochen viel trainiert! Der neue Plan wird eine Deload-Woche mit reduzierter Intensität.'
        : 'Möchtest du einen neuen Plan generieren? Der aktuelle wird ersetzt.';
      showConfirm('Neuer Trainingsplan', msg, () => {
        state.plan = state.logs.length > 0
          ? window.Planner.generateProgressivePlan(state.profile, state.logs, state.plan)
          : window.Planner.generatePlan(state.profile, state.logs);
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

      if (doneBtn && !doneBtn.classList.contains('done')) {
        const info = getExSetIdx(doneBtn);
        if (info && info.setIdx >= 0) {
          const ex = wo.exercises[info.exIdx];
          const exercise = window.getExercise(ex.exerciseId);
          const set = ex.sets[info.setIdx];
          if (ex && exercise && set) {
            if (!(exercise.isTimed || ex.targetDuration)) {
              if (!set.reps) set.reps = ex.targetReps;
              if (!set.weight && ex.targetWeight) set.weight = ex.targetWeight;
            }
            set.completed = true;

            if (!ex.isWarmup && !ex.isCooldown && !ex.isWarmupSet) {
              if (checkForPR(ex.exerciseId, ex.sets)) {
                if (!wo.prs.includes(ex.exerciseId)) {
                  wo.prs.push(ex.exerciseId);
                  showConfetti();
                  doneBeep();
                  if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
                }
              }
            }

            renderWorkout();
            maybeShowRestTimer(ex, info.exIdx, info.setIdx);
          }
        }
        return;
      }
    });

    document.getElementById('btn-quit-workout').addEventListener('click', () => {
      showConfirm('Training abbrechen?', 'Dein Fortschritt geht verloren.', () => {
        stopWorkoutTimer(); clearInterval(restTimerInterval); clearInterval(exerciseTimerInterval);
        document.getElementById('rest-overlay').classList.add('hidden');
        document.getElementById('exercise-timer-overlay').classList.add('hidden');
        state.currentWorkout = null;
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
    document.getElementById('modal-backdrop').addEventListener('click', () => {
      document.getElementById('modal-close').click();
    });

    document.querySelector('.modal-confirm-backdrop').addEventListener('click', () => {
      document.getElementById('modal-confirm').classList.add('hidden');
    });

    // Day detail modal
    document.getElementById('day-detail-close').addEventListener('click', () => {
      document.getElementById('modal-day-detail').classList.add('hidden');
    });
    document.getElementById('day-detail-backdrop').addEventListener('click', () => {
      document.getElementById('modal-day-detail').classList.add('hidden');
    });

    document.getElementById('progress-exercise-select').addEventListener('change', e => {
      renderProgressChart(e.target.value);
    });
  }

  // ── Init ─────────────────────────────────────────────────

  function init() {
    loadState();
    initDarkMode();
    initOnboarding(); // Always init onboarding listeners
    initEventListeners();

    const isOnboarded = load(STORAGE_KEYS.onboarded);
    if (isOnboarded && state.profile) {
      showScreen('dashboard');
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
