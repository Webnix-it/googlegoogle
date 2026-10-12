/* ============================================================
   ANIMAZIONE GOOGLE / GOOGLE MAPS — script.js
   Vanilla JS: digitazione, sequenza temporale, contatori animati,
   recensioni progressive, ciclo automatico, pausa/ripresa.

   I dati dell'attività sono DIMOSTRATIVI e centralizzati
   nell'oggetto BIZ_DATA: in futuro potrà essere sostituito da
   una risposta di un'API autorizzata (es. Google Places API)
   senza inventare recensioni reali.
   ============================================================ */

"use strict";

/* ------------------------------------------------------------
   DATI DIMOSTRATIVI (sostituibili con API autorizzate)
   Esempio futuro:
   const data = await fetchAuthorizedPlaceData();  // es. Google Places
   applyBusinessData(data);
------------------------------------------------------------- */
const BIZ_DATA = {
  query: "la mia attività",
  name: "Verde Fiorista",
  category: "Negozio di fiori",
  rating: 4.8,          // voto dimostrativo
  reviewCount: 127,     // numero dimostrativo
  address: "Via dei Fiori 12, 20121 Milano MI",
  hours: "Lun–Dom 8:30–19:30",
  phone: "02 1234 5678",
  reviews: [
    { name: "Giulia R.", stars: 5, text: "Composizione meravigliosa…" },
    { name: "Marco T.", stars: 5, text: "Il miglior fiorista della zona…" },
    { name: "Sara L.", stars: 4, text: "Ottima scelta di piante…" }
  ]
};

/* Applica i dati al DOM (predisposizione per API reali).
   Il testo visibile è già presente nell'HTML con i dati dimostrativi;
   questa funzione permette di sovrascrivere i campi principali con
   informazioni ottenute da un'API autorizzata (es. Google Places),
   senza inventare recensioni reali. */
function applyBusinessData(data) {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el && value != null) el.textContent = value;
  };
  setText("bcName", data.name);
  setText("miniQuery", data.query);

  const cat = document.querySelector(".bc-category");
  if (cat && data.category) cat.textContent = data.category;

  const addr = document.querySelector("#sceneCard .info-row:nth-child(1) dd");
  if (addr && data.address) addr.innerHTML = `<strong>Indirizzo:</strong> ${data.address}`;

  const phone = document.querySelector("#sceneCard .info-row:nth-child(3) dd");
  if (phone && data.phone) phone.innerHTML = `<strong>Telefono:</strong> ${data.phone}`;
}

/* ------------------------------------------------------------
   Timer gestiti: ogni setTimeout della sequenza passa da
   managedTimeout(), così è possibile annullarli tutti con clearAll()
   per evitare animazioni duplicate o sovrapposte.
------------------------------------------------------------- */
const TimerPool = {
  ids: new Set(),
  timeout(fn, delay) {
    const id = window.setTimeout(() => {
      TimerPool.ids.delete(id);
      fn();
    }, delay);
    TimerPool.ids.add(id);
    return id;
  },
  clearTimeout(id) {
    window.clearTimeout(id);
    TimerPool.ids.delete(id);
  },
  clearAll() {
    TimerPool.ids.forEach((id) => window.clearTimeout(id));
    TimerPool.ids.clear();
  }
};

/* Pausa/ripresa basata su Web Animations API + animation-play-state
   Permette anche di sospendere il "tempo" della sequenza. */
let paused = false;
let pauseStartTime = 0;
let totalPausedMs = 0;
let sequenceAbortToken = { cancelled: false };

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Promessa "pausabile": congela il countdown durante la pausa. */
function wait(ms) {
  return new Promise((resolve) => {
    const token = sequenceAbortToken;
    let remaining = Math.max(0, ms);
    let last = performance.now();
    let id = null;

    function tick() {
      if (token.cancelled) { TimerPool.clearTimeout(id); return; }
      const now = performance.now();
      if (!paused) remaining -= now - last;
      last = now;
      if (remaining <= 0) {
        TimerPool.clearTimeout(id);
        resolve();
      } else {
        id = TimerPool.timeout(tick, Math.min(60, remaining));
      }
    }

    id = TimerPool.timeout(tick, Math.min(60, remaining));
  });
}

/* Attesa legata a una fase: se il ciclo viene riavviato o interrotto
   (IntersectionObserver, pausa prolungata oltre il cancel), la promessa
   non si risolve e la vecchia sequenza async termina senza duplicazioni. */
