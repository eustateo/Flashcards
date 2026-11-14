const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Exercise the actual app's state and storage logic without a browser or packages.
// Visual layout and native dialog behavior are checked separately in Safari.
function loadApp({ stored = null, readFails = false, writeFails = false } = {}) {
  const elements = new Map();
  const timers = new Map();
  let timerId = 0;
  let writes = 0;
  const document = { activeElement: null };

  class Element {
    constructor(tag = "div") {
      this.tag = tag;
      this.tabIndex = ["button", "input", "textarea", "select", "a"].includes(tag) ? 0 : -1;
      this.children = [];
      this.dataset = {};
      this.attributes = {};
      this.listeners = {};
      this.value = "";
      this.hidden = false;
      this.disabled = false;
      this.isConnected = true;
      this.open = false;
      this.classList = { toggle() {} };
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    append(...children) {
      children.forEach((child) => { child.parentElement = this; });
      this.children.push(...children);
    }
    replaceChildren() {
      this.querySelectorAll().forEach((child) => { child.isConnected = false; });
      this.children = [];
    }
    querySelectorAll() {
      return this.children.flatMap((child) => [child, ...child.querySelectorAll()]);
    }
    closest(selector) {
      if (selector.includes("[hidden]")) {
        return this.hidden ? this : this.parentElement?.closest(selector) ?? null;
      }
      if (selector.includes(this.tag) && this.tag !== "div") return this;
      return null;
    }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    focus() { document.activeElement = this; }
    reset() {}
    select() {}
    setCustomValidity(message) { this.validationMessage = message; }
    showModal() { this.open = true; }
    close() { this.open = false; this.listeners.close?.(); }
  }

  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  for (const match of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bid="([^"]+)"/g)) {
    elements.set(match[2], new Element(match[1]));
  }
  elements.get("selected-card-actions").append(elements.get("edit-card-button"));
  document.querySelector = (selector) => elements.get(selector.slice(1));
  document.createElement = (tag) => new Element(tag);
  document.addEventListener = () => {};
  const context = vm.createContext({
    document, Element, HTMLElement: Element, console: { log() {} },
    window: {
      localStorage: {
        getItem() { if (readFails) throw Error("Read blocked"); return stored; },
        setItem(key, value) {
          if (writeFails) throw Error("Storage full");
          stored = value;
          writes += 1;
        },
      },
      setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
      clearTimeout(id) { timers.delete(id); },
    },
  });
  const run = (code) => vm.runInContext(code, context);
  run(fs.readFileSync(path.join(__dirname, "../app.js"), "utf8"));
  return {
    run, elements, get stored() { return stored; }, get writes() { return writes; },
    snapshot: () => JSON.parse(run("JSON.stringify(appState)")),
    flushSearch() {
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((callback) => callback());
    },
    search(query) {
      elements.get("card-search").value = query;
      elements.get("card-search").listeners.input();
      this.flushSearch();
    },
  };
}

test("deck/card changes persist; refresh restores the active deck and its front", () => {
  const app = loadApp();
  app.run('createDeck("JavaScript"); createCard(appState.activeDeckId, "const", "Binding");');
  app.run('createDeck("HTML"); createCard(appState.activeDeckId, "main", "Main content");');
  app.run('renameDeck(appState.activeDeckId, "Markup");');
  app.run('updateCard(appState.activeDeckId, appState.selectedCardId, "main", "Primary content");');
  app.run("flipSelectedCard();");
  const saved = JSON.parse(app.stored);
  assert.equal(saved.version, 1);
  assert.deepEqual(Object.keys(saved).sort(), ["activeDeckId", "cardsByDeckId", "decks", "version"]);
  const restored = loadApp({ stored: app.stored }).snapshot();
  assert.equal(restored.decks.length, 2);
  assert.equal(restored.decks[1].name, "Markup");
  assert.equal(restored.activeDeckId, saved.activeDeckId);
  assert.equal(restored.cardsByDeckId[restored.activeDeckId][0].back, "Primary content");
  assert.equal(restored.isCardFlipped, false);
  assert.equal(restored.shuffledCardIds, null);
});

test("malformed or unsupported storage stays unchanged during startup", () => {
  for (const stored of ["{broken", '{"version":999}', "null", "[]"]) {
    const app = loadApp({ stored });
    assert.equal(app.snapshot().decks.length, 0);
    assert.equal(app.writes, 0);
    assert.equal(app.stored, stored);
    assert.match(app.elements.get("app-status").textContent, /unreadable|invalid|unsupported/);
  }
});

test("restored data rejects duplicate IDs and broken deck references", () => {
  const app = loadApp();
  app.run('createDeck("Test"); createCard(appState.activeDeckId, "Q", "A");');
  const saved = JSON.parse(app.stored);
  const invalidStates = [
    { ...saved, decks: [saved.decks[0], saved.decks[0]] },
    { ...saved, activeDeckId: "missing" },
    { ...saved, cardsByDeckId: {} },
    { ...saved, cardsByDeckId: { [saved.activeDeckId]: [{ id: "bad" }] } },
  ];
  for (const state of invalidStates) {
    assert.equal(app.run(`validateSavedState(${JSON.stringify(state)})`), null);
  }
});

