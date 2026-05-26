---
layout: post
title: "Sample — kicking off the UMA water benchmark"
date: 2026-05-25
category: research
excerpt: "First entry in what I hope is a running log of the bulk-water UMA benchmarking project, with the actual question I'm trying to answer."
---

_(Sample post for the `research` category — delete or rewrite freely.)_

The question, stripped down: do graph neural network potentials like Meta's UMA give physically reasonable bulk-water properties (density, RDF, diffusion coefficient) at the scale where classical force fields are usually "good enough"?

Two things make this interesting. First, the cost: UMA is roughly 100× slower per step than TIP4P. If it's not noticeably more accurate at the same statistical mechanics, that's hard to justify. Second, the structure of failures: classical force fields fail in predictable ways; neural potentials fail in *weirder* ways. I want a paper-trail of what those failures look like for a tractable system before trying anything more interesting.

I'll log progress here as I go. First milestone: equilibrated 64-molecule box, NPT at 298K, with both potentials. Already saw one surprise — writing that up next.
