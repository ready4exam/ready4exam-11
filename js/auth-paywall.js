// js/auth-paywall.js
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  onAuthStateChanged,
  signOut as fbSignOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import { getInitializedClients } from "./config.js";

let listenerSetup = false;

export function initializeAuthListener() {
  if (listenerSetup) return;
  listenerSetup = true;

  const { auth, supabase } = getInitializedClients();

  onAuthStateChanged(auth, async (user) => {
    console.log("[AUTH] State:", user?.email || "No user");

    const paywall = document.getElementById("paywall-screen");
    const quizContent = document.getElementById("quiz-content");
    const logoutBtn = document.getElementById("logout-nav-btn");

    if (user) {
      console.log("[AUTH] User signed in");

      try {
        const token = await user.getIdToken(false);
        if (supabase?.auth?.setSession) {
          await supabase.auth.setSession({
            access_token: token,
            refresh_token: token
          });
          console.log("[AUTH] Supabase session set");
        }
      } catch (e) {
        console.warn("[AUTH] Supabase session error:", e);
      }

      paywall?.classList.add("hidden");
      quizContent?.classList.remove("hidden");
      logoutBtn?.classList.remove("hidden");

      document.dispatchEvent(new CustomEvent("r4e-auth-ready", { detail: user }));
    } else {
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
    console.log("[AUTH] Using Popup...");
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.warn("[AUTH] Popup failed:", err?.code);
    await signInWithRedirect(auth, provider);
  }
}

export async function signOut() {
  const { auth, supabase } = getInitializedClients();
  await fbSignOut(auth);
  try {
    if (supabase?.auth?.signOut) await supabase.auth.signOut();
  } catch (e) {
    console.warn("Supabase signOut:", e);
  }
  document.getElementById("paywall-screen")?.classList.remove("hidden");
  document.getElementById("quiz-content")?.classList.add("hidden");
}

export function checkAccess() {
  return true;
}
