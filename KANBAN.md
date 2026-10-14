# Cube Buddy kanban

Update this board with each story move. IDs and phases come from the project brief. “Blocked” means a named human decision or external contract is required; no proposed default is silently accepted.

## In progress

- [ ] CB-01 (P0/1) Import/select versioned cube. Public URL/ID loading was validated against the stored 608-entry owner reference cube; CSV fallback, local persistence, reconciliation, source IDs, and artwork pass. Board-selection default and unresolved-row UI remain.

## Ready

- [ ] CB-23 (P0/1) Review observations with sample and date context.

## Blocked by decision or proof

- [ ] CB-18, CB-31, CB-32, CB-34, CB-35 (P0/1) Print and Proxxied integration: WebP art, tracking backs, DFC placeholders, Proxxied settings, mirrored duplex pairing, jsPDF export, manifest, and restore backup now produce the 84-page reference-cube PDF. Remaining gates are physical Canon calibration, browser download UX, face-name enrichment on DFC placeholders, and reprint UX.
- [ ] CB-21 (P1/2) Image extraction: depends on approved back template and reviewed snapshot model.
- [ ] CB-02–06, CB-08–12 (P1/3) Draft session and play: depends on Phase 1 release and D-07.
- [ ] CB-07 (P1/3) Swiss pairings: D-08.
- [ ] CB-13–16 (P2/4) Optional session evidence: depends on Phase 3 flows.
- [ ] CB-24–27 (P2/5) Pick detail, teams, voice: D-09.
- [ ] CB-28–30 (P2/6) Digital drafting and sync: D-09 and verified external contracts.

## Review

- [ ] CB-19, CB-33 (P0/1) Revised numbered A4 proof generated with nine fronts, mirrored Games/Wins backs (50 squares each), 20 two-digit pick boxes, in-box AVG/CNT fields, QR identities, and manifest. Awaiting physical Canon iP7200-series print and owner assessment of registration, scan/readability, and erasability.
- [ ] CB-20, CB-22, CB-36 (P0/1) Owner flow imports a cube, opens a copy by QR payload, reviews cumulative Games/Wins marks, displays performance, and archives/resets a cycle. Needs owner trial with real cards and copies before release acceptance.
- [ ] CB-23 (P0/1) Copy review shows sample size, last review date, and the player-selected scope. Awaiting owner workflow review.
- [ ] CB-37 (P0/1) Local backup/restore and cube-linked performance JSON preserve cube UUID, source card/Oracle IDs, copy IDs, metric scope, and cycles. Direct Cube Cobra write-back is blocked by its session/CSRF routes and incompatible Records event/deck metric.
- [ ] CB-38 (P0/1) Cube Cobra collaboration contract proposes scoped authentication, idempotent aggregate physical-card observations, revocation, and separation from Records analytics. Owner controls outreach and upstream agreement.
- [x] CB-39 (P0/1) Cube Cobra record connection accepts an owner-copied contribution link/token per cube and stores it only in browser-local integration storage.
- [ ] CB-40 (P0/1) Residual Records transport calculates one managed one-card deck per Oracle ID, excludes its own managed players, blocks the entire batch when any residual needs human review, and has passed live create/update/read-back tests including overlapping 10-match and 8-match decks. Bulk owner preview and apply UI remains pending.
- [ ] CB-41 (P0/1) Artwork-backed tracking card uses the supplied ornamental cardback, exact generated 50 Games / 50 Wins / 20 pick fields, and extracted QR/name bounds. Generated SVG/PNG proof passes layout tests; physical scan, erasability, and duplex verification remain the human gate.
- [ ] CB-43 (P0/1) QBuddy Print loads a Cube Cobra cube into a visual card-back editor. Every overlay can be shown, moved, and resized independently; grids expose row, column, and square-size controls; preview values can use Cube Buddy state. Awaiting owner browser and print-workflow review.
- [ ] CB-44 (P0/1) Reviewed Print Studio adds color-coded fields, live physical-copy preview, reusable JSON template save/load, A4/Letter/custom paper sizes, and editable Proxxied printer profiles with independent front/back registration offsets. Awaiting the next owner review and physical duplex measurements.
- [ ] CB-45 (P0/1) Value fields print bare numbers by default, with optional editable labels per field. Color controls are visible and editable directly in the field list. Awaiting owner visual review.

## Done

- [x] CB-17 (P0/1) Domain identity slice: each physical copy gets a UUID; reprints explicitly retain or issue a new ID. Persistence and print-project UI remain part of CB-34.
- [x] CB-42 (P0/1) Print planning supports interleaved duplex or all fronts followed by mirrored backs in reverse sheet order. Playable DFC artwork remains isolated on ending pages.
