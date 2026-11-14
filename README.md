# Recall — Flashcards Study App

A responsive, single-page study app built with HTML, CSS, and vanilla JavaScript for the **An AI Coding Challenge** lab. No framework, build step, or installation is required to use the app.

## Run the app

Download or clone this repository and open `index.html` in a modern browser. Create a deck, add cards, and use the study controls to review them.

An optional local server is useful for a consistent browser storage origin:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Python is only needed for this optional server.

## Features

- Create, select, rename, and delete multiple decks.
- Create, edit, delete, and preview cards with front/back text.
- Flip cards with a 3D animation that respects reduced-motion preferences.
- Previous/Next navigation with wraparound, a position indicator, and session shuffle.
- Case-insensitive search across both faces with a 300ms debounce.
- LocalStorage persistence for decks, cards, and the last active deck.
- Responsive layout, automatic light/dark themes, visible focus styles, labeled dialogs, and keyboard support.

## Keyboard controls

| Key | Action |
| --- | --- |
| Left / Right arrow | Previous / next study card |
| Space | Flip the study card when focus is outside interactive controls |
| Enter / Space on a button | Activate the focused button normally |
| Escape | Close the active dialog |

Study shortcuts pause while a dialog is open or an editable field has focus. Dialogs return focus to their opener, or to an available control if the opener becomes hidden. Rename selects the existing deck name so it can be replaced immediately.

## How the code is organized

| File | Purpose |
| --- | --- |
| `index.html` | Semantic page structure and native deck/card dialogs |
| `styles.css` | Layout, theme variables, focus styles, and flip animation |
| `app.js` | State, CRUD operations, rendering, study order, search, and persistence |
| `tests/app.test.cjs` | Dependency-free regression checks for state and storage logic |

Storage uses the `recall.flashcards.state` key with schema version `1`. Search, shuffle order, dialogs, and the flipped face are temporary. Search filters a view of the cards; it does not delete cards or rewrite the stored order.

Browser data is local to that browser and origin. Opening the file directly and using the optional server may show different collections. Clearing browser storage removes saved cards. Malformed or unsupported saved data produces a visible message and is left unchanged during startup; a later successful save replaces the stored collection. Failed saves leave the app usable in memory and display a warning. There is no account sync, import/export, or spaced repetition.

## Verification

With Node.js installed, run the optional tests:

```bash
node --test tests/app.test.cjs
node --check app.js
```

The eleven regression tests cover restoration, malformed/unsupported data, invalid references, storage failures, wraparound navigation, shuffle changes, search, pending-search cancellation, focus fallback, dialog focus cycling, and deletion of the final card/deck. They use a small DOM stub to exercise the actual JavaScript; browser layout and native dialog behavior require manual checks.

Browser review in Safari covered card creation/editing, flip state, navigation, keyboard shortcuts, search against back text, no-match states, clearing search, and restoring the last active deck after refresh. Contrast calculations checked normal text, muted text, counts, placeholders, and primary buttons in both theme palettes.

For a final manual check, try a narrow window, a long multiline answer, both dialogs using only the keyboard, and the operating system's light/dark and reduced-motion preferences.

## Reflection — five bullets

- **Where AI saved time:** AI assistants helped scaffold the responsive page and implement deck/card operations, native dialogs, study controls, search, and LocalStorage. Building one checkpoint at a time made the generated code easier to review and understand.
- **An AI bug identified and fixed:** Review in Safari showed that a long answer overflowed the flashcard and covered the controls. The generated CSS used absolutely positioned faces inside a fixed minimum-height area. Putting both faces in the same CSS grid cell let their content determine the card height while keeping the flip effect. Review also caught the misleading empty-deck message when a search had no matches.
- **A refactor for clarity:** Navigation shares one `moveStudyCard(direction)` function instead of repeating the index and flip-reset logic in separate handlers. Buttons and shortcuts call these small wrappers. Final cleanup also moved the grid fix into the original CSS rules instead of leaving duplicate overrides at the bottom of the stylesheet.

  ```js
  function goToPreviousCard() {
    return moveStudyCard(-1);
  }

  function goToNextCard() {
    return moveStudyCard(1);
  }
  ```

- **An accessibility improvement:** Labeled native dialogs support Escape and focus restoration, and only the visible study face is exposed to screen readers. Keyboard shortcuts pause during text entry and preserve normal button activation. Final review improved muted-text contrast, added a focus fallback when an edited card disappears from filtered results, and added explicit Tab/Shift+Tab cycling after Safari let focus leave the native dialog for the browser toolbar.
- **Prompt changes that improved the output:** Specific prompts such as “bind listeners once,” “render user text with textContent,” “preserve the stored card order when shuffling,” and “test empty decks and deleting the last card” produced more consistent behavior than asking for the whole app at once. The main lesson was to check generated code with edge cases, not just the first successful interaction.

## AI assistance

This lab was developed through staged AI-assisted implementation and review. The student identified the Rename selection issue and reviewed the app through the checkpoints. Codex assisted with browser review, final polish, documentation, and regression checks. The reflection describes changes and findings from that process.
