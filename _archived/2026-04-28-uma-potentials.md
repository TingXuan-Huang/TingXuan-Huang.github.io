---
layout: post
title: "Notes on running UMA potentials in LAMMPS"
date: 2026-04-28
category: note
excerpt: "A short walkthrough of getting Meta's UMA potential running in LAMMPS for a small water box — what worked, what didn't, and the smallest viable input deck."
---

I spent most of last week getting Meta's [UMA](https://github.com/facebookresearch/fairchem) (Universal Models for Atoms) potential to run inside LAMMPS for a small bulk-water benchmark. The interface is younger than ASE's, and there are a few sharp edges that aren't yet in the docs. These are the notes I wish I'd had on Monday.

## What you actually need

UMA isn't a classical force field — it's a graph neural network, served from Python. To use it from LAMMPS you need:

1. A LAMMPS build with the `ML-IAP` package (or the newer Python `pair_style`).
2. The UMA model weights downloaded locally.
3. A small Python shim that LAMMPS calls into for each force evaluation.

The friction is almost entirely in step 1. If your LAMMPS was built without `ML-IAP`, you'll get a confusing `Unknown pair style` error and waste an afternoon.

## The smallest viable input deck

Here's the LAMMPS input I ended up with for a 64-molecule water box. It's deliberately stripped down — no thermostats, no fancy output — just enough to confirm that forces are being computed.

```lammps
# bulk-water-uma.in
units           metal
atom_style      atomic
boundary        p p p

read_data       water64.data

pair_style      python uma_pair.UMAPair
pair_coeff      * * uma-small-2025 O H

timestep        0.0005          # 0.5 fs in metal units
fix             1 all nve

thermo_style    custom step temp pe ke etotal press
thermo          10

run             100
```

A few things that bit me:

- **Unit system.** I started in `real` and got nonsense forces. UMA's training data is in eV / Å, which lines up with LAMMPS `metal` units. Switching fixed it.
- **Atom type ordering.** The `pair_coeff` line is positional. If your data file has H before O, you need `H O`, not `O H`. The model does not warn you.
- **Cutoff radius.** UMA has an implicit cutoff baked into the graph construction. If your simulation box is smaller than 2× the cutoff, you'll get duplicated neighbors and the energies will look wrong but not error out.

## What I'd do differently

Honestly: I'd skip LAMMPS for the initial sanity check and run a 10-step trajectory in ASE first. ASE's UMA calculator is much better-trodden, and once you've confirmed that forces look reasonable there, the LAMMPS wiring is mechanical.

The thing I keep relearning is that the right debugging interface for a new model is the simplest one that exposes the forces. LAMMPS is *not* that interface.
