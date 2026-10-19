---
title: "Generated record covers"
description: "Every record gets a risograph-style cover drawn at build time from its id, in an ink and motif that no other project shares, with plugin motifs of your own."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [theming, content, config, plugins]
related: [theming/adr/0001-overprint-design, theming/adr/0003-theme-with-inkan-css-tokens, authoring/adr/0001-one-folder-per-project, extending/adr/0001-plugins-with-defineplugin]
---

## Context

A photocard needs art on its front, and an archive of hundreds of records cannot have an illustration made for each. Stock images and generated pictures would weigh down the site, break the flat ink look and need an API or a licence. The art had to be free, instant, unique per record, stable across builds and recoloured by the same tokens as the rest of the page. Teams also need to tell their cards apart at a glance, and a few of them want a motif of their own.

## Decision

Inkan draws a cover for every record as an inline SVG at build time. The drawing is a pure function of the record's id, so the same file always gets the same print, and of the project's ink and motif, so a team's cards look like a set. Every project is assigned an (ink, motif) pair that no other project has, for as long as pairs remain. The SVG carries ink roles rather than colours and is painted by CSS, which means a cover changes with the theme and with any `--inkan-ink-*` override.

Motifs are functions. Seventy-six are built in: seventeen abstract prints, ten for infrastructure, platform and security teams, ten for product teams, twelve for operations, data and hardware teams, twelve for business teams, seven for finance teams and eight for engineering, product and company functions. Each team motif carries keywords, so a project called `security`, `frontend`, `dbre` or `legal` gets a shield, a browser window, database discs or a pair of scales without any configuration. A plugin can add or replace a motif with `defineMotif` and the `motifs` key, and give it keywords of its own.

## How to use it

### Pin an ink or a motif per project

```yaml title="decisions/payments/_project.yml"
name: "Payments"
description: "Ledger, settlement and everything that moves money."
ink: m
motif: ticker
owners: [jules, noor]
order: 20
```

| Field | Values | When absent |
| --- | --- | --- |
| `ink` | `c` cyan, `m` magenta, `y` yellow, `g` green, `v` violet, `o` orange | Assigned so the (ink, motif) pair is unique |
| `motif` | A built-in name (below) or a motif a plugin registered | A motif whose keywords appear in the project id or name when one is free, otherwise assigned so the (ink, motif) pair is unique |

Both are optional. The ink is the project's colour everywhere (dots, sidebar, avatar rings, card underline); the motif only affects the covers.

An `ink` outside the six letters fails the build in the `_project.yml` schema. A `motif` that nobody registered fails the build too, naming the file and the available motifs:

```text
inkan: project "sre": unknown motif "ring", did you mean "rings"? (available: a11y, arcs, bank, bars, ...)
```

### How pairs are assigned

The allocation runs once per build over every project, including bare folders without a `_project.yml`. Six inks and seventy-six built-in motifs give 456 pairs; plugin motifs add six more each.

1. Projects that pin both `ink` and `motif` are settled first. Two projects pinning the same pair share it.
2. Projects that pin one field get the other chosen from the free pairs. A half pin avoids the motifs and inks another half pin still needs.
3. Projects that pin nothing are allocated in id order. Each project ranks all pairs: pairs whose motif matches a keyword in the project's id or name come first, then the rest, and within each group a stable hash of the id decides. The project takes the first pair that is still free.

Only when every pair is taken do pairs repeat. The ranking is stable across machines, so a build gives the same covers everywhere. Adding an unpinned project does not change the style of any project that comes before it in id order; a project that sorts earlier can move the ones after it. Because pinned projects are reserved before unpinned ones, adding a pin to any `_project.yml` can change the pair of an unpinned project. Pin both fields on the teams whose look must never move.

### How a motif is matched to a team

Every team motif owns a list of keywords (tables below). When a project does not pin a `motif`, the allocation splits its id and its `name` from `_project.yml` into words and looks for a motif that owns one of them:

