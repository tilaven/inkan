---
title: "Enlarge images and diagrams"
description: "Images and Mermaid diagrams in a record open in a full-screen viewer with zoom and pan, so a wide diagram can be read in detail."
status: implemented
date: 2026-11-10
authors: [tilaven]
deciders: [tilaven]
tags: [site, markdown, accessibility]
related: [authoring/adr/0007-github-flavoured-markdown-with-diagrams-and-math, theming/adr/0001-overprint-design]
---

## Context

A record is read in a column about 760 pixels wide. A Mermaid diagram with a dozen boxes in a row is scaled down to fit it, and its labels shrink until nobody can read them. Screenshots and architecture drawings have the same problem. Browser zoom enlarges the whole page and still keeps the diagram inside the column, and on a phone a pinch moves the page instead of the picture.

## Decision

Every image and Mermaid diagram in Markdown can be opened in a full-screen viewer. Clicking it, or the enlarge button in its corner, opens the viewer with the picture fitted to the screen. Photos are never shown larger than their own pixels at first; diagrams and SVG images may grow up to twice their size. From there it zooms up to eight times its own size and pans in any direction.

| Action | Mouse or touch | Keyboard |
| --- | --- | --- |
| Zoom in or out | Wheel, pinch, or the `+` and `−` buttons | `+` and `−` |
| Zoom in on a point | Double-click it. Double-click again to fit. | |
| Fit to the screen | The fit button | `0` |
| Move | Drag, or click a point to bring it to the centre | Arrow keys, with `Shift` for bigger steps |
| Close | The close button | `Esc` |

The viewer is a modal dialog: focus moves into it, stays inside while it is open, and goes back to the enlarge button when it closes. The enlarge button is named after the image's alt text ("Image" when there is none), or for diagrams after their `accTitle`, falling back to "Diagram 1", "Diagram 2". The zoom level is announced after each button or key press, not on every wheel step. Every movement has a single-click way to do it, so nobody has to drag. A diagram is moved into the viewer rather than copied, so its styles keep working and its colours follow the Day and Stage themes.

Images inside a link stay links. Images narrower than 48 pixels, such as badges and icons, and images that fail to load get no button. Printed pages leave the buttons out.

## How to use it

Nothing to configure. Write images and diagrams as usual and they can be enlarged:

```mermaid
flowchart LR
  Client["Web and mobile<br/>clients"] --> Edge["Edge<br/>auth proxy"] --> Gateway["API<br/>gateway"]
  Gateway --> Orders["Orders<br/>service"] --> Payments["Payments<br/>service"] --> PSP["Payment<br/>provider"]
  Payments --> Ledger["Ledger<br/>service"] --> Kafka["Kafka<br/>event bus"]
  Kafka --> Settlement["Settlement<br/>consumer"] --> Warehouse["Data<br/>warehouse"] --> Reports["Finance<br/>reports"]
  Kafka --> Notify["Notifications<br/>consumer"] --> Email["Email and<br/>push"]
```

![Anatomy of a record: front matter on top, Markdown body below](../../authoring/adr/_images/record-anatomy.svg)

Give every image a meaningful alt text: it names the enlarge button and the viewer, and it is what screen readers read out.

## Consequences

- Wide diagrams no longer have to be split up or redrawn vertically to stay readable.
- The viewer is one component with no new dependency. Every page carries its markup, and its script does nothing on pages without an image or a diagram.
- The viewer follows the OVERPRINT look: the picture sits on a dotted paper stage with the hard ink shadow used by cards and the search palette.
