# Demo Script

> **Audience:** team · **Status:** ready to record · **Last updated:** 2026-11-01 · **Related:** [PITCH](PITCH.md) · [BENCHMARK](BENCHMARK.md) · [HACKATHON_RULES](../HACKATHON_RULES.md)

The 3-minute submission video. Every claim in it comes from a real run in this repo; anything sped up says so on screen.

**Hard rules for the video (from the official rules and Discord):** 3 minutes maximum. Open by stating it was built entirely during the event. Show only what was built during the event.

## The story in one line

An AI agent's fix passes its own tests, but a real user still can't pay. Attest catches it, shows exactly why, proves the real fix, and seals a receipt anyone can check — and tampering with that receipt fails on camera.

## Before you record

### Setup

- Screen at **1920×1080**, Windows scaling 100–125%. Terminal font **18 pt+**, dark theme, window ~1100 px wide.
- Close notifications (Windows Focus Assist on), and close Discord, email and anything with personal data.
- Recorder: OBS Studio or the Xbox Game Bar (`Win+Alt+R`). Record the screen and voice separately if you can; voiceover is easier to redo than screen capture.
- Work in `C:\dev\attest`. Run `git pull` first.

### Pre-record the slow parts (do these first)

Live runs take minutes. Record them in advance, then speed them up in editing with an on-screen **"sped up ×N"** caption.

```bash
# A. Full proof with a visible browser, so viewers see the verifier clicking
$env:ATTEST_HEADLESS = "0"
npm run attest -- prove --app examples/checkout-widget --base demo2/base --pr demo2/fix --break demo2/bad-fix
```

```bash
# B. The closed loop: Muse Code writes the fix, Attest proves it (optional, see 1:00)
$env:ATTEST_HEADLESS = "0"
npm run attest -- loop --app examples/checkout-widget --base demo2/base --break demo2/bad-fix --report "On the cart page I click the Pay button and nothing happens. I can't pay."
```

Note the `evidence/run-<id>` folder each prints. Open its `index.html` in Chrome or Edge and keep the tab ready.

### Prepare the tamper shot (2:05)

```bash
# Make a copy of the run to tamper with, so the real evidence stays intact
Copy-Item evidence\run-<id> evidence\tamper-demo -Recurse
```

Open `evidence\tamper-demo\receipt.json` in VS Code or Notepad, ready to edit.

## Shot list and voiceover

About 420 words at a calm pace. Times are targets; trim the voiceover, not the evidence.

