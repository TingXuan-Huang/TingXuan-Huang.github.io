---
layout: post
title: "Building an LLM from scratch"
date: 2026-05-26
category: learning
topic: "llm"
excerpt: "Notes from building a small language model from the ground up — for myself, and (hopefully) for anyone else trying to do the same."
---

This is the first entry in a running set of notes on building a language model from scratch — tokenizer, attention, training loop, the whole stack — and writing down what I learn at each step.

## Why I Started Rebuilding Modern Language Models

Modern language models are evolving extremely quickly. Every few months, new open-source models appear with different attention mechanisms, routing strategies, kernels, training tricks, context extensions, or inference optimizations. Yet the overall transformer-based architecture has remained surprisingly stable. Most progress is not a complete paradigm shift, but careful engineering layered onto a shared foundation.

That observation became the motivation for this project.

I wanted to better understand the modern LLM landscape: what each model contributes, why certain design choices exist, and how frontier systems evolve from one another. Instead of only reading papers or running existing repositories, I decided to build a long-term learning project centered around reconstructing these systems myself.

One problem I immediately encountered when studying modern LLM repositories is that they are often difficult to read as learning resources. There are several reasons for this:

1. It is hard to understand an entire large-scale codebase at once.
2. Many repositories contain huge amounts of infrastructure, launch scripts, distributed-training wrappers, configuration systems, and experiment code that obscure the actual model implementation.
3. Important ideas are frequently buried across multiple files with little explanation of why the design exists.

As a result, even strong repositories can feel overwhelming for learners.

This project has two goals. First, it is a structured way for me to improve my engineering and coding ability. I want to implement the components directly: tokenizers, attention variants, RoPE extensions, MoE routing, distributed training utilities, inference systems, and more.

Second, I hope it becomes a useful survey and reference for others. My plan is to build a cleaner learning-oriented library called lmlib, where each subsystem is clearly separated and written in a more functional style. Each module will connect back to real frontier implementations with exact references and notes explaining why the design matters.

There is also a personal reason behind the project. In the age of AI coding tools, it is increasingly easy to let AI write most of your code. That is useful, but it can also weaken the slow engineering practice needed to design large systems yourself. Writing a language-model library from scratch is my way of deliberately practicing software architecture, coding discipline, and large-scale ML project organization.
