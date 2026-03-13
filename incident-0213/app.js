// Don't Come Home // Incident 02:13
// Story engine — UI controller, state management, localStorage persistence
// Hidden state: trust, danger, memory, attempts, hasPlayed

/* jshint esversion: 6 */
/* global STORY */

(function () {
  "use strict";

  var STATE_KEY = "incident_0213_state";
  var ATTEMPTS_KEY = "incident_0213_attempts";

  // ── DOM refs ──────────────────────────────────────────────────────────────

  var landingEl = null;
  var storyEl = null;
  var endingEl = null;

  // ── State helpers ─────────────────────────────────────────────────────────

  function freshState() {
    return {
      scene: "start",
      trust: 0,
      danger: 0,
      memory: 0,
      path: [],
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : freshState();
    } catch (_e) {
      return freshState();
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (_e) {
      // storage unavailable — continue without persistence
    }
  }

  function getAttempts() {
    try {
      return parseInt(localStorage.getItem(ATTEMPTS_KEY) || "0", 10);
    } catch (_e) {
      return 0;
    }
  }

  function incrementAttempts() {
    try {
      var n = getAttempts() + 1;
      localStorage.setItem(ATTEMPTS_KEY, String(n));
      return n;
    } catch (_e) {
      return 1;
    }
  }

  // ── Rendering helpers ─────────────────────────────────────────────────────

  function hideAll() {
    landingEl.classList.add("hidden");
    storyEl.classList.add("hidden");
    endingEl.classList.add("hidden");
  }

  function buildTextHTML(lines) {
    return lines
      .map(function (line) {
        return line === "" ? "<br>" : "<p>" + line + "</p>";
      })
      .join("");
  }

  // ── Landing ───────────────────────────────────────────────────────────────

  function showLanding(attempts) {
    hideAll();
    landingEl.classList.remove("hidden");

    var returnMsg = document.getElementById("return-message");
    if (attempts > 0 && returnMsg) {
      returnMsg.classList.remove("hidden");
      returnMsg.textContent =
        "[ Attempt " + (attempts + 1) + " detected. Memory fragments partially intact. ]";
    } else if (returnMsg) {
      returnMsg.classList.add("hidden");
    }
  }

  // ── Scene rendering ───────────────────────────────────────────────────────

  function renderScene(state) {
    var scene = STORY.scenes[state.scene];
    if (!scene) return;

    hideAll();
    storyEl.classList.remove("hidden");

    // Title
    var titleEl = document.getElementById("scene-title");
    titleEl.textContent = scene.title;

    // Body text — use returnText on repeat visits if available
    var hasPlayed = getAttempts() > 1;
    var lines = (hasPlayed && scene.returnText) ? scene.returnText : scene.text;
    var textEl = document.getElementById("scene-text");
    textEl.innerHTML = buildTextHTML(lines);

    // Conditional additional text
    if (scene.conditionalText) {
      var cond = scene.conditionalText;
      if (state[cond.condition] >= cond.threshold) {
        var condP = document.createElement("p");
        condP.className = "conditional-hint";
        condP.textContent = cond.text;
        textEl.appendChild(condP);
      }
    }

    // Choices
    var choicesEl = document.getElementById("choices");
    choicesEl.innerHTML = "";

    if (scene.isEnding) {
      // Single "continue" button leading to ending card
      var continueBtn = document.createElement("button");
      continueBtn.className = "choice-btn";
      continueBtn.textContent = "[ continue ]";
      continueBtn.addEventListener("click", function () {
        transitionTo(function () {
          renderEnding(scene.endingId, state);
        });
      });
      choicesEl.appendChild(continueBtn);
    } else {
      scene.choices.forEach(function (choice) {
        var btn = document.createElement("button");
        btn.className = "choice-btn";
        btn.textContent = choice.text;
        btn.addEventListener("click", function () {
          applyChoice(state, choice);
        });
        choicesEl.appendChild(btn);
      });
    }
  }

  // ── Ending rendering ──────────────────────────────────────────────────────

  function renderEnding(endingId, state) {
    var ending = STORY.endings[endingId];
    if (!ending) return;

    hideAll();
    endingEl.classList.remove("hidden");

    var labelEl = document.getElementById("ending-label");
    labelEl.textContent = ending.label;
    labelEl.style.color = ending.color;

    var textEl = document.getElementById("ending-text");
    textEl.innerHTML = buildTextHTML(ending.text);

    // Stats (only if anything non-zero)
    var statsEl = document.getElementById("ending-stats");
    statsEl.innerHTML = "";
    if (state.trust > 0 || state.danger > 0 || state.memory > 0) {
      statsEl.innerHTML =
        "<div class='stats'>" +
        "<span>trust: " + state.trust + "</span>" +
        "<span>danger: " + state.danger + "</span>" +
        "<span>memory: " + state.memory + "</span>" +
        "</div>";
    }

    // Hint towards logs page on loop ending
    var hintEl = document.getElementById("ending-hint");
    hintEl.innerHTML = "";
    if (ending.logsHint) {
      hintEl.innerHTML = "<p class='hint'>[ <a href='logs.html'>incident log available</a> ]</p>";
    }

    // Reset state (keep attempts count)
    var newState = freshState();
    saveState(newState);
  }

  // ── Choice handler ────────────────────────────────────────────────────────

  function applyChoice(state, choice) {
    // Apply effects
    if (choice.effects) {
      Object.keys(choice.effects).forEach(function (key) {
        state[key] = (state[key] || 0) + choice.effects[key];
      });
    }

    // Record path
    state.path.push({ from: state.scene, choice: choice.text });

    // Advance scene
    state.scene = choice.next;
    saveState(state);

    transitionTo(function () {
      renderScene(state);
    });
  }

  // ── Scene transition ──────────────────────────────────────────────────────

  function transitionTo(fn) {
    storyEl.classList.add("scene-transition");
    setTimeout(function () {
      fn();
      storyEl.classList.remove("scene-transition");
    }, 280);
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  document.addEventListener("DOMContentLoaded", function () {
    landingEl = document.getElementById("landing");
    storyEl = document.getElementById("story-screen");
    endingEl = document.getElementById("ending-screen");

    var attempts = getAttempts();
    showLanding(attempts);

    // Begin button
    document.getElementById("begin-btn").addEventListener("click", function () {
      var currentAttempts = incrementAttempts();
      var state = freshState();
      // If this is a return visit, signal that in state
      if (currentAttempts > 1) {
        state.memory = 1; // slight head-start to trigger conditional text earlier
      }
      saveState(state);
      transitionTo(function () {
        renderScene(state);
      });
    });

    // Restart button
    var restartBtn = document.getElementById("restart-btn");
    if (restartBtn) {
      restartBtn.addEventListener("click", function () {
        showLanding(getAttempts());
      });
    }
  });

}());
