const STORAGE_KEY = "recall.flashcards.state";
const STORAGE_VERSION = 1;

const appState = {
  decks: [],
  cardsByDeckId: {},
  activeDeckId: null,
  selectedCardId: null,
  isCardFlipped: false,
  shuffledCardIds: null,
};

const newDeckButton = document.querySelector("#new-deck-button");
const deckList = document.querySelector("#deck-list");
const deckListHint = document.querySelector("#deck-list-hint");
const deckCount = document.querySelector("#deck-count");
const deckHeading = document.querySelector("#deck-heading");
const cardEmptyTitle = document.querySelector("#card-empty-title");
const cardEmptyDescription = document.querySelector("#card-empty-description");
const deckDialog = document.querySelector("#deck-dialog");
const deckForm = document.querySelector("#deck-form");
const deckNameInput = document.querySelector("#deck-name");
const deckDialogTitle = document.querySelector("#deck-dialog-title");
const cancelDeckButton = document.querySelector("#cancel-deck-button");
const newCardButton = document.querySelector("#new-card-button");
const studyCard = document.querySelector("#study-card");
const flashcardInner = document.querySelector("#flashcard-inner");
const cardFrontFace = document.querySelector("#card-front-face");
const cardBackFace = document.querySelector("#card-back-face");
const cardFrontText = document.querySelector("#card-front-text");
const cardBackText = document.querySelector("#card-back-text");
const flipCardButton = document.querySelector("#flip-card-button");
const previousCardButton = document.querySelector("#previous-card-button");
const nextCardButton = document.querySelector("#next-card-button");
const shuffleCardsButton = document.querySelector("#shuffle-cards-button");
const studyPosition = document.querySelector("#study-position");
const cardEmptyState = document.querySelector("#card-empty-state");
const selectedCardActions = document.querySelector("#selected-card-actions");
const editCardButton = document.querySelector("#edit-card-button");
const deleteCardButton = document.querySelector("#delete-card-button");
const cardList = document.querySelector("#card-list");
const cardListEmpty = document.querySelector("#card-list-empty");
const cardLibraryCount = document.querySelector("#card-library-count");
const cardLibraryHeading = document.querySelector("#card-library-heading");
const cardDialog = document.querySelector("#card-dialog");
const cardForm = document.querySelector("#card-form");
const cardFrontInput = document.querySelector("#card-front-input");
const cardBackInput = document.querySelector("#card-back-input");
const cardDialogTitle = document.querySelector("#card-dialog-title");
const cancelCardButton = document.querySelector("#cancel-card-button");
const searchInput = document.querySelector("#card-search");
const appStatus = document.querySelector("#app-status");

let deckDialogMode = "create";
let editingDeckId = null;
let dialogOpener = null;
let dialogOpenerAction = null;
let dialogOpenerDeckId = null;
let cardDialogMode = "create";
let editingCardId = null;
let cardDialogDeckId = null;
let cardDialogOpener = null;
let cardDialogOpenerCardId = null;
let fallbackIdSequence = 0;
let searchQuery = "";
let searchDebounceId = null;

function resetSearch() {
  if (searchDebounceId !== null) {
    window.clearTimeout(searchDebounceId);
    searchDebounceId = null;
  }
  searchQuery = "";
  searchInput.value = "";
}

function showStatus(message) {
  appStatus.textContent = message;
  appStatus.hidden = false;
}

function clearStatus() {
  appStatus.textContent = "";
  appStatus.hidden = true;
}

function saveAppState() {
  const savedState = {
    version: STORAGE_VERSION,
    decks: appState.decks,
    cardsByDeckId: appState.cardsByDeckId,
    activeDeckId: appState.activeDeckId,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));
    clearStatus();
    return true;
  } catch {
    showStatus(
      "Your changes are active in this tab, but could not be saved to this browser. Check storage availability and try again.",
    );
    return false;
  }
}

