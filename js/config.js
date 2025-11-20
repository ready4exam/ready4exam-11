// js/config.js
// -------------------------------------------------------------
// FINAL Simplified Config (No Supabase Auth / No OIDC)
// Firebase = Login
// Supabase = Anonymous Reads Only
// Firestore = Save Results
// -------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { createClient as createSupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDB = null;
let supabase = null;
let analyticsInstance = null;

export async function initializeServices() {
  if (firebaseApp && supabase) {
    return { auth: firebaseAuth, db: firebaseDB, supabase };
  }

  const cfg = JSON.parse(window.__firebase_config || "{}");
  if (!cfg.apiKey) throw new Error("Firebase config missing in HTML.");

  // Firebase Init
  firebaseApp = initializeApp(cfg);
  firebaseAuth = getAuth(firebaseApp);
  firebaseDB = getFirestore(firebaseApp);

  // Supabase Init (anonymous only)
  const SUPABASE_URL = cfg.supabaseUrl;
  const SUPABASE_ANON = cfg.supabaseAnonKey;

  supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false }
  });

  window.supabase = supabase; // optional debugging
  console.log("[Config] Supabase initialized (public-only).");

  // GA
  if (cfg.measurementId) {
    analyticsInstance = getAnalytics(firebaseApp);
    console.log("[Config] Google Analytics initialized.");
  }

  return { auth: firebaseAuth, db: firebaseDB, supabase };
}

export function getInitializedClients() {
  if (!firebaseApp) throw new Error("Not initialized.");
  return { auth: firebaseAuth, supabase, db: firebaseDB };
}

export function getAuthUser() {
  return firebaseAuth?.currentUser || null;
}

export function logAnalyticsEventWrapper(evt, data = {}) {
  try {
    if (analyticsInstance) logEvent(analyticsInstance, evt, data);
  } catch (_) { }
}
