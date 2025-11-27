// js/quiz-engine.js
// -----------------------------------------------------------------------------
// Core quiz logic: loading questions, tracking progress, auth state, GA4 logging
// Automatically maps topic slug → correct chapter + subject from curriculum
// -----------------------------------------------------------------------------

import { initializeServices, getAuthUser } from "./config.js";
import { fetchQuestions, saveResult } from "./api.js";
import * as UI from "./ui-renderer.js";
import {
  checkAccess,
  initializeAuthListener,
  signInWithGoogle,
  signOut,
} from "./auth-paywall.js";
import curriculumData from "./curriculum.js";


// ===========================================================
// GLOBAL STATE (same as before – no change)
// ===========================================================
let quizState = {
  classId: "11",
  subject: "",
  topicSlug: "",
  difficulty: "",
  questions: [],
  currentQuestionIndex: 0,
  userAnswers: {},
  isSubmitted: false,
  score: 0,
};


// ===========================================================
// ADVANCED TOPIC → CHAPTER MAPPING
// ===========================================================
function findCurriculumMatch(topicSlug) {

  const normalize = s => s
    ?.toString()
    ?.toLowerCase()
    ?.replace(/quiz/g, "")
    ?.replace(/[_\s-]/g, "")
    ?.trim();

  const target = normalize(topicSlug);

  for (const subject in curriculumData) {
    const books = curriculumData[subject];

    for (const book in books) {
      for (const ch of books[book]) {

        const idMatch = normalize(ch.table_id);
        const titleMatch = normalize(ch.chapter_title);

        if (idMatch === target) return { subjectName: subject, chapterTitle: ch.chapter_title };
        if (titleMatch === target) return { subjectName: subject, chapterTitle: ch.chapter_title };
        if (target.includes(titleMatch) || titleMatch.includes(target))
          return { subjectName: subject, chapterTitle: ch.chapter_title };
      }
    }
  }
  return null;
}



// ===========================================================
// URL PARSER  ★★ AUTO-FALLBACK LOGIC ADDED HERE ★★
// ===========================================================
function parseUrlParameters() {

  const params = new URLSearchParams(location.search);

  quizState.topicSlug = params.get("topic") || "";
  quizState.difficulty = params.get("difficulty") || "simple";

  if (!quizState.topicSlug)
    throw new Error("Missing topic parameter");

  const match = findCurriculumMatch(quizState.topicSlug);

  // -------------------------- 🔥 NEW: AUTO-FALLBACK --------------------------
  // If curriculum doesn't match → DO NOT THROW → Continue with direct table use
  if (!match) {
    console.warn(`⚠ No curriculum mapping found → Fallback used for: ${quizState.topicSlug}`);
    quizState.subject = "General"; // safe neutral label
    UI.updateHeader(`Class 11 – ${quizState.topicSlug.replace(/_/g," ")} Quiz`, quizState.difficulty);
    return; // <-- important: skip curriculum mapping safely
  }
  // ---------------------------------------------------------------------------

  quizState.subject = match.subjectName;
  const chapterTitle = match.chapterTitle.replace(/quiz/ig, "").trim();

  const finalHeader =
    `Class 11 ${quizState.subject} – ${chapterTitle} Worksheet`;

  UI.updateHeader(finalHeader, quizState.difficulty);
}



// ===========================================================
// RENDER QUESTION (unchanged)
// ===========================================================
function renderQuestion() {
  const i = quizState.currentQuestionIndex;
  const q = quizState.questions[i];
  if (!q) return UI.showStatus("No question to display.");

  UI.renderQuestion(q, i + 1, quizState.userAnswers[q.id], quizState.isSubmitted);
  UI.updateNavigation?.(i, quizState.questions.length, quizState.isSubmitted);
  UI.hideStatus();
}



// ===========================================================
// NAVIGATION + ANSWERS (unchanged)
// ===========================================================
function handleNavigation(dir) {
  const i = quizState.currentQuestionIndex + dir;
  if (i >= 0 && i < quizState.questions.length) {
    quizState.currentQuestionIndex = i;
    renderQuestion();
  }
}

function handleAnswerSelection(id, opt) {
  if (!quizState.isSubmitted) {
    quizState.userAnswers[id] = opt;
    renderQuestion();
  }
}



// ===========================================================
// SUBMIT — SCORE — GA — SAVE (unchanged)
// ===========================================================
async function handleSubmit() {
  if (quizState.isSubmitted) return;
  quizState.isSubmitted = true;

  quizState.score = quizState.questions.filter(q =>
    quizState.userAnswers[q.id]?.toUpperCase() === q.correct_answer?.toUpperCase()
  ).length;

  const user = getAuthUser();

  const result = {
    classId: "11",
    subject: quizState.subject,
    topic: quizState.topicSlug,
    difficulty: quizState.difficulty,
    score: quizState.score,
    total: quizState.questions.length,
    user_answers: quizState.userAnswers,
  };

  if (user) { try { await saveResult(result); } catch (e) { console.warn(e); } }

  quizState.currentQuestionIndex = 0;
  renderQuestion();
  UI.showResults(quizState.score, quizState.questions.length);
  UI.renderAllQuestionsForReview?.(quizState.questions, quizState.userAnswers);
  UI.updateNavigation?.(0, quizState.questions.length, true);
}



// ===========================================================
// LOAD QUIZ (unchanged)
// ===========================================================
async function loadQuiz() {
  try {
    UI.showStatus("Fetching questions...");
    const q = await fetchQuestions(quizState.topicSlug, quizState.difficulty);
    if (!q?.length) throw new Error("No questions found.");

    quizState.questions = q;
    quizState.userAnswers = Object.fromEntries(q.map(x => [x.id, null]));
    renderQuestion();
    UI.attachAnswerListeners?.(handleAnswerSelection);
    UI.showView?.("quiz-content");
  } catch (e) {
    UI.showStatus(`Error: ${e.message}`, "text-red-600");
  }
}



// ===========================================================
// AUTH + SCREEN FLOW (unchanged)
// ===========================================================
async function onAuthChange(u) {
  if (u) {
    const ok = await checkAccess(quizState.topicSlug);
    if (ok) loadQuiz();
    else UI.showView("paywall-screen");
  } else UI.showView("paywall-screen");
}



// ===========================================================
// DOM EVENT LISTENERS (unchanged)
// ===========================================================
function attachDomEvents() {
  document.addEventListener("click", e => {
    const b = e.target.closest("button,a"); if (!b) return;

    if (b.id === "prev-btn") return handleNavigation(-1);
    if (b.id === "next-btn") return handleNavigation(1);
    if (b.id === "submit-btn") return handleSubmit();

    if (b.id === "login-btn" || b.id === "google-signin-btn" || b.id === "paywall-login-btn")
      return signInWithGoogle();

    if (b.id === "logout-nav-btn") return signOut();
    if (b.id === "back-to-chapters-btn") location.href = "chapter-selection.html";
  });
}



// ===========================================================
// INIT (unchanged)
// ===========================================================
async function init() {
  UI.initializeElements();
  parseUrlParameters();
  await initializeServices();
  await initializeAuthListener(onAuthChange);
  attachDomEvents();
  UI.hideStatus();
}

document.addEventListener("DOMContentLoaded", init);