function validateSavedState(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.version !== STORAGE_VERSION ||
    !Array.isArray(value.decks) ||
    !value.cardsByDeckId ||
    typeof value.cardsByDeckId !== "object" ||
    Array.isArray(value.cardsByDeckId) ||
    !(
      value.activeDeckId === null ||
      typeof value.activeDeckId === "string"
    )
  ) {
    return null;
  }

  const deckIds = new Set();
  for (const deck of value.decks) {
    if (
      !deck ||
      typeof deck !== "object" ||
      typeof deck.id !== "string" ||
      !deck.id.trim() ||
      deckIds.has(deck.id) ||
      typeof deck.name !== "string" ||
      !deck.name.trim()
    ) {
      return null;
    }
    deckIds.add(deck.id);
  }

  const storageDeckIds = Object.keys(value.cardsByDeckId);
  if (
    storageDeckIds.length !== deckIds.size ||
    storageDeckIds.some((deckId) => !deckIds.has(deckId))
  ) {
    return null;
  }

  const cardIds = new Set();
  for (const deckId of deckIds) {
    const cards = value.cardsByDeckId[deckId];
    if (!Array.isArray(cards)) {
      return null;
    }
    for (const card of cards) {
      if (
        !card ||
        typeof card !== "object" ||
        typeof card.id !== "string" ||
        !card.id.trim() ||
        cardIds.has(card.id) ||
        typeof card.front !== "string" ||
        !card.front.trim() ||
        typeof card.back !== "string" ||
        !card.back.trim() ||
        typeof card.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(card.updatedAt))
      ) {
        return null;
      }
      cardIds.add(card.id);
    }
  }

  if (value.activeDeckId !== null && !deckIds.has(value.activeDeckId)) {
    return null;
  }

  return {
    decks: value.decks,
    cardsByDeckId: value.cardsByDeckId,
    activeDeckId: value.activeDeckId,
  };
}

function restoreAppState() {
  let serialized;
  try {
    serialized = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    showStatus(
      "Saved decks could not be read from this browser. You can continue, but changes may not persist.",
    );
    return;
  }

  if (serialized === null) {
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    showStatus(
      "Saved data is unreadable, so the app started with an empty collection. The saved data was left unchanged.",
    );
    return;
  }

  const restored = validateSavedState(parsed);
  if (!restored) {
    showStatus(
      "Saved data is invalid or from an unsupported version, so the app started with an empty collection. The saved data was left unchanged.",
    );
    return;
  }

  appState.decks = restored.decks;
  appState.cardsByDeckId = restored.cardsByDeckId;
  appState.activeDeckId = restored.activeDeckId;
  if (!appState.activeDeckId && appState.decks.length > 0) {
    appState.activeDeckId = appState.decks[0].id;
  }
  appState.selectedCardId = appState.activeDeckId
    ? appState.cardsByDeckId[appState.activeDeckId][0]?.id ?? null
    : null;
  appState.isCardFlipped = false;
  appState.shuffledCardIds = null;
}

function createUniqueDeckId() {
  let id;

  do {
    id = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `deck-${Date.now()}-${fallbackIdSequence++}`;
  } while (
    appState.decks.some((deck) => deck.id === id) ||
    Object.prototype.hasOwnProperty.call(appState.cardsByDeckId, id)
  );

  return id;
}

function createUniqueCardId() {
  const existingCardIds = Object.values(appState.cardsByDeckId).flatMap(
    (cards) => cards.map((card) => card.id),
  );
  let id;

  do {
    id = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `card-${Date.now()}-${fallbackIdSequence++}`;
  } while (existingCardIds.includes(id));

  return id;
}

function createDeck(name) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return false;
  }

  const deck = { id: createUniqueDeckId(), name: trimmedName };
  appState.decks.push(deck);
  appState.cardsByDeckId[deck.id] = [];
  appState.activeDeckId = deck.id;
  resetSearch();
  appState.selectedCardId = null;
  appState.isCardFlipped = false;
  appState.shuffledCardIds = null;
  renderDecks();
  saveAppState();
  return true;
}

function selectDeck(deckId) {
  if (
    appState.activeDeckId === deckId ||
    !appState.decks.some((deck) => deck.id === deckId)
  ) {
    return;
  }

  appState.activeDeckId = deckId;
  resetSearch();
  appState.selectedCardId = appState.cardsByDeckId[deckId][0]?.id ?? null;
  appState.isCardFlipped = false;
  appState.shuffledCardIds = null;
  renderDecks();
  saveAppState();
}

function renameDeck(deckId, name) {
  const trimmedName = name.trim();
  const deck = appState.decks.find((item) => item.id === deckId);

  if (!deck || !trimmedName) {
    return false;
  }

  deck.name = trimmedName;
  renderDecks();
  saveAppState();
  return true;
}

