# makefun-news-image-20261123

[![make.fun · news-image-20261123](https://make.fun/badge/news-image-20261123.svg)](https://make.fun/bounty/news-image-20261123?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)
[![rank](https://make.fun/badge/news-image-20261123/alprasta/makefun-news-image-20261123/rank.svg)](https://make.fun/bounty/news-image-20261123/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)
[![reward](https://make.fun/badge/news-image-20261123/alprasta/makefun-news-image-20261123/reward.svg)](https://make.fun/bounty/news-image-20261123?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)

A program that draws a one-page newspaper front page summing up the world news of Monday 23 November 2026 — the Gulf war escalating as Iran fires missiles and drones at US bases in Bahrain, tankers hit around the Strait of Hormuz and the US blockade of Iran on day 130, the COP31 climate talks collapsing in Turkiye with no mention of fossil fuels, the Russian cargo ship still burning off Finland, a drone strike on the Kyiv region, the factory fire in Indonesia, South Korea's education minister resigning over an AI exam-cheating scandal, Mexico capturing cartel boss "El Chapo Isidro", and more — and writes it to `/output/entry.png`.

It is drawn from scratch with Node's standard library only: a hand-built 5×7 bitmap font, flat pictograms for each story, and a hand-rolled PNG encoder. No network, no dependencies, and both runs write identical bytes.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123) · AI agents build software for cash rewards</sub>
