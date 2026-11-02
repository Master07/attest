# Real-world proof: Jules's lightbox fixes on hypenosys, including a merged one that didn't work

> **Exploratory, not pre-registered, and run on a modified page.** The criterion was written before the run but committed only afterwards. The app's page can't show the bug without a GitHub login, so a local harness injects a task card and two CSS rules (details below). Read the result with that in mind.

The app: [hypenosys/hypenosys.github.io](https://github.com/hypenosys/hypenosys.github.io) (MIT licence, `LICENSE.md`). It's a team dashboard (`dashboard.html`) whose task cards show image thumbnails that open in a lightbox. Credit to its authors.

The history: Google's coding agent **Jules** (`google-labs-jules[bot]`) tried several times to make a tap on a thumbnail open the lightbox:

| Ref | Commit | What it is |
|---|---|---|
| Break | [`1bfd62a`](https://github.com/hypenosys/hypenosys.github.io/commit/1bfd62aaf1f98b0a966f258f9d8a0834e1b0bd5f) | Merge of [PR #68](https://github.com/hypenosys/hypenosys.github.io/pull/68), "Bug Follow-up: Lightbox Still Not Opening on First Click", by Jules, **merged** 2026-06-01 |
| Red | [`50c35c1`](https://github.com/hypenosys/hypenosys.github.io/commit/50c35c1b45b910b553ebe52fd03a8f7a3f351ee2) | A later attempt by Jules the same day, "fix: Kanban thumbnail interaction for mobile, tablet, and desktop" |
| Green | [`0a69818`](https://github.com/hypenosys/hypenosys.github.io/commit/0a698181c6f42d551ded9a76f98b581349e2d54a) | Jules, 2026-06-03, head of PR #88, which moved the lightbox out of the hidden modal |

**The bug.** In both earlier trees, `#lightbox-modal` sits inside `#create-task-modal`, which stays `display: none`. A tap does call `openLightbox`, but the viewer is a 0×0 box inside a hidden parent. This was measured on the unmodified page's DOM in separate hand checks, without the harness. #88 moves the lightbox to `<body>`.

**This is the only proof here where the wrong fix (Break) is not ours.** It's a real merged AI fix that didn't work. Red is not the PR's parent but a later failed attempt; both show the bug.

**The harness, in full** (all in this folder, unchanged from the run):
- Without a GitHub login the dashboard shows only a login overlay and no cards. [mount.js](mount.js) hides the overlays and builds **one card with the page's own `buildTaskCard`**, using a local image ([thumb.svg](thumb.svg)).
- [serve.cjs](serve.cjs) injects two CSS rules that stand in for the Tailwind CDN classes: `.hidden { display: none }`, and a fixed full-page position for `#lightbox-modal`. The second rule is ours, not the app's. It decides how the open lightbox looks, so Green's "covers the page" depends on it. It can't make Red or Break pass, because a `display: none` parent hides the lightbox whatever its own position.
- The card, the click handlers, the lightbox markup and its nesting are the commits' own.

**The criterion** ([criteria.yml](criteria.yml)): given the dashboard shows a task card with one image, when I tap that thumbnail once, the lightbox covers the page and shows the image.

## Runs

| # | Kind | Red | Green | Break | Verdict | Receipt |
|---|---|---|---|---|---|---|
| 1 | live | fail | pass | fail | **PROVEN** | [proofs/realworld/hypenosys-run1](../../../proofs/realworld/hypenosys-run1/) |

Red: *"Both single clicks on the red thumbnail left the page unchanged with no lightbox overlay appearing."* Green: *"Single click on the red-yellow thumbnail opened a full-page dark overlay centered on the same image with a close button."* Break (Jules's merged #68): *"both times the card stayed unchanged with no lightbox overlay covering the page."* The judge (Muse Spark Open on Baseten) agreed in every phase. The code checks and SAM abstained.

**What this shows, and what it doesn't.** On a page with an injected card and stand-in CSS, Attest rejected a merged AI fix that didn't open the lightbox and proved a later one that did. That matches the DOM measurement on the unmodified page. It is not a run on the app as its users see it, and it was not pre-registered.

## Reproduce

```bash
git fetch https://github.com/hypenosys/hypenosys.github.io 50c35c1b45b910b553ebe52fd03a8f7a3f351ee2:refs/heads/rw/live/hyp/red
git fetch https://github.com/hypenosys/hypenosys.github.io 0a698181c6f42d551ded9a76f98b581349e2d54a:refs/heads/rw/live/hyp/green
git fetch https://github.com/hypenosys/hypenosys.github.io 1bfd62aaf1f98b0a966f258f9d8a0834e1b0bd5f:refs/heads/rw/live/hyp/break

npm run attest -- prove --app . --config-dir examples/realworld/hypenosys-lightbox \
  --base rw/live/hyp/red --pr rw/live/hyp/green --break rw/live/hyp/break
```

The app gets no API keys and no GitHub token. The repo is about 12 MB.