function deleteDeck(deckId) {
  const deckIndex = appState.decks.findIndex((deck) => deck.id === deckId);
  if (deckIndex === -1) {
    return false;
  }

  appState.decks.splice(deckIndex, 1);
  delete appState.cardsByDeckId[deckId];

  if (appState.activeDeckId === deckId) {
    appState.activeDeckId = appState.decks[0]?.id ?? null;
    resetSearch();
    appState.selectedCardId = appState.activeDeckId
      ? appState.cardsByDeckId[appState.activeDeckId][0]?.id ?? null
      : null;
    appState.isCardFlipped = false;
    appState.shuffledCardIds = null;
  }

  renderDecks();
  saveAppState();
  return true;
}

function createDeckAction(label, action, deck) {
  const button = document.createElement("button");
  button.className = action === "select-deck" ? "deck-select" : "deck-action";
  button.type = "button";
  button.dataset.action = action;
  button.dataset.deckId = deck.id;

  if (action === "select-deck") {
    button.textContent = deck.name;
    if (deck.id === appState.activeDeckId) {
      button.setAttribute("aria-current", "page");
    }
  } else {
    button.textContent = label;
    button.setAttribute("aria-label", `${label} ${deck.name}`);
  }

  return button;
}

function renderDecks() {
  deckList.replaceChildren();

  for (const deck of appState.decks) {
    const item = document.createElement("li");
    item.className = "deck-item";
    item.dataset.active = String(deck.id === appState.activeDeckId);
    item.append(
      createDeckAction("Select", "select-deck", deck),
      createDeckAction("Rename", "rename-deck", deck),
      createDeckAction("Delete", "delete-deck", deck),
    );
    deckList.append(item);
  }

  const activeDeck = appState.decks.find(
    (deck) => deck.id === appState.activeDeckId,
  );
  const deckTotal = appState.decks.length;
  deckCount.textContent = String(deckTotal);
  deckCount.setAttribute(
    "aria-label",
    `${deckTotal} ${deckTotal === 1 ? "deck" : "decks"}`,
  );
  deckListHint.hidden = deckTotal > 0;
  deckHeading.textContent = activeDeck?.name ?? "Choose a deck to begin";
  renderCards();
}

function createCard(deckId, front, back) {
  const cards = appState.cardsByDeckId[deckId];
  if (!cards || !front.trim() || !back.trim()) {
    return null;
  }

  const card = {
    id: createUniqueCardId(),
    front: front.trim(),
    back: back.trim(),
    updatedAt: new Date().toISOString(),
  };
  cards.push(card);
  if (deckId === appState.activeDeckId && appState.shuffledCardIds) {
    appState.shuffledCardIds.push(card.id);
  }
  appState.selectedCardId = card.id;
  appState.isCardFlipped = false;
  renderCards();
  saveAppState();
  return card.id;
}

function updateCard(deckId, cardId, front, back) {
  const card = appState.cardsByDeckId[deckId]?.find((item) => item.id === cardId);
  if (!card || !front.trim() || !back.trim()) {
    return false;
  }

  card.front = front.trim();
  card.back = back.trim();
  card.updatedAt = new Date().toISOString();
  appState.selectedCardId = card.id;
  appState.isCardFlipped = false;
  renderCards();
  saveAppState();
  return true;
}

function getVisibleStudyCards() {
  const cards = appState.cardsByDeckId[appState.activeDeckId] ?? [];
  const orderedIds = getStudyCardIds(cards);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const cardsById = new Map(cards.map((card) => [card.id, card]));

  return orderedIds
    .map((cardId) => cardsById.get(cardId))
    .filter((card) => {
      if (!card || !normalizedQuery) {
        return Boolean(card);
      }

      return (
        card.front.toLocaleLowerCase().includes(normalizedQuery) ||
        card.back.toLocaleLowerCase().includes(normalizedQuery)
      );
    });
}

function selectCard(cardId) {
  const card = getVisibleStudyCards().find((item) => item.id === cardId);
  if (!card) {
    return;
  }

  appState.selectedCardId = card.id;
  appState.isCardFlipped = false;
  renderCards();
}

