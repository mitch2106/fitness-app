// ============================================================
// Firebase Firestore + Auth Layer
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

  let db = null;
  let auth = null;
  let initialized = false;
  let authStateCallbacks = [];

  function init() {
    if (initialized) return;
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.firestore();
      auth = firebase.auth();
      initialized = true;
      auth.onAuthStateChanged(user => {
        authStateCallbacks.forEach(cb => cb(user));
      });
    } catch(e) {
      console.error('Firebase init failed:', e);
    }
  }

  function getDb() {
    if (!initialized) init();
    return db;
  }

  function getAuth() {
    if (!initialized) init();
    return auth;
  }

  function currentUser() {
    return auth ? auth.currentUser : null;
  }

  function userId() {
    const u = currentUser();
    return u ? u.uid : null;
  }

  function isVerified() {
    const u = currentUser();
    return u && u.emailVerified;
  }

  function onAuthStateChanged(callback) {
    authStateCallbacks.push(callback);
    if (auth && auth.currentUser !== undefined) callback(auth.currentUser);
  }

  // ── Auth ─────────────────────────────────────────────────

  async function signUp(email, password) {
    init();
    const result = await auth.createUserWithEmailAndPassword(email, password);
    await result.user.sendEmailVerification();
    return result.user;
  }

  async function signIn(email, password) {
    init();
    const result = await auth.signInWithEmailAndPassword(email, password);
    return result.user;
  }

  async function signOut() {
    init();
    await auth.signOut();
  }

  async function resendVerification() {
    const u = currentUser();
    if (u && !u.emailVerified) await u.sendEmailVerification();
  }

  async function reloadUser() {
    const u = currentUser();
    if (u) await u.reload();
    return currentUser();
  }

  async function resetPassword(email) {
    init();
    await auth.sendPasswordResetEmail(email);
  }

  // ── Save to Firestore ────────────────────────────────────

  async function saveData(collection, data) {
    const fireDb = getDb();
    const uid = userId();
    if (!fireDb || !uid || !isVerified()) return;
    try {
      await fireDb.collection(collection).doc(uid).set(data, { merge: true });
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
    const uid = userId();
    if (!fireDb || !uid || !isVerified()) return null;
    try {
      const doc = await fireDb.collection(collection).doc(uid).get();
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
    if (!fireDb || !userId() || !isVerified()) return localState;

    try {
      const remote = await loadAll();

      const merged = { ...localState };

      if (!merged.profile && remote.profile) merged.profile = remote.profile;
      if (!merged.plan && remote.plan) merged.plan = remote.plan;
      if ((!merged.notes || Object.keys(merged.notes).length === 0) && remote.notes) merged.notes = remote.notes;
      if ((!merged.weightLog || merged.weightLog.length === 0) && remote.weightLog) merged.weightLog = remote.weightLog;

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
    currentUser,
    userId,
    isVerified,
    onAuthStateChanged,
    signUp,
    signIn,
    signOut,
    resendVerification,
    reloadUser,
    resetPassword,
    saveProfile,
    savePlan,
    saveLogs,
    saveNotes,
    saveWeightLog,
    loadAll,
    syncAll
  };

})();
