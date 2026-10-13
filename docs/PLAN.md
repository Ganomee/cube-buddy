# Cube Buddy project plan

Based on the owner's Cube Buddy brief, version 0.4 (13 October 2026). Story IDs and acceptance intent follow that brief. This plan does not treat its proposals as approved product decisions.

## Delivery method

- Keep the board in [`KANBAN.md`](../KANBAN.md). Move a story through Ready, In progress, Review, and Done; keep decision-dependent work in Blocked.
- For each behavior slice, commit a test that fails for the intended reason (`test(CB-xx): red ...`), then commit the smallest passing implementation (`feat(CB-xx): green ...`). Confirm both outcomes locally.
- Record a decision before implementing a choice left open in the brief. Do not infer approval from a proposed default.
- Demo each release gate to the owner before declaring that phase complete. Preserve observations, identity, and version provenance in exports.

## Phase 0: print contract and physical proof

Inspect Proxxied source, exporter, and actual reuse terms. Establish a per-copy front/back manifest and test an actual-size numbered proof for QR readability, duplex alignment, writable fields, sleeves, and erasability. **Human gate:** agree on reuse route, proof layout, 25/50-slot grid, draw treatment, marking surface, DFC convention, and initial print profile. A code-only simulation does not pass this gate.

## Phase 1: physical-card feedback release

1. **Identity and import:** CB-17, CB-01. Preserve copies, cube versions, source identifiers, printing and custom art; show unresolved rows for review. File import first; URL route after verification.
2. **Print workflow:** CB-18, CB-19, CB-31–35. Build a persistent manifest, matching fronts/backs, proof, printer profile, and explicit retain/new-copy reprint actions. Integrate with Proxxied only through a verified route.
3. **Observation loop:** CB-20, CB-22, CB-23, CB-36. QR identifies a copy. Review cumulative W/L counts per cycle; repeat entry adds zero, lower totals require resolution, reset retains history. Show sample counts, capture dates, unknown scope, and card/copy aggregation.
4. **Interoperability:** CB-37, CB-38. Export/restore versioned records with Cube Cobra mappings and precise metric meaning. Verify supported target import before claiming compatibility; prepare a collaboration proposal. Outreach is a separate owner action.

**Human release gate:** owner completes import → print → mark → QR → review → cube feedback → archive/reset → identity-preserving reprint, including repeat entry, numbered proof, and full-cube export on the intended printer.

## Later phases

| Phase | Stories | Deliverable | Human gate |
| --- | --- | --- | --- |
| 2 | CB-21 | Reviewed image extraction for multiple visible backs | Real marked examples save time and ambiguous marks are flagged; no duplicate observations |
| 3 | CB-02–12 | Guest session, organizer controls, seats, readiness, Swiss, results, life counter, history | Agree networking and Swiss rules; complete a recoverable real draft night |
| 4 | CB-13–16 | Optional deck/board evidence in existing flows | Skipping capture remains quick |
| 5 | CB-24–27 | Pick observations, teams, voice proposals | Agree pick convention and team scoring; manual team flow works |
| 6 | CB-28–30 | Verified digital draft handoff/import and optional sync | Confirm service/provider and conflict policy; repeated import remains safe |

## Decision register

| ID | Required decision or evidence | Needed before |
| --- | --- | --- |
| D-01 | Proxxied source reuse/license and integration boundary | CB-31 implementation/distribution |
| D-02 | **Decided 13 Oct 2026:** 50 W/L slots; skip draws; mark the printed back with an erasable medium. The exposed edge has two rows: leftmost fields for average pick and number of drafts, with the remaining space open for handwritten pick numbers from drafts. Do not auto-calculate the average yet. Physical legibility and erasability still require a proof. | CB-19 template approval |
| D-03 | A4/Letter, flip mode, printer offsets, QR size from proof | CB-32/33 release |
| D-04 | **Decided 13 Oct 2026:** draft a placeholder card for a double-faced card, with a tracking back. Use the merged custom front when Cube Cobra supplies one; otherwise make a conventional placeholder showing the card and both faces. Keep the playable card in a separate side pile. | CB-35 bulk export |
| D-05 | Retain versus replace physical-copy identity on reprint | CB-34 UI approval |
| D-06 | CSV fields inspected in source; validate with an owner export. CSV has no durable entry/Oracle ID. Supported performance import capability remains unverified. | CB-01 adapter / CB-37 target claim |
| D-07 | Mixed-phone transport, authority, recovery | CB-03 multi-phone implementation |
| D-08 | Swiss scoring, byes, tie-breaks, drops, repeats | CB-07 implementation |
| D-09 | Pick convention, team rules, voice language/provider, exact digital service | Phases 5–6 |
| D-10 | **Decided 13 Oct 2026:** configurable per cube; default to overall draft pick position. If recorded numbers never exceed 15, suggest checking whether pack position was used, but never switch automatically. Edge average and draft count are handwritten placeholders for now. Never combine samples from different conventions. | Later pick capture and average calculation |

## Near-term TDD slices

1. CB-17: issue a stable ID for each physical copy; retained reprints keep it, replacement/additional copies get new IDs. Tests first.
2. CB-01: import a real Cube Cobra CSV fixture after verifying its export headers; preserve duplicates, source IDs, art, and unresolved rows.
3. CB-20/22: cumulative reviewed snapshots and cycle reset, including idempotence and lower-count review.

These slices provide the domain foundation while print-contract decisions are gathered. Phase 0 stays open until a physical proof and reuse route are agreed.