- Text is split at every character that is not a letter or a digit, and at the lowercase-to-uppercase step inside a word, then lowercased. `payments-core` gives `payments core`; `SecurityTools` gives `security tools`; `ML Platform / v2` gives `ml platform v2`.
- A word matches a keyword exactly or with a trailing `s` on either side, so `payment` finds `payments` and `orders` finds `order`. There is no stemming beyond that: `authentication` does not find `auth`.
- Each built-in keyword belongs to exactly one motif, so a word never points at two built-in motifs. A project whose words hit several motifs (`platform-security` hits `lattice` and `shield`) ranks both equally and the hash of the id decides.
- A match wins only while that motif still has a free ink. Six teams whose names contain `security` get a shield in six inks; the seventh gets the next free pair.
- A pinned `motif` always wins over a keyword match. A project that pins only `ink` still prefers a matching motif for the field it leaves open.
- A project that matches nothing is allocated by the hash alone, as before.

Keywords are matched against the project id (the folder name) and the name, nothing else; a description that says "security" does not count.

### The built-in motifs

Seventeen abstract prints, used by every project that has no keyword match and available to pin:

| Motif | What it draws |
| --- | --- |
| `rings` | Concentric rings around an off-centre point with a halftone fall-off, two hairlines, a wedge in the second ink and a black dot. |
| `ticker` | Horizontal stripes of ink and key black down two thirds of the card, a disc in the second ink with fine rings, a dashed rule. |
| `lattice` | A 7 by 11 grid with some cells filled, crosses at every intersection, and a tilted square plate in the second ink. |
| `discs` | A stack of five flat discs in alternating inks, like platters or coins, between two margin rules. |
| `arcs` | Concentric half-circles growing from the left or right edge in alternating inks, a black pill and a row of dots at the top. |
| `chevrons` | Stacked chevron bands pointing up or down, one in the second ink with a black blip, and a dashed vertical rule. |
| `waves` | A sun in the second ink over a halftone glow, with seven layered wave fronts rolling in below. |
| `sunburst` | Rays from a point near one edge, a disc in the second ink at the centre and a dashed horizon. |
| `bricks` | A brick wall with some bricks filled in either ink or black, a disc in the second ink on top. |
| `bars` | A bar chart standing on a baseline or hanging from it, one bar in the second ink with a black marker, dashed grid lines. |
| `orbit` | A planet in the second ink with a tilted ring passing in front of it, stars and a black moon. |
| `contour` | Seven contour lines around a wobbly centre, filled in alternating inks, and a dashed line to one corner. |
| `checker` | A rotated checkerboard in the main ink, a disc in the second ink with a black satellite. |
| `cubes` | Isometric cubes in a stair or a cluster, faces in the two inks and paper, a dashed ground line. |
| `crescent` | A crescent in the main ink over a halftone glow, a small disc in the second ink, scattered black dots. |
| `dots` | A dot grid that grows towards one corner, one black dot, crossed by a band in the second ink. |
| `triangles` | A triangle mesh with some cells filled in either ink or black, one triangle outlined, a black dot. |

Eight of these abstract prints also own keywords, so data, finance, media and growth teams and the classic infrastructure disciplines land on them:

| Motif | Keywords |
| --- | --- |
| `discs` | `dbre`, `database`, `db`, `storage`, `postgres`, `mysql`, `sql` |
| `rings` | `sre`, `observability`, `monitoring`, `reliability`, `o11y`, `telemetry` |
| `cubes` | `k8s`, `kubernetes`, `containers`, `infrastructure`, `orchestration` |
| `lattice` | `platform`, `infra`, `core`, `foundation` |
| `bars` | `analytics`, `data`, `metrics`, `insights` |
| `chevrons` | `growth`, `experimentation`, `acquisition`, `conversion`, `activation` |
| `ticker` | `finance`, `trading`, `markets`, `treasury`, `brokerage`, `investing` |
| `arcs` | `media`, `content`, `video`, `audio`, `streaming`, `editorial` |

Ten motifs for infrastructure, platform and security teams (`app/src/lib/motifs-infra.ts`):

