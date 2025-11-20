// js/auth-paywall.js
// ------------------------------------------------------------
// FINAL Non-OIDC Version
// Firebase ONLY → Controls UI access
// Supabase is never authenticated → Public quiz reads
// No token sync, no redirect loops, no signInWithIdToken()
// ------------------------------------------------------------

import { initializeServices, getInitializedClients } from "./config.js";
import { showView, showAuthLoading, hideAuthLoading } from "./ui-renderer.js";

import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const LOG = "[AUTH]";
let externalCallback = null;

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export async function initializeAuthListener(onAuthReady = null) {
  const { auth } = await initializeServices();

  externalCallback = onAuthReady;

  await setPersistence(auth, browserLocalPersistence);

  onAuthStateChanged(auth, (user) => {
    console.log(LOG, "Auth state →", user ? user.uid : "signed out");

    if (user) {
      showView("quiz-content");
      hideAuthLoading();
    } else {
      showView("paywall-screen");
    }

    if (externalCallback) externalCallback(user);
  });

  console.log(LOG, "Auth listener ready.");
}

export async function signInWithGoogle() {
  const { auth } = getInitializedClients();
  showAuthLoading("Opening Google Sign-In...");

  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log(LOG, "Google popup success:", result.user?.uid);
  } catch (e) {
    console.error(LOG, "Google popup error:", e);
  }

  hideAuthLoading();
}

export async function signOut() {
  const { auth } = getInitializedClients();
  await firebaseSignOut(auth);
  console.log(LOG, "Signed out.");
}
