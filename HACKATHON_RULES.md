# Meta Global AI Developer Hackathon — Rule Book

> Context file for Claude Code. Drop it in the project root and reference it from `CLAUDE.md` with `@HACKATHON_RULES.md`.
> Compiled Oct 29, 2026 from the public event page and the Official Rules & Event Waiver. The Official Rules govern if anything differs.

## Instructions for Claude Code

When working in this repository, treat the rules below as hard project constraints:

- **Deadline:** everything must be demo-ready and submitted by **Nov 4, 2026, 9:00 PM ET (Nov 5, 7:30 AM IST)**. Favor shipping a working end-to-end demo over polish when time is short.
- **Meta models are required.** The core functionality must use Meta AI tooling (Muse Spark series, Muse Wonder, Muse Image, SAM 3 / 3.1, Glimmer, Meta open-weights models, Muse Code). Do not swap in other providers' models for core features. Creative, beyond-basic use is 25% of the score.
- **Original work only.** Write original code. Do not copy proprietary or license-incompatible code. Open-source dependencies are fine if their licenses are respected; keep a record of them (e.g. in the README).
- **No secrets or confidential material** in the repo or submission — anything shared is non-confidential and licensed to the Organizers. Keep API keys in env vars / `.env` (gitignored).
- **Budget:** Meta Model API credits are $150 and expire after the 10-day window. Avoid wasteful API calls in loops, tests and retries; cache where sensible.
- **Optimize for the judging rubric:** Impact 30% · Use of Meta AI tooling 25% · Demo 25% · Technical depth & execution 20%.
- **The demo must work live** and be recordable as a high-quality demo video.

## At a glance

| Item | Rule |
| --- | --- |
| Hosts | Meta & Cerebral Valley |
| Format | Virtual only, worldwide, free for selected applicants |
| Build window | 10 days: Oct 26 – Nov 4, 2026 |
| Prize pool | $1,000,000 USD (cash) |
| Tracks | Indie Developer or Startup — one track per participant and per project |
| Team size | Indie track: solo or teams of up to 4. Startup track: founding team with one authorized Representative |
| Minimum age | 18, and the age of majority where you live |
| Credits | $150 Meta Model API credits (10-day validity), plus partner credits for select participants |
| Where to submit | [Cerebral Valley submission portal](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit) |
| Judging weights | Impact 30% · Use of Meta AI tooling 25% · Demo 25% · Technical depth 20% |
| Final say | Judges' and Organizers' decisions are final and binding |

## Key dates and deadlines

All times are US Eastern as published. Dates may change at Meta's sole discretion; changes are posted on the event page.

| Date (2026) | Milestone | Status |
| --- | --- | --- |
| Oct 13, 9:00 AM ET | Applications open (rolling review) | Done |
| Oct 25, 11:59 PM ET | Application deadline (or earlier if 20,000 spots fill) | Done |
| Oct 26, 9:00 AM ET | Acceptance notices sent by this time | Done |
| Oct 26 | Kickoff livestream; hackathon begins | Done |
| Oct 27 – Nov 4 | Live workshops from Meta and partners; office hours on Discord | Ongoing |
| Nov 4, 9:00 PM ET | **Project submissions due** (Nov 5, 7:30 AM IST) | Upcoming |
| Nov 4 – Nov 8 | Judging | Upcoming |
| Nov 9 | Closing ceremony: live finals, winners announced | Upcoming |
| ~Nov 10 | Bonus prizes (incl. any public-vote prize) announced | Upcoming |

## Eligibility

Only accepted applicants may take part. Every participant (and every team Representative) must meet all of these:

- **Age:** at least 18 and the age of majority in your country of residence.
- **Location:** open worldwide except where local law bars participation or receiving a prize. Void where prohibited.
- **Sanctions:** not eligible if you are a target of US, EU, UN or UK sanctions or export controls, act for such a person, or are organized or located in Belarus, China, Russia, Ukraine, Syria, or a comprehensively sanctioned region (Crimea, Donetsk, Luhansk, Cuba, North Korea, Iran).
- **Conflicts:** employees, contractors and interns of Meta or Cerebral Valley, government-affiliated individuals, their immediate families and household members are not eligible.
- **Honest application:** duplicate applications, false identity details or spam can lead to disqualification.
- **Cap:** at most 20,000 accepted participants.

Eligibility is re-verified before any prize is paid.

## Tracks, teams and themes

Each participant applies to one track, and each project is entered in one track only.

| | Indie Developer track | Startup track |
| --- | --- | --- |
| Who | Individual builders and students | Technical founders and teams building a real product |
| Team size | Solo, or a team of up to 4 | Startup team (no stated cap) |
| Representative | One team member submits and lists all other members | Must be an active employee of the startup, authorized to receive notices and prize payment |
| Event-page emphasis | Creativity, technical ambition, and whether it works | Technical execution, and whether it holds up in production |
| Prize pool | $400,000 | $550,000 |

**Representative:** every team appoints one Representative who submits the project, must meet all eligibility rules, and confirms every member has accepted the Official Rules.

**Themes** (fit counts toward Impact):