function phaseWait(token, ms) {
  return new Promise((resolve) => {
    if (token.cancelled) return; // non risolve mai: la fase viene abbandonata
    wait(ms).then(() => {
      if (!token.cancelled) resolve();
    });
  });
}

/* Animazione con requestAnimationFrame, pausabile e cancellabile */
function animateValue({ duration, onUpdate, onDone }) {
  return new Promise((resolve) => {
    const token = sequenceAbortToken;
    let rafId = null;
    let startTime = null;   // riferimento temporale (già compensato per le pause)
    let pausedAt = 0;       // timestamp di inizio pausa corrente

    function frame(now) {
      if (token.cancelled) { resolve(); return; }
      if (paused) {
        if (!pausedAt) pausedAt = now;
        rafId = requestAnimationFrame(frame);
        return;
      }
      if (pausedAt) {
        // compensa il tempo trascorso in pausa
        startTime += now - pausedAt;
        pausedAt = 0;
      }
      if (startTime === null) startTime = now;
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      onUpdate(eased, t);
      if (t < 1) {
        rafId = requestAnimationFrame(frame);
      } else {
        if (onDone) onDone();
        resolve();
      }
    }
    rafId = requestAnimationFrame(frame);
  });
}

/* ------------------------------------------------------------
   STELLE: riempimento progressivo via clip-path.
   Le stelle usano SVG data-uri (nessuna immagine esterna):
   livello grigio di sfondo + livello oro clippato in alto.
------------------------------------------------------------- */
const STAR_SVG_GRAY =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='92' height='17' viewBox='0 0 92 17'><g fill='%23dadce0'><path d='M8.5 1l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L-.7 6.7l5.4-.8z'/><path transform='translate(18.7)' d='M8.5 1l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L-.7 6.7l5.4-.8z'/><path transform='translate(37.4)' d='M8.5 1l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L-.7 6.7l5.4-.8z'/><path transform='translate(56.1)' d='M8.5 1l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L-.7 6.7l5.4-.8z'/><path transform='translate(74.8)' d='M8.5 1l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L-.7 6.7l5.4-.8z'/></g></svg>\")";
const STAR_SVG_GOLD =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='92' height='17' viewBox='0 0 92 17'><g fill='%23fbbc04'><path d='M8.5 1l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L-.7 6.7l5.4-.8z'/><path transform='translate(18.7)' d='M8.5 1l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L-.7 6.7l5.4-.8z'/><path transform='translate(37.4)' d='M8.5 1l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L-.7 6.7l5.4-.8z'/><path transform='translate(56.1)' d='M8.5 1l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L-.7 6.7l5.4-.8z'/><path transform='translate(74.8)' d='M8.5 1l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L-.7 6.7l5.4-.8z'/></g></svg>\")";

function initStar(el) {
  el.style.backgroundImage = STAR_SVG_GRAY;
  el.style.backgroundRepeat = "no-repeat";
  el.style.backgroundSize = "100% 100%";
  el.innerHTML = "";
  const full = document.createElement("span");
  full.className = "layer-full";
  full.style.backgroundImage = STAR_SVG_GOLD;
  full.style.backgroundRepeat = "no-repeat";
  full.style.backgroundSize = "100% 100%";
  full.style.clipPath = "inset(0 100% 0 0)";
  el.appendChild(full);
}

function setStars(el, ratio) {
  const full = el.querySelector(".layer-full");
  if (!full) return;
  const pct = Math.max(0, Math.min(100, ratio * 100));
  full.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
}

/* Inizializza tutte le stelle statiche nella pagina */
function initAllStars() {
  document.querySelectorAll(".stars").forEach((el) => {
    initStar(el);
    const dataFull = parseFloat(el.getAttribute("data-full"));
    if (!Number.isNaN(dataFull)) {
      // stelle recensioni: piene subito (o animate quando entrano)
      el.setAttribute("data-target-ratio", String(dataFull / 5));
    }
  });
  // stelle risultati di ricerca: 4,8/5
  document.querySelectorAll("#sceneResults .stars").forEach((el) => {
    el.setAttribute("data-target-ratio", String(BIZ_DATA.rating / 5));
  });
}

/* ------------------------------------------------------------
   SCENE: show/hide senza sovrapposizioni
------------------------------------------------------------- */
const scenes = {
  search: document.getElementById("sceneSearch"),
  results: document.getElementById("sceneResults"),
  card: document.getElementById("sceneCard")
};
const ctaFinal = document.getElementById("ctaFinal");