function getStudyCardIds(cards) {
  const cardIds = cards.map((card) => card.id);
  if (!appState.shuffledCardIds) {
    return cardIds;
  }

  const currentIds = new Set(cardIds);
  appState.shuffledCardIds = appState.shuffledCardIds.filter(
    (cardId) => currentIds.has(cardId),
  );
  const shuffledIds = new Set(appState.shuffledCardIds);
  for (const cardId of cardIds) {
    if (!shuffledIds.has(cardId)) {
      appState.shuffledCardIds.push(cardId);
    }
  }
  return appState.shuffledCardIds;
}

function moveStudyCard(direction) {
  const cardIds = getVisibleStudyCards().map((card) => card.id);
  if (cardIds.length < 2) {
    return false;
  }

  const currentIndex = cardIds.indexOf(appState.selectedCardId);
  const startIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (startIndex + direction + cardIds.length) % cardIds.length;
  appState.selectedCardId = cardIds[nextIndex];
  appState.isCardFlipped = false;
  renderCards();
  return true;
}

function goToPreviousCard() {
  return moveStudyCard(-1);
}

function goToNextCard() {
  return moveStudyCard(1);
}

function flipSelectedCard() {
  if (!appState.selectedCardId) {
    return false;
  }

  appState.isCardFlipped = !appState.isCardFlipped;
  renderCards();
  return true;
}

function shuffleCards() {
  const cards = appState.cardsByDeckId[appState.activeDeckId] ?? [];
  if (getVisibleStudyCards().length < 2) {
    return false;
  }

  const cardIds = cards.map((card) => card.id);
  for (let index = cardIds.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cardIds[index], cardIds[swapIndex]] = [cardIds[swapIndex], cardIds[index]];
  }

  appState.shuffledCardIds = cardIds;
  const visibleIds = getVisibleStudyCards().map((card) => card.id);
  if (!visibleIds.includes(appState.selectedCardId)) {
    appState.selectedCardId = visibleIds[0] ?? null;
  }
  appState.isCardFlipped = false;
  renderCards();
  return true;
}

function deleteCard(deckId, cardId) {
  const cards = appState.cardsByDeckId[deckId];
  const cardIndex = cards?.findIndex((card) => card.id === cardId) ?? -1;
  if (cardIndex === -1) {
    return false;
  }

  const cardIdsBeforeDelete = deckId === appState.activeDeckId
    ? getVisibleStudyCards().map((card) => card.id)
    : [];
  const studyIndex = cardIdsBeforeDelete.indexOf(cardId);
  cards.splice(cardIndex, 1);
  if (deckId === appState.activeDeckId && appState.shuffledCardIds) {
    appState.shuffledCardIds = appState.shuffledCardIds.filter(
      (id) => id !== cardId,
    );
  }
  if (appState.activeDeckId === deckId && appState.selectedCardId === cardId) {
    const remainingIds = getVisibleStudyCards().map((card) => card.id);
    appState.selectedCardId = remainingIds.length
      ? remainingIds[Math.min(studyIndex, remainingIds.length - 1)]
      : null;
    appState.isCardFlipped = false;
  }

  renderCards();
  saveAppState();
  return true;
}

function createCardPreview(card) {
  const item = document.createElement("li");
  const button = document.createElement("button");
  const front = document.createElement("span");
  const back = document.createElement("span");

  button.className = "card-preview";
  button.type = "button";
  button.dataset.action = "select-card";
  button.dataset.cardId = card.id;
  front.className = "card-preview-front";
  front.textContent = card.front;
  back.className = "card-preview-back";
  back.textContent = card.back;
  button.append(front, back);

  if (card.id === appState.selectedCardId) {
    button.setAttribute("aria-current", "true");
  }

  item.append(button);
  return item;
}

function findCardAction(action, cardId) {
  return Array.from(cardList.querySelectorAll("button[data-action]")).find(
    (button) =>
      button.dataset.action === action && button.dataset.cardId === cardId,
  );
}