| Motif | What it draws | Keywords |
| --- | --- | --- |
| `shield` | A heraldic shield in the main ink over a diagonal hatch, half of it in the second ink, with a black dot or a chevron on it and a dashed drop line. | `security`, `sec`, `secops`, `appsec`, `infosec`, `trust`, `compliance`, `privacy` |
| `key` | A tilted key with two or three teeth in the main ink over a halftone glow, a keyhole in the second ink and a dashed axis. | `identity`, `iam`, `auth`, `sso`, `access`, `login`, `accounts`, `oauth` |
| `mesh` | A hub in the second ink with six or eight nodes around it, spokes, a ring (solid or dashed) and a few black packets on the way. | `network`, `networking`, `edge`, `cdn`, `mesh`, `dns`, `vpc`, `connectivity` |
| `cloud` | A cloud in the main ink under a sun in the second ink, with dashed rain or a black lightning bolt below. | `cloud`, `aws`, `gcp`, `azure`, `hosting`, `cloudops`, `finops` |
| `pipeline` | A pipe in the main ink with a step in it, flow arrows, black flanges and a vertical bypass pipe in the second ink. | `ci`, `cd`, `cicd`, `devops`, `pipeline`, `release`, `delivery`, `build` |
| `gear` | A big gear with eight or twelve teeth in the main ink meshing with a small one in the second ink, three spokes, a dashed axis. | `devex`, `tooling`, `tools`, `internal`, `productivity`, `automation`, `enablement` |
| `rack` | A server rack of five or seven units with rails and screws, LEDs on one side and vents on the other, one unit in the second ink and one in black. | `backend`, `servers`, `compute`, `hardware`, `datacenter`, `baremetal`, `services` |
| `queue` | Three lanes of boxes on rails with black arrowheads at the end, one box black and one slot empty, and a large disc in the second ink at one edge. | `messaging`, `events`, `kafka`, `async`, `queue`, `pubsub`, `eventing` |
| `lens` | A magnifying glass in the main ink over lines of black text; the glass enlarges the text and highlights one line. | `search`, `discovery`, `relevance`, `indexing`, `ranking`, `browse`, `seo`, `sem` |
| `terminal` | A terminal window in the main ink with a drop shadow in the second ink, a black title bar, a prompt chevron, a cursor and lines of output. | `cli`, `ops`, `terminal`, `shell`, `console`, `scripts`, `oncall`, `runbooks` |

Ten motifs for product teams (`app/src/lib/motifs-product.ts`):

| Motif | What it draws | Keywords |
| --- | --- | --- |
| `browser` | A browser window in the main ink with a black title bar, a hero block in the second ink, columns of text lines and an optional sidebar. | `frontend`, `web`, `ui`, `webapp`, `website`, `fe` |
| `phone` | A tilted phone with a black bezel, a grid of app tiles in paper and one large tile in the second ink. | `mobile`, `ios`, `android`, `app`, `apps`, `native` |
| `neural` | Three or four layers of nodes fully connected by hairlines, one active path in the main ink, hot nodes in black. | `ml`, `ai`, `ds`, `datascience`, `science`, `llm`, `models`, `research`, `machine` |
| `card` | A payment card in the main ink with a chip, embossed digits and a two-circle logo, over a second card in the second ink. | `payments`, `billing`, `fintech`, `checkout`, `subscriptions`, `wallet`, `card`, `acquiring`, `issuing` |
| `cart` | A shopping cart in the main ink, solid or wire, with goods in the second ink above the basket and black wheels. | `commerce`, `ecommerce`, `shop`, `store`, `catalog`, `orders`, `marketplace` |
| `pen` | A nib in the main ink drawing a bezier curve, with its control handles and anchor points shown as in a vector editor. | `design`, `ux`, `brand`, `creative`, `illustration`, `visual` |
| `flask` | A laboratory flask filled to one of two levels with liquid in the main ink, bubbles in the second ink and black vapour. | `qa`, `testing`, `test`, `lab`, `labs`, `quality`, `experiments` |
| `globe` | A tilted globe in the main ink with a graticule, a continent in the second ink and a black pin. | `i18n`, `l10n`, `localization`, `international`, `geo`, `maps`, `global` |
| `bell` | A swinging bell in the main ink with two or three sound arcs on each side and a badge in the second ink. | `notifications`, `notify`, `comms`, `alerts`, `push`, `email`, `deliverability` |
| `chat` | Two speech bubbles, one in the main ink with typing dots and one in the second ink with lines of text. | `support`, `cx`, `customer`, `success`, `helpdesk`, `community` |

Twelve motifs for operations, data and hardware teams (`app/src/lib/motifs-ops.ts`):

