---
title: "Run CI on Jenkins"
description: "Jenkins stays until the migration finishes. Do not start new pipelines on it."
status: deprecated
date: 2024-02-08
authors: [sam]
deciders: [sam]
tags: [ci, tooling]
---
> [!WARNING]
> Deprecated. Do not start new pipelines on Jenkins. Existing ones keep running until the migration to GitHub Actions finishes.

## Context
We needed shared CI in 2024 and Jenkins was already running.

## Decision
Run CI on Jenkins until the migration finishes.