function renderCards() {
  const activeDeck = appState.decks.find(
    (deck) => deck.id === appState.activeDeckId,
  );
  const allCards = activeDeck ? appState.cardsByDeckId[activeDeck.id] : [];
  const visibleCards = getVisibleStudyCards();
  const studyCardIds = visibleCards.map((card) => card.id);
  let selectedCard = visibleCards.find(
    (card) => card.id === appState.selectedCardId,
  );

  if (!selectedCard && studyCardIds.length > 0) {
    appState.selectedCardId = studyCardIds[0];
    appState.isCardFlipped = false;
  } else if (!selectedCard && appState.selectedCardId !== null) {
    appState.selectedCardId = null;
    appState.isCardFlipped = false;
  }
  selectedCard = visibleCards.find(
    (card) => card.id === appState.selectedCardId,
  );

  cardList.replaceChildren();
  for (const card of visibleCards) {
    cardList.append(createCardPreview(card));
  }

  const cardTotal = studyCardIds.length;
  const studyIndex = studyCardIds.indexOf(appState.selectedCardId);
  cardLibraryCount.textContent = String(cardTotal);
  cardLibraryHeading.textContent = searchQuery.trim()
    ? "Matching cards"
    : "Cards in this deck";
  cardLibraryCount.setAttribute(
    "aria-label",
    `${cardTotal} matching ${cardTotal === 1 ? "card" : "cards"}`,
  );
  studyPosition.textContent = selectedCard
    ? `Card ${studyIndex + 1} of ${studyCardIds.length}`
    : activeDeck && allCards.length > 0 && searchQuery.trim()
      ? "No cards found"
      : "No cards";
  cardListEmpty.hidden = cardTotal > 0;
  cardListEmpty.textContent = !activeDeck
    ? "Create a deck to see its cards here."
    : allCards.length === 0
      ? "This deck is empty. Add a card to get started."
      : "No cards found.";
  newCardButton.disabled = !activeDeck;
  searchInput.disabled = !activeDeck;
  previousCardButton.disabled = studyCardIds.length < 2;
  nextCardButton.disabled = studyCardIds.length < 2;
  shuffleCardsButton.disabled = studyCardIds.length < 2;

  studyCard.hidden = !selectedCard;
  cardEmptyState.hidden = Boolean(selectedCard);
  selectedCardActions.hidden = !selectedCard;
  flipCardButton.disabled = !selectedCard;
  flipCardButton.setAttribute("aria-pressed", String(appState.isCardFlipped));
  flashcardInner.classList.toggle("is-flipped", appState.isCardFlipped);

  if (selectedCard) {
    cardFrontText.textContent = selectedCard.front;
    cardBackText.textContent = selectedCard.back;
    cardEmptyTitle.textContent = "";
    cardEmptyDescription.textContent = "";
    cardFrontFace.setAttribute("aria-hidden", String(appState.isCardFlipped));
    cardBackFace.setAttribute("aria-hidden", String(!appState.isCardFlipped));
    cardFrontFace.inert = appState.isCardFlipped;
    cardBackFace.inert = !appState.isCardFlipped;
  } else {
    const hasSearchQuery = Boolean(searchQuery.trim());
    const hasCardsInDeck = (allCards?.length ?? 0) > 0;
    if (!activeDeck) {
      cardEmptyTitle.textContent = "Your next big idea starts here.";
      cardEmptyDescription.textContent =
        "Create a deck to add flashcards and start studying.";
    } else if (hasSearchQuery && hasCardsInDeck) {
      cardEmptyTitle.textContent = "No cards found";
      cardEmptyDescription.textContent =
        "Try a different keyword or clear your search to see all cards.";
    } else {
      cardEmptyTitle.textContent = "This deck is ready for its first card.";
      cardEmptyDescription.textContent =
        "Add a card to this deck to start studying.";
    }
    cardFrontText.textContent = "";
    cardBackText.textContent = "";
    cardFrontFace.setAttribute("aria-hidden", "true");
    cardBackFace.setAttribute("aria-hidden", "true");
    cardFrontFace.inert = true;
    cardBackFace.inert = true;
  }
}

function findDeckAction(action, deckId) {
  return Array.from(deckList.querySelectorAll("button[data-action]")).find(
    (button) =>
      button.dataset.action === action && button.dataset.deckId === deckId,
  );
}

function openDeckDialog(mode, opener, deckId = null) {
  deckDialogMode = mode;
  editingDeckId = deckId;
  dialogOpener = opener;
  dialogOpenerAction = mode === "rename" ? "rename-deck" : null;
  dialogOpenerDeckId = mode === "rename" ? deckId : null;
  deckForm.reset();
  deckNameInput.setCustomValidity("");

  const deck = appState.decks.find((item) => item.id === deckId);
  deckDialogTitle.textContent = mode === "rename" ? "Rename deck" : "New deck";
  deckNameInput.value = deck?.name ?? "";
  deckDialog.showModal();
  deckNameInput.focus();
  if (mode === "rename") {
    deckNameInput.select();
  }
}

