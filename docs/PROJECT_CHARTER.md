# Project Charter — Judgment Research Platform

## Purpose

A private legal judgment research and knowledge-management platform serving the
eight legal portals in this monorepo (MyLitAI, MyLitAI IRAC, MySyalitAI,
MyCorpLegalAI, MyConveyLitAI, MyCrimAI, MyCCBLitAI, MyAccidentAI).

The platform ingests folders and ZIP archives containing hundreds of document
files and turns them, through controlled and reviewable processing, into a
research corpus of legal judgments.

## Foundational Data Principle

> **A SOURCE FILE IS A CONTAINER. IT IS NOT AUTOMATICALLY A CASE.**

A single file may contain:

- no judgment;
- one judgment;
- several judgments (thirty or more is normal);
- duplicate judgments;
- incomplete judgments;
- multiple versions of a judgment;
- scanned pages;
- editorial material;
- administrative pages;
- one judgment split across several files.

A case may therefore originate from:

- one complete source span;
- multiple spans in one file;
- spans across multiple files;
- multiple alternative source versions.

## Core Commitments

1. **Provenance** — every extracted character, paragraph, case candidate,
   metadata field, quotation, and AI proposition must be traceable to its
   source container, byte/character range, and processing history.
2. **Uncertainty is preserved** — uncertain processing results are routed to
   human review. The system never replaces uncertainty with guessed content.
3. **Judicial-text integrity** — judicial text is preserved faithfully. Any
   correction, normalisation, exclusion, merge, or split is recorded as a
   reviewable transformation.
4. **Publisher-content isolation** — suspected publisher-created editorial
   material is isolated from verified judicial text, search indexes,
   embeddings, summaries, AI prompts, classifications, and citation analysis.
5. **Rights gating** — all source files begin as `UNREVIEWED`. Access and
   processing depend on the applicable rights status (see
   `RIGHTS_MODEL.md`).
6. **AI is a separate research aid** — AI output is never mixed into the
   corpus. Every substantive AI proposition requires paragraph-level
   supporting evidence.

## Delivery Model

The project is delivered in strictly ordered phases (see `PHASES.md`). Each
phase is implemented in isolation, ends with a completion report in
`docs/reports/`, and updates `docs/status/current-phase.json`. Work on a
subsequent phase must not begin until the active phase is closed out.
