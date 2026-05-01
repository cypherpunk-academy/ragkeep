(function(){
  var d = document.documentElement;
  var themeBtn = document.getElementById("themeToggle");
  var sizeBtn = document.getElementById("sizeToggle");
  var sizeOrder = ["base", "l", "xl", "xxl", "xxxl"];
  var sizeLabels = { base: "A", l: "A+", xl: "A++", xxl: "A+++", xxxl: "A++++" };

  function getTheme(){ return d.getAttribute("data-theme") || "default"; }
  function setTheme(t){
    d.setAttribute("data-theme", t);
    try { localStorage.setItem("readerTheme", t); } catch(e) {}
    updateTheme();
  }
  function getSize(){ return d.getAttribute("data-size") || "base"; }
  function setSize(s){
    if (s === "base") d.removeAttribute("data-size"); else d.setAttribute("data-size", s);
    try { localStorage.setItem("readerSize", s); } catch(e) {}
    updateSize();
  }
  function updateTheme(){
    if (!themeBtn) return;
    var t = getTheme();
    themeBtn.textContent = (t === "default") ? "🌙" : "☀️";
    themeBtn.setAttribute("aria-pressed", String(t === "dark"));
  }
  function updateSize(){
    if (!sizeBtn) return;
    var s = getSize();
    if (sizeOrder.indexOf(s) === -1) s = "base";
    sizeBtn.textContent = sizeLabels[s] || "A";
    sizeBtn.setAttribute("aria-pressed", String(s !== "base"));
  }
  function applyReferenceNumbers(){
    var refs = d.querySelectorAll(".talk-sources-stack > .talk-sources");
    for (var i = 0; i < refs.length; i++) {
      var summaryTop = refs[i].querySelector(":scope > summary .talk-sources-summary-top");
      if (!summaryTop) continue;
      if (summaryTop.querySelector(".talk-sources-ref-number")) continue;
      var refEl = document.createElement("span");
      refEl.className = "talk-sources-ref-number";
      refEl.textContent = "[" + (i + 1) + "]";
      summaryTop.insertBefore(refEl, summaryTop.firstChild);
    }
  }
  function hideConceptTypeLabels(){
    var metas = d.querySelectorAll(".talk-sources-summary-meta");
    for (var i = 0; i < metas.length; i++) {
      var typeEl = metas[i].querySelector(".talk-sources-summary-type");
      if (!typeEl) continue;
      var titleEl = metas[i].querySelector(".talk-sources-summary-title");
      var typeText = (typeEl.textContent || "").trim().toLowerCase();
      var titleText = titleEl ? (titleEl.textContent || "").trim().toLowerCase() : "";
      var isConceptType = typeText === "begriff" || typeText === "concept" || typeText === "concepts";
      var isConceptTitle = titleText === "begriff";
      if (isConceptType || isConceptTitle) typeEl.remove();
    }
  }
  try {
    var savedTheme = localStorage.getItem("readerTheme");
    if (savedTheme) d.setAttribute("data-theme", savedTheme);
    var savedSize = localStorage.getItem("readerSize");
    if (savedSize && savedSize !== "base") d.setAttribute("data-size", savedSize);
  } catch(e) {}
  if (themeBtn) {
    themeBtn.addEventListener("click", function(){
      var t = getTheme();
      setTheme(t === "dark" ? "default" : "dark");
    });
  }
  if (sizeBtn) {
    sizeBtn.addEventListener("click", function(){
      var s = getSize();
      var idx = sizeOrder.indexOf(s);
      if (idx === -1) idx = 0;
      var next = sizeOrder[(idx + 1) % sizeOrder.length];
      setSize(next);
    });
  }
  updateTheme();
  updateSize();
  hideConceptTypeLabels();
  applyReferenceNumbers();
})();
