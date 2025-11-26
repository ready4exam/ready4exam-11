// js/quiz-engine.js
// -----------------------------------------------------------------------------
// Core quiz logic: loading questions, detecting class+subject from curriculum,
// tracking progress, saving, UI, and GA logging
// -----------------------------------------------------------------------------

import { initializeServices, getAuthUser } from "./config.js";
import { fetchQuestions, saveResult } from "./api.js";
import * as UI from "./ui-renderer.js";
import { checkAccess, initializeAuthListener, signInWithGoogle, signOut } from "./auth-paywall.js";
import curriculumData from "./curriculum.js";

// ----------------------------------------------
// GLOBAL STATE
// ----------------------------------------------
let quizState = {
  classId: "11",        // <-- DEFAULTED because your project is Class 11 only
  subject: "",
  topicSlug: "",
  difficulty: "",
  questions: [],
  currentQuestionIndex: 0,
  userAnswers: {},
  isSubmitted: false,
  score: 0,
};

// ----------------------------------------------
// Find subject & chapter from curriculum using topicSlug as table_id
// ----------------------------------------------
function findCurriculumMatch(topicSlug) {
  for (const subject in curriculumData) {
    const books = curriculumData[subject];
    for (const book in books) {
      const chapters = books[book];
      for (const ch of chapters) {
        if (!ch.table_id) continue;
        if (ch.table_id.toLowerCase().trim() === topicSlug.toLowerCase().trim()) {
          return {
            subjectName: subject,
            chapterTitle: ch.chapter_title
          };
        }
      }
    }
  }
  return null;
}

// ----------------------------------------------
// Parse URL → Auto detect Class + Subject + Title
// ----------------------------------------------
function parseUrlParameters() {
  const url = new URLSearchParams(location.search);

  quizState.topicSlug   = url.get("topic")      || "";
  quizState.difficulty  = url.get("difficulty") || "simple";

  if (!quizState.topicSlug) throw new Error("Topic missing in URL!");

  const match = findCurriculumMatch(quizState.topicSlug);
  if (!match) throw new Error(`No curriculum entry matched topic: ${quizState.topicSlug}`);

  quizState.subject = match.subjectName;        // <<< AUTO DETECTED
  const chapterTitle = match.chapterTitle.replace(/quiz/ig,"").trim();

  // 🔥 FINAL HEADER OUTPUT
  const finalHeader = `Class 11 ${quizState.subject} – ${chapterTitle} Worksheet`;

  UI.updateHeader(finalHeader, quizState.difficulty);
}

// ----------------------------------------------
// Rendering + Navigation + Quiz Flow (unchanged)
// ----------------------------------------------
function renderQuestion() {
  const i = quizState.currentQuestionIndex;
  const q = quizState.questions[i];
  if (!q) return UI.showStatus("No question available.");

  UI.renderQuestion(q, i+1, quizState.userAnswers[q.id], quizState.isSubmitted);
  UI.updateNavigation(i, quizState.questions.length, quizState.isSubmitted);
  UI.hideStatus();
}

function handleNavigation(d) {
  const n = quizState.currentQuestionIndex + d;
  if (n >= 0 && n < quizState.questions.length) {
    quizState.currentQuestionIndex = n;
    renderQuestion();
  }
}

function handleAnswerSelection(id,opt){
  if(!quizState.isSubmitted){
    quizState.userAnswers[id] = opt;
    renderQuestion();
  }
}

async function handleSubmit(){
  if(quizState.isSubmitted) return;
  quizState.isSubmitted = true;

  quizState.score = quizState.questions.filter(q =>
    quizState.userAnswers[q.id]?.toUpperCase()===q.correct_answer?.toUpperCase()
  ).length;

  const user = getAuthUser();
  const result={
    classId:"11",
    subject:quizState.subject,
    topic:quizState.topicSlug,
    difficulty:quizState.difficulty,
    score:quizState.score,
    total:quizState.questions.length,
    user_answers:quizState.userAnswers
  };

  if(user) try{ await saveResult(result);}catch(e){console.warn(e);}
  quizState.currentQuestionIndex=0;
  renderQuestion();
  UI.showResults(quizState.score,quizState.questions.length);
  UI.renderAllQuestionsForReview?.(quizState.questions,quizState.userAnswers);
  UI.updateNavigation(0,quizState.questions.length,true);
}

async function loadQuiz(){
  try{
    UI.showStatus("Loading questions...");
    const q = await fetchQuestions(quizState.topicSlug,quizState.difficulty);
    if(!q.length) throw new Error("No questions found.");
    quizState.questions=q;
    quizState.userAnswers=Object.fromEntries(q.map(x=>[x.id,null]));
    renderQuestion();
    UI.attachAnswerListeners?.(handleAnswerSelection);
    UI.showView?.("quiz-content");
  }catch(e){
    UI.showStatus("Error: "+e.message,"text-red-600");
  }
}

async function onAuthChange(u){
  if(u){
    const ok = await checkAccess(quizState.topicSlug);
    if(ok) loadQuiz(); else UI.showView("paywall-screen");
  }else UI.showView("paywall-screen");
}

function attachDomEvents(){
  document.addEventListener("click",e=>{
    const btn=e.target.closest("button,a"); if(!btn)return;
    if(btn.id==="prev-btn")   return handleNavigation(-1);
    if(btn.id==="next-btn")   return handleNavigation(1);
    if(btn.id==="submit-btn") return handleSubmit();
    if(btn.id==="login-btn"||btn.id==="google-signin-btn"||btn.id==="paywall-login-btn") return signInWithGoogle();
    if(btn.id==="logout-nav-btn") return signOut();
    if(btn.id==="back-to-chapters-btn") location.href="chapter-selection.html";
  });
}

async function init(){
  UI.initializeElements();
  parseUrlParameters();
  await initializeServices();
  await initializeAuthListener(onAuthChange);
  attachDomEvents();
  UI.hideStatus();
}

document.addEventListener("DOMContentLoaded",init);
