// ============================================================
// Training Plan Generator
// ============================================================
window.Planner = (function() {

  const KB_WEIGHTS = [6, 8, 10, 12, 14, 16, 18, 20];
  const DB_WEIGHTS = [2, 3, 5, 7, 10];

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pick(arr, n) { return shuffle(arr).slice(0, n); }

  // Pick with equipment preference: preferred equipment exercises first, fill rest randomly
  function pickPrefer(arr, n, preferredEquip) {
    if (!preferredEquip) return pick(arr, n);
    const preferred = shuffle(arr.filter(e => e.equipment.includes(preferredEquip)));
    const rest = shuffle(arr.filter(e => !e.equipment.includes(preferredEquip)));
    return [...preferred, ...rest].slice(0, n);
  }

  function getDifficultyMax(level) {
    return { beginner: 1, intermediate: 2, advanced: 3 }[level] || 2;
  }

  function getStartWeight(level, exercise) {
    if (exercise.equipment.includes('dumbbell')) {
      const idx = { beginner: 0, intermediate: 1, advanced: 2 }[level] || 0;
      return DB_WEIGHTS[Math.min(idx, DB_WEIGHTS.length - 1)];
    }
    if (exercise.equipment.includes('resistance_band')) return null;
    if (!exercise.equipment.includes('kettlebell')) return null;
    const idx = { beginner: 0, intermediate: 2, advanced: 4 }[level] || 1;
    return KB_WEIGHTS[Math.min(idx, KB_WEIGHTS.length - 1)];
  }

  function getRepScheme(goal) {
    switch (goal) {
      case 'lose_weight':     return { sets: 3, reps: 15 };
      case 'build_muscle':    return { sets: 4, reps: 10 };
      case 'general_fitness': return { sets: 3, reps: 12 };
      case 'tone':            return { sets: 3, reps: 15 };
      default:                return { sets: 3, reps: 12 };
    }
  }

  function getTimedScheme(goal, exercise) {
    const base = exercise.defaultDuration || 30;
    switch (goal) {
      case 'lose_weight':     return { sets: 3, duration: Math.round(base * 1.2) };
      case 'build_muscle':    return { sets: 3, duration: base };
      case 'general_fitness': return { sets: 3, duration: base };
      case 'tone':            return { sets: 3, duration: Math.round(base * 1.1) };
      default:                return { sets: 3, duration: base };
    }
  }

  function getRestSeconds(goal) {
    switch (goal) {
      case 'lose_weight':     return 30;
      case 'build_muscle':    return 75;
      case 'general_fitness': return 60;
      case 'tone':            return 45;
      default:                return 60;
    }
  }

  // ── Warm-up ──────────────────────────────────────────────

  function generateWarmup(split) {
    const warmups = window.getExercisesByCategory('warmup');

    // Muscle groups relevant per split
    const upperMuscles = ['shoulders', 'back', 'core', 'chest'];
    const lowerMuscles = ['hips', 'legs', 'glutes'];

    let priority, filler;
    switch (split) {
      case 'upper': case 'push': case 'pull':
        priority = warmups.filter(e => e.muscleGroups.some(m => upperMuscles.includes(m)));
        filler = warmups.filter(e => e.muscleGroups.some(m => lowerMuscles.includes(m) || m === 'full_body'));
        break;
      case 'lower': case 'legs':
        priority = warmups.filter(e => e.muscleGroups.some(m => lowerMuscles.includes(m)));
        filler = warmups.filter(e => e.muscleGroups.some(m => upperMuscles.includes(m) || m === 'full_body'));
        break;
      default: // full_body
        priority = warmups.filter(e => e.muscleGroups.includes('full_body'));
        filler = warmups.filter(e => !e.muscleGroups.includes('full_body'));
        break;
    }

    // Pick 3 priority + 2 filler, deduplicated
    const selected = pick(priority, 3);
    const remaining = filler.filter(e => !selected.includes(e));
    const result = [...selected, ...pick(remaining, 5 - selected.length)].slice(0, 5);

    return result.map(ex => ({
      exerciseId: ex.id,
      sets: 1,
      reps: ex.isTimed ? null : 10,
      duration: ex.isTimed ? (ex.defaultDuration || 30) : null,
      weight: null,
      restSeconds: 10,
      isWarmup: true,
      isCooldown: false,
      isWarmupSet: false
    }));
  }

  // ── Cooldown ─────────────────────────────────────────────

  function generateCooldown() {
    const cooldowns = window.getExercisesByCategory('cooldown');
    return pick(cooldowns, 4).map(ex => ({
      exerciseId: ex.id,
      sets: 1,
      reps: null,
      duration: ex.defaultDuration || 30,
      weight: null,
      restSeconds: 5,
      isWarmup: false,
      isCooldown: true,
      isWarmupSet: false
    }));
  }

  // ── Warmup sets for heavy exercises ──────────────────────

  function generateWarmupSets(exercise, targetWeight, level) {
    if (!targetWeight || targetWeight <= 8) return [];
    // One lighter warmup set
    const warmupWeight = KB_WEIGHTS.find(w => w >= targetWeight * 0.5) || KB_WEIGHTS[0];
    if (warmupWeight >= targetWeight) return [];
    return [{
      exerciseId: exercise.id,
      sets: 1,
      reps: 8,
      duration: null,
      weight: warmupWeight,
      restSeconds: 30,
      isWarmup: false,
      isCooldown: false,
      isWarmupSet: true
    }];
  }

  // ── Exercise selection ───────────────────────────────────

  function selectExercises(split, profile, exerciseCount) {
    const maxDiff = getDifficultyMax(profile.fitnessLevel);
    const pref = profile.preferredEquipment || null;
    const all = window.EXERCISES.filter(e =>
      e.category !== 'warmup' && e.category !== 'cooldown' && e.difficulty <= maxDiff
    );

    const byCategory = {};
    all.forEach(e => {
      if (!byCategory[e.category]) byCategory[e.category] = [];
      byCategory[e.category].push(e);
    });

    const push = byCategory['upper_push'] || [];
    const pull = byCategory['upper_pull'] || [];
    const lower = byCategory['lower'] || [];
    const core = byCategory['core'] || [];
    const compound = byCategory['compound'] || [];
    const p = (arr, n) => pickPrefer(arr, n, pref);

    let selected = [];
    switch (split) {
      case 'full_body': {
        const n = Math.max(1, Math.floor(exerciseCount / 4));
        selected = [...p(push, n), ...p(pull, n), ...p(lower, n + 1),
          ...p(core, Math.max(1, exerciseCount - n * 3 - 1))];
        break;
      }
      case 'upper': {
        const n = Math.max(1, Math.floor(exerciseCount / 3));
        selected = [...p(push, n + 1), ...p(pull, n + 1),
          ...p(core, Math.max(1, exerciseCount - (n + 1) * 2))];
        break;
      }
      case 'lower': {
        const n = Math.max(1, Math.floor(exerciseCount * 0.7));
        selected = [...p(lower, n), ...p(core, Math.max(1, exerciseCount - n))];
        break;
      }
      case 'push': {
        const n = Math.floor(exerciseCount * 0.65);
        const cn = Math.max(1, Math.floor(exerciseCount * 0.15));
        selected = [...p(push, n),
          ...p(compound.filter(e => e.muscleGroups.some(m => ['shoulders','chest','triceps','full_body'].includes(m))), cn),
          ...p(core, Math.max(1, exerciseCount - n - cn))];
        break;
      }
      case 'pull': {
        const n = Math.floor(exerciseCount * 0.65);
        const cn = Math.max(1, Math.floor(exerciseCount * 0.15));
        selected = [...p(pull, n),
          ...p(lower.filter(e => e.muscleGroups.some(m => ['hamstrings','back'].includes(m))), cn),
          ...p(core, Math.max(1, exerciseCount - n - cn))];
        break;
      }
      case 'legs': {
        const n = Math.floor(exerciseCount * 0.75);
        selected = [...p(lower, n), ...p(core, Math.max(1, exerciseCount - n))];
        break;
      }
      default:
        selected = p(all, exerciseCount);
    }
    return selected.slice(0, exerciseCount);
  }

  // ── Superset detection ───────────────────────────────────

  function findSupersets(exerciseEntries) {
    const pairs = window.SUPERSET_PAIRS || [];
    const ids = exerciseEntries.map(e => e.exerciseId);
    const supersets = [];
    const used = new Set();

    for (const [a, b] of pairs) {
      const idxA = ids.indexOf(a);
      const idxB = ids.indexOf(b);
      if (idxA >= 0 && idxB >= 0 && !used.has(idxA) && !used.has(idxB)) {
        supersets.push([idxA, idxB]);
        used.add(idxA);
        used.add(idxB);
      }
    }
    return supersets;
  }

  // ── Split structure ──────────────────────────────────────

  function getSplitStructure(daysPerWeek) {
    switch (daysPerWeek) {
      case 1: return [{ name: 'Full Body', nameDE: 'Ganzkörper', split: 'full_body' }];
      case 2: return [
        { name: 'Full Body A', nameDE: 'Ganzkörper A', split: 'full_body' },
        { name: 'Full Body B', nameDE: 'Ganzkörper B', split: 'full_body' }];
      case 3: return [
        { name: 'Upper Body', nameDE: 'Oberkörper', split: 'upper' },
        { name: 'Lower Body', nameDE: 'Unterkörper', split: 'lower' },
        { name: 'Full Body', nameDE: 'Ganzkörper', split: 'full_body' }];
      case 4: return [
        { name: 'Upper Body A', nameDE: 'Oberkörper A', split: 'upper' },
        { name: 'Lower Body A', nameDE: 'Unterkörper A', split: 'lower' },
        { name: 'Upper Body B', nameDE: 'Oberkörper B', split: 'upper' },
        { name: 'Lower Body B', nameDE: 'Unterkörper B', split: 'lower' }];
      case 5: return [
        { name: 'Push', nameDE: 'Drücken', split: 'push' },
        { name: 'Pull', nameDE: 'Ziehen', split: 'pull' },
        { name: 'Legs', nameDE: 'Beine', split: 'legs' },
        { name: 'Upper Body', nameDE: 'Oberkörper', split: 'upper' },
        { name: 'Lower Body', nameDE: 'Unterkörper', split: 'lower' }];
      case 6: return [
        { name: 'Push A', nameDE: 'Drücken A', split: 'push' },
        { name: 'Pull A', nameDE: 'Ziehen A', split: 'pull' },
        { name: 'Legs A', nameDE: 'Beine A', split: 'legs' },
        { name: 'Push B', nameDE: 'Drücken B', split: 'push' },
        { name: 'Pull B', nameDE: 'Ziehen B', split: 'pull' },
        { name: 'Legs B', nameDE: 'Beine B', split: 'legs' }];
      default: return [{ name: 'Full Body', nameDE: 'Ganzkörper', split: 'full_body' }];
    }
  }

  // ── Deload check ─────────────────────────────────────────

  function shouldDeload(logs) {
    // Deload every 4-6 weeks of consistent training
    if (logs.length < 12) return false;
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const recentCount = logs.filter(l => new Date(l.date) >= fourWeeksAgo).length;
    // If 12+ workouts in last 4 weeks → suggest deload
    return recentCount >= 12;
  }

  function applyDeload(exerciseEntry) {
    if (exerciseEntry.weight) {
      exerciseEntry.weight = KB_WEIGHTS.find(w => w >= exerciseEntry.weight * 0.6) || exerciseEntry.weight;
    }
    if (exerciseEntry.reps) exerciseEntry.reps = Math.max(6, Math.round(exerciseEntry.reps * 0.7));
    if (exerciseEntry.duration) exerciseEntry.duration = Math.round(exerciseEntry.duration * 0.7);
    exerciseEntry.sets = Math.max(2, exerciseEntry.sets - 1);
    return exerciseEntry;
  }

  // ── Main generation ──────────────────────────────────────

  function generatePlan(profile, logs) {
    profile.daysPerWeek = Number(profile.daysPerWeek) || 3;
    profile.minutesPerSession = Number(profile.minutesPerSession) || 45;

    const warmupTime = 5;
    const cooldownTime = 4;
    const minutesPerExercise = profile.goal === 'build_muscle' ? 6 : 5;
    const availableMinutes = profile.minutesPerSession - warmupTime - cooldownTime;
    const exerciseCount = Math.max(3, Math.min(10, Math.floor(availableMinutes / minutesPerExercise)));

    const structure = getSplitStructure(profile.daysPerWeek);
    const restSec = getRestSeconds(profile.goal);
    const isDeload = logs ? shouldDeload(logs) : false;

    const days = structure.map(day => {
      const warmup = generateWarmup(day.split);
      const exercises = selectExercises(day.split, profile, exerciseCount);

      let exerciseEntries = exercises.map(ex => {
        const weight = getStartWeight(profile.fitnessLevel, ex);
        let entry;
        if (ex.isTimed) {
          const scheme = getTimedScheme(profile.goal, ex);
          entry = {
            exerciseId: ex.id, sets: scheme.sets, reps: null,
            duration: scheme.duration, weight: null, restSeconds: restSec,
            isWarmup: false, isCooldown: false, isWarmupSet: false
          };
        } else {
          const scheme = getRepScheme(profile.goal);
          entry = {
            exerciseId: ex.id, sets: scheme.sets, reps: scheme.reps,
            duration: null, weight: weight, restSeconds: restSec,
            isWarmup: false, isCooldown: false, isWarmupSet: false
          };
        }
        if (isDeload) applyDeload(entry);
        return entry;
      });

      // Add warmup sets for heavy kettlebell exercises
      const withWarmupSets = [];
      exerciseEntries.forEach(entry => {
        const ex = window.getExercise(entry.exerciseId);
        if (ex && !ex.isTimed && entry.weight && entry.weight >= 12) {
          withWarmupSets.push(...generateWarmupSets(ex, entry.weight, profile.fitnessLevel));
        }
        withWarmupSets.push(entry);
      });

      // Detect supersets
      const supersetPairs = findSupersets(withWarmupSets.filter(e => !e.isWarmupSet));
      const cooldown = generateCooldown();

      return {
        name: day.name, nameDE: day.nameDE, split: day.split,
        exercises: [...warmup, ...withWarmupSets, ...cooldown],
        supersets: supersetPairs,
        isDeload: isDeload
      };
    });

    return {
      id: 'plan_' + Date.now(),
      createdAt: new Date().toISOString(),
      profile: { ...profile },
      days: days,
      isDeload: isDeload
    };
  }

  // ── Progressive plan ─────────────────────────────────────

  function generateProgressivePlan(profile, logs, currentPlan) {
    const recentLogs = logs.slice(-20);
    const exercisePerformance = {};

    recentLogs.forEach(log => {
      log.exercises.forEach(ex => {
        if (!exercisePerformance[ex.exerciseId]) {
          exercisePerformance[ex.exerciseId] = { completed: 0, total: 0, avgReps: [], avgWeight: [] };
        }
        const perf = exercisePerformance[ex.exerciseId];
        ex.sets.forEach(set => {
          perf.total++;
          if (set.completed) {
            perf.completed++;
            if (set.reps) perf.avgReps.push(set.reps);
            if (set.weight) perf.avgWeight.push(set.weight);
          }
        });
      });
    });

    const newPlan = generatePlan(profile, logs);

    newPlan.days.forEach(day => {
      day.exercises.forEach(ex => {
        if (ex.isWarmup || ex.isCooldown || ex.isWarmupSet) return;
        const perf = exercisePerformance[ex.exerciseId];
        if (!perf || perf.total === 0) return;

        const completionRate = perf.completed / perf.total;

        if (completionRate >= 0.9) {
          if (ex.weight !== null && ex.weight > 0) {
            const avgW = perf.avgWeight.reduce((a, b) => a + b, 0) / perf.avgWeight.length;
            const exercise = window.getExercise(ex.exerciseId);
            if (exercise) {
              const weights = exercise.equipment.includes('kettlebell') ? KB_WEIGHTS
                : exercise.equipment.includes('dumbbell') ? DB_WEIGHTS : null;
              if (weights) {
                const nextW = weights.find(w => w > avgW);
                if (nextW) ex.weight = nextW;
              }
            }
          } else if (ex.reps !== null) {
            ex.reps = Math.min(20, ex.reps + 2);
          } else if (ex.duration !== null) {
            ex.duration = Math.round(ex.duration * 1.15);
          }
        } else if (completionRate < 0.5) {
          if (ex.weight !== null && ex.weight > 0) {
            const avgW = perf.avgWeight.reduce((a, b) => a + b, 0) / perf.avgWeight.length;
            const exercise = window.getExercise(ex.exerciseId);
            if (exercise) {
              const weights = exercise.equipment.includes('kettlebell') ? KB_WEIGHTS
                : exercise.equipment.includes('dumbbell') ? DB_WEIGHTS : null;
              if (weights) {
                const prevW = [...weights].reverse().find(w => w < avgW);
                if (prevW) ex.weight = prevW;
              }
            }
          } else if (ex.reps !== null) {
            ex.reps = Math.max(6, ex.reps - 2);
          }
        }
      });
    });

    return newPlan;
  }

  // ── Get alternative exercise ─────────────────────────────

  function getAlternative(exerciseId, usedIds) {
    const ex = window.getExercise(exerciseId);
    if (!ex) return null;
    const alternatives = window.EXERCISES.filter(e =>
      e.id !== exerciseId &&
      e.category === ex.category &&
      e.difficulty <= ex.difficulty + 1 &&
      !usedIds.includes(e.id)
    );
    return alternatives.length > 0 ? shuffle(alternatives)[0] : null;
  }

  return {
    generatePlan,
    generateProgressivePlan,
    getAlternative,
    shouldDeload,
    KB_WEIGHTS,
    _selectExercises: selectExercises,
    _getStartWeight: getStartWeight,
    _generateWarmup: generateWarmup
  };
})();