| Time | On screen | Voiceover |
|---|---|---|
| **0:00–0:08** | Title card: **Attest — proof-of-fix for AI pull requests.** Small text: *Built entirely during the Meta Global AI Developer Hackathon, Oct 26 – Nov 4.* | "Attest. Built entirely during this hackathon." |
| **0:08–0:28** | Terminal on `demo2/bad-fix`: `cd examples/checkout-widget; npm test` → **2 tests pass**. Then the shop in a browser: click **Pay**. Nothing happens. | "Here's a fix an AI agent might write for a checkout bug. Its unit tests pass. Two out of two. But when a real customer clicks Pay… nothing happens. Green tests aren't proof. And AI agents are now writing pull requests faster than anyone can review them." |
| **0:28–0:45** | Split: the one-line criterion (`criteria.yml`: *given a cart, when the user clicks Pay, then the order confirmation shows an order number*), then the command `npm run attest -- prove …` | "Attest asks for proof instead. A person approves one plain-language requirement. Then Attest runs three experiments on the real, running app." |
| **0:45–1:25** | Pre-recorded run **A**, sped up (caption **"sped up ×6"**). The visible browser window: the verifier clicks Pay on base → nothing; on the fix → *Order #1042*; on the wrong fix → nothing. Terminal lines `red: fail`, `green: pass`, `break: fail`, then **`verdict: PROVEN`**. | "Red: on the original code, the bug must reproduce. Green: on the fix, it must work. Break: on a wrong fix, Attest must say no — otherwise its 'yes' means nothing. The clicking is Muse Spark 1.3, Meta's computer-use model, driving a real browser. And it's blind: it never sees the code, so the code can't talk it into passing." |
| **1:25–1:55** | The evidence page: zoom on the **PROVEN** stamp, then the Red card's **four vote tiles**, then the **SAM reveal image**: green box *"Pay button · SAM 3.1"*, red dashed box *"click landed on div#hb-root"*. | "Four independent votes per phase: the verifier, plain code checks, SAM 3.1, and a separate Muse Wonder judge. Disagreement is never a pass. And here's *why* it failed: SAM finds the Pay button on screen — but the click actually landed on an invisible box from a third-party chat widget. That's a bug no unit test was looking for." |
| **1:55–2:05** | (Optional) Pre-recorded run **B**, sped up: `attest loop` → *"Muse Code is writing a fix"* → **PROVEN**. | "It closes the loop too: Muse Code writes the fix from the customer's words, and Attest proves it." |
| **2:05–2:30** | `npm run attest -- verify evidence\tamper-demo\receipt.json` → five green ✔. In the editor, change one phase's `"result": "fail"` to `"pass"`; save. Run verify again → **✘ signature, ✘ verdict — receipt INVALID.** | "Everything is sealed in a signed receipt: screenshots, votes, a hash-chained log. Anyone can check it — no AI needed. Now let's fake a result… One edit. Invalid. You can't quietly change what happened." |
| **2:30–2:48** | Benchmark card (from [BENCHMARK](BENCHMARK.md)): **10 / 10 wrong fixes passed their own tests · 8 / 10 PROVEN · 0 wrong fixes certified · 0 real fixes rejected.** | "We built ten planted bugs, each with a wrong fix whose tests pass. Attest proved eight of the real fixes, never certified a wrong one, and never rejected a real one. When the evidence wasn't there, it said 'inconclusive' instead of guessing." |
| **2:48–3:00** | End card: logos/names of **Muse Spark 1.3 · SAM 3.1 · Muse Wonder · Muse Code**, the repo URL, and *"Run it without an API key: `--replay`"*. | "Built on Meta's models. Try it yourself — even without an API key. Attest: don't trust the agent. Check the receipt." |

## Editing checklist

- [ ] Total length **≤ 3:00**.
- [ ] The first line says it was built during the event.
- [ ] Every sped-up clip has a caption saying so.
- [ ] Numbers on screen match [BENCHMARK](BENCHMARK.md) exactly.
- [ ] No API keys, `.env`, email, Discord or personal data visible anywhere (check terminal history and browser tabs).
- [ ] Subtitles burned in or uploaded (many judges watch muted).
- [ ] Export 1080p MP4; upload unlisted to YouTube or Vimeo; check the link works in a private window.

## If something breaks while recording

- **Meta API errors (HTTP 500/503):** Attest will say INCONCLUSIVE — that's honest, but not the shot you want. Re-run later, or record run A in replay mode instead and say so: add `--replay examples/checkout-widget/cassette.jsonl` and caption it *"replay of a recorded live run."*
- **Verifier takes odd paths:** keep the take if the verdict is right; viewers like seeing it work things out. Re-take if it's confusing.
- **Never** edit evidence files except the tamper copy.

## Things to avoid saying

- Don't claim Muse Code fails first; in our runs it fixed both demo bugs on the first try. The wrong fix shown is one **we** wrote to test Attest — say "a fix an AI agent *might* write".
- Don't claim "can't be faked" — say "you can't quietly change what happened" (the receipt proves nothing changed after capture).
- Don't quote a cost per proof until it's confirmed on the billing page.

## Post for "Most Viral" (optional, through Nov 8)

> AI agents write fixes whose tests pass and the app is still broken.
> We built Attest at the @AIatMeta hackathon: it reproduces the bug, proves the fix in the running app, catches the wrong fix — and seals it in a receipt anyone can check. Watch me try to fake one. 👇
> [video] · [repo]

Attach a 30–45 second cut: the "tests pass, Pay does nothing" moment → the SAM reveal → the tamper failing.
