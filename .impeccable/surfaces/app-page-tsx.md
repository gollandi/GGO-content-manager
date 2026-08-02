---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["app/review/page.tsx","components/AppShell.tsx","components/Sidebar.tsx"]
---

## Scope and mode

The whole GGOMed Operator Cockpit — all 21 surfaces plus the shell. Mode: Operate.

## Audience, job, task

One expert operator (JJ), sole user. Desktop for orchestration; phone, one-handed, for approvals at Il Cancello between clinics. Opening question is always "where does the system stand", then descend into a room.

## Must shout, never whisper

Pending decisions and their age · breakages and failed runs · silent drift (stale content, overdue reviews, slipping compliance) · model cost per run.

## Chosen direction

Il Registro — security engraving, seals, the bound register of signed decisions. Seed key 9055bf41. Committed colour: intaglio blue-black plate dominant, oxblood reserved for the gate alone, engraving green for structure, safety paper only where a real document sits. Bodoni Moda / Archivo Narrow / Archivo.

## Approved composition

Two floors of one building.

- **Atrium** — `.impeccable/mocks/comp-b-counterfoil-wall.png`. The home surface. One perforated stub per room; seal sockets read pending versus sealed at a glance; torn oxblood stubs mark rooms needing attention. This is what ends the "21 identical sidebar items" problem: rooms become physically distinct objects.
- **Room interior** — `.impeccable/mocks/comp-a-register-spread.png`. Every module page. Ruled register with a seal socket ending each row, engraved rail, oxblood counterfoil margin, and a tall document panel holding the entry opened for decision.

Corrections carried into the build, not literalised from the comps: the comps' generic medical clip-art icons are replaced by icons drawn in the engraving grammar; row density encodes the age of an undecided item; the document panel carries real approve/modify/reject controls, not a decorative seal.

## Memorable moment

Sealing. The commit control is a wax seal pressed into an empty socket — the only oxblood interaction in the product, and the only place anything irreversible happens.

## Hard functional requirement

JJ must be able to SEE an asset to judge it. Images, video, and captions render at document scale inside the decision panel with a full-size viewer — never as a 128px thumbnail strip. An unviewable asset is an undecidable one.

## Unresolved

Whether the legacy mirror-DB pages keep full room status in the atrium or are demoted to a subordinate register once the mirrors retire.
