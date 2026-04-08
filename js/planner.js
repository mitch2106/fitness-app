// ============================================================
// Training Plan Generator
// ============================================================
window.Planner = (function() {

  // Available kettlebell weights
  const KB_WEIGHTS = [6, 8, 10, 12, 14, 16, 18, 20];
  const DB_WEIGHT = 5;

  // ── Helpers ──────────────────────────────────────────────

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pick(arr, n) {
    return shuffle(arr).slice(0, n);
  }

  function getDifficultyMax(level) {
    return { beginner: 1, intermediate: 2, advanced: 3 }[level] || 2;
  }

  function getStartWeight(level, exercise) {
    if (exercise.equipment.includes('dumbbell')) return DB_WEIGHT;
    if (!exercise.equipment.includes('kettlebell')) return null;

    const idx = { beginner: 0, intermediate: 2, advanced: 4 }[level] || 1;
    return KB_WEIGHTS[Math.min(idx, KB_WEIGHTS.length - 1)];
  }

  function getRepScheme(goal, isTimed) {
    if (isTimed) return null;
    switch (goal) {
      case 'lose_weight':    return { sets: 3, reps: 15 };
      case 'build_muscle':   return { sets: 4, reps: 10 };
      case 'general_fitness': return { sets: 3, reps: 12 };
      case 'tone':           return { sets: 3, reps: 15 };
      default:               return { sets: 3, reps: 12 };
    }
  }

  function getTimedScheme(goal, exercise) {
    const base = exercise.defaultDuration || 30;
    switch (goal) {
      case 'lose_weight':    return { sets: 3, duration: Math.round(base * 1.2) };
      case 'build_muscle':   return { sets: 3, duration: base };
      case 'general_fitness': return { sets: 3, duration: base };
      case 'tone':           return { sets: 3, duration: Math.round(base * 1.1) };
      default:               return { sets: 3, duration: base };
    }
  }

  function getRestSeconds(goal) {
    switch (goal) {
      case 'lose_weight':    return 30;
      case 'build_muscle':   return 75;
      case 'general_fitness': return 60;
      case 'tone':           return 45;
      default:               return 60;
    }
  }

  // ── Warm-up generation ───────────────────────────────────

  function generateWarmup() {
    const warmups = window.getExercisesByCategory('warmup');
    const selected = pick(warmups, 5);
    return selected.map(ex => {
      if (ex.isTimed) {
        return {
          exerciseId: ex.id,
          sets: 1,
          reps: null,
          duration: ex.defaultDuration || 30,
          weight: null,
          restSeconds: 10,
          isWarmup: true
        };
      } else {
        return {
          exerciseId: ex.id,
          sets: 1,
          reps: 10,
          duration: null,
          weight: null,
          restSeconds: 10,
          isWarmup: true
        };
      }
    });
  }

  // ── Exercise selection by split type ─────────────────────

  function selectExercises(split, profile, exerciseCount) {
    const maxDiff = getDifficultyMax(profile.fitnessLevel);
    const all = window.EXERCISES.filter(e =>
      e.category !== 'warmup' && e.difficulty <= maxDiff
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

    let selected = [];

    switch (split) {
      case 'full_body': {
        const n = Math.max(1, Math.floor(exerciseCount / 4));
        selected = [
          ...pick(push, n),
          ...pick(pull, n),
          ...pick(lower, n + 1),
          ...pick(core, Math.max(1, exerciseCount - n * 3 - 1))
        ];
        break;
      }
      case 'upper': {
        const n = Math.max(1, Math.floor(exerciseCount / 3));
        selected = [
          ...pick(push, n + 1),
          ...pick(pull, n + 1),
          ...pick(core, Math.max(1, exerciseCount - (n + 1) * 2))
        ];
        break;
      }
      case 'lower': {
        const n = Math.max(1, Math.floor(exerciseCount * 0.7));
        selected = [
          ...pick(lower, n),
          ...pick(core, Math.max(1, exerciseCount - n))
        ];
        break;
      }
      case 'push': {
        const n = Math.floor(exerciseCount * 0.65);
        selected = [
          ...pick(push, n),
          ...pick(compound.filter(e =>
            e.muscleGroups.some(m => ['shoulders', 'chest', 'triceps'].includes(m)) ||
            e.muscleGroups.includes('full_body')
          ), Math.max(1, Math.floor(exerciseCount * 0.15))),
          ...pick(core, Math.max(1, exerciseCount - n - Math.floor(exerciseCount * 0.15)))
        ];
        break;
      }
      case 'pull': {
        const n = Math.floor(exerciseCount * 0.65);
        selected = [
          ...pick(pull, n),
          ...pick(lower.filter(e =>
            e.muscleGroups.some(m => ['hamstrings', 'back'].includes(m))
          ), Math.max(1, Math.floor(exerciseCount * 0.15))),
          ...pick(core, Math.max(1, exerciseCount - n - Math.floor(exerciseCount * 0.15)))
        ];
        break;
      }
      case 'legs': {
        const n = Math.floor(exerciseCount * 0.75);
        selected = [
          ...pick(lower, n),
          ...pick(core, Math.max(1, exerciseCount - n))
        ];
        break;
      }
      default: {
        selected = pick(all, exerciseCount);
      }
    }

    return selected.slice(0, exerciseCount);
  }

  // ── Plan structure by days per week ──────────────────────

  function getSplitStructure(daysPerWeek) {
    switch (daysPerWeek) {
      case 1: return [
        { name: 'Full Body', nameDE: 'Ganzkörper', split: 'full_body' }
      ];
      case 2: return [
        { name: 'Full Body A', nameDE: 'Ganzkörper A', split: 'full_body' },
        { name: 'Full Body B', nameDE: 'Ganzkörper B', split: 'full_body' }
      ];
      case 3: return [
        { name: 'Upper Body', nameDE: 'Oberkörper', split: 'upper' },
        { name: 'Lower Body', nameDE: 'Unterkörper', split: 'lower' },
        { name: 'Full Body', nameDE: 'Ganzkörper', split: 'full_body' }
      ];
      case 4: return [
        { name: 'Upper Body A', nameDE: 'Oberkörper A', split: 'upper' },
        { name: 'Lower Body A', nameDE: 'Unterkörper A', split: 'lower' },
        { name: 'Upper Body B', nameDE: 'Oberkörper B', split: 'upper' },
        { name: 'Lower Body B', nameDE: 'Unterkörper B', split: 'lower' }
      ];
      case 5: return [
        { name: 'Push', nameDE: 'Drücken', split: 'push' },
        { name: 'Pull', nameDE: 'Ziehen', split: 'pull' },
        { name: 'Legs', nameDE: 'Beine', split: 'legs' },
        { name: 'Upper Body', nameDE: 'Oberkörper', split: 'upper' },
        { name: 'Lower Body', nameDE: 'Unterkörper', split: 'lower' }
      ];
      case 6: return [
        { name: 'Push A', nameDE: 'Drücken A', split: 'push' },
        { name: 'Pull A', nameDE: 'Ziehen A', split: 'pull' },
        { name: 'Legs A', nameDE: 'Beine A', split: 'legs' },
        { name: 'Push B', nameDE: 'Drücken B', split: 'push' },
        { name: 'Pull B', nameDE: 'Ziehen B', split: 'pull' },
        { name: 'Legs B', nameDE: 'Beine B', split: 'legs' }
      ];
      default: return [
        { name: 'Full Body', nameDE: 'Ganzkörper', split: 'full_body' }
      ];
    }
  }

  // ── Main generation ──────────────────────────────────────

  function generatePlan(profile) {
    // Ensure numeric values
    profile.daysPerWeek = Number(profile.daysPerWeek) || 3;
    profile.minutesPerSession = Number(profile.minutesPerSession) || 45;

    const warmupTime = 5;
    const minutesPerExercise = profile.goal === 'build_muscle' ? 6 : 5;
    const availableMinutes = profile.minutesPerSession - warmupTime;
    const exerciseCount = Math.max(3, Math.min(10, Math.floor(availableMinutes / minutesPerExercise)));

    const structure = getSplitStructure(profile.daysPerWeek);
    const restSec = getRestSeconds(profile.goal);

    const days = structure.map((day, dayIdx) => {
      const warmup = generateWarmup();
      const exercises = selectExercises(day.split, profile, exerciseCount);

      const exerciseEntries = exercises.map(ex => {
        if (ex.isTimed) {
          const scheme = getTimedScheme(profile.goal, ex);
          return {
            exerciseId: ex.id,
            sets: scheme.sets,
            reps: null,
            duration: scheme.duration,
            weight: null,
            restSeconds: restSec,
            isWarmup: false
          };
        } else {
          const scheme = getRepScheme(profile.goal);
          const weight = getStartWeight(profile.fitnessLevel, ex);
          return {
            exerciseId: ex.id,
            sets: scheme.sets,
            reps: scheme.reps,
            duration: null,
            weight: weight,
            restSeconds: restSec,
            isWarmup: false
          };
        }
      });

      return {
        name: day.name,
        nameDE: day.nameDE,
        split: day.split,
        exercises: [...warmup, ...exerciseEntries]
      };
    });

    return {
      id: 'plan_' + Date.now(),
      createdAt: new Date().toISOString(),
      profile: { ...profile },
      days: days
    };
  }

  // ── Progressive plan generation ──────────────────────────

  function generateProgressivePlan(profile, logs, currentPlan) {
    // Analyze recent performance
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

    // Generate base plan
    const newPlan = generatePlan(profile);

    // Apply progressions
    newPlan.days.forEach(day => {
      day.exercises.forEach(ex => {
        if (ex.isWarmup) return;
        const perf = exercisePerformance[ex.exerciseId];
        if (!perf || perf.total === 0) return;

        const completionRate = perf.completed / perf.total;

        // If completing all sets consistently → increase
        if (completionRate >= 0.9) {
          if (ex.weight !== null) {
            // Try to increase weight
            const avgW = perf.avgWeight.reduce((a, b) => a + b, 0) / perf.avgWeight.length;
            const exercise = window.getExercise(ex.exerciseId);
            if (exercise && exercise.equipment.includes('kettlebell')) {
              const nextW = KB_WEIGHTS.find(w => w > avgW);
              if (nextW) ex.weight = nextW;
            }
          } else if (ex.reps !== null) {
            // Increase reps
            ex.reps = Math.min(20, ex.reps + 2);
          } else if (ex.duration !== null) {
            // Increase duration
            ex.duration = Math.round(ex.duration * 1.15);
          }
        }
        // If struggling → decrease slightly
        else if (completionRate < 0.5) {
          if (ex.weight !== null) {
            const avgW = perf.avgWeight.reduce((a, b) => a + b, 0) / perf.avgWeight.length;
            const exercise = window.getExercise(ex.exerciseId);
            if (exercise && exercise.equipment.includes('kettlebell')) {
              const prevW = [...KB_WEIGHTS].reverse().find(w => w < avgW);
              if (prevW) ex.weight = prevW;
            }
          } else if (ex.reps !== null) {
            ex.reps = Math.max(6, ex.reps - 2);
          }
        }
      });
    });

    return newPlan;
  }

  // Public API
  return {
    generatePlan,
    generateProgressivePlan,
    KB_WEIGHTS
  };

})();
