(function(){
  var d = document.documentElement;
  var themeBtn = document.getElementById("themeToggle");
  var sizeBtn = document.getElementById("sizeToggle");

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
    sizeBtn.textContent = (s === "base") ? "A" : (s === "l" ? "A+" : "A++");
    sizeBtn.setAttribute("aria-pressed", String(s !== "base"));
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
      var next = (s === "base") ? "l" : (s === "l" ? "xl" : "base");
      setSize(next);
    });
  }
  updateTheme();
  updateSize();
})();
