---
layout: post
title: "Sample — Shannon entropy in three lines of intuition"
date: 2026-05-24
category: learning
excerpt: "How information theory's central quantity actually measures the surprise of an outcome, with the smallest example that makes it click."
---

_(Sample post for the `learning` category — delete or rewrite freely.)_

Shannon entropy is the expected log-surprise of a random variable. If a coin is fair, every flip carries one bit of surprise. If the coin is biased to land heads 99% of the time, almost every flip carries roughly nothing — you already knew it would land heads.

The clean way to write it is `H(X) = -Σ p(x) log p(x)`. The only thing worth working through carefully is *why* the formula is `-p log p` and not something else. Once you've sat with the derivation — that the log is the unique function turning "independent events" into "additive surprise," and the minus sign just makes the answer positive — the formula stops feeling arbitrary.

That's the whole intuition. The rest of information theory is what falls out when you take this seriously.