| Motif | What it draws | Keywords |
| --- | --- | --- |
| `gauge` | A speedometer dial in the main ink with tick marks, a black needle and a red-line sector in the second ink. | `performance`, `perf`, `latency`, `capacity`, `speed`, `scaling` |
| `siren` | A beacon lamp in the main ink on a black base, with light rays around it. | `incident`, `incidents`, `response`, `escalation`, `outage`, `emergency` |
| `lifebuoy` | A life ring striped in the main ink and paper, floating on waves in the second ink. | `dr`, `backup`, `recovery`, `resilience`, `continuity`, `bcp` |
| `funnel` | A funnel in the main ink with blocks of data in the second ink and black drops falling in, and a stream leaving the spout. | `etl`, `ingestion`, `dataeng`, `elt`, `transform`, `dataops` |
| `lake` | A sun over mountains reflected in a rippled lake, the water in the main ink. | `lakehouse`, `warehouse`, `lake`, `dwh`, `datalake`, `snowflake` |
| `chip` | A microchip in the main ink with black pins on every side and a die in the second ink. | `firmware`, `embedded`, `iot`, `devices`, `sensors`, `robotics` |
| `plug` | A plug with prongs in the main ink, black collars and a lightning mark, on a curling cable. | `api`, `apis`, `gateway`, `integrations`, `connectors`, `partners` |
| `hourglass` | An hourglass in a black frame with sand in the main ink running from the top bulb to the bottom. | `scheduling`, `batch`, `cron`, `jobs`, `workflow`, `workflows` |
| `flag` | A waving flag in the main ink on a black pole, with a stripe in the second ink and a paper emblem. | `flags`, `feature`, `toggles`, `rollout`, `launch`, `launches` |
| `compass` | A compass rose in the main ink inside a ring of ticks, the needle in black and the second ink. | `architecture`, `arch`, `strategy`, `radar`, `principles`, `guild` |
| `chain` | Three interlocked chain links in the main ink, one link in the second ink. | `blockchain`, `crypto`, `web3`, `ledger`, `tokens`, `defi` |
| `eye` | A wide eye with an iris in the main ink and, on some teams, black lashes. | `fraud`, `abuse`, `moderation`, `safety`, `integrity`, `risk` |

Twelve motifs for business teams (`app/src/lib/motifs-business.ts`):

| Motif | What it draws | Keywords |
| --- | --- | --- |
| `book` | An open book with black lines of text on its pages, a cover in the second ink and a ribbon in the main ink. | `docs`, `documentation`, `wiki`, `knowledge`, `writing`, `handbook` |
| `people` | Two or three bust silhouettes in the main and second inks, overlapping like a team photo. | `hr`, `people`, `talent`, `recruiting`, `hiring`, `onboarding` |
| `scales` | A black balance with pans in the main ink holding weights in the second ink, tipped to one side. | `legal`, `policy`, `governance`, `regulatory`, `ethics`, `contracts` |
| `magnet` | A horseshoe magnet in the main ink with paper tips, pulling small blocks in the second ink. | `sales`, `crm`, `revenue`, `leads`, `deals`, `quota` |
| `megaphone` | A megaphone in the main ink with a rim in the second ink, a black handle and black sound arcs. | `ads`, `advertising`, `campaigns`, `pr`, `outreach`, `social`, `communications`, `press` |
| `gamepad` | A game controller in the main ink with a black d-pad and buttons. | `games`, `gaming`, `gameplay`, `esports`, `studio`, `play` |
| `truck` | A delivery truck with a cargo box in the main ink, a cab in the second ink and black wheels. | `logistics`, `shipping`, `fulfillment`, `supply`, `fleet`, `dispatch` |
| `coins` | Stacks of coins in the main ink beside one large coin with a star. | `cost`, `budget`, `procurement`, `spend`, `pricing`, `invoicing`, `monetization` |
| `sparkle` | A large four-pointed sparkle in the main ink with smaller ones in the second ink and black. | `recommendations`, `personalization`, `recs`, `feed`, `assist` |
| `a11y` | The accessibility figure in paper inside a disc in the main ink. | `a11y`, `accessibility`, `inclusive`, `inclusion`, `assistive`, `wcag` |
| `trophy` | A trophy cup in the main ink on a black base, with confetti in the second ink. | `loyalty`, `rewards`, `gamification`, `achievements`, `engagement`, `retention` |
| `leaf` | A leaf in the main ink with black veins, on some covers with a small twin in the second ink. | `sustainability`, `green`, `esg`, `climate`, `carbon`, `energy` |