test("unavailable storage reports the error and keeps edits usable in memory", () => {
  const app = loadApp({ readFails: true, writeFails: true });
  assert.match(app.elements.get("app-status").textContent, /could not be read/);
  app.run('createDeck("Unsaved"); createCard(appState.activeDeckId, "Q", "A");');
  assert.equal(app.snapshot().decks.length, 1);
  assert.match(app.elements.get("app-status").textContent, /could not be saved/);
  assert.equal(app.writes, 0);
});

test("navigation wraps and resets the flipped face", () => {
  const app = loadApp();
  app.run('createDeck("Test"); for (const n of [1, 2, 3]) createCard(appState.activeDeckId, String(n), "Answer");');
  app.run("flipSelectedCard(); goToNextCard();");
  assert.equal(app.elements.get("card-front-text").textContent, "1");
  assert.equal(app.snapshot().isCardFlipped, false);
  app.run("goToPreviousCard();");
  assert.equal(app.elements.get("card-front-text").textContent, "3");
});

test("shuffle and filtering preserve data; deletion and additions keep valid study IDs", () => {
  const app = loadApp();
  app.run('createDeck("Test"); for (const n of [1, 2, 3]) createCard(appState.activeDeckId, String(n), "Answer");');
  const before = app.snapshot();
  app.run("shuffleCards();");
  const shuffled = app.snapshot().shuffledCardIds;
  const cards = before.cardsByDeckId[before.activeDeckId];
  assert.deepEqual([...shuffled].sort(), cards.map((card) => card.id).sort());
  assert.deepEqual(app.snapshot().cardsByDeckId, before.cardsByDeckId);
  app.search("ANSWER");
  assert.deepEqual(JSON.parse(app.run("JSON.stringify(getVisibleStudyCards().map(card => card.id))")), shuffled);
  app.run('createCard(appState.activeDeckId, "4", "Answer");');
  app.run("deleteCard(appState.activeDeckId, appState.selectedCardId);");
  assert.deepEqual(app.snapshot().shuffledCardIds, shuffled);
  assert.equal(app.run("getVisibleStudyCards().length"), 3);
});

test("search matches either face without changing storage; no-match and clear states work", () => {
  const app = loadApp();
  app.run('createDeck("Test"); createCard(appState.activeDeckId, "const", "Binding"); createCard(appState.activeDeckId, "array", "Collection");');
  const saved = app.stored;
  app.search("BINDING");
  assert.equal(app.elements.get("card-front-text").textContent, "const");
  assert.equal(app.elements.get("next-card-button").disabled, true);
  app.search("zznomatch");
  assert.equal(app.elements.get("card-empty-title").textContent, "No cards found");
  assert.equal(app.elements.get("flip-card-button").disabled, true);
  app.search("");
  assert.equal(app.run("getVisibleStudyCards().length"), 2);
  assert.equal(app.stored, saved);
});

test("switching decks cancels a pending search", () => {
  const app = loadApp();
  app.run('createDeck("One"); createCard(appState.activeDeckId, "Q", "A"); createDeck("Two");');
  const input = app.elements.get("card-search");
  input.value = "unmatched";
  input.listeners.input();
  app.run("selectDeck(appState.decks[0].id);");
  app.flushSearch();
  assert.equal(input.value, "");
  assert.equal(app.run("getVisibleStudyCards().length"), 1);
});

test("editing a card out of search results returns focus to search", () => {
  const app = loadApp();
  app.run('createDeck("Test"); createCard(appState.activeDeckId, "match", "match");');
  app.search("match");
  app.run('openCardDialog("edit", editCardButton, appState.selectedCardId);');
  app.run('updateCard(appState.activeDeckId, appState.selectedCardId, "Other", "Answer"); cardDialog.close();');
  assert.equal(app.run("document.activeElement === searchInput"), true);
});

test("dialog Tab and Shift+Tab reach every control and wrap within the modal", () => {
  const app = loadApp();
  app.run(`
    const saveButton = document.createElement("button");
    cardDialog.append(cardFrontInput, cardBackInput, cancelCardButton, saveButton);
    cardFrontInput.focus();
  `);
  const tab = (backward = false) => app.run(`handleDialogTab({
    key: "Tab", currentTarget: cardDialog, shiftKey: ${backward}, preventDefault() {}
  });`);
  tab();
  assert.equal(app.run("document.activeElement === cardBackInput"), true);
  tab();
  assert.equal(app.run("document.activeElement === cancelCardButton"), true);
  tab();
  assert.equal(app.run("document.activeElement === saveButton"), true);
  tab();
  assert.equal(app.run("document.activeElement === cardFrontInput"), true);
  tab(true);
  assert.equal(app.run("document.activeElement === saveButton"), true);
});

test("deleting the last card and deck saves a valid empty state", () => {
  const app = loadApp();
  app.run('createDeck("Test"); createCard(appState.activeDeckId, "Q", "A");');
  app.run("deleteCard(appState.activeDeckId, appState.selectedCardId);");
  assert.equal(app.snapshot().selectedCardId, null);
  assert.equal(app.elements.get("flip-card-button").disabled, true);
  app.run("deleteDeck(appState.activeDeckId);");
  assert.equal(app.snapshot().activeDeckId, null);
  assert.equal(loadApp({ stored: app.stored }).snapshot().decks.length, 0);
});
