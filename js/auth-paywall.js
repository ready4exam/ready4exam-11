// js/auth-paywall.js
// -------------------------------------------------------------
// Google Sign-In + Auth Flow Handler
// -------------------------------------------------------------

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  onAuthStateChanged,
  signOut as fbSignOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import { getInitializedClients } from "./config.js";

let authListenerStarted = false;

export function initializeAuthListener() {
  const { auth } = getInitializedClients();

  if (authListenerStarted) return;
  authListenerStarted = true;

  onAuthStateChanged(auth, (user) => {
    console.log("[AUTH] State:", user?.email ?? "Not logged in");

    const paywall = document.getElementById("paywall-screen");
    const content = document.getElementById("quiz-content");

    if (user) {
      paywall?.classList.add("hidden");
      content?.classList.remove("hidden");

      document.dispatchEvent(new CustomEvent("r4e-auth-ready"));
    } else {
      paywall?.classList.remove("hidden");
      content?.classList.add("hidden");
    }
  });
}

export async function signInWithGoogle() {
  const { auth } = getInitializedClients();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.warn("[AUTH] Popup blocked → redirect");
    await signInWithRedirect(auth, provider);
  }
}

export async function signOut() {
  const { auth } = getInitializedClients();
  await fbSignOut(auth);
}

export function checkAccess() { return true; }
