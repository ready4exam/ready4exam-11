/* -----------------------------------
   AUTO-DETECT ASSERTION–REASON FORMATTER
----------------------------------- */
function formatAssertionReason(rawText){
  const txt = rawText || "";

  // Detect if question contains Assertion + Reason (automatic)
  const hasA = /Assertion\s*\(A\)/i.test(txt);
  const hasR = /Reason\s*\(R\)/i.test(txt);
  if (!hasA || !hasR) return rawText;  // normal question → return unchanged

  // Extract Statements
  const assertion = txt.match(/Assertion\s*\(A\)\s*[:\-]?\s*(.*?)(?=Reason\s*\(R\)|$)/is)?.[1]?.trim();
  const reason    = txt.match(/Reason\s*\(R\)\s*[:\-]?\s*(.*)$/is)?.[1]?.trim();

  return `
  <div class="ar-card">
      <div class="ar-block">
          <span class="ar-label">Assertion (A):</span>
          <div class="ar-text">${assertion}</div>
      </div>
      <div class="ar-block">
          <span class="ar-label">Reason (R):</span>
          <div class="ar-text">${reason}</div>
      </div>
  </div>
  `;
}
