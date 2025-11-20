// js/config.js
// -----------------------------------------------------------------------------
// Phase-7 Config: CLEANED-UP Supabase client init (Lazy Init + Global Exposure)
// -----------------------------------------------------------------------------
// FIXED: Exposes supabase globally so auth-paywall.js + api.js can use it
// FIXED: Prevents header conflicts & session collisions
// -----------------------------------------------------------------------------


import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { createClient as createSupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";


// ---------- Internal State ----------
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDB = null;
let supabase = null;
let analyticsInstance = null;
let analyticsInitialized = false;


// -----------------------------------------------------------------------------
// initializeServices() - Main Initialization
// -----------------------------------------------------------------------------
export async function initializeServices() {
  if (firebaseApp && supabase) {
    return { app: firebaseApp, auth: firebaseAuth, db: firebaseDB, supabase };
  }

  const cfg = JSON.parse(window.__firebase_config || "{}");
  if (!cfg?.apiKey) throw new Error("Firebase config missing in HTML.");

  // ---------- Firebase ----------
  console.log("[Config] Initializing Firebase...");
  firebaseApp = initializeApp(cfg);
  firebaseAuth = getAuth(firebaseApp);
  firebaseDB = getFirestore(firebaseApp);

  // ---------- Supabase ----------
  const SUPABASE_URL = cfg.supabaseUrl || "https://zqhzekzilalbszpfwxhn.supabase.co";
  const SUPABASE_ANON_KEY =
    cfg.supabaseAnonKey ||
    cfg.clientId ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxaHpla3ppbGFsYnN6cGZ3eGhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNjcyNjcsImV4cCI6MjA3Nzg0MzI2N30.RUa39KAfnBjLgaV9HTRfViPPXB861EOpCT2bv35q6Js";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[Config] Supabase credentials missing — Supabase client unavailable.");
  } else {
    supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: undefined
      }
      // NOTE: all global.headers removed (critical)
    });

    // --------- CRITICAL FIX ----------
    // Make Supabase available globally so auth-paywall.js can sync tokens
    window.supabase = supabase;

    console.log("[Config] Supabase initialized:", SUPABASE_URL);
  }

  // ---------- Google Analytics ----------
  if (cfg.measurementId) {
    analyticsInstance = getAnalytics(firebaseApp);
    analyticsInitialized = true;
    console.log("[Config] Google Analytics initialized.");
  }

  return { app: firebaseApp, auth: firebaseAuth, db: firebaseDB, supabase };
}


// -----------------------------------------------------------------------------
// Helpers + Exports
// -----------------------------------------------------------------------------
export function getInitializedClients() {
  if (!firebaseApp) throw new Error("Clients not initialized. Call initializeServices() first.");
  return { auth: firebaseAuth, supabase, db: firebaseDB };
}

export function getAuthUser() {
  return (firebaseAuth && firebaseAuth.currentUser) || null;
}

export function logAnalyticsEvent(evt, data = {}) {
  if (!analyticsInitialized || !analyticsInstance) return;
  try {
    logEvent(analyticsInstance, evt, data);
  } catch (e) {
    console.warn("[Analytics] Failed to log event:", e);
  }
}
