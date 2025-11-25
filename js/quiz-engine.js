// js/quiz-engine.js
// Updated 11th version with fixes from 9th version (Supabase + correct topic param)

import { initializeServices } from "./config.js";
import { initializeAuthListener, signInWithGoogle } from "./auth-paywall.js";
import { fetchQuestions } from "./api.js";
import * as UI from "./ui-renderer.js";

const LOG = "[ENGINE]";

// ------------------------------------------------------
// FIX 1: Use correct URL parameter (topic instead of table)
// ------------------------------------------------------
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    topic: params.get("topic"),        // FIXED
    difficulty: params.get("difficulty")
  };
}

// GLOBAL quizState holder (11th style)
window.quizState = window.quizState || {
  topicSlug: null,
  difficulty: "medium"
};

async function main() {
  const urlParams = getUrlParams();

  // FIX 2: Correctly set topicSlug
  if (urlParams.topic) {
    window.quizState.topicSlug = urlParams.topic.trim();
    console.log(LOG, "Set topicSlug from URL:", urlParams.topic);
  }

  if (urlParams.difficulty) {
    window.quizState.difficulty = urlParams.difficulty;
    console.log(LOG, "Set difficulty from URL:", urlParams.difficulty);
  }

  await initializeServices();
  await initializeAuthListener(onAuthReady);

  const btn = document.getElementById("google-signin-btn");
  if (btn) btn.onclick = () => signInWithGoogle();

  console.log(LOG, "Engine ready.");
}

// ------------------------------------------------------
// After login
// ------------------------------------------------------
async function onAuthReady(user) {
  if (!user) return;

  const topic = window.quizState.topicSlug;
  const diff = window.quizState.difficulty || "medium";

  if (!topic) {
    console.error(LOG, "Missing topicSlug — quiz cannot load.");
    UI.showStatus("Error: Topic missing.");
    return;
  }

  UI.showStatus("Loading quiz...");

  try {
    const questions = await fetchQuestions(topic, diff);

    // ------------------------------------------------------
    // FIX: Replace UI.renderQuiz() with 11th-version logic
    // ------------------------------------------------------
    window.quizState.questions = questions;
    window.quizState.userAnswers = Object.fromEntries(
      questions.map(q => [q.id, null])
    );
    window.quizState.currentQuestionIndex = 0;
    window.quizState.isSubmitted = false;

    // Render first question
    if (typeof UI.renderQuestion === "function") {
      UI.renderQuestion(
        questions[0],
        1,
        window.quizState.userAnswers[questions[0].id],
        false
      );
    }

    // Attach answer listeners (optional chaining)
    UI.attachAnswerListeners?.((questionId, selectedOption) => {
      if (!window.quizState.isSubmitted) {
        window.quizState.userAnswers[questionId] = selectedOption;
        UI.renderQuestion(
          window.quizState.questions[window.quizState.currentQuestionIndex],
          window.quizState.currentQuestionIndex + 1,
          window.quizState.userAnswers[
            window.quizState.questions[window.quizState.currentQuestionIndex].id
          ],
          false
        );
      }
    });

    // Show quiz content
    UI.showView?.("quiz-content");

    console.log(LOG, "Quiz loaded:", questions.length);

    // FIX 3: Show quiz block
    const quizContent = document.getElementById("quiz-content");
    if (quizContent) quizContent.classList.remove("hidden");

  } catch (e) {
    console.error(LOG, "Quiz loading failed:", e);
    UI.showStatus("Failed to load quiz.");
  }
}

document.addEventListener("DOMContentLoaded", main);
