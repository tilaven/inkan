---
title: "Adopt React Native for the new app"
description: "Considered and rejected. We stay native on both platforms."
status: rejected
date: 2026-02-17
authors: [lena]
deciders: [lena]
tags: [frameworks, mobile]
---
> [!NOTE]
> Considered and rejected. We stay native on both platforms.

## Options
| Option | Release speed | Platform feel | Verdict |
|---|---|---|---|
| React Native | Faster | Good | Rejected |
| Native iOS and Android | Slower | Best | Chosen |

## Decision
We stay native. The two apps share a design-token source and a typed analytics layer.

## Consequences
- [x] Shared design tokens
- [ ] Revisit when the app doubles in size
