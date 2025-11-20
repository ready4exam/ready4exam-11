// js/auth-paywall.js
// ------------------------------------------------------------
// Phase-6 Auth Handler (JWT Sync & Loop Fix)
// ------------------------------------------------------------

import { getInitializedClients } from "./config.js";
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

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });


/**
 * 🔑 CRITICAL FIX: Syncs the Firebase ID Token with Supabase.
 * This ensures the Supabase client sends the required Authorization: Bearer <JWT> header.
 */
async function syncSupabaseAuth(user) {
    const { supabase } = getInitializedClients();
    
    // 1. Get the Firebase ID token
    const idToken = await user.getIdToken();
    
    try {
        // 2. Pass the Firebase ID token to Supabase to sign in/create a Supabase session
        const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google', // Must match your primary Firebase provider
            token: idToken,
        });

        if (error) {
            console.error(LOG, "Supabase token sync failed:", error.message);
        } else {
            console.log(LOG, "Supabase token sync successful. Full authorization should now be active.");
        }

    } catch (e) {
        console.error(LOG, "Error getting ID Token or syncing:", e);
    }
}


function internalAuthChangeHandler(user) {
    console.log(LOG, "Auth state changed →", user ? user.uid : "Signed Out");

    if (user) {
        // --- Call the sync function immediately after Firebase reports sign-in ---
        syncSupabaseAuth(user); 
        // ------------------------------------------------------------------------
        
        showView("quiz-content");
        hideAuthLoading();
    } else {
        // Ensure Supabase user is also cleared on Firebase sign-out (optional but clean)
        const { supabase } = getInitializedClients();
        supabase.auth.signOut();
        
        showView("paywall-screen");
    }
    
    // Always call the external callback (onAuthReady in quiz-engine.js)
    if (typeof externalOnAuthChange === "function") externalOnAuthChange(user);
}


export async function initializeAuthListener(onAuthChangeCallback = null) {
    const { auth } = getInitializedClients(); 
    
    // Attempt to set local persistence first
    await setPersistence(auth, browserLocalPersistence);

    try {
        // Handle redirect result if a previous sign-in used redirect
        const redirectResult = await firebaseGetRedirectResult(auth);
        if (redirectResult?.user) console.log(LOG, "Restored user:", redirectResult.user.uid);
    } catch (err) {
        // Log, but do not block, on redirect errors
        console.warn(LOG, "Redirect restore error:", err.message);
    }
    
    // Set the external callback from quiz-engine.js
    if (onAuthChangeCallback) externalOnAuthChange = onAuthChangeCallback;

    // Start the auth listener
    onAuthStateChanged(auth, internalAuthChangeHandler);
    console.log(LOG, "Auth listener initialized.");
}


export async function signInWithGoogle() {
    const { auth } = getInitializedClients();
    if (isSigningIn) return;
    isSigningIn = true;

    try {
        showAuthLoading("Opening Google Sign-In...");
        // Using signInWithPopup here, which is generally safer than redirect
        const result = await signInWithPopup(auth, googleProvider);
        console.log(LOG, "Popup sign-in success:", result.user?.uid);
        hideAuthLoading();
        return result;
    } catch (popupError) {
        // Fallback logic for pop-up errors (e.g., blocked pop-up)
        const fallbackCodes = ["auth/popup-blocked", "auth/cancelled-popup-request", "auth/web-storage-unsupported"];
        if (fallbackCodes.includes(popupError.code)) {
            console.warn(LOG, "Popup blocked or error → fallback to redirect.");
            await signInWithRedirect(auth, googleProvider);
        } else {
            console.error(LOG, "Popup/Sign-in error:", popupError);
            hideAuthLoading();
        }
    } finally {
        isSigningIn = false;
    }
}


export async function signOut() {
    const { auth, supabase } = getInitializedClients();
    await firebaseSignOut(auth);
    await supabase.auth.signOut(); // Explicitly sign out of Supabase as well
    console.log(LOG, "User signed out.");
}
