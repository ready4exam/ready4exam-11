// js/auth-paywall.js
// -------------------------------------------------------------
// Google Sign-In + Auth Gate 100% Synced for Quiz Engine
// -------------------------------------------------------------

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import { getInitializedClients } from "./config.js";

let listenerSetup = false;

export function initializeAuthListener() {
  if (listenerSetup) return;
  listenerSetup = true;

  const { auth } = getInitializedClients();

  onAuthStateChanged(auth, (user) => {
    console.log("[AUTH] State:", user?.email || "NO USER");

    const paywall = document.getElementById("paywall-screen");
    const quizContent = document.getElementById("quiz-content");
    const logoutBtn = document.getElementById("logout-nav-btn");

    if (user) {
      console.log("[AUTH] Signed In UI Update");
      paywall?.classList.add("hidden");
      quizContent?.classList.remove("hidden");
      logoutBtn?.classList.remove("hidden");

      document.dispatchEvent(new CustomEvent("r4e-auth-ready", { detail: user }));
    } else {
      console.log("[AUTH] No User UI Update");
      paywall?.classList.remove("hidden");
      quizContent?.classList.add("hidden");
      logoutBtn?.classList.add("hidden");
    }
  });

  console.log("[AUTH] Listener Initialized");
}

export async function signInWithGoogle() {
  const { auth } = getInitializedClients();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.warn("[AUTH] Popup failed", e);
  }
}

export async function signOut() {
  const { auth } = getInitializedClients();
  await fbSignOut(auth);
}