function openCardDialog(mode, opener, cardId = null) {
  cardDialogMode = mode;
  editingCardId = cardId;
  cardDialogDeckId = appState.activeDeckId;
  cardDialogOpener = opener;
  cardDialogOpenerCardId = mode === "edit" ? cardId : null;
  cardForm.reset();
  cardFrontInput.setCustomValidity("");
  cardBackInput.setCustomValidity("");

  const card = appState.cardsByDeckId[cardDialogDeckId]?.find(
    (item) => item.id === cardId,
  );
  cardDialogTitle.textContent = mode === "edit" ? "Edit card" : "New card";
  cardFrontInput.value = card?.front ?? "";
  cardBackInput.value = card?.back ?? "";
  cardDialog.showModal();
  cardFrontInput.focus();
}

function restoreCardDialogFocus() {
  if (
    cardDialogOpener?.isConnected &&
    !cardDialogOpener.disabled &&
    !cardDialogOpener.closest("[hidden]")
  ) {
    cardDialogOpener.focus();
  } else {
    const preview = cardDialogOpenerCardId
      ? findCardAction("select-card", cardDialogOpenerCardId)
      : null;
    const fallback = searchQuery.trim() ? searchInput : newCardButton;
    (preview ?? fallback).focus();
  }

  cardDialogOpener = null;
  cardDialogOpenerCardId = null;
}

function closeDialogOnEscape(event) {
  event.preventDefault();
  event.currentTarget.close();
}

function handleDialogTab(event) {
  if (event.key !== "Tab" || event.ctrlKey || event.metaKey) {
    return;
  }

  const controls = Array.from(
    event.currentTarget.querySelectorAll(
      "button, input, textarea, select, a[href], [tabindex]",
    ),
  ).filter((control) =>
    !control.disabled && control.tabIndex >= 0 &&
    !control.closest("[hidden], [inert]"),
  );
  if (!controls.length) {
    return;
  }

  const currentIndex = controls.indexOf(document.activeElement);
  const nextIndex = currentIndex === -1
    ? (event.shiftKey ? controls.length - 1 : 0)
    : (currentIndex + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
  event.preventDefault();
  controls[nextIndex].focus();
}

function handleDialogEscape(event) {
  if (event.key !== "Escape") {
    return;
  }

  const openDialog = cardDialog.open
    ? cardDialog
    : deckDialog.open
      ? deckDialog
      : null;
  if (openDialog) {
    event.preventDefault();
    openDialog.close();
  }
}

function handleStudyShortcut(event) {
  if (
    deckDialog.open ||
    cardDialog.open ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return;
  }

  const activeElement = document.activeElement;
  if (
    activeElement instanceof HTMLElement &&
    (
      activeElement.isContentEditable ||
      activeElement.closest(
        "input, textarea, select, [contenteditable]:not([contenteditable='false'])",
      )
    )
  ) {
    return;
  }

  let action;
  if (event.key === "ArrowLeft") {
    action = goToPreviousCard;
  } else if (event.key === "ArrowRight") {
    action = goToNextCard;
  } else if (event.key === " ") {
    if (
      activeElement instanceof HTMLElement &&
      activeElement.closest("button, a[href], [role='button']")
    ) {
      return;
    }
    action = flipSelectedCard;
  } else {
    return;
  }

  const focusedPreview = activeElement instanceof HTMLElement
    ? activeElement.closest(".card-preview")
    : null;
  if (action()) {
    event.preventDefault();
    if (focusedPreview) {
      findCardAction("select-card", appState.selectedCardId)?.focus();
    }
  }
}

function restoreDialogFocus() {
  if (dialogOpener?.isConnected) {
    dialogOpener.focus();
  } else if (dialogOpenerAction && dialogOpenerDeckId) {
    findDeckAction(dialogOpenerAction, dialogOpenerDeckId)?.focus();
  } else {
    newDeckButton.focus();
  }

  dialogOpener = null;
  dialogOpenerAction = null;
  dialogOpenerDeckId = null;
}

newDeckButton.addEventListener("click", () => {
  openDeckDialog("create", newDeckButton);
});

newCardButton.addEventListener("click", () => {
  if (!newCardButton.disabled) {
    openCardDialog("create", newCardButton);
  }
});

deckList.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest("button[data-action][data-deck-id]");
  if (!button || !deckList.contains(button)) {
    return;
  }

  const { action, deckId } = button.dataset;
  if (action === "select-deck") {
    selectDeck(deckId);
    findDeckAction("select-deck", deckId)?.focus();
  } else if (action === "rename-deck") {
    openDeckDialog("rename", button, deckId);
  } else if (action === "delete-deck") {
    const deck = appState.decks.find((item) => item.id === deckId);
    if (deck && window.confirm(`Delete the "${deck.name}" deck?`)) {
      deleteDeck(deckId);
      (findDeckAction("select-deck", appState.activeDeckId) ?? newDeckButton).focus();
    }
  }
});