Seven motifs for finance teams (`app/src/lib/motifs-finance.ts`):

| Motif | What it draws | Keywords |
| --- | --- | --- |
| `bank` | A columned bank building with a pediment and steps. | `banking`, `bank`, `neobank`, `deposits`, `branch`, `psd2` |
| `vault` | A round safe door with a spoked handle and bolts. | `custody`, `vault`, `wealth`, `savings`, `assets`, `safekeeping` |
| `calculator` | A desk calculator with a display and a keypad. | `tax`, `accounting`, `fp`, `bookkeeping`, `payroll`, `forecasting` |
| `percent` | A percent sign on a coin or a hanging price tag. | `lending`, `loans`, `credit`, `mortgage`, `underwriting`, `interest` |
| `passport` | An identity document with a photo, lines of text and a round stamp. | `kyc`, `aml`, `kyb`, `sanctions`, `crime`, `verification` |
| `pie` | A pie or donut chart with one slice pulled out, over a small legend. | `bi`, `intelligence`, `reporting`, `dashboards`, `kpi`, `okr` |
| `handshake` | Two sleeved hands clasped across the card. | `partnerships`, `alliances`, `bizdev`, `business`, `solutions`, `presales` |

Eight motifs for engineering, product and company functions (`app/src/lib/motifs-work.ts`):

| Motif | What it draws | Keywords |
| --- | --- | --- |
| `wrench` | A wrench crossed with a screwdriver. | `engineering`, `eng`, `production`, `maintenance`, `sustaining`, `craft` |
| `puzzle` | A grid of interlocking puzzle pieces with one piece being placed. | `product`, `pm`, `prd`, `mvp`, `roadmap`, `outcomes` |
| `brackets` | Large code braces around a cursor or dots, with lines of code. | `developer`, `devrel`, `dx`, `sdk`, `advocacy`, `relations` |
| `headset` | A VR headset on its strap, with a beam of light below. | `ar`, `vr`, `xr`, `metaverse`, `spatial`, `immersive` |
| `clipboard` | A clipboard with a checklist, some items ticked. | `operations`, `bizops`, `program`, `project`, `pmo`, `process` |
| `cap` | A graduation cap with a tassel. | `learning`, `training`, `education`, `academy`, `courses`, `mentoring` |
| `laptop` | An open laptop with text on its screen and a keyboard. | `it`, `workplace`, `office`, `facilities`, `endpoints`, `desktop` |
| `target` | A bullseye with an arrow in it. | `marketing`, `lifecycle`, `gtm`, `targeting`, `segments`, `positioning` |

The keywords are chosen so that the team names most companies use get a themed motif, and a test keeps it that way: about 130 names from Engineering, Platform and SRE through Payments, KYC and Treasury to Sales, Marketing, Legal and Workplace (`app/src/lib/team-catalog.test.ts`) must each get a matching motif, on their own and all together on one site. Camel case does not split after a single leading lowercase letter, so `iOS` and `eCommerce` stay one word while `SecurityTools` and `dataAPI` split.

The nine remaining abstract prints (`waves`, `sunburst`, `bricks`, `orbit`, `contour`, `checker`, `crescent`, `dots`, `triangles`) own no keywords.

Every motif takes two decisions per project (the side it leans to, the number of teeth or rays, the thickness of a line) and the rest per record, so a team's set is recognisable while every card differs.

### What varies per record

A motif receives two seeded random generators. `record` is seeded by the record id (`payments/adr/0003-stripe-as-primary-provider`) and decides positions, sizes, rotations and the paper grain. `project` is seeded by the project id, so the choices drawn from it are the same on every cover of a team. The record id also picks the card stock:

| Stock | Chance | Look |
| --- | --- | --- |
| `paper` | 3 in 5 | Ink printed on the paper token (`--inkan-paper`). |
| `flood` | 1 in 5 | The ink floods the card; motif in paper and key black. |
| `black` | 1 in 5 | Light on black; the motif screens over the dark stock. |

Each ink has a fixed second ink for overprints (cyan with magenta, magenta with yellow, yellow with cyan, green with cyan, violet with magenta, orange with magenta), so the same two-plate misregistration appears across a team's set.

