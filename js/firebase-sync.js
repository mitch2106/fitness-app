// ============================================================
// Firebase Firestore Sync Layer
// ============================================================
window.FireSync = (function() {

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCaczpDER4G_UsECasM8EDXu_AC6UhwFh8",
    authDomain: "myfit-80014.firebaseapp.com",
    projectId: "myfit-80014",
    storageBucket: "myfit-80014.firebasestorage.app",
    messagingSenderId: "383696306748",
    appId: "1:383696306748:web:bcf939e2102b3b21dfb939"
  };

  // We use a single document per data type under a fixed "user" doc
  // Since there's only one user, we use a fixed ID
  const USER_DOC_ID = 'eva_default';

  let db = null;
  let initialized = false;

  function init() {
    if (initialized) return;
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.firestore();
      initialized = true;
      console.log('Firebase initialized');
    } catch(e) {
      console.error('Firebase init failed:', e);
    }
  }

  function getDb() {
    if (!initialized) init();
    return db;
  }

  // ── Save to Firestore ────────────────────────────────────

  async function saveData(collection, data) {
    const fireDb = getDb();
    if (!fireDb) return;
    try {
      await fireDb.collection(collection).doc(USER_DOC_ID).set(data, { merge: true });
    } catch(e) {
      console.error(`Firestore save ${collection} failed:`, e);
    }
  }

  async function saveProfile(profile) {
    await saveData('profiles', { data: JSON.stringify(profile), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  }

  async function savePlan(plan) {
    await saveData('plans', { data: JSON.stringify(plan), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  }

  async function saveLogs(logs) {
    await saveData('logs', { data: JSON.stringify(logs), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  }

  async function saveNotes(notes) {
    await saveData('notes', { data: JSON.stringify(notes), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  }

  async function saveWeightLog(weightLog) {
    await saveData('weightlog', { data: JSON.stringify(weightLog), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  }

  // ── Load from Firestore ──────────────────────────────────

  async function loadData(collection) {
    const fireDb = getDb();
    if (!fireDb) return null;
    try {
      const doc = await fireDb.collection(collection).doc(USER_DOC_ID).get();
      if (doc.exists) {
        return JSON.parse(doc.data().data);
      }
    } catch(e) {
      console.error(`Firestore load ${collection} failed:`, e);
    }
    return null;
  }

  async function loadAll() {
    const [profile, plan, logs, notes, weightLog] = await Promise.all([
      loadData('profiles'),
      loadData('plans'),
      loadData('logs'),
      loadData('notes'),
      loadData('weightlog')
    ]);
    return { profile, plan, logs, notes, weightLog };
  }

  // ── Sync: merge local + remote ───────────────────────────

  async function syncAll(localState) {
    init();
    const fireDb = getDb();
    if (!fireDb) return localState;

    try {
      const remote = await loadAll();

      // Merge strategy: remote wins if local is empty, otherwise local wins
      // Exception: logs are merged by combining unique entries
      const merged = { ...localState };

      if (!merged.profile && remote.profile) merged.profile = remote.profile;
      if (!merged.plan && remote.plan) merged.plan = remote.plan;
      if ((!merged.notes || Object.keys(merged.notes).length === 0) && remote.notes) merged.notes = remote.notes;
      if ((!merged.weightLog || merged.weightLog.length === 0) && remote.weightLog) merged.weightLog = remote.weightLog;

      // Merge logs: combine by id, no duplicates
      if (remote.logs && remote.logs.length > 0) {
        const localIds = new Set((merged.logs || []).map(l => l.id));
        const remoteLogs = remote.logs.filter(l => !localIds.has(l.id));
        merged.logs = [...(merged.logs || []), ...remoteLogs].sort((a, b) => new Date(a.date) - new Date(b.date));
      }

      // Push merged state back to Firestore
      await Promise.all([
        merged.profile ? saveProfile(merged.profile) : null,
        merged.plan ? savePlan(merged.plan) : null,
        merged.logs ? saveLogs(merged.logs) : null,
        merged.notes ? saveNotes(merged.notes) : null,
        merged.weightLog ? saveWeightLog(merged.weightLog) : null
      ]);

      return merged;
    } catch(e) {
      console.error('Sync failed, using local data:', e);
      return localState;
    }
  }

  return {
    init,
    saveProfile,
    savePlan,
    saveLogs,
    saveNotes,
    saveWeightLog,
    loadAll,
    syncAll
  };

})();