cardList.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest("button[data-action='select-card'][data-card-id]");
  if (!button || !cardList.contains(button)) {
    return;
  }

  selectCard(button.dataset.cardId);
  findCardAction("select-card", button.dataset.cardId)?.focus();
});

previousCardButton.addEventListener("click", goToPreviousCard);
nextCardButton.addEventListener("click", goToNextCard);
shuffleCardsButton.addEventListener("click", shuffleCards);
flipCardButton.addEventListener("click", flipSelectedCard);

searchInput.addEventListener("input", () => {
  if (searchDebounceId !== null) {
    window.clearTimeout(searchDebounceId);
  }

  searchDebounceId = window.setTimeout(() => {
    searchQuery = searchInput.value;
    searchDebounceId = null;
    renderCards();
  }, 300);
});

editCardButton.addEventListener("click", () => {
  const card = appState.cardsByDeckId[appState.activeDeckId]?.find(
    (item) => item.id === appState.selectedCardId,
  );
  if (card) {
    openCardDialog("edit", editCardButton, card.id);
  }
});

deleteCardButton.addEventListener("click", () => {
  const card = appState.cardsByDeckId[appState.activeDeckId]?.find(
    (item) => item.id === appState.selectedCardId,
  );
  if (
    card &&
    window.confirm(`Delete this card? "${card.front}"`)
  ) {
    deleteCard(appState.activeDeckId, card.id);
    (findCardAction("select-card", appState.selectedCardId) ?? newCardButton).focus();
  }
});

deckNameInput.addEventListener("input", () => {
  deckNameInput.setCustomValidity("");
});

deckForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = deckNameInput.value.trim();
  if (!name) {
    deckNameInput.setCustomValidity("Enter a deck name.");
    deckNameInput.reportValidity();
    return;
  }

  const saved = deckDialogMode === "rename"
    ? renameDeck(editingDeckId, name)
    : createDeck(name);

  if (saved) {
    deckDialog.close();
  }
});

cancelDeckButton.addEventListener("click", () => {
  deckDialog.close();
});

deckDialog.addEventListener("close", restoreDialogFocus);
deckDialog.addEventListener("cancel", closeDialogOnEscape);
deckDialog.addEventListener("keydown", handleDialogTab);

cardFrontInput.addEventListener("input", () => {
  cardFrontInput.setCustomValidity("");
});

cardBackInput.addEventListener("input", () => {
  cardBackInput.setCustomValidity("");
});

cardForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const front = cardFrontInput.value.trim();
  const back = cardBackInput.value.trim();
  cardFrontInput.setCustomValidity(front ? "" : "Enter text for the front of the card.");
  cardBackInput.setCustomValidity(back ? "" : "Enter text for the back of the card.");

  if (!front || !back) {
    (front ? cardBackInput : cardFrontInput).reportValidity();
    return;
  }

  const saved = cardDialogMode === "edit"
    ? updateCard(cardDialogDeckId, editingCardId, front, back)
    : createCard(cardDialogDeckId, front, back);

  if (saved) {
    cardDialog.close();
  }
});

cancelCardButton.addEventListener("click", () => {
  cardDialog.close();
});

cardDialog.addEventListener("close", restoreCardDialogFocus);
cardDialog.addEventListener("cancel", closeDialogOnEscape);
cardDialog.addEventListener("keydown", handleDialogTab);

document.addEventListener("keydown", handleDialogEscape);
document.addEventListener("keydown", handleStudyShortcut);

restoreAppState();
renderDecks();
console.log("Recall flashcards app is ready.");
