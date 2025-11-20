// js/api.js
// ------------------------------------------------------------
// FINAL Non-OIDC Version
// Fetch quiz questions from Supabase (public access)
// Save score to Firestore
// ------------------------------------------------------------

import { getInitializedClients, getAuthUser, logAnalyticsEventWrapper } from "./config.js";
import * as UI from "./ui-renderer.js";
import { cleanKatexMarkers } from "./utils.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

function getTableName(topic) {
  const map = {
    motion: "motion",
    force: "force",
    gravitation: "gravitation",
    matter_pure: "matter_pure",
    relations_functions_quiz: "relations_functions_quiz"
  };
  topic = topic.toLowerCase().replace(/\s+/g, "_");
  return map[topic] || topic;
}

// ------------------------
// Fetch Questions (Public)
// ------------------------
export async function fetchQuestions(topic, difficulty) {
  const { supabase } = getInitializedClients();
  const table = getTableName(topic);

  UI.showStatus(`Loading questions from ${table}...`);

  const normalizedDiff = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

  const { data, error } = await supabase
    .from(table)
    .select("id, question_text, question_type, scenario_reason_text, option_a, option_b, option_c, option_d, correct_answer_key")
    .eq("difficulty", normalizedDiff);

  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("No questions found.");

  return data.map(q => ({
    id: q.id,
    text: cleanKatexMarkers(q.question_text),
    options: {
      A: cleanKatexMarkers(q.option_a),
      B: cleanKatexMarkers(q.option_b),
      C: cleanKatexMarkers(q.option_c),
      D: cleanKatexMarkers(q.option_d)
    },
    correct_answer: q.correct_answer_key?.trim().toUpperCase(),
    scenario_reason: cleanKatexMarkers(q.scenario_reason_text || ""),
    question_type: q.question_type?.trim().toLowerCase()
  }));
}

// ------------------------
// Save Quiz Result
// ------------------------
export async function saveResult(result) {
  const { db } = getInitializedClients();
  const user = getAuthUser();
  if (!user) return console.warn("[API] User not logged in — skipping save.");

  await addDoc(collection(db, "quiz_scores"), {
    user_id: user.uid,
    email: user.email,
    chapter: result.topic,
    difficulty: result.difficulty,
    score: result.score,
    total: result.total,
    percentage: Math.round((result.score / result.total) * 100),
    timestamp: serverTimestamp()
  });

  logAnalyticsEventWrapper("quiz_completed", {
    user_id: user.uid,
    chapter: result.topic,
    difficulty: result.difficulty,
    score: result.score,
    total: result.total
  });

  console.log("[API] Score saved.");
}
