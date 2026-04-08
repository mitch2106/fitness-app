// ============================================================
// Exercise Database
// ============================================================
window.EXERCISES = [
  // ── WARM-UP ──────────────────────────────────────────────
  {
    id: 'wu_jumping_jacks', name: 'Jumping Jacks', nameDE: 'Hampelmann',
    category: 'warmup', equipment: ['bodyweight'], muscleGroups: ['full_body'],
    description: 'Stand upright, jump while spreading legs and raising arms overhead. Jump back to starting position. Keep a steady rhythm.',
    videoSearch: 'jumping+jacks+proper+form', isTimed: true, defaultDuration: 45, difficulty: 1
  },
  {
    id: 'wu_arm_circles', name: 'Arm Circles', nameDE: 'Armkreisen',
    category: 'warmup', equipment: ['bodyweight'], muscleGroups: ['shoulders'],
    description: 'Extend arms to the sides. Make small circles, gradually increasing size. Switch direction halfway through.',
    videoSearch: 'arm+circles+warm+up', isTimed: true, defaultDuration: 30, difficulty: 1
  },
  {
    id: 'wu_hip_circles', name: 'Hip Circles', nameDE: 'Hüftkreisen',
    category: 'warmup', equipment: ['bodyweight'], muscleGroups: ['hips'],
    description: 'Stand with hands on hips. Rotate hips in large circles. Switch direction halfway through.',
    videoSearch: 'hip+circles+warm+up+exercise', isTimed: true, defaultDuration: 30, difficulty: 1
  },
  {
    id: 'wu_leg_swings', name: 'Leg Swings', nameDE: 'Beinschwünge',
    category: 'warmup', equipment: ['bodyweight'], muscleGroups: ['hips', 'legs'],
    description: 'Hold onto a wall for balance. Swing one leg forward and back in a controlled motion. Switch legs after the set time.',
    videoSearch: 'leg+swings+dynamic+stretch', isTimed: true, defaultDuration: 30, difficulty: 1
  },
  {
    id: 'wu_cat_cow', name: 'Cat-Cow Stretch', nameDE: 'Katze-Kuh',
    category: 'warmup', equipment: ['bodyweight'], muscleGroups: ['back', 'core'],
    description: 'On all fours, alternate between arching your back (cat) and dropping your belly while lifting your head (cow). Move slowly with your breath.',
    videoSearch: 'cat+cow+stretch+proper+form', isTimed: true, defaultDuration: 40, difficulty: 1
  },
  {
    id: 'wu_worlds_greatest', name: "World's Greatest Stretch", nameDE: 'Weltbeste Dehnung',
    category: 'warmup', equipment: ['bodyweight'], muscleGroups: ['full_body'],
    description: 'Lunge forward, place both hands on the floor, rotate one arm to the ceiling, return and switch sides. Combines hip, thoracic, and hamstring mobility.',
    videoSearch: 'worlds+greatest+stretch+tutorial', isTimed: true, defaultDuration: 45, difficulty: 1
  },
  {
    id: 'wu_high_knees', name: 'High Knees', nameDE: 'Kniehebelauf',
    category: 'warmup', equipment: ['bodyweight'], muscleGroups: ['legs', 'core'],
    description: 'Run in place, driving knees up to hip height. Pump arms for momentum. Keep core tight.',
    videoSearch: 'high+knees+exercise+proper+form', isTimed: true, defaultDuration: 30, difficulty: 1
  },
  {
    id: 'wu_bw_squats', name: 'Bodyweight Squats', nameDE: 'Kniebeugen',
    category: 'warmup', equipment: ['bodyweight'], muscleGroups: ['legs', 'glutes'],
    description: 'Stand shoulder-width apart, lower your hips back and down until thighs are parallel to the floor. Keep chest up and knees tracking over toes.',
    videoSearch: 'bodyweight+squat+proper+form', isTimed: false, difficulty: 1
  },
  {
    id: 'wu_inchworm', name: 'Inchworm', nameDE: 'Raupe',
    category: 'warmup', equipment: ['bodyweight'], muscleGroups: ['full_body'],
    description: 'From standing, hinge forward and walk hands out to a plank position. Walk hands back to feet and stand up. Great for hamstrings and shoulders.',
    videoSearch: 'inchworm+exercise+warm+up', isTimed: false, difficulty: 1
  },

  // ── COOLDOWN / STRETCHING ────────────────────────────────
  {
    id: 'cd_childs_pose', name: "Child's Pose", nameDE: 'Kindhaltung',
    category: 'cooldown', equipment: ['bodyweight'], muscleGroups: ['back', 'hips'],
    description: 'Kneel on the floor, sit back on your heels and reach arms forward on the ground. Breathe deeply and relax into the stretch.',
    videoSearch: 'childs+pose+stretch', isTimed: true, defaultDuration: 40, difficulty: 1
  },
  {
    id: 'cd_pigeon', name: 'Pigeon Stretch', nameDE: 'Tauben-Dehnung',
    category: 'cooldown', equipment: ['bodyweight'], muscleGroups: ['hips', 'glutes'],
    description: 'From a plank, bring one knee forward behind your wrist. Lower hips toward the floor. Feel the stretch in the hip and glute. Hold each side.',
    videoSearch: 'pigeon+stretch+proper+form', isTimed: true, defaultDuration: 30, difficulty: 1
  },
  {
    id: 'cd_seated_forward', name: 'Seated Forward Fold', nameDE: 'Vorbeuge im Sitzen',
    category: 'cooldown', equipment: ['bodyweight'], muscleGroups: ['hamstrings', 'back'],
    description: 'Sit with legs extended. Hinge at the hips and reach toward your toes. Keep your back as flat as possible. Breathe and relax into the stretch.',
    videoSearch: 'seated+forward+fold+stretch', isTimed: true, defaultDuration: 30, difficulty: 1
  },
  {
    id: 'cd_quad_stretch', name: 'Standing Quad Stretch', nameDE: 'Oberschenkel-Dehnung',
    category: 'cooldown', equipment: ['bodyweight'], muscleGroups: ['quads'],
    description: 'Stand on one leg, pull the other foot toward your glute. Keep knees together and hips pushed forward. Hold each side.',
    videoSearch: 'standing+quad+stretch', isTimed: true, defaultDuration: 25, difficulty: 1
  },
  {
    id: 'cd_chest_doorway', name: 'Doorway Chest Stretch', nameDE: 'Brust-Dehnung',
    category: 'cooldown', equipment: ['bodyweight'], muscleGroups: ['chest', 'shoulders'],
    description: 'Place forearm against a wall or doorframe at 90°. Step through and rotate body away to feel the stretch in your chest and front shoulder. Both sides.',
    videoSearch: 'doorway+chest+stretch', isTimed: true, defaultDuration: 25, difficulty: 1
  },
  {
    id: 'cd_figure_four', name: 'Figure Four Stretch', nameDE: 'Vierer-Dehnung',
    category: 'cooldown', equipment: ['bodyweight'], muscleGroups: ['glutes', 'hips'],
    description: 'Lie on your back. Cross one ankle over the opposite knee, then pull the bottom leg toward your chest. Feel the stretch deep in the glute.',
    videoSearch: 'figure+four+stretch+glute', isTimed: true, defaultDuration: 30, difficulty: 1
  },
  {
    id: 'cd_cobra', name: 'Cobra Stretch', nameDE: 'Kobra-Dehnung',
    category: 'cooldown', equipment: ['bodyweight'], muscleGroups: ['core', 'back'],
    description: 'Lie face down, hands under shoulders. Press up gently, extending the spine. Keep hips on the floor. Opens up chest and stretches abs.',
    videoSearch: 'cobra+stretch+yoga', isTimed: true, defaultDuration: 30, difficulty: 1
  },
  {
    id: 'cd_supine_twist', name: 'Supine Twist', nameDE: 'Rückendrehung',
    category: 'cooldown', equipment: ['bodyweight'], muscleGroups: ['back', 'obliques'],
    description: 'Lie on your back, pull one knee to chest and guide it across your body to the opposite side. Extend the arm on the same side. Hold each side.',
    videoSearch: 'supine+twist+stretch', isTimed: true, defaultDuration: 25, difficulty: 1
  },

  // ── UPPER BODY – PUSH ────────────────────────────────────
  {
    id: 'push_pushup', name: 'Push-Ups', nameDE: 'Liegestütze',
    category: 'upper_push', equipment: ['bodyweight'], muscleGroups: ['chest', 'shoulders', 'triceps'],
    description: 'Hands shoulder-width apart, lower chest to the floor while keeping body in a straight line. Push back up. Scale to knees if needed.',
    videoSearch: 'push+up+proper+form+tutorial', isTimed: false, difficulty: 1
  },
  {
    id: 'push_knee_pushup', name: 'Knee Push-Ups', nameDE: 'Knie-Liegestütze',
    category: 'upper_push', equipment: ['bodyweight'], muscleGroups: ['chest', 'shoulders', 'triceps'],
    description: 'Like a regular push-up but with knees on the ground. Keep a straight line from knees to head. Great for building up to full push-ups.',
    videoSearch: 'knee+push+ups+proper+form', isTimed: false, difficulty: 1
  },
  {
    id: 'push_diamond_pushup', name: 'Diamond Push-Ups', nameDE: 'Diamant-Liegestütze',
    category: 'upper_push', equipment: ['bodyweight'], muscleGroups: ['triceps', 'chest'],
    description: 'Place hands close together forming a diamond shape with thumbs and index fingers. Lower chest to hands and push back up. Emphasizes triceps.',
    videoSearch: 'diamond+push+ups+proper+form', isTimed: false, difficulty: 3
  },
  {
    id: 'push_dips', name: 'Dips', nameDE: 'Dips',
    category: 'upper_push', equipment: ['dip_bars'], muscleGroups: ['chest', 'triceps', 'shoulders'],
    description: 'Support yourself on the dip bars with straight arms. Lower body by bending elbows until upper arms are parallel to the floor. Push back up.',
    videoSearch: 'dip+bars+proper+form+technique', isTimed: false, difficulty: 2
  },
  {
    id: 'push_ring_pushup', name: 'Ring Push-Ups', nameDE: 'Ring-Liegestütze',
    category: 'upper_push', equipment: ['rings'], muscleGroups: ['chest', 'shoulders', 'triceps', 'core'],
    description: 'Perform push-ups with hands on gymnastic rings set close to the ground. The instability adds core activation and extra chest work.',
    videoSearch: 'ring+push+ups+tutorial', isTimed: false, difficulty: 2
  },
  {
    id: 'push_ring_dips', name: 'Ring Dips', nameDE: 'Ring-Dips',
    category: 'upper_push', equipment: ['rings'], muscleGroups: ['chest', 'triceps', 'shoulders'],
    description: 'Support yourself on rings with straight arms (turn rings out). Lower body and push back up. Very demanding on stabilizers.',
    videoSearch: 'ring+dips+proper+form+tutorial', isTimed: false, difficulty: 3
  },
  {
    id: 'push_kb_press', name: 'Kettlebell Overhead Press', nameDE: 'Kettlebell Überkopfdrücken',
    category: 'upper_push', equipment: ['kettlebell'], muscleGroups: ['shoulders', 'triceps'],
    description: 'Clean the kettlebell to shoulder height. Press it straight overhead until arm is fully extended. Lower with control. Do both sides.',
    videoSearch: 'kettlebell+overhead+press+form', isTimed: false, difficulty: 2
  },
  {
    id: 'push_db_press', name: 'Dumbbell Shoulder Press', nameDE: 'Kurzhantel Schulterdrücken',
    category: 'upper_push', equipment: ['dumbbell'], muscleGroups: ['shoulders', 'triceps'],
    description: 'Hold dumbbells at shoulder height with palms facing forward. Press both weights overhead until arms are extended. Lower with control.',
    videoSearch: 'dumbbell+shoulder+press+proper+form', isTimed: false, difficulty: 1
  },
  {
    id: 'push_pike_pushup', name: 'Pike Push-Ups', nameDE: 'Pike-Liegestütze',
    category: 'upper_push', equipment: ['bodyweight'], muscleGroups: ['shoulders', 'triceps'],
    description: 'Start in a downward dog position with hips high. Bend elbows and lower head toward the floor. Push back up. Targets shoulders heavily.',
    videoSearch: 'pike+push+up+proper+form', isTimed: false, difficulty: 2
  },

  // ── UPPER BODY – PULL ────────────────────────────────────
  {
    id: 'pull_pullup', name: 'Pull-Ups', nameDE: 'Klimmzüge',
    category: 'upper_pull', equipment: ['pull_up_bar'], muscleGroups: ['back', 'biceps'],
    description: 'Hang from the bar with palms facing away. Pull yourself up until chin is over the bar. Lower with control. The king of upper body exercises.',
    videoSearch: 'pull+up+proper+form+tutorial', isTimed: false, difficulty: 3
  },
  {
    id: 'pull_neg_pullup', name: 'Negative Pull-Ups', nameDE: 'Negative Klimmzüge',
    category: 'upper_pull', equipment: ['pull_up_bar'], muscleGroups: ['back', 'biceps'],
    description: 'Jump or step up to the top position (chin over bar). Lower yourself as slowly as possible (3-5 seconds). Great for building pull-up strength.',
    videoSearch: 'negative+pull+ups+tutorial+beginner', isTimed: false, difficulty: 2
  },
  {
    id: 'pull_chin_up', name: 'Chin-Ups', nameDE: 'Klimmzüge im Untergriff',
    category: 'upper_pull', equipment: ['pull_up_bar'], muscleGroups: ['back', 'biceps'],
    description: 'Hang from the bar with palms facing you. Pull yourself up until chin clears the bar. Emphasizes biceps more than pull-ups.',
    videoSearch: 'chin+up+proper+form', isTimed: false, difficulty: 2
  },
  {
    id: 'pull_ring_row', name: 'Ring Rows', nameDE: 'Ring-Rudern',
    category: 'upper_pull', equipment: ['rings'], muscleGroups: ['back', 'biceps'],
    description: 'Set rings at waist height. Hang underneath with straight body. Pull chest to rings, squeezing shoulder blades. Adjust difficulty by changing body angle.',
    videoSearch: 'ring+rows+proper+form+tutorial', isTimed: false, difficulty: 1
  },
  {
    id: 'pull_inv_row', name: 'Inverted Rows', nameDE: 'Rudern am Barren',
    category: 'upper_pull', equipment: ['dip_bars'], muscleGroups: ['back', 'biceps'],
    description: 'Lie under the dip bars, grip them and pull your chest up while keeping body straight. Like an upside-down push-up for your back.',
    videoSearch: 'inverted+row+proper+form', isTimed: false, difficulty: 1
  },
  {
    id: 'pull_kb_row', name: 'Kettlebell Row', nameDE: 'Kettlebell-Rudern',
    category: 'upper_pull', equipment: ['kettlebell'], muscleGroups: ['back', 'biceps'],
    description: 'Hinge forward at the hips, one hand on a bench for support. Pull the kettlebell to your hip, squeezing the shoulder blade. Lower with control.',
    videoSearch: 'kettlebell+row+single+arm+form', isTimed: false, difficulty: 1
  },
  {
    id: 'pull_db_row', name: 'Dumbbell Row', nameDE: 'Kurzhantel-Rudern',
    category: 'upper_pull', equipment: ['dumbbell'], muscleGroups: ['back', 'biceps'],
    description: 'Same as kettlebell row but with a dumbbell. Hinge forward, pull to hip, squeeze shoulder blade at the top.',
    videoSearch: 'dumbbell+row+one+arm+proper+form', isTimed: false, difficulty: 1
  },
  {
    id: 'pull_kb_halo', name: 'Kettlebell Halo', nameDE: 'Kettlebell Halo',
    category: 'upper_pull', equipment: ['kettlebell'], muscleGroups: ['shoulders', 'core'],
    description: 'Hold the kettlebell by the horns at chest height. Circle it around your head in a smooth motion. Alternate directions each rep.',
    videoSearch: 'kettlebell+halo+exercise+form', isTimed: false, difficulty: 1
  },

  // ── LOWER BODY ───────────────────────────────────────────
  {
    id: 'lower_goblet_squat', name: 'Goblet Squat', nameDE: 'Goblet Kniebeuge',
    category: 'lower', equipment: ['kettlebell'], muscleGroups: ['quads', 'glutes'],
    description: 'Hold a kettlebell at chest height by the horns. Squat deep with elbows inside your knees. Keep chest up throughout the movement.',
    videoSearch: 'goblet+squat+kettlebell+proper+form', isTimed: false, difficulty: 1
  },
  {
    id: 'lower_kb_swing', name: 'Kettlebell Swing', nameDE: 'Kettlebell Schwung',
    category: 'lower', equipment: ['kettlebell'], muscleGroups: ['glutes', 'hamstrings', 'back', 'core'],
    description: 'Hinge at the hips and swing the kettlebell between your legs, then explosively drive hips forward to swing it to chest height. Power comes from the hips, not the arms.',
    videoSearch: 'kettlebell+swing+proper+form+tutorial', isTimed: false, difficulty: 2
  },
  {
    id: 'lower_lunge', name: 'Lunges', nameDE: 'Ausfallschritte',
    category: 'lower', equipment: ['bodyweight'], muscleGroups: ['quads', 'glutes', 'hamstrings'],
    description: 'Step forward into a deep lunge. Both knees at 90 degrees, back knee just above the floor. Push back to standing. Alternate legs.',
    videoSearch: 'lunges+proper+form+tutorial', isTimed: false, difficulty: 1
  },
  {
    id: 'lower_kb_lunge', name: 'Kettlebell Lunges', nameDE: 'Kettlebell Ausfallschritte',
    category: 'lower', equipment: ['kettlebell'], muscleGroups: ['quads', 'glutes', 'hamstrings'],
    description: 'Hold a kettlebell in the goblet position or at your sides. Perform lunges with added resistance. Keep torso upright.',
    videoSearch: 'kettlebell+lunge+proper+form', isTimed: false, difficulty: 2
  },
  {
    id: 'lower_rdl', name: 'Romanian Deadlift', nameDE: 'Rumänisches Kreuzheben',
    category: 'lower', equipment: ['kettlebell'], muscleGroups: ['hamstrings', 'glutes', 'back'],
    description: 'Hold kettlebell(s) in front of thighs. Hinge at hips, pushing them back while lowering the weight along your legs. Feel the stretch in hamstrings, then drive hips forward to stand.',
    videoSearch: 'romanian+deadlift+kettlebell+form', isTimed: false, difficulty: 2
  },
  {
    id: 'lower_sumo_squat', name: 'Sumo Squat', nameDE: 'Sumo Kniebeuge',
    category: 'lower', equipment: ['kettlebell'], muscleGroups: ['quads', 'glutes', 'adductors'],
    description: 'Wide stance with toes pointed out. Hold a kettlebell between your legs. Squat deep, keeping knees tracking over toes. Targets inner thighs and glutes.',
    videoSearch: 'sumo+squat+kettlebell+form', isTimed: false, difficulty: 1
  },
  {
    id: 'lower_bulgarian', name: 'Bulgarian Split Squat', nameDE: 'Bulgarische Kniebeuge',
    category: 'lower', equipment: ['bodyweight'], muscleGroups: ['quads', 'glutes'],
    description: 'Rear foot elevated on a bench or chair. Lower into a deep single-leg squat. Keep torso upright. Can add kettlebell for extra resistance.',
    videoSearch: 'bulgarian+split+squat+proper+form', isTimed: false, difficulty: 2
  },
  {
    id: 'lower_glute_bridge', name: 'Glute Bridge', nameDE: 'Gesäßbrücke',
    category: 'lower', equipment: ['bodyweight'], muscleGroups: ['glutes', 'hamstrings'],
    description: 'Lie on your back, knees bent, feet flat on the floor. Drive hips up by squeezing glutes. Hold briefly at the top.',
    videoSearch: 'glute+bridge+proper+form', isTimed: false, difficulty: 1
  },
  {
    id: 'lower_kb_glute_bridge', name: 'Weighted Glute Bridge', nameDE: 'Gesäßbrücke mit Gewicht',
    category: 'lower', equipment: ['kettlebell'], muscleGroups: ['glutes', 'hamstrings'],
    description: 'Same as glute bridge but with a kettlebell placed on your hips for extra resistance. Hold the weight in place with both hands.',
    videoSearch: 'weighted+glute+bridge+kettlebell', isTimed: false, difficulty: 1
  },
  {
    id: 'lower_single_leg_dl', name: 'Single Leg Deadlift', nameDE: 'Einbeiniges Kreuzheben',
    category: 'lower', equipment: ['kettlebell'], muscleGroups: ['hamstrings', 'glutes', 'core'],
    description: 'Stand on one leg, hold a kettlebell in the opposite hand. Hinge forward while extending the free leg behind you. Return to standing.',
    videoSearch: 'single+leg+deadlift+kettlebell+form', isTimed: false, difficulty: 2
  },
  {
    id: 'lower_step_up', name: 'Step-Ups', nameDE: 'Aufsteiger',
    category: 'lower', equipment: ['bodyweight'], muscleGroups: ['quads', 'glutes'],
    description: 'Step onto a sturdy elevated surface. Drive through the heel and stand fully upright. Step back down with control.',
    videoSearch: 'step+ups+exercise+proper+form', isTimed: false, difficulty: 1
  },
  {
    id: 'lower_kb_deadlift', name: 'Kettlebell Deadlift', nameDE: 'Kettlebell Kreuzheben',
    category: 'lower', equipment: ['kettlebell'], muscleGroups: ['glutes', 'hamstrings', 'back'],
    description: 'Stand over the kettlebell, feet hip-width. Hinge at hips, grip the handle, and stand up by driving through heels. Keep back flat throughout.',
    videoSearch: 'kettlebell+deadlift+proper+form', isTimed: false, difficulty: 1
  },
  {
    id: 'lower_wall_sit', name: 'Wall Sit', nameDE: 'Wandsitzen',
    category: 'lower', equipment: ['bodyweight'], muscleGroups: ['quads', 'glutes'],
    description: 'Lean against a wall and slide down until thighs are parallel to the floor. Hold this position.',
    videoSearch: 'wall+sit+proper+form', isTimed: true, defaultDuration: 30, difficulty: 1
  },
  {
    id: 'lower_calf_raise', name: 'Calf Raises', nameDE: 'Wadenheben',
    category: 'lower', equipment: ['bodyweight'], muscleGroups: ['calves'],
    description: 'Stand on the edge of a step or flat on the floor. Rise up on your toes as high as possible, lower with control.',
    videoSearch: 'calf+raises+proper+form', isTimed: false, difficulty: 1
  },

  // ── CORE ─────────────────────────────────────────────────
  {
    id: 'core_plank', name: 'Plank', nameDE: 'Unterarmstütz',
    category: 'core', equipment: ['bodyweight'], muscleGroups: ['core'],
    description: 'Support yourself on forearms and toes. Keep body in a perfectly straight line from head to heels. Squeeze glutes and brace core.',
    videoSearch: 'plank+proper+form+tutorial', isTimed: true, defaultDuration: 30, difficulty: 1
  },
  {
    id: 'core_side_plank', name: 'Side Plank', nameDE: 'Seitstütz',
    category: 'core', equipment: ['bodyweight'], muscleGroups: ['obliques', 'core'],
    description: 'Lie on your side, support on forearm and feet stacked. Lift hips to form a straight line. Hold. Do both sides.',
    videoSearch: 'side+plank+proper+form', isTimed: true, defaultDuration: 25, difficulty: 1
  },
  {
    id: 'core_dead_bug', name: 'Dead Bugs', nameDE: 'Käfer',
    category: 'core', equipment: ['bodyweight'], muscleGroups: ['core'],
    description: 'Lie on your back, arms reaching to ceiling, knees at 90°. Extend opposite arm and leg while keeping lower back pressed to the floor.',
    videoSearch: 'dead+bug+exercise+proper+form', isTimed: false, difficulty: 1
  },
  {
    id: 'core_mountain_climber', name: 'Mountain Climbers', nameDE: 'Bergsteiger',
    category: 'core', equipment: ['bodyweight'], muscleGroups: ['core', 'shoulders', 'legs'],
    description: 'Start in a push-up position. Alternate driving knees toward chest in a running motion. Keep hips level and core tight.',
    videoSearch: 'mountain+climbers+proper+form', isTimed: true, defaultDuration: 30, difficulty: 1
  },
  {
    id: 'core_russian_twist', name: 'Russian Twist', nameDE: 'Russische Drehung',
    category: 'core', equipment: ['kettlebell'], muscleGroups: ['obliques', 'core'],
    description: 'Sit with knees bent, lean back slightly, feet off the floor. Hold a kettlebell and rotate torso side to side.',
    videoSearch: 'russian+twist+kettlebell+form', isTimed: false, difficulty: 2
  },
  {
    id: 'core_hanging_knee_raise', name: 'Hanging Knee Raises', nameDE: 'Knieheben im Hang',
    category: 'core', equipment: ['pull_up_bar'], muscleGroups: ['core', 'hip_flexors'],
    description: 'Hang from the pull-up bar. Raise knees toward chest by curling pelvis up. Lower with control. Avoid swinging.',
    videoSearch: 'hanging+knee+raise+proper+form', isTimed: false, difficulty: 2
  },
  {
    id: 'core_l_sit', name: 'L-Sit Hold', nameDE: 'L-Sitz',
    category: 'core', equipment: ['dip_bars'], muscleGroups: ['core', 'hip_flexors', 'triceps'],
    description: 'Support yourself on the dip bars with straight arms. Lift legs straight in front of you to form an L-shape. Hold this position.',
    videoSearch: 'l+sit+hold+parallettes+form', isTimed: true, defaultDuration: 15, difficulty: 3
  },
  {
    id: 'core_bicycle_crunch', name: 'Bicycle Crunches', nameDE: 'Fahrrad-Crunches',
    category: 'core', equipment: ['bodyweight'], muscleGroups: ['core', 'obliques'],
    description: 'Lie on your back, hands behind head. Bring opposite elbow to opposite knee while extending the other leg. Alternate in a pedaling motion.',
    videoSearch: 'bicycle+crunches+proper+form', isTimed: false, difficulty: 1
  },
  {
    id: 'core_flutter_kicks', name: 'Flutter Kicks', nameDE: 'Beinflattern',
    category: 'core', equipment: ['bodyweight'], muscleGroups: ['core', 'hip_flexors'],
    description: 'Lie on your back, hands under lower back. Lift legs slightly off the ground and alternate kicking up and down in small, fast movements.',
    videoSearch: 'flutter+kicks+exercise+form', isTimed: true, defaultDuration: 30, difficulty: 1
  },
  {
    id: 'core_kb_windmill', name: 'Kettlebell Windmill', nameDE: 'Kettlebell Windmühle',
    category: 'core', equipment: ['kettlebell'], muscleGroups: ['obliques', 'shoulders', 'hamstrings'],
    description: 'Press a kettlebell overhead with one arm. Keeping eyes on the weight, hinge sideways and reach the free hand toward your foot.',
    videoSearch: 'kettlebell+windmill+proper+form', isTimed: false, difficulty: 3
  },

  // ── FULL BODY / COMPOUND ─────────────────────────────────
  {
    id: 'comp_burpee', name: 'Burpees', nameDE: 'Burpees',
    category: 'compound', equipment: ['bodyweight'], muscleGroups: ['full_body'],
    description: 'From standing, drop into a squat, kick feet back to plank, do a push-up, jump feet to hands, and jump up with arms overhead.',
    videoSearch: 'burpees+proper+form+tutorial', isTimed: false, difficulty: 2
  },
  {
    id: 'comp_kb_clean_press', name: 'Kettlebell Clean & Press', nameDE: 'Kettlebell Umsetzen & Drücken',
    category: 'compound', equipment: ['kettlebell'], muscleGroups: ['full_body'],
    description: 'Swing the kettlebell and clean it to shoulder. Press it overhead. Lower back to rack, then back down. Combines power and strength.',
    videoSearch: 'kettlebell+clean+and+press+form', isTimed: false, difficulty: 2
  },
  {
    id: 'comp_kb_snatch', name: 'Kettlebell Snatch', nameDE: 'Kettlebell Reißen',
    category: 'compound', equipment: ['kettlebell'], muscleGroups: ['full_body'],
    description: 'Swing the kettlebell and in one fluid motion bring it overhead. Advanced movement requiring good swing technique.',
    videoSearch: 'kettlebell+snatch+proper+form', isTimed: false, difficulty: 3
  },
  {
    id: 'comp_turkish_getup', name: 'Turkish Get-Up', nameDE: 'Türkisches Aufstehen',
    category: 'compound', equipment: ['kettlebell'], muscleGroups: ['full_body'],
    description: 'Lie on your back holding a kettlebell overhead. Stand up in a specific sequence of movements while keeping the weight overhead at all times.',
    videoSearch: 'turkish+get+up+kettlebell+tutorial', isTimed: false, difficulty: 3
  },
  {
    id: 'comp_kb_thruster', name: 'Kettlebell Thruster', nameDE: 'Kettlebell Thruster',
    category: 'compound', equipment: ['kettlebell'], muscleGroups: ['legs', 'shoulders', 'core'],
    description: 'Hold kettlebells in rack position. Squat down, then explosively stand and press the weights overhead in one fluid motion.',
    videoSearch: 'kettlebell+thruster+proper+form', isTimed: false, difficulty: 2
  }
];

// ── Superset pairs (complementary exercises) ───────────────
window.SUPERSET_PAIRS = [
  ['push_pushup', 'pull_ring_row'],
  ['push_pushup', 'pull_inv_row'],
  ['push_dips', 'pull_chin_up'],
  ['push_dips', 'pull_pullup'],
  ['push_ring_pushup', 'pull_ring_row'],
  ['push_kb_press', 'pull_kb_row'],
  ['push_db_press', 'pull_db_row'],
  ['lower_goblet_squat', 'lower_kb_swing'],
  ['lower_lunge', 'lower_glute_bridge'],
  ['lower_rdl', 'lower_goblet_squat'],
  ['core_plank', 'lower_glute_bridge'],
  ['push_pike_pushup', 'pull_ring_row'],
];

// Helpers
window.getExercise = function(id) {
  return window.EXERCISES.find(e => e.id === id);
};
window.getExercisesByCategory = function(category) {
  return window.EXERCISES.filter(e => e.category === category);
};
window.getExercisesByDifficulty = function(maxDifficulty) {
  return window.EXERCISES.filter(e => e.difficulty <= maxDifficulty);
};