function hideAllScenes() {
  Object.values(scenes).forEach((s) => { s.hidden = true; });
  ctaFinal.hidden = true;
  ctaFinal.classList.remove("show");
}

function resetSceneElements() {
  // Reset barra di ricerca
  const typedText = document.getElementById("typedText");
  const caret = document.getElementById("caret");
  typedText.textContent = "";
  typedText.appendChild(caret);
  caret.classList.remove("stopped");
  document.getElementById("searchbar").classList.remove("submitting");
  document.querySelector(".sb-search-icon").classList.remove("visible");
  scenes.search.classList.remove("lifted");

  // Reset risultati
  document.querySelectorAll(".result-item").forEach((el) => el.classList.remove("show"));

  // Reset scheda
  const card = document.querySelector(".biz-card");
  card.classList.remove("show");
  document.getElementById("scoreNum").textContent = "0,0";
  document.getElementById("revCounter").textContent = "0";
  setStars(document.getElementById("cardStars"), 0);
  document.getElementById("mapPin").classList.remove("drop");
  document.querySelectorAll(".review").forEach((r) => {
    r.classList.remove("show", "drift");
    const st = r.querySelector(".stars");
    if (st) setStars(st, 0);
  });
}

/* ------------------------------------------------------------
   FASE 1 — Digitazione
------------------------------------------------------------- */
async function phaseTyping(token) {
  const typedText = document.getElementById("typedText");
  const caret = document.getElementById("caret");
  const icon = document.querySelector(".sb-search-icon");
  const text = BIZ_DATA.query;

  icon.classList.add("visible");

  for (let i = 0; i < text.length && !token.cancelled; i++) {
    const ch = document.createTextNode(text[i]);
    typedText.insertBefore(ch, caret);
    // Velocità naturale variabile: 60–160ms, pause sui spazi
    const base = reducedMotion ? 5 : 60 + Math.random() * 100;
    const extra = text[i] === " " ? 120 : 0;
    await phaseWait(token, base + extra);
  }

  if (token.cancelled) return;

  // Breve pausa + cursore fermo ~700ms
  await phaseWait(token, reducedMotion ? 100 : 700);
  if (token.cancelled) return;

  caret.classList.add("stopped");

  // Animazione di invio
  const bar = document.getElementById("searchbar");
  bar.classList.add("submitting");
  await phaseWait(token, 500);
  if (token.cancelled) return;

  // La barra si solleva leggermente
  scenes.search.classList.add("lifted");
  await phaseWait(token, 420);
}

/* ------------------------------------------------------------
   FASE 2 — Risultati di ricerca
------------------------------------------------------------- */
async function phaseResults(token) {
  hideAllScenes();
  scenes.results.hidden = false;

  const items = [...document.querySelectorAll("#sceneResults .result-item")];
  for (const item of items) {
    if (token.cancelled) return;
    item.classList.add("show");
    // Stelle nei risultati appaiono piene dolcemente
    item.querySelectorAll(".stars").forEach((st) => {
      const target = parseFloat(st.getAttribute("data-target-ratio") || "1");
      animateValue({
        duration: reducedMotion ? 1 : 600,
        onUpdate: (e) => setStars(st, target * e)
      });
    });
    await phaseWait(token, reducedMotion ? 60 : 620);
  }
}

/* ------------------------------------------------------------
   FASE 3 — Scheda attività + recensioni
------------------------------------------------------------- */
async function phaseCard(token) {
  if (token.cancelled) return;
  hideAllScenes();
  scenes.card.hidden = false;

  const card = document.querySelector(".biz-card");
  // Forza reflow per riavviare l'animazione CSS
  card.classList.remove("show");
  void card.offsetWidth;
  card.classList.add("show");

  await phaseWait(token, reducedMotion ? 100 : 750);
  if (token.cancelled) return;

  // 1) Stelle + punteggio animati
  const scoreEl = document.getElementById("scoreNum");
  const starsEl = document.getElementById("cardStars");
  const revEl = document.getElementById("revCounter");

  const fmt = (v) => v.toFixed(1).replace(".", ",");

  await Promise.all([
    animateValue({
      duration: reducedMotion ? 1 : 1400,
      onUpdate: (e) => {
        scoreEl.textContent = fmt(BIZ_DATA.rating * e);
        setStars(starsEl, (BIZ_DATA.rating / 5) * e);
      }
    }),
    animateValue({
      duration: reducedMotion ? 1 : 1600,
      onUpdate: (e) => {
        revEl.textContent = String(Math.round(BIZ_DATA.reviewCount * e));
      }
    })
  ]);
  if (token.cancelled) return;

  // 2) Segnaposto mappa con rimbalzo
  document.getElementById("mapPin").classList.add("drop");
  await phaseWait(token, reducedMotion ? 100 : 900);
  if (token.cancelled) return;

  // 3) Recensioni una alla volta
  const reviews = [...document.querySelectorAll(".review")];
  for (const rv of reviews) {
    if (token.cancelled) return;
    rv.classList.add("show");
    const st = rv.querySelector(".stars");
    if (st) {
      const target = parseFloat(st.getAttribute("data-target-ratio") || "1");
      animateValue({
        duration: reducedMotion ? 1 : 700,
        onUpdate: (e) => setStars(st, target * e)
      });
    }
    await phaseWait(token, reducedMotion ? 60 : 750);
  }

  // 4) Delicato scorrimento verticale delle recensioni
  if (!reducedMotion) {
    reviews.forEach((rv, i) => {
      rv.style.animationDelay = `${i * 0.4}s`;
      rv.classList.add("drift");
    });
  }
}