Renaming a file changes its id and therefore its cover. Changing a record's `title` or body does not.

### Status treatments

A record that no longer describes the current state has its print treated, as a sticker on an old release would be:

| Status | Treatment |
| --- | --- |
| `draft` | half grey, very pale |
| `rejected` | full greyscale |
| `withdrawn` | greyscale, half transparent |
| `superseded` | mostly grey, dimmed |
| `deprecated` | sepia, slightly faded |

Accepted, implemented, proposed and in-review covers print in full ink. Custom statuses get no treatment unless they reuse one of these ids.

### Where covers appear

- On every photocard: the record index, the latest records on the landing page, team pages, the timeline and the flippable card in a record's rail.
- As the banner of each team card on the landing page, using the project's newest record (or the project id when the project has no records yet).

Covers are written into the HTML, so they cost no requests. A page with many cards carries the SVG markup of each; the record index therefore renders the first 120 cards and mounts the rest as you scroll.

### Recolouring

The SVG uses classes that `cover.css` maps to tokens: `--inkan-ink-<ink>`, `--inkan-ink-k`, `--inkan-paper`, `--inkan-bg-2` in Stage and the blend mode `--inkan-blend`. Override those tokens in `customCss` and every cover follows; see [Theme with --inkan-* CSS tokens](0003-theme-with-inkan-css-tokens.md). There is no per-record cover setting and no way to supply an image instead.

### Add your own motif

A motif is a module whose default export is a `MotifFn`, wrapped in `defineMotif`. A plugin registers it under a name with the `motifs` key, and any `_project.yml` can then pin that name. The second argument of `defineMotif` takes `keywords`, so projects whose id or name contains one of them get the motif without pinning it. This is `examples/company-decisions/plugins/stamp.ts`:

```ts title="plugins/stamp.ts"
import { defineMotif } from 'inkan';
import { circle, n, TAU } from 'inkan/covers';

/** A rubber stamp: a ticked ring over a halftone cloud, with a black seal off to one side. */
export default defineMotif((c, record, project) => {
  const { w, h } = c;
  const side = project() < 0.5 ? 0.3 : 0.7;
  const teeth = 24 + Math.floor(project() * 3) * 8;
  const cx = w * (side + (record() - 0.5) * 0.12);
  const cy = h * (0.3 + record() * 0.12);
  const R = w * (0.26 + record() * 0.06);
  const tilt = (record() - 0.5) * 0.6;

  c.halftone({ spacing: 5, angle: 0.6, maxR: 2.6, cls: 'a', field: { cx, cy, r: w * 0.9, pow: 1.3, amp: 1.1 } });
  c.add(circle(cx, cy, R, ' class="b x"'));
  c.add(circle(cx, cy, R * 1.18, ` class="sa n x" stroke-width="${n(R * 0.14)}"`));
  let ticks = '';
  for (let i = 0; i < teeth; i++) {
    const a = tilt + (i / teeth) * TAU;
    const r0 = R * 1.3;
    const r1 = R * (i % 4 === 0 ? 1.55 : 1.42);
    ticks += `M${n(cx + Math.cos(a) * r0)} ${n(cy + Math.sin(a) * r0)}L${n(cx + Math.cos(a) * r1)} ${n(cy + Math.sin(a) * r1)}`;
  }
  c.add(`<path class="sk n" stroke-width="1.6" d="${ticks}"/>`);
  c.add(circle(cx, cy, R * 0.62, ' class="sk n" stroke-width="2.4"'));
  const seal = tilt + TAU * (0.6 + record() * 0.3);
  c.add(circle(cx + Math.cos(seal) * R * 1.9, cy + Math.sin(seal) * R * 1.9, w * 0.05, ' class="k"'));
}, { keywords: ['audit', 'controls', 'sox'] });
```

```ts title="plugins/acme.ts"
import { definePlugin } from 'inkan';

export default definePlugin({
  name: 'acme',
  motifs: { stamp: new URL('./stamp.ts', import.meta.url) },
});
```

```yaml title="decisions/platform/_project.yml"
name: "Platform"
ink: y
motif: stamp
```

Rules for the `motifs` key:

