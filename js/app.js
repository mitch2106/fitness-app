// ============================================================
// FitPlan – Main Application Logic
// ============================================================
(function() {
  'use strict';

  // ── State ────────────────────────────────────────────────
  const STORAGE_KEYS = {
    profile: 'fitplan_profile',
    plan: 'fitplan_plan',
    logs: 'fitplan_logs',
    onboarded: 'fitplan_onboarded',
    darkMode: 'fitplan_darkmode'
  };

  let state = {
    profile: null,
    plan: null,
    logs: [],
    currentWorkout: null,
    activeScreen: 'onboarding'
  };

  // Timers
  let workoutStartTime = null;
  let workoutElapsedInterval = null;
  let restTimerInterval = null;
  let restTimerRemaining = 0;
  let exerciseTimerInterval = null;
  let exerciseTimerRemaining = 0;
  let exerciseTimerTotal = 0;
  let exerciseTimerRunning = false;
  let exerciseTimerCallback = null;

  // Charts
  let progressChart = null;

  // ── Persistence ──────────────────────────────────────────

  function save(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {}
  }

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch(e) { return null; }
  }

  function loadState() {
    state.profile = load(STORAGE_KEYS.profile);
    state.plan = load(STORAGE_KEYS.plan);
    state.logs = load(STORAGE_KEYS.logs) || [];
  }

  function saveProfile() { save(STORAGE_KEYS.profile, state.profile); }
  function savePlan() { save(STORAGE_KEYS.plan, state.plan); }
  function saveLogs() { save(STORAGE_KEYS.logs, state.logs); }

  // ── Navigation ───────────────────────────────────────────

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById('screen-' + id);
    if (screen) screen.classList.add('active');
    state.activeScreen = id;

    const nav = document.getElementById('bottom-nav');
    const hideNav = ['onboarding', 'workout', 'complete'].includes(id);
    nav.classList.toggle('hidden', hideNav);

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

    // Step indicators
    document.getElementById('ob-days').addEventListener('input', e => {
      document.getElementById('ob-days-val').textContent = e.target.value;
      onboardingData.daysPerWeek = +e.target.value;
    });

    document.getElementById('ob-minutes').addEventListener('input', e => {
      document.getElementById('ob-minutes-val').textContent = e.target.value;
      onboardingData.minutesPerSession = +e.target.value;
    });

    // Option cards
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

    // Day selector
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

    // Navigation
    document.getElementById('ob-next').addEventListener('click', nextOnboardingStep);
    document.getElementById('ob-back').addEventListener('click', prevOnboardingStep);
  }

  function renderStepIndicator() {
    const container = document.getElementById('step-indicator');
    container.innerHTML = '';
    for (let i = 1; i <= totalSteps; i++) {
      const dot = document.createElement('div');
      dot.className = 'step-dot' + (i === onboardingStep ? ' active' : '') + (i < onboardingStep ? ' done' : '');
      container.appendChild(dot);
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
    const backBtn = document.getElementById('ob-back');
    const nextBtn = document.getElementById('ob-next');
    backBtn.style.visibility = onboardingStep === 1 ? 'hidden' : 'visible';
    nextBtn.textContent = onboardingStep === totalSteps ? 'Los geht\'s!' : 'Weiter';
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
      case 2:
        if (!onboardingData.fitnessLevel) { alert('Bitte wähle dein Fitnesslevel.'); return false; }
        return true;
      case 3:
        if (!onboardingData.goal) { alert('Bitte wähle dein Trainingsziel.'); return false; }
        return true;
      case 4:
        return true;
      case 5:
        if (!onboardingData.restMode) { alert('Bitte wähle eine Option.'); return false; }
        return true;
    }
    return true;
  }

  function nextOnboardingStep() {
    if (!validateStep(onboardingStep)) return;
    if (onboardingStep < totalSteps) {
      onboardingStep++;
      showOnboardingStep(onboardingStep);
    } else {
      completeOnboarding();
    }
  }

  function prevOnboardingStep() {
    if (onboardingStep > 1) {
      onboardingStep--;
      showOnboardingStep(onboardingStep);
    }
  }

  function completeOnboarding() {
    state.profile = { ...onboardingData };
    saveProfile();
    save(STORAGE_KEYS.onboarded, true);

    // Generate initial plan
    state.plan = window.Planner.generatePlan(state.profile);
    savePlan();

    showScreen('dashboard');
  }

  // ── Dashboard ────────────────────────────────────────────

  function renderDashboard() {
    if (!state.profile) return;

    // Auto-generate plan if missing or invalid
    if (!state.plan || !state.plan.days || state.plan.days.length === 0) {
      try {
        state.plan = window.Planner.generatePlan(state.profile);
        savePlan();
        console.log('Plan generated:', state.plan.days.length, 'days');
      } catch(e) {
        console.error('Plan generation failed:', e);
      }
    }

    // Greeting
    const hour = new Date().getHours();
    let greetTime = 'Guten Morgen';
    if (hour >= 12 && hour < 18) greetTime = 'Guten Tag';
    if (hour >= 18) greetTime = 'Guten Abend';
    document.getElementById('greeting').textContent = `${greetTime}, ${state.profile.name}!`;

    const goalNames = {
      lose_weight: 'Abnehmen',
      build_muscle: 'Muskelaufbau',
      general_fitness: 'Allgemeine Fitness',
      tone: 'Körper straffen'
    };
    document.getElementById('dash-subtitle').textContent = `Ziel: ${goalNames[state.profile.goal] || ''}`;

    // Stats
    const logs = state.logs;
    const streak = calculateStreak(logs);
    const thisWeek = countThisWeek(logs);
    document.getElementById('stat-streak').textContent = streak;
    document.getElementById('stat-workouts').textContent = logs.length;
    document.getElementById('stat-week').textContent = thisWeek;

    // Map preferred days to plan days
    const dayNameMap = {
      mon: 'Montag', tue: 'Dienstag', wed: 'Mittwoch', thu: 'Donnerstag',
      fri: 'Freitag', sat: 'Samstag', sun: 'Sonntag'
    };
    const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const preferred = (state.profile.preferredDays || [])
      .slice()
      .sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));

    // Plan days
    const list = document.getElementById('plan-days-list');
    list.innerHTML = '';

    const today = new Date().toDateString();
    const todayDayIdx = new Date().getDay(); // 0=Sun
    const todayKey = dayOrder[todayDayIdx === 0 ? 6 : todayDayIdx - 1];

    state.plan.days.forEach((day, idx) => {
      const card = document.createElement('div');
      card.className = 'plan-day-card';

      // Check if done today
      const doneToday = logs.some(l => l.dayIndex === idx && new Date(l.date).toDateString() === today);
      const mainExercises = day.exercises.filter(e => !e.isWarmup);
      const assignedDay = preferred[idx] ? dayNameMap[preferred[idx]] : null;
      const isToday = preferred[idx] === todayKey;

      if (doneToday) card.classList.add('completed-today');
      if (isToday && !doneToday) card.classList.add('is-today');

      card.innerHTML = `
        <div class="plan-day-name">${assignedDay ? assignedDay + ' — ' : ''}${day.name}</div>
        <div class="plan-day-nameDE">${day.nameDE}</div>
        <div class="plan-day-meta">${mainExercises.length} Übungen${isToday && !doneToday ? ' · 📍 Heute' : ''}${doneToday ? ' · ✅ Heute erledigt' : ''}</div>
      `;
      card.addEventListener('click', () => showPlanDetail(idx));
      list.appendChild(card);
    });
  }

  function calculateStreak(logs) {
    if (logs.length === 0) return 0;
    const dates = [...new Set(logs.map(l => new Date(l.date).toDateString()))].sort((a, b) => new Date(b) - new Date(a));
    let streak = 0;
    const now = new Date();
    let checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Allow today or yesterday as start
    if (dates[0] !== checkDate.toDateString()) {
      checkDate.setDate(checkDate.getDate() - 1);
      if (dates[0] !== checkDate.toDateString()) return 0;
    }

    for (const d of dates) {
      if (d === checkDate.toDateString()) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  function countThisWeek(logs) {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    startOfWeek.setHours(0, 0, 0, 0);
    return logs.filter(l => new Date(l.date) >= startOfWeek).length;
  }

  // ── Plan Detail ──────────────────────────────────────────

  function showPlanDetail(dayIdx) {
    if (!state.plan || !state.plan.days || !state.profile) return;
    const day = state.plan.days[dayIdx];
    if (!day) return;

    const dayNameMap2 = {
      mon: 'Montag', tue: 'Dienstag', wed: 'Mittwoch', thu: 'Donnerstag',
      fri: 'Freitag', sat: 'Samstag', sun: 'Sonntag'
    };
    const dayOrder2 = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const preferred2 = (state.profile.preferredDays || [])
      .slice()
      .sort((a, b) => dayOrder2.indexOf(a) - dayOrder2.indexOf(b));
    const assignedDay2 = preferred2[dayIdx] ? dayNameMap2[preferred2[dayIdx]] : null;

    document.getElementById('plan-detail-title').textContent =
      `${assignedDay2 ? assignedDay2 + ' — ' : ''}${day.name}`;

    const container = document.getElementById('plan-detail-exercises');
    container.innerHTML = '';

    let warmupStarted = false;
    let mainStarted = false;
    let num = 0;

    day.exercises.forEach((ex, exIdx) => {
      const exercise = window.getExercise(ex.exerciseId);
      if (!exercise) return;

      if (ex.isWarmup && !warmupStarted) {
        warmupStarted = true;
        const label = document.createElement('div');
        label.className = 'warmup-section-label';
        label.textContent = 'Aufwärmen';
        container.appendChild(label);
      }
      if (!ex.isWarmup && !mainStarted) {
        mainStarted = true;
        num = 0;
        const label = document.createElement('div');
        label.className = 'main-section-label';
        label.textContent = 'Training';
        container.appendChild(label);
      }

      num++;
      const card = document.createElement('div');
      card.className = 'exercise-card' + (ex.isWarmup ? ' warmup' : '');

      let meta = '';
      if (ex.duration) {
        meta = `${ex.sets}× ${ex.duration}s`;
      } else {
        meta = `${ex.sets}× ${ex.reps} Wdh.`;
        if (ex.weight) meta += ` · ${ex.weight} kg`;
      }
      if (ex.restSeconds && !ex.isWarmup) meta += ` · ${ex.restSeconds}s Pause`;

      card.innerHTML = `
        <div class="exercise-num">${num}</div>
        <div class="exercise-info">
          <div class="exercise-name">${exercise.name}</div>
          <div class="exercise-nameDE">${exercise.nameDE}</div>
          <div class="exercise-meta">${meta}</div>
        </div>
        <button class="exercise-info-btn" data-exid="${exercise.id}">ℹ</button>
      `;

      card.querySelector('.exercise-info-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        showExerciseModal(exercise.id);
      });

      container.appendChild(card);
    });

    // Store for workout start
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
    ex.muscleGroups.forEach(m => {
      const b = document.createElement('span');
      b.className = 'badge badge-muscle';
      b.textContent = formatMuscle(m);
      badges.appendChild(b);
    });
    ex.equipment.forEach(e => {
      const b = document.createElement('span');
      b.className = 'badge badge-equipment';
      b.textContent = formatEquipment(e);
      badges.appendChild(b);
    });

    document.getElementById('modal-video-link').href =
      `https://www.youtube.com/results?search_query=${ex.videoSearch}`;

    document.getElementById('modal-exercise').classList.remove('hidden');
  }

  function formatMuscle(m) {
    const map = {
      chest: 'Brust', shoulders: 'Schultern', triceps: 'Trizeps', biceps: 'Bizeps',
      back: 'Rücken', core: 'Core', quads: 'Quadrizeps', glutes: 'Gesäß',
      hamstrings: 'Beinbeuger', calves: 'Waden', obliques: 'Schräge Bauchm.',
      full_body: 'Ganzkörper', hips: 'Hüfte', legs: 'Beine', hip_flexors: 'Hüftbeuger',
      adductors: 'Adduktoren'
    };
    return map[m] || m;
  }

  function formatEquipment(e) {
    const map = {
      bodyweight: 'Körpergewicht', kettlebell: 'Kettlebell', dumbbell: 'Kurzhantel',
      dip_bars: 'Dip-Barren', pull_up_bar: 'Klimmzugstange', rings: 'Ringe'
    };
    return map[e] || e;
  }

  // ── Active Workout ───────────────────────────────────────

  function startWorkout(dayIdx) {
    if (!state.plan || !state.plan.days) return;
    const day = state.plan.days[dayIdx];
    if (!day) return;
    state.currentWorkout = {
      dayIndex: dayIdx,
      dayName: day.name,
      exercises: day.exercises.map(ex => ({
        exerciseId: ex.exerciseId,
        isWarmup: ex.isWarmup,
        targetSets: ex.sets,
        targetReps: ex.reps,
        targetDuration: ex.duration,
        targetWeight: ex.weight,
        restSeconds: ex.restSeconds,
        sets: Array.from({ length: ex.sets }, () => ({
          reps: null,
          weight: ex.weight,
          duration: null,
          completed: false
        }))
      })),
      startedAt: new Date().toISOString()
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

    let warmupStarted = false;
    let mainStarted = false;
    let totalSets = 0;
    let completedSets = 0;

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
      if (!ex.isWarmup && !mainStarted) {
        mainStarted = true;
        const label = document.createElement('div');
        label.className = 'main-section-label';
        label.textContent = 'Training';
        container.appendChild(label);
      }

      const card = document.createElement('div');
      card.className = 'workout-exercise-card';

      const header = document.createElement('div');
      header.className = 'workout-ex-header';
      header.innerHTML = `
        <div>
          <div class="workout-ex-name">${exercise.name}</div>
          <div class="workout-ex-nameDE">${exercise.nameDE}</div>
        </div>
        <button class="exercise-info-btn" data-exid="${exercise.id}">ℹ</button>
      `;
      header.querySelector('.exercise-info-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        showExerciseModal(exercise.id);
      });
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
          // Timed exercise
          const target = document.createElement('span');
          target.className = 'set-target';
          target.textContent = `Ziel: ${ex.targetDuration}s`;
          row.appendChild(target);

          if (!set.completed) {
            const timerBtn = document.createElement('button');
            timerBtn.className = 'btn-timer-start';
            timerBtn.textContent = '⏱ Timer';
            timerBtn.addEventListener('click', () => {
              openExerciseTimer(exercise.name, ex.targetDuration, (finalTime) => {
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
          // Reps exercise
          const target = document.createElement('span');
          target.className = 'set-target';
          target.textContent = `Ziel: ${ex.targetReps}× ${ex.targetWeight ? ex.targetWeight + 'kg' : ''}`;
          row.appendChild(target);

          if (!set.completed) {
            const inputGroup = document.createElement('div');
            inputGroup.className = 'set-input-group';

            const repsInput = document.createElement('input');
            repsInput.type = 'number';
            repsInput.className = 'set-input';
            repsInput.placeholder = ex.targetReps;
            repsInput.inputMode = 'numeric';
            repsInput.value = set.reps || '';
            repsInput.addEventListener('input', (e) => { set.reps = +e.target.value; });
            inputGroup.innerHTML = '';

            const repsLabel = document.createElement('span');
            repsLabel.className = 'set-input-label';
            repsLabel.textContent = 'Wdh';
            inputGroup.appendChild(repsInput);
            inputGroup.appendChild(repsLabel);

            if (ex.targetWeight) {
              const weightInput = document.createElement('input');
              weightInput.type = 'number';
              weightInput.className = 'set-input';
              weightInput.placeholder = ex.targetWeight;
              weightInput.inputMode = 'decimal';
              weightInput.step = '0.5';
              weightInput.value = set.weight || '';
              weightInput.addEventListener('input', (e) => { set.weight = +e.target.value; });

              const weightLabel = document.createElement('span');
              weightLabel.className = 'set-input-label';
              weightLabel.textContent = 'kg';
              inputGroup.appendChild(weightInput);
              inputGroup.appendChild(weightLabel);
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
        doneBtn.className = 'btn-set-done' + (set.completed ? ' done' : '');
        doneBtn.innerHTML = set.completed ? '✓' : '✓';
        if (!set.completed) {
          doneBtn.addEventListener('click', () => {
            if (!(exercise.isTimed || ex.targetDuration)) {
              if (!set.reps) set.reps = ex.targetReps;
              if (!set.weight && ex.targetWeight) set.weight = ex.targetWeight;
            }
            set.completed = true;
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
    const allDone = wo.exercises.every(ex => ex.sets.every(s => s.completed));
    if (allDone && completedSets > 0) {
      setTimeout(() => finishWorkout(), 500);
    }

    // Add bottom padding
    const spacer = document.createElement('div');
    spacer.style.height = '100px';
    container.appendChild(spacer);
  }

  function maybeShowRestTimer(exerciseEntry, exIdx, setIdx) {
    if (state.profile.restMode !== 'auto') return;
    if (exerciseEntry.isWarmup) {
      // Short rest for warmup
      if (exerciseEntry.restSeconds > 0) showRestTimer(exerciseEntry.restSeconds, exIdx, setIdx);
      return;
    }
    // Check if there are more sets or exercises
    const wo = state.currentWorkout;
    const isLastSet = setIdx >= exerciseEntry.sets.length - 1;
    const isLastExercise = exIdx >= wo.exercises.length - 1;
    if (isLastSet && isLastExercise) return;

    showRestTimer(exerciseEntry.restSeconds || 60, exIdx, setIdx);
  }

  // ── Workout Timer (elapsed) ──────────────────────────────

  function startWorkoutTimer() {
    workoutStartTime = Date.now();
    clearInterval(workoutElapsedInterval);
    workoutElapsedInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - workoutStartTime) / 1000);
      const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const sec = String(elapsed % 60).padStart(2, '0');
      document.getElementById('workout-elapsed').textContent = `${min}:${sec}`;
    }, 1000);
  }

  function stopWorkoutTimer() {
    clearInterval(workoutElapsedInterval);
  }

  // ── Rest Timer ───────────────────────────────────────────

  function showRestTimer(seconds, currentExIdx, currentSetIdx) {
    const overlay = document.getElementById('rest-overlay');
    overlay.classList.remove('hidden');

    restTimerRemaining = seconds;
    const total = seconds;
    const circumference = 2 * Math.PI * 54;

    const valueEl = document.getElementById('rest-timer-value');
    const progressEl = document.getElementById('rest-timer-progress');
    progressEl.style.strokeDasharray = circumference;

    // Show next exercise info
    const wo = state.currentWorkout;
    const nextInfo = document.getElementById('rest-next-exercise');
    const currentEx = wo.exercises[currentExIdx];
    const isLastSet = currentSetIdx >= currentEx.sets.length - 1;

    if (isLastSet && currentExIdx < wo.exercises.length - 1) {
      const nextEx = window.getExercise(wo.exercises[currentExIdx + 1].exerciseId);
      if (nextEx) nextInfo.textContent = `Nächste Übung: ${nextEx.name}`;
      else nextInfo.textContent = '';
    } else if (!isLastSet) {
      nextInfo.textContent = `Nächster Satz: ${currentSetIdx + 2}`;
    } else {
      nextInfo.textContent = '';
    }

    clearInterval(restTimerInterval);
    const startTime = Date.now();

    function updateRest() {
      const elapsed = (Date.now() - startTime) / 1000;
      restTimerRemaining = Math.max(0, total - elapsed);

      valueEl.textContent = Math.ceil(restTimerRemaining);
      const offset = circumference * (1 - restTimerRemaining / total);
      progressEl.style.strokeDashoffset = offset;

      if (restTimerRemaining <= 0) {
        clearInterval(restTimerInterval);
        overlay.classList.add('hidden');
        // Vibrate if available
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    }

    restTimerInterval = setInterval(updateRest, 50);
    updateRest();
  }

  // ── Exercise Timer (countdown) ───────────────────────────

  function openExerciseTimer(name, duration, callback) {
    const overlay = document.getElementById('exercise-timer-overlay');
    overlay.classList.remove('hidden');

    document.getElementById('timer-exercise-name').textContent = name;

    exerciseTimerTotal = duration;
    exerciseTimerRemaining = duration;
    exerciseTimerRunning = false;
    exerciseTimerCallback = callback;

    const circumference = 2 * Math.PI * 54;
    document.getElementById('exercise-timer-progress').style.strokeDasharray = circumference;

    updateExerciseTimerDisplay();

    document.getElementById('btn-timer-toggle').textContent = 'Start';
  }

  function updateExerciseTimerDisplay() {
    const valueEl = document.getElementById('exercise-timer-value');
    const progressEl = document.getElementById('exercise-timer-progress');
    const circumference = 2 * Math.PI * 54;

    const seconds = Math.floor(exerciseTimerRemaining);
    const centiseconds = Math.floor((exerciseTimerRemaining % 1) * 100);
    valueEl.textContent = `${seconds}.${String(centiseconds).padStart(2, '0')}`;

    const offset = circumference * (1 - exerciseTimerRemaining / exerciseTimerTotal);
    progressEl.style.strokeDashoffset = offset;
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

        if (exerciseTimerRemaining <= 0) {
          clearInterval(exerciseTimerInterval);
          exerciseTimerRunning = false;
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          document.getElementById('btn-timer-toggle').textContent = 'Start';
          // Auto-complete
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
    if (exerciseTimerCallback) {
      exerciseTimerCallback(Math.round(finalTime || (exerciseTimerTotal - exerciseTimerRemaining)));
    }
  }

  // ── Finish Workout ───────────────────────────────────────

  function finishWorkout() {
    stopWorkoutTimer();
    clearInterval(restTimerInterval);
    document.getElementById('rest-overlay').classList.add('hidden');

    const wo = state.currentWorkout;
    const elapsed = Math.floor((Date.now() - workoutStartTime) / 1000);

    // Save log
    const log = {
      id: 'log_' + Date.now(),
      date: new Date().toISOString(),
      dayIndex: wo.dayIndex,
      dayName: wo.dayName,
      duration: elapsed,
      exercises: wo.exercises.map(ex => ({
        exerciseId: ex.exerciseId,
        isWarmup: ex.isWarmup,
        sets: ex.sets.map(s => ({ ...s }))
      }))
    };

    state.logs.push(log);
    saveLogs();

    // Show completion screen
    const min = Math.floor(elapsed / 60);
    const totalSets = wo.exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0);
    const mainExercises = wo.exercises.filter(e => !e.isWarmup).length;

    document.getElementById('complete-summary').textContent = `${wo.dayName} abgeschlossen`;
    document.getElementById('complete-stats').innerHTML = `
      <div class="complete-stat">
        <span class="complete-stat-value">${min}</span>
        <span class="complete-stat-label">Minuten</span>
      </div>
      <div class="complete-stat">
        <span class="complete-stat-value">${mainExercises}</span>
        <span class="complete-stat-label">Übungen</span>
      </div>
      <div class="complete-stat">
        <span class="complete-stat-value">${totalSets}</span>
        <span class="complete-stat-label">Sätze</span>
      </div>
    `;

    state.currentWorkout = null;
    showScreen('complete');
  }

  // ── Progress Screen ──────────────────────────────────────

  function renderProgress() {
    renderHistory();
    populateExerciseSelect();
  }

  function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';

    if (state.logs.length === 0) {
      list.innerHTML = '<div class="no-data">Noch keine Trainings absolviert.</div>';
      return;
    }

    const recent = [...state.logs].reverse().slice(0, 20);
    recent.forEach(log => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const date = new Date(log.date);
      const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const min = Math.floor((log.duration || 0) / 60);

      item.innerHTML = `
        <div>
          <div class="history-date">${dateStr}</div>
          <div class="history-name">${log.dayName}</div>
        </div>
        <div class="history-meta">${min} Min.</div>
      `;
      list.appendChild(item);
    });
  }

  function populateExerciseSelect() {
    const select = document.getElementById('progress-exercise-select');
    select.innerHTML = '<option value="">Übung wählen...</option>';

    // Find exercises that have logged data
    const loggedExercises = new Set();
    state.logs.forEach(log => {
      log.exercises.forEach(ex => {
        if (!ex.isWarmup) loggedExercises.add(ex.exerciseId);
      });
    });

    loggedExercises.forEach(id => {
      const ex = window.getExercise(id);
      if (ex) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${ex.name} (${ex.nameDE})`;
        select.appendChild(opt);
      }
    });
  }

  function renderProgressChart(exerciseId) {
    const canvas = document.getElementById('progress-chart');
    if (progressChart) progressChart.destroy();

    if (!exerciseId) return;

    // Collect data points
    const dataPoints = [];
    state.logs.forEach(log => {
      log.exercises.forEach(ex => {
        if (ex.exerciseId !== exerciseId) return;
        const completedSets = ex.sets.filter(s => s.completed);
        if (completedSets.length === 0) return;

        const exercise = window.getExercise(exerciseId);
        if (exercise && (exercise.isTimed || completedSets[0].duration)) {
          // Timed: show max duration
          const maxDur = Math.max(...completedSets.map(s => s.duration || 0));
          dataPoints.push({ date: new Date(log.date), value: maxDur, label: 'Sekunden' });
        } else {
          // Reps: show volume (reps × weight) or just reps
          const hasWeight = completedSets.some(s => s.weight);
          if (hasWeight) {
            const volume = completedSets.reduce((sum, s) => sum + (s.reps || 0) * (s.weight || 0), 0);
            dataPoints.push({ date: new Date(log.date), value: volume, label: 'Volumen (kg)' });
          } else {
            const totalReps = completedSets.reduce((sum, s) => sum + (s.reps || 0), 0);
            dataPoints.push({ date: new Date(log.date), value: totalReps, label: 'Wiederholungen' });
          }
        }
      });
    });

    if (dataPoints.length === 0) return;

    const labels = dataPoints.map(d => d.date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }));
    const values = dataPoints.map(d => d.value);
    const labelText = dataPoints[0].label;

    progressChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: labelText,
          data: values,
          borderColor: '#FF6B6B',
          backgroundColor: 'rgba(255,107,107,0.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#FF6B6B',
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { font: { size: 11 } }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 } }
          }
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

  function showSettings() {
    populateSettings();
    showScreen('settings');
  }

  function saveSettings() {
    if (!state.profile) return;
    state.profile.name = document.getElementById('set-name').value.trim();
    state.profile.age = +document.getElementById('set-age').value;
    state.profile.weight = +document.getElementById('set-weight').value;
    state.profile.height = +document.getElementById('set-height').value;
    state.profile.fitnessLevel = document.getElementById('set-level').value;
    state.profile.goal = document.getElementById('set-goal').value;
    state.profile.daysPerWeek = +document.getElementById('set-days').value;
    state.profile.minutesPerSession = +document.getElementById('set-minutes').value;
    state.profile.restMode = document.getElementById('set-rest').value;

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

  // ── Event Listeners ──────────────────────────────────────

  // ── Dark Mode ────────────────────────────────────────────

  function applyDarkMode(dark) {
    document.body.classList.toggle('dark', dark);
    // Update meta theme-color
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
    if (saved === true) {
      applyDarkMode(true);
    } else if (saved === null && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyDarkMode(true);
    }
  }

  function initEventListeners() {
    // Bottom nav
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => showScreen(btn.dataset.screen));
    });

    // Dashboard buttons
    document.getElementById('btn-settings').addEventListener('click', showSettings);

    document.getElementById('btn-darkmode').addEventListener('click', toggleDarkMode);

    document.getElementById('btn-new-plan').addEventListener('click', () => {
      showConfirm(
        'Neuer Trainingsplan',
        'Möchtest du einen neuen Plan generieren? Der aktuelle Plan wird ersetzt. Dein Fortschritt wird basierend auf deinen bisherigen Ergebnissen berücksichtigt.',
        () => {
          if (state.logs.length > 0 && state.plan) {
            state.plan = window.Planner.generateProgressivePlan(state.profile, state.logs, state.plan);
          } else {
            state.plan = window.Planner.generatePlan(state.profile);
          }
          savePlan();
          renderDashboard();
        }
      );
    });

    // Plan detail
    document.getElementById('btn-back-plan').addEventListener('click', () => showScreen('dashboard'));

    // Workout
    document.getElementById('btn-quit-workout').addEventListener('click', () => {
      showConfirm(
        'Training abbrechen?',
        'Dein Fortschritt für dieses Training geht verloren.',
        () => {
          stopWorkoutTimer();
          clearInterval(restTimerInterval);
          clearInterval(exerciseTimerInterval);
          document.getElementById('rest-overlay').classList.add('hidden');
          document.getElementById('exercise-timer-overlay').classList.add('hidden');
          state.currentWorkout = null;
          showScreen('dashboard');
        }
      );
    });

    // Rest timer
    document.getElementById('btn-skip-rest').addEventListener('click', () => {
      clearInterval(restTimerInterval);
      document.getElementById('rest-overlay').classList.add('hidden');
    });

    // Exercise timer
    document.getElementById('btn-timer-toggle').addEventListener('click', toggleExerciseTimer);
    document.getElementById('btn-timer-reset').addEventListener('click', resetExerciseTimer);
    document.getElementById('btn-timer-done').addEventListener('click', () => {
      const elapsed = exerciseTimerTotal - exerciseTimerRemaining;
      closeExerciseTimer(elapsed);
    });

    // Complete
    document.getElementById('btn-complete-done').addEventListener('click', () => showScreen('dashboard'));

    // Settings
    document.getElementById('btn-back-settings').addEventListener('click', () => showScreen('dashboard'));
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);

    document.getElementById('set-days').addEventListener('input', e => {
      document.getElementById('set-days-val').textContent = e.target.value;
    });
    document.getElementById('set-minutes').addEventListener('input', e => {
      document.getElementById('set-minutes-val').textContent = e.target.value;
    });

    document.getElementById('btn-reset-all').addEventListener('click', () => {
      showConfirm(
        'Alle Daten löschen?',
        'Profil, Trainingsplan und gesamte Historie werden unwiderruflich gelöscht.',
        () => {
          localStorage.removeItem(STORAGE_KEYS.profile);
          localStorage.removeItem(STORAGE_KEYS.plan);
          localStorage.removeItem(STORAGE_KEYS.logs);
          localStorage.removeItem(STORAGE_KEYS.onboarded);
          location.reload();
        }
      );
    });

    // Exercise modal
    document.getElementById('modal-close').addEventListener('click', () => {
      document.getElementById('modal-exercise').classList.add('hidden');
    });
    document.getElementById('modal-backdrop').addEventListener('click', () => {
      document.getElementById('modal-exercise').classList.add('hidden');
    });

    // Confirm modal backdrop
    document.querySelector('.modal-confirm-backdrop').addEventListener('click', () => {
      document.getElementById('modal-confirm').classList.add('hidden');
    });

    // Progress chart
    document.getElementById('progress-exercise-select').addEventListener('change', e => {
      renderProgressChart(e.target.value);
    });
  }

  // ── Init ─────────────────────────────────────────────────

  function init() {
    loadState();
    initDarkMode();
    initEventListeners();

    const isOnboarded = load(STORAGE_KEYS.onboarded);
    if (isOnboarded && state.profile && state.plan) {
      showScreen('dashboard');
    } else {
      initOnboarding();
      showScreen('onboarding');
    }
  }

  // Go
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
