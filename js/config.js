// js/config.js
// -------------------------------------------------------------
// Stable Config for Production Quiz — Supabase + Firebase Auth
// -------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut as fbSignOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoTrueClient } from "https://esm.sh/@supabase/supabase-js@2/dist/module/lib/GoTrueClient.js";

// -------------------------------------------------------------
// Firebase Config — injected by HTML in quiz-engine.html
// -------------------------------------------------------------
const firebaseConfig = JSON.parse(window.__firebase_config);

// -------------------------------------------------------------
// Firebase Init
// -------------------------------------------------------------
console.log("[Config] Initializing Firebase…");
export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firebaseDB = getFirestore(firebaseApp);
export const analytics = getAnalytics(firebaseApp);
console.log("[Config] Firebase initialized.");

// -------------------------------------------------------------
// Supabase Init (🔹 needs session persistence for RLS tables)
// -------------------------------------------------------------
const SUPABASE_URL = "https://zqhzekzilalbszpfwxhn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxaHpla3ppbGFsYnN6cGZ3eGhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNjcyNjcsImV4cCI6MjA3Nzg0MzI2N30.RUa39KAfnBjLgaV9HTRfViPPXB861EOpCT2bv35q6Js";

console.log("[Config] Initializing Supabase…");
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});
console.log("[Config] Supabase initialized:", SUPABASE_URL);

// -------------------------------------------------------------
// Sync Firebase Auth token → Supabase JWT
// Required for: RLS permission to query quiz tables
// -------------------------------------------------------------
onAuthStateChanged(firebaseAuth, async (user) => {
  if (!user) {
    console.log("[Config] Firebase signed out → clearing Supabase session");
    await supabase.auth.signOut();
    return;
  }

  console.log("[Config] Firebase user detected → Getting Supabase JWT…");

  const token = await user.getIdToken(false).catch(() => null);
  if (!token) return;

  const { data, error } = await supabase.auth.setSession({ access_token: token, refresh_token: token });

  if (error) console.warn("[Config] Supabase session sync failed:", error.message);
  else console.log("[Config] Supabase session updated (RLS enabled)");
});

// -------------------------------------------------------------
// Helpers for rest of app
// -------------------------------------------------------------
export function getInitializedClients() {
  return {
    app: firebaseApp,
    auth: firebaseAuth,
    db: firebaseDB,
    supabase,
  };
}

export function getAuthUser() {
  return firebaseAuth?.currentUser || null;
}

export function logAnalyticsEvent(event, data = {}) {
  try {
    logEvent(analytics, event, data);
  } catch (e) {
    console.warn("[Config] Analytics failed:", e);
  }
}
