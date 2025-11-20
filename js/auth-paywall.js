// js/auth-paywall.js
// ------------------------------------------------------------
// Phase-7 Auth Handler (Lazy-init safe, JWT Sync + Robustness)
// ------------------------------------------------------------

import { initializeServices, getInitializedClients } from "./config.js";
import { showView, showAuthLoading, hideAuthLoading } from "./ui-renderer.js";

import {
  GoogleAuthProvider,
  getRedirectResult as firebaseGetRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const LOG = "[AUTH]";
let externalOnAuthChange = null;
let isSigningIn = false;
let isSyncInProgress = false;

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/**
 * Robust sync: exchanges Firebase ID token for Supabase session.
 * - Uses provider 'firebase' to indicate an external Firebase token
 * - Guards against empty tokens and parallel syncs
 * - Returns true if sync succeeded, false otherwise
 */
async function syncSupabaseAuth(user) {
  if (!user) {
    console.warn(LOG, "syncSupabaseAuth called with null user.");
    return false;
  }

  // Prevent concurrent syncs
  if (isSyncInProgress) {
    console.log(LOG, "syncSupabaseAuth already in progress — skipping parallel run.");
    return false;
  }
  isSyncInProgress = true;

  try {
    // Ensure clients are initialized (lazy-init safe)
    await initializeServices();
    const { supabase } = getInitializedClients();
    if (!supabase) {
      console.error(LOG, "Supabase client unavailable. Cannot sync.");
      return false;
    }

    // Force fresh token to avoid expired tokens
    const idToken = await user.getIdToken(true);
    if (!idToken || typeof idToken !== "string" || idToken.length < 20) {
      console.error(LOG, "Invalid/empty ID token, length:", idToken ? idToken.length : 0);
      return false;
    }

    // For debugging you can uncomment the next line (be careful not to leak tokens)
    // console.log(LOG, "ID token length:", idToken.length);

    // Use provider 'firebase' for Firebase ID tokens
    let attempt = 0;
    const maxAttempts = 2;
    while (attempt < maxAttempts) {
      attempt++;
      try {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: "firebase",
          token: idToken,
        });

        if (error) {
          console.warn(LOG, `Supabase token sync attempt ${attempt} failed:`, error.message || error);
          // If it's a transient network error, allow a retry; otherwise break
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 500));
            continue;
          }
          return false;
        }

        // Success
        console.log(LOG, "Supabase token sync successful. Supabase session created.", data?.session ? "[session present]" : "[no session info]");
        return true;
      } catch (syncErr) {
        console.error(LOG, `supabase.auth.signInWithIdToken threw (attempt ${attempt}):`, syncErr);
        if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 500));
      }
    }

    return false;
  } catch (err) {
    console.error(LOG, "Error in syncSupabaseAuth:", err);
    return false;
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * Internal auth-change handler.
 * Made async so we can await syncSupabaseAuth and only show quiz after sync completes.
 */
async function internalAuthChangeHandler(user) {
  console.log(LOG, "Auth state changed →", user ? user.uid : "Signed Out");

  if (user) {
    showAuthLoading("Restoring session...");

    // Ensure services are initialized before we attempt to sync
    try {
      await initializeServices();
    } catch (e) {
      console.error(LOG, "initializeServices failed in auth handler:", e);
      hideAuthLoading();
      showView("paywall-screen");
      if (typeof externalOnAuthChange === "function") externalOnAuthChange(null);
      return;
    }

    // Await token sync so Supabase session is ready before next steps
    const synced = await syncSupabaseAuth(user);
    if (!synced) {
      console.warn(LOG, "Supabase token sync failed — treating user as unauthenticated for Supabase.");
      // show the quiz UI anyway if you want read-only behavior for some flows; currently we show paywall.
      hideAuthLoading();
      showView("paywall-screen");
      if (typeof externalOnAuthChange === "function") externalOnAuthChange(null);
      return;
    }

    // At this point Supabase session should be present and queries will include Authorization header
    showView("quiz-content");
    hideAuthLoading();
    if (typeof externalOnAuthChange === "function") externalOnAuthChange(user);
  } else {
    // Signed out
    try {
      await initializeServices();
      const { supabase } = getInitializedClients();
      if (supabase) {
        await supabase.auth.signOut().catch((e) => console.warn(LOG, "Supabase signOut error:", e));
      }
    } catch (e) {
      // ignore initialization errors during signout
    }

    showView("paywall-screen");
    if (typeof externalOnAuthChange === "function") externalOnAuthChange(null);
  }
}

/**
 * Initializes auth listener (lazy-init safe).
 * Ensures initializeServices() is awaited before registering listener.
 */
export async function initializeAuthListener(onAuthChangeCallback = null) {
  // Ensure services are initialized (lazy-init)
  try {
    await initializeServices();
  } catch (e) {
    console.error(LOG, "initializeServices failed in initializeAuthListener:", e);
    throw e; // caller should handle; failing fast is better than silent undefined clients
  }

  const { auth } = getInitializedClients();

  // Attempt to set local persistence first (non-blocking if unsupported)
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (pErr) {
    console.warn(LOG, "Could not set browserLocalPersistence:", pErr?.message || pErr);
  }

  try {
    const redirectResult = await firebaseGetRedirectResult(auth);
    if (redirectResult?.user) console.log(LOG, "Restored user from redirect:", redirectResult.user.uid);
  } catch (err) {
    console.warn(LOG, "Redirect restore error:", err?.message || err);
  }

  // Set external callback
  if (onAuthChangeCallback) externalOnAuthChange = onAuthChangeCallback;

  // Register listener. Note: onAuthStateChanged will now call our async handler.
  onAuthStateChanged(auth, (user) => {
    // call async handler but keep errors caught
    internalAuthChangeHandler(user).catch((e) => console.error(LOG, "internalAuthChangeHandler error:", e));
  });

  console.log(LOG, "Auth listener initialized.");
}

/**
 * Sign in with Google (popup), with fallback to redirect.
 */
export async function signInWithGoogle() {
  const { auth } = getInitializedClients();
  if (isSigningIn) return;
  isSigningIn = true;

  try {
    showAuthLoading("Opening Google Sign-In...");
    const result = await signInWithPopup(auth, googleProvider);
    console.log(LOG, "Popup sign-in success:", result.user?.uid);
    hideAuthLoading();
    return result;
  } catch (popupError) {
    const fallbackCodes = ["auth/popup-blocked", "auth/cancelled-popup-request", "auth/web-storage-unsupported"];
    if (fallbackCodes.includes(popupError?.code)) {
      console.warn(LOG, "Popup blocked/error → fallback to redirect.", popupError);
      await signInWithRedirect(auth, googleProvider);
    } else {
      console.error(LOG, "Popup/Sign-in error:", popupError);
      hideAuthLoading();
    }
  } finally {
    isSigningIn = false;
  }
}

/**
 * Sign out both Firebase and Supabase
 */
export async function signOut() {
  try {
    await initializeServices();
  } catch (e) {
    console.warn(LOG, "initializeServices failed during signOut:", e);
  }

  const { auth, supabase } = getInitializedClients();
  try {
    await firebaseSignOut(auth);
  } catch (e) {
    console.warn(LOG, "Firebase signOut error:", e);
  }
  try {
    if (supabase) await supabase.auth.signOut();
  } catch (e) {
    console.warn(LOG, "Supabase signOut error:", e);
  }
  console.log(LOG, "User signed out.");
}