- A name matches `/^[a-z][a-z0-9-]*$/`. Anything else fails config validation: `plugins.0.motifs.Stamp: motif names use lowercase letters, digits and dashes and start with a letter`.
- The value is an absolute path, a `file:` URL string or a `URL`. A URL with another scheme fails with `plugin "acme" motif "stamp": expected a file path or file: URL, got ...`; a file that does not exist fails with `plugin "acme" motif "stamp": module not found: ...`.
- A later plugin wins over an earlier one, and a plugin motif named like a built-in replaces it for the whole site.
- The module's default export must be a function, or the build fails with `plugin motif "stamp" must default-export a function`. An exception thrown while drawing fails with `motif "stamp" failed for <record id>: ...`.

Rules for `defineMotif(fn, options?)`:

- Without options it returns `fn` unchanged. With `{ keywords }` it attaches the list to the function, which is what the registry reads.
- `keywords` must be an array of strings; anything else (a single string, numbers) throws `inkan: defineMotif keywords must be an array of strings` when the module loads.
- Each keyword goes through the same word splitting as project names: `['Legal', 'data-science']` becomes `legal`, `data`, `science`. Keep keywords to single lowercase words.
- A plugin keyword is not checked against the built-in lists. If `stamp` claimed `legal`, which `scales` owns, both would match and the hash would decide; `audit`, `controls` and `sox` are free today.
- A plugin motif that replaces a built-in name and sets `keywords` replaces that motif's keyword list too. One that sets none keeps the built-in keywords of the name it replaces.

The motif is called with `(canvas, record, project)`. `record` and `project` are the two generators described above; each call returns a number in `[0, 1)`. Draw with ink classes instead of colours, so one print works in Day and Stage and on every stock:

| Class | Paints |
| --- | --- |
| `a` | Fill in the main ink |
| `b` | Fill in the alternate ink |
| `k` | Fill in key black |
| `p` | Fill in paper |
| `sa` | Stroke in the main ink |
| `sk` | Stroke in key black |
| `n` | No fill (for outlines, together with `sa` or `sk`) |
| `x` | Blend with what is below (`multiply` in Day, `screen` in Stage) |

The canvas is a `MotifCanvas` (types in `lib/index.d.ts`):

| Member | What it does |
| --- | --- |
| `w`, `h` | Size of the print. The default cover is 220 by 340 units. |
| `add(markup)` | Appends SVG markup to the print. |
| `id()` | A fresh id for `<defs>` entries such as patterns, unique across every cover on a page. |
| `halftone(options)` | A riso halftone raster: dots grow where the field is strong. |
| `clip(d)` | Registers a clip path from an SVG path and returns its id. |

`halftone` takes `HalftoneOptions`: `spacing` between dots, the screen `angle` in radians, `maxR` (dot radius where the field is 1), `cls` (`a`, `b`, `k` or `p`), an optional `clip` id, and `field`, either one radial fall-off `{ cx, cy, r, pow, amp }` or a list of linear ramps `{ x1, y1, x2, y2, amp? }` that multiply.

`inkan/covers` exports four helpers for writing the markup: `TAU` (a full turn in radians), `DEG` (radians to degrees), `n(v)` (a number as an attribute value, one decimal, no `-0`) and `circle(cx, cy, r, attrs?)` (a `<circle>` element; `attrs` is raw attribute markup such as `' class="k"'`). The built-in motifs in `app/src/lib/motifs.ts`, `motifs-infra.ts` and `motifs-product.ts` are written with the same API and are the best reference for more complex prints.

## Consequences

- Zero assets to make or store; a thousand records have a thousand distinct covers on the first build.
- Deterministic: the same repository builds the same covers anywhere, so screenshots and printouts stay consistent.
- Teams stay distinct until 222 pairs are in use (more with plugin motifs); after that, pairs repeat.
- Keyword matching depends on the folder name and `name`: renaming `security` to `trust-and-safety` keeps the shield (`trust` is a keyword), renaming it to `blue-team` loses it. Pin `motif` where the picture must survive a rename.
- Adding a pin or a project that sorts early can move the covers of unpinned projects. Pin both fields where the look matters.
- A plugin motif is code that runs at build time; a motif that throws stops the build. There is still no way to upload artwork per record.
- Renaming a record file gives it a new cover, which is a reason (next to broken links) to keep file names stable.
- Inline SVG on list pages adds to the HTML size; that is why the index streams cards in chunks.
