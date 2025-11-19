// js/ui-renderer.js 
// ------------------------------------------------------------
// Phase-4 UI Rendering Layer (Advanced, Robust, and State-Aware)
// ------------------------------------------------------------

import { cleanKatexMarkers } from './utils.js'; // Assumes utils.js exists and exports this function

let els = {};
let isInit = false;

// Helper function to clean up explanation text
function normalizeReasonText(txt) {
  if (!txt) return "";
  return txt.replace(/^\s*(Reasoning|Reason|Context)\s*(\(R\))?\s*:\s*/i, "").trim();
}

/* -----------------------------------
   ELEMENT INITIALIZATION (Caches all DOM elements)
----------------------------------- */
export function initializeElements() {
  if (isInit) return;
  els = {
    title: document.getElementById("quiz-page-title"), // May not exist in current HTML
    diffBadge: document.getElementById("difficulty-display"),
    status: document.getElementById("status-message"),
    list: document.getElementById("question-list"),
    counter: document.getElementById("question-counter"),
    prevButton: document.getElementById("prev-btn"),
    nextButton: document.getElementById("next-btn"),
    submitButton: document.getElementById("submit-btn"),
    reviewScreen: document.getElementById("results-screen"),
    score: document.getElementById("score-display"),
    paywallScreen: document.getElementById("paywall-screen"),
    quizContent: document.getElementById("quiz-content"),
    reviewContainer: document.getElementById("review-container"),
    resultsActions: document.getElementById("results-actions")
  };

  // Dynamically create review container if missing (for robustness)
  if (!els.reviewContainer) {
    const rc = document.createElement("div");
    rc.id = "review-container";
    rc.className = "w-full max-w-3xl text-left mb-8";
    const resultsSection = document.getElementById("results-screen");
    if (resultsSection)
      resultsSection.insertBefore(rc, resultsSection.querySelector("#results-actions") || null);
    els.reviewContainer = document.getElementById("review-container");
  }

  isInit = true;
}

/* -----------------------------------
   STATUS + VIEW CONTROL
----------------------------------- */
export function showStatus(msg, cls = "text-gray-700") {
  initializeElements();
  if (!els.status) return;
  els.status.innerHTML = msg;
  els.status.className = `p-3 text-center font-semibold ${cls}`;
  els.status.classList.remove("hidden");
}

export function hideStatus() {
  initializeElements();
  if (els.status) els.status.classList.add("hidden");
}

export function showView(viewName) {
  initializeElements();
  const views = {
    "quiz-content": els.quizContent,
    "results-screen": els.reviewScreen,
    "paywall-screen": els.paywallScreen,
  };
  Object.values(views).forEach((v) => v && v.classList.add("hidden"));
  if (views[viewName]) views[viewName].classList.remove("hidden");
}


/* -----------------------------------
   QUESTION RENDERING (MODIFIED FOR STATE)
----------------------------------- */
export function renderQuestion(state) {
  initializeElements();
  
  // Extract required data from the state object
  const q = state.questions[state.index];
  if (!q || !els.list) return; 
  
  const idxOneBased = state.index + 1;
  const selected = state.answers[q.id];
  const submitted = false; // This function is for active answering, not review

  const type = (q.question_type || "").toLowerCase();
  const qText = cleanKatexMarkers(q.text || "");
  let reasonRaw = q.explanation || q.scenario_reason || "";
  const reason = normalizeReasonText(cleanKatexMarkers(reasonRaw));

  let label = "";
  if (type === "ar") label = "Reasoning (R)";
  else if (type === "case") label = "Context";

  // Show Reason/Context only if not submitted
  const reasonHtml =
    (type === "ar" || type === "case") && reason && !submitted
      ? `<p class="text-gray-700 mt-2 mb-3">${label}: ${reason}</p>` : "";

  // Submitted explanation is not used in the active quiz view
  const submittedExplanationHtml = ""; 

  const optionsHtml = ["A", "B", "C", "D"]
    .map((opt) => {
      const txt = cleanKatexMarkers(q.options?.[opt] || "");
      const isSel = selected === opt;
      
      let cls = "option-label flex items-start p-3 border-2 rounded-lg cursor-pointer transition";
      if (isSel) cls += " border-blue-500 bg-blue-50";
      else cls += " border-gray-300"; // Default border

      return `
        <label class="block">
          <input type="radio" name="q-${q.id}" value="${opt}" class="hidden" ${isSel ? "checked" : ""}>
          <div class="${cls}" data-option="${opt}">
            <span class="font-bold mr-3">${opt}.</span>
            <span class="text-gray-800">${txt}</span>
          </div>
        </label>`;
    }).join("");

  els.list.innerHTML = `
    <div class="bg-white rounded-lg shadow p-6 border border-gray-200 space-y-4">
      <p class="text-lg font-bold text-gray-800">Q${idxOneBased}: ${qText}</p>
      ${reasonHtml}
      <div class="space-y-3">${optionsHtml}</div>
    </div>`;

  if (els.counter)
    els.counter.textContent = `${idxOneBased} / ${state.questions.length || "--"}`;
  
  // Update navigation based on current index
  updateNavigation(state.index, state.questions.length, submitted);
}


