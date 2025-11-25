// js/ui-renderer.js
// Fully aligned with 11th quiz-engine.js + 11th HTML

import { cleanKatexMarkers } from "./utils.js";

let els = {};
let isInit = false;

/* -------------------------------------------------------
   INITIALIZE ELEMENT REFERENCES
------------------------------------------------------- */
function init() {
  if (isInit) return;

  els = {
    status: document.getElementById("status-message"),
    quizContent: document.getElementById("quiz-content"),
    questionList: document.getElementById("question-list"),
    counter: document.getElementById("question-counter"),
    prevBtn: document.getElementById("prev-btn"),
    nextBtn: document.getElementById("next-btn"),
    submitBtn: document.getElementById("submit-btn"),
    resultsScreen: document.getElementById("results-screen"),
    score: document.getElementById("score-display"),
    reviewContainer: document.getElementById("review-container"),
    paywallScreen: document.getElementById("paywall-screen"),
    chapterTitle: document.getElementById("chapter-name-display"),
    diffDisplay: document.getElementById("difficulty-display"),
  };

  isInit = true;
}

/* -------------------------------------------------------
   STATUS MESSAGE
------------------------------------------------------- */
export function showStatus(msg) {
  init();
  if (!els.status) return;
  els.status.innerHTML = msg;
  els.status.classList.remove("hidden");
}

export function hideStatus() {
  init();
  if (!els.status) return;
  els.status.classList.add("hidden");
}

/* -------------------------------------------------------
   HEADER UPDATE
------------------------------------------------------- */
export function updateHeader(title, difficulty) {
  init();
  if (els.chapterTitle) els.chapterTitle.textContent = title || "";
  if (els.diffDisplay) els.diffDisplay.textContent = `Difficulty: ${difficulty || "--"}`;
}

/* -------------------------------------------------------
   VIEW SWITCHER
------------------------------------------------------- */
export function showView(view) {
  init();

  // Hide all screens
  if (els.quizContent) els.quizContent.classList.add("hidden");
  if (els.resultsScreen) els.resultsScreen.classList.add("hidden");
  if (els.paywallScreen) els.paywallScreen.classList.add("hidden");

  // Show target
  if (view === "quiz-content" && els.quizContent) els.quizContent.classList.remove("hidden");
  if (view === "results-screen" && els.resultsScreen) els.resultsScreen.classList.remove("hidden");
  if (view === "paywall-screen" && els.paywallScreen) els.paywallScreen.classList.remove("hidden");
}

/* -------------------------------------------------------
   RENDER SINGLE QUESTION
------------------------------------------------------- */
export function renderQuestion(q, indexOne, selected, submitted) {
  init();
  if (!els.questionList) return;

  const qText = cleanKatexMarkers(q.text || "");
  const options = ["A", "B", "C", "D"];

  const optionsHtml = options
    .map(opt => {
      const txt = cleanKatexMarkers(q.options?.[opt] || "");
      const isSel = selected === opt;
      const isCorrect = submitted && q.correct_answer === opt;
      const isWrong = submitted && isSel && !isCorrect;

      let cls = "option-label flex items-start p-3 border-2 rounded-lg cursor-pointer";
      if (isCorrect) cls += " border-green-600 bg-green-50";
      else if (isWrong) cls += " border-red-600 bg-red-50";
      else if (isSel) cls += " border-blue-600 bg-blue-50";

      return `
        <label class="block">
          <input type="radio" name="q-${q.id}" value="${opt}" class="hidden" ${isSel ? "checked" : ""} ${submitted ? "disabled" : ""}>
          <div class="${cls}">
            <span class="font-bold mr-3">${opt}.</span>
            <span>${txt}</span>
          </div>
        </label>
      `;
    })
    .join("");

  els.questionList.innerHTML = `
    <div class="space-y-6">
      <p class="text-lg font-bold">Q${indexOne}: ${qText}</p>
      <div class="space-y-3">${optionsHtml}</div>
    </div>
  `;

  if (els.counter) els.counter.textContent = `${indexOne} / ${els._total || "--"}`;
}

/* -------------------------------------------------------
   ANSWER CHANGE HANDLER
------------------------------------------------------- */
export function attachAnswerListeners(handler) {
  init();
  if (!els.questionList) return;

  if (els._listener) els.questionList.removeEventListener("change", els._listener);

  const listener = (e) => {
    if (e.target && e.target.type === "radio") {
      const qid = e.target.name.substring(2);
      handler(qid, e.target.value);
    }
  };

  els.questionList.addEventListener("change", listener);
  els._listener = listener;
}

/* -------------------------------------------------------
   NAVIGATION BUTTONS
------------------------------------------------------- */
export function updateNavigation(currentIndexZero, total, submitted) {
  init();

  els._total = total;

  if (els.prevBtn) els.prevBtn.classList.toggle("hidden", currentIndexZero <= 0);
  if (els.nextBtn) els.nextBtn.classList.toggle("hidden", currentIndexZero >= total - 1);
  if (els.submitBtn) els.submitBtn.classList.toggle("hidden", submitted || currentIndexZero < total - 1);

  if (els.counter) els.counter.textContent = `${currentIndexZero + 1} / ${total}`;
}

/* -------------------------------------------------------
   RESULTS SCREEN
------------------------------------------------------- */
export function showResults(score, total) {
  init();
  if (els.score) els.score.textContent = `${score} / ${total}`;
  showView("results-screen");
}

/* -------------------------------------------------------
   REVIEW MODE
------------------------------------------------------- */
export function renderAllQuestionsForReview(questions, userAnswers) {
  init();
  if (!els.reviewContainer) return;

  const html = questions
    .map((q, i) => {
      const txt = cleanKatexMarkers(q.text || "");
      const ua = userAnswers[q.id] || "-";
      const ca = q.correct_answer || "-";
      const correct = ua === ca;

      return `
        <div class="mb-6 p-4 bg-white rounded-lg border">
          <p class="font-bold mb-2">Q${i + 1}: ${txt}</p>
          <p>Your Answer: <span class="${correct ? "text-green-600" : "text-red-600"}">${ua}</span></p>
          <p>Correct Answer: <b class="text-green-600">${ca}</b></p>
        </div>
      `;
    })
    .join("");

  els.reviewContainer.innerHTML = html;
}