/* ------------------------------------------------------------
   FASE 4 — CTA finale
------------------------------------------------------------- */
async function phaseCTA(token) {
  if (token.cancelled) return;
  ctaFinal.hidden = false;
  void ctaFinal.offsetWidth;
  ctaFinal.classList.add("show");
  // Attesa prima del riavvio del ciclo (~4 secondi)
  await phaseWait(token, 4000);
}

/* ------------------------------------------------------------
   CICLO COMPLETO
------------------------------------------------------------- */
async function runCycle() {
  const token = sequenceAbortToken;
  resetSceneElements();
  hideAllScenes();
  scenes.search.hidden = false;

  await phaseWait(token, 600);
  if (token.cancelled) return;

  await phaseTyping(token);
  if (token.cancelled) return;

  await phaseResults(token);
  if (token.cancelled) return;

  // Concentrazione sulla scheda dopo ~2 secondi
  await phaseWait(token, reducedMotion ? 200 : 2000);
  if (token.cancelled) return;

  await phaseCard(token);
  if (token.cancelled) return;

  await phaseCTA(token);
  if (token.cancelled) return;

  // Riavvio automatico pulito: stesso token del ciclo corrente.
  // Le attese con lo stesso token si risolvono correttamente e
  // non vengono create due sequenze parallele.
  TimerPool.clearAll();
  runCycle();
}

function startAnimation() {
  // Pulizia totale per evitare duplicazioni/sovrapposizioni
  sequenceAbortToken.cancelled = true;
  TimerPool.clearAll();

  sequenceAbortToken = { cancelled: false };
  runCycle();
}

/* ------------------------------------------------------------
   PAUSA / RIPRESA
------------------------------------------------------------- */
const pauseBtn = document.getElementById("pauseBtn");
const stageWrap = document.querySelector(".stage-wrap");

function setPaused(state) {
  paused = state;
  pauseBtn.classList.toggle("is-paused", state);
  pauseBtn.setAttribute("aria-pressed", String(state));
  pauseBtn.querySelector(".pause-label").textContent = state ? "Riprendi" : "Pausa";
  pauseBtn.setAttribute(
    "aria-label",
    state ? "Riprendi l'animazione" : "Metti in pausa l'animazione"
  );

  // Congela/scongela tutte le animazioni CSS figlie
  stageWrap.classList.toggle("is-paused", state);
}

pauseBtn.addEventListener("click", () => setPaused(!paused));

// Spazio = pausa/ripresa quando il focus non è su un pulsante
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && document.activeElement.tagName !== "BUTTON" &&
      document.activeElement.tagName !== "A") {
    e.preventDefault();
    setPaused(!paused);
  }
});

/* ------------------------------------------------------------
   AVVIO CON INTERSECTIONOBSERVER
   L'animazione parte quando la sezione entra in visualizzazione
   e si ferma (cancel) quando esce, per non sprecare risorse.
------------------------------------------------------------- */
let running = false;

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !running) {
        running = true;
        startAnimation();
      } else if (!entry.isIntersecting && running) {
        running = false;
        sequenceAbortToken.cancelled = true;
        TimerPool.clearAll();
      }
    });
  },
  { threshold: 0.25 }
);

/* ------------------------------------------------------------
   INIZIALIZZAZIONE
------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  applyBusinessData(BIZ_DATA);
  initAllStars();
  observer.observe(document.getElementById("hero"));
});
