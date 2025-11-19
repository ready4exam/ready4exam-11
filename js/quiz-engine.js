// js/quiz-engine.js
// -----------------------------------------------------------
// Phase-4 Quiz Engine (Auth-Synced Build, Config Aware)
// -----------------------------------------------------------

import { fetchQuiz, saveResult } from "./api.js";
import { initializeServices } from "./config.js";
import { renderQuestion, renderResultsScreen, registerResultButtons } from "./ui-renderer.js";

let state = {
  questions: [],
  answers: {},
  index: 0,
  table: "",
  difficulty: "",
};

// -----------------------------------------------------------
// INIT LISTENERS AND SERVICES ON LOAD
// -----------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 1. Initialize all required clients (Firebase, Supabase, GA)
    await initializeServices();
    
    // 2. Auth listener is initialized separately in auth-paywall.js 
    //    and will dispatch 'r4e-auth-ready' upon sign-in.
    
  } catch (error) {
    console.error("[ENGINE] Initialization failed:", error);
    document.getElementById("status-message").textContent = "Fatal Error: Failed to initialize services.";
    document.getElementById("status-message").classList.remove("hidden");
  }
});

// -----------------------------------------------------------
// AUTH READY EVENT → START QUIZ
// -----------------------------------------------------------
document.addEventListener("r4e-auth-ready", () => {
  console.log("[ENGINE] Auth Ready → Loading quiz now...");
  startQuiz(); 
});

// -----------------------------------------------------------
// MAIN QUIZ LOADER (Runs ONLY after sign-in)
// -----------------------------------------------------------
async function startQuiz() {
  console.log("[ENGINE] Starting Quiz Engine...");

  // Reset state
  state.index = 0;
  state.answers = {};

  const params = new URLSearchParams(location.search);
  state.table = params.get("table");
  state.difficulty = params.get("difficulty");

  document.getElementById("chapter-name-display").textContent = state.table.replace(/_/g, ' ');

  try {
    const questions = await fetchQuiz({
      table: state.table,
      difficulty: state.difficulty
    });
    state.questions = questions || [];
    console.log("[ENGINE] Loaded Questions:", state.questions.length);

    if (state.questions.length === 0) {
      document.getElementById("question-list").innerHTML =
        `<p class='text-center text-red-600 font-semibold'>
          ⚠️ No questions found for: ${state.table} (${state.difficulty})
        </p>`;
      return;
    }

    renderCurrentQuestion();
    
  } catch (error) {
    console.error("[ENGINE] Quiz loading error:", error);
    document.getElementById("question-list").innerHTML =
      `<p class='text-center text-red-600 font-semibold'>
        ❌ Error fetching quiz data: ${error.message}
      </p>`;
  }
}

// -----------------------------------------------------------
// RENDER CURRENT QUESTION
// -----------------------------------------------------------
function renderCurrentQuestion() {
  const q = state.questions[state.index];
  if (!q) return;

  renderQuestion(state); // Delegate rendering to ui-renderer.js

  document.getElementById("difficulty-display").textContent =
    `Difficulty: ${state.difficulty}`;

  setupOptionClickHandlers(q.id);

  // Show/Hide Submit button
  const submitBtn = document.getElementById("submit-btn");
  if (state.index === state.questions.length - 1) {
    submitBtn.classList.remove("hidden");
  } else {
    submitBtn.classList.add("hidden");
  }
}

// -----------------------------------------------------------
// OPTION CLICK HANDLER
// -----------------------------------------------------------
function setupOptionClickHandlers(qid) {
  document.querySelectorAll(".option-label").forEach((lb) => {
    lb.onclick = () => {
      const selected = lb.getAttribute("data-option");
      state.answers[qid] = selected;

      // Delegate highlighting to ui-renderer.js
      document.querySelectorAll(".option-label").forEach(button => {
        const opt = button.getAttribute("data-option");
        button.classList.toggle("border-blue-600", opt === selected);
        button.classList.toggle("bg-blue-50", opt === selected);
        button.classList.toggle("border-gray-300", opt !== selected);
      });
    };
  });
}

// -----------------------------------------------------------
// NAVIGATION
// -----------------------------------------------------------
document.getElementById("next-btn").onclick = () => {
  if (state.index < state.questions.length - 1) {
    state.index++;
    renderCurrentQuestion();
  }
};

document.getElementById("prev-btn").onclick = () => {
  if (state.index > 0) {
    state.index--;
    renderCurrentQuestion();
  }
};

// -----------------------------------------------------------
// SUBMIT
// -----------------------------------------------------------
document.getElementById("submit-btn").onclick = async () => {
  let score = 0;
  const total = state.questions.length;

  state.questions.forEach((q) => {
    if (state.answers[q.id] === q.correct_answer) score++;
  });

  // Save result to Firestore and log analytics
  await saveResult({
    topic: state.table,
    difficulty: state.difficulty,
    score: score,
    total: total
  });

  // Render results screen
  renderResultsScreen({
    score,
    total,
    questions: state.questions,
    answers: state.answers,
  });
  
  // Setup retry buttons
  registerResultButtons(state.table);
};