1. **Build for Your World** — bring Meta's models into a domain you know firsthand: solve a real problem, save people time or mental effort, or make something newly possible.
2. **Push the Frontier** — apply the models to software, robotics, manufacturing, energy, materials and other physical-world problems: new machine capabilities, faster experiments, or better understanding and control of physical systems.

## Tools, models and credits

- **Meta Model API:** Muse Spark series, Muse Wonder, Muse Image, SAM 3.1.
- **Meta open-weights models**, self-hosted or via inference partners.
- **Muse Code** coding agent.
- The Official Rules also name **Glimmer** and **SAM 3**, plus any other Meta AI product identified on the event page.

| Credit | Amount | Who gets it |
| --- | --- | --- |
| Meta Model API | $150, valid for the 10-day window | Every selected participant (review the Credit Terms before claiming) |
| [Baseten](https://www.baseten.co/) | $100 + 2M tokens/min rate limit | Select participants, for Meta open-weights models |
| [Modal](https://modal.com/) | $100 | Select participants: open-weights models via Endpoints, plus serverless GPUs, sandboxes, LLM training tools |
| [Fireworks](https://fireworks.ai/) | $100 + workshop | Select participants, for Meta open-weights models |

Open question: the event page lists SAM 3.1 and Muse Wonder/Image; the Official Rules list SAM 3 and Glimmer. Both appear allowed — confirm on Discord if the project depends on one.

## Submission requirements

Submit via the [Cerebral Valley portal](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit) by **Nov 4, 9:00 PM ET**.

- **Who submits:** the solo participant, or the team/startup Representative. Indie teams must name every member.
- **One track** per project.
- **Demo video:** scored under Demo, along with whether the product works live.
- **Original work:** your own work, solely owned by you/your team, not infringing anyone's IP, contract or privacy rights.
- **Outside help:** third-party technical help is allowed if the components remain your own work and you own all rights.
- **Open source:** allowed if licenses are followed and the project builds meaningfully on top of it.

Open question: exact submission form fields (repo link, video length, description) are behind the Cerebral Valley login — check the portal early.

## Judging criteria

| Criterion | Weight | What judges look for |
| --- | --- | --- |
| Impact | 30% | Real-world potential, who benefits and how much, whether people would actually use it, fit with a project theme |
| Use of Meta AI tooling | 25% | Creative use beyond a basic integration; surfacing unexpected model capabilities |
| Demo | 25% | A working, impressive demo that holds up live, and a high-quality demo video |
| Technical depth & execution | 20% | Sound, refined engineering that shows real craft |

Track lens: Indie — creativity, ambition, does it work. Startup — execution and production-readiness.

## Prizes

Total pool $1,000,000 USD: $400,000 Indie, $550,000 Startup, up to $50,000 bonus.

| Place | Indie Developer track | Startup track |
| --- | --- | --- |
| 1st | $150,000 | $250,000 |
| 2nd | $100,000 | $150,000 |
| 3rd | $75,000 | $75,000 |
| 4th | $50,000 | $50,000 |
| 5th | $25,000 | $25,000 |
| **Track total** | **$400,000** | **$550,000** |

Bonus prizes (e.g. community vote, most viral project) are set by the Organizers, announced around Nov 10, and do not reduce track prizes.

## Payout, taxes and verification

- Paid in USD within 30 days of verification via Cerebral Valley's payout provider (currently Tremendous, bank payout).
- Requires signed waiver/Official Rules and a W-9 (US) or W-8BEN (non-US).
- Team Representative states in writing whether the prize goes to them or is split; Organizers don't arbitrate splits.
- Winners pay wiring/FX fees and all applicable taxes.

## IP, licenses and publicity

- You keep ownership of your submission.
- Organizers get a perpetual, irrevocable, worldwide, royalty-free, non-exclusive license to use, modify and publish it, including for marketing.
- Nothing shared during the event is confidential — don't include trade secrets.
- Sessions may be recorded; your name, likeness, chats, screen shares and submissions may be used in any media.

## Code of conduct and disqualification

Be professional, respectful and inclusive in all event spaces. Grounds for removal include harassment or abusive behavior, failing eligibility, duplicate/false applications or spam, non-original or infringing submissions, and participation prohibited by law or the Official Rules.

## Legal summary

Binding contract; release of liability and indemnity in favor of Meta, Cerebral Valley and partners; California law, San Francisco courts; Organizers may modify terms or cancel the event.

## Submission checklist

- [ ] Track confirmed (Indie or Startup), project entered in only that one
- [ ] Project clearly fits "Build for Your World" or "Push the Frontier"
- [ ] Meta models used meaningfully, beyond a basic integration
- [ ] Working demo that holds up live
- [ ] Polished demo video recorded
- [ ] All code original; open-source licenses respected and listed
- [ ] No secrets, keys or confidential material in the repo
- [ ] Representative named; all team members listed and have accepted the Official Rules
- [ ] Submitted on the portal before Nov 4, 9:00 PM ET (Nov 5, 7:30 AM IST)
- [ ] If you win: W-9 or W-8BEN ready, team prize split agreed in writing

## Sources

- [Event page](https://cerebralvalley.ai/e/meta-ai-developer-hackathon)
- [Official Rules and Event Waiver](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver)
- [Submission portal](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit)

_Summary for convenience, not legal advice._