/* -----------------------------------
   NAVIGATION + COUNTER
----------------------------------- */
export function updateNavigation(currentIndexZeroBased, totalQuestions, submitted) {
  initializeElements();
  
  // Update total count for internal reference if needed
  els._total = totalQuestions; 
  
  const show = (btn, cond) => btn && btn.classList.toggle("hidden", !cond);
  
  // Always show/hide Prev/Next based on position
  show(els.prevButton, currentIndexZeroBased > 0);
  show(els.nextButton, currentIndexZeroBased < totalQuestions - 1);
  
  // Show Submit button only on the last question AND if not submitted
  show(els.submitButton, !submitted && currentIndexZeroBased === totalQuestions - 1);
  
  if (els.counter)
    els.counter.textContent = `${currentIndexZeroBased + 1} / ${totalQuestions}`;
}


/* -----------------------------------
   RESULTS + REVIEW
----------------------------------- */
export function renderResultsScreen({ score, total, questions, answers }) {
  initializeElements();
  
  // 1. Set Score
  if (els.score) els.score.textContent = `${score} / ${total}`;
  
  // 2. Generate Review HTML
  if (els.reviewContainer) {
    const html = questions.map((q, i) => {
      const txt = cleanKatexMarkers(q.text || "");
      const reason = normalizeReasonText(cleanKatexMarkers(q.explanation || q.scenario_reason || ""));
      const label = (q.question_type || "").toLowerCase() === "case" ? "Context" : "Reasoning (R)";
      const ua = answers[q.id] || "-";
      const ca = q.correct_answer || "-";
      const correct = ua && ua.toUpperCase() === ca.toUpperCase();
      
      return `
        <div class="mb-6 p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
          <p class="font-bold text-lg mb-1">Q${i + 1}: ${txt}</p>
          ${reason ? `<p class="text-gray-700 mb-2">${label}: ${reason}</p>` : ""}
          <p>Your Answer: <span class="${correct ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}">${ua}</span></p>
          <p>Correct Answer: <b class="text-green-700">${ca}</b></p>
        </div>`;
    }).join("");
  
    els.reviewContainer.innerHTML = html;
  }

  // 3. Show the screen
  showView("results-screen");
  
  // 4. Ensure action buttons are visible
  if (els.resultsActions) els.resultsActions.classList.remove("hidden");
}

/* -----------------------------------
   BUTTON HANDLERS FOR RETRY
----------------------------------- */
export function registerResultButtons(currentTable) {
    initializeElements();
    
    // Attach click handlers to the buttons defined in the HTML
    document.getElementById("retry-simple").onclick = () =>
      location.href = `quiz-engine.html?table=${currentTable}&difficulty=simple`;

    document.getElementById("retry-medium").onclick = () =>
      location.href = `quiz-engine.html?table=${currentTable}&difficulty=medium`;

    document.getElementById("retry-advanced").onclick = () =>
      location.href = `quiz-engine.html?table=${currentTable}&difficulty=advanced`;

    document.getElementById("back-to-chapters-btn").onclick = () =>
      location.href = "chapter-selection.html";
}


// These functions are imported by auth-paywall.js and MUST exist
export function showAuthLoading(message) {
    let overlay = document.getElementById("auth-loading-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "auth-loading-overlay";
        overlay.className = "fixed inset-0 bg-white/80 flex items-center justify-center z-50";
        overlay.innerHTML = `
          <div class="p-6 rounded-lg shadow-lg text-center max-w-lg bg-white">
            <div class="text-2xl font-bold mb-2">Signing in</div>
            <div class="text-sm text-gray-700 mb-4">${message}</div>
            <div class="w-12 h-12 mx-auto mb-1">
              <svg class="animate-spin w-12 h-12 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
            </div>
          </div>`;
        document.body.appendChild(overlay);
    } else overlay.classList.remove("hidden");
}

export function hideAuthLoading() {
    const overlay = document.getElementById("auth-loading-overlay");
    if (overlay) overlay.remove();
}

// Dummy/Placeholder for updateAuthUI, as it's not strictly necessary for core function
export function updateAuthUI(user) {
    initializeElements();
    // Logic to show/hide user info and logout button on the page
}
