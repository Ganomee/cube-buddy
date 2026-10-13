# Integration findings

Inspected 13 October 2026. These are source observations and integration constraints, not a claim that either upstream service endorses Cube Buddy.

## Proxxied

- Its [`CardOption`](https://github.com/acoreyj/proxies-at-home/blob/main/client/src/types/Card.ts) contains a UUID, name, image URLs, upload flag, and optional set/collector number. It has no physical-copy ID, tracking-back image, or front/back pair field. Its UUID currently supports Proxxied ordering; Cube Buddy must keep a separate durable copy ID.
- [`exportProxyPagesToPdf`](https://github.com/acoreyj/proxies-at-home/blob/main/client/src/helpers/ExportProxyPageToPdf.tsx) lays cards out on a configurable rows × columns grid, resolves one image per card, then rasterizes each page into jsPDF. It does not pair duplex sides or store a print-project manifest. The source sets `DPI = 600`; the README's 1200 DPI description should not be used as a verified export specification.
- The [README](https://github.com/acoreyj/proxies-at-home/blob/main/README.md) says MIT. No top-level license file appeared in the inspected repository tree. Confirm the applicable reuse terms before distributing copied source. A separate image/manifest adapter remains possible without changing the hosted site.

**Proposed boundary to test:** Cube Buddy owns copy identity, front/back mapping, QR payload, tracking template, and print manifest. A Proxxied-compatible image export can supply fronts; a paired duplex exporter or source extension must preserve each copy's back. Test actual printed alignment before choosing the route.

## Cube Cobra

- The [cube CSV export header](https://github.com/dekkerglen/CubeCobra/blob/master/packages/server/src/serverutils/cube.ts) includes `name`, `Set`, `Collector Number`, `board`, `image URL`, and `image Back URL`. These give Cube Buddy printing and custom-art inputs. The server's [API documentation](https://github.com/dekkerglen/CubeCobra/blob/master/packages/client/src/pages/ApiDocsPage.tsx) lists a CSV download route.
- Cube Buddy now uses Cube Cobra's documented public, CORS-enabled `GET /cube/api/cubeJSON/:id` endpoint for URL/ID imports. It accepts a cube UUID or short ID and is documented at 100 requests per minute. No account token is needed for this read-only route. The published API documentation does not describe personal API tokens or OAuth for account/private-cube access, so Cube Buddy does not collect credentials or session cookies.
- Reference cube `0b0d5ab4-9816-4d1a-b726-bfd211317413` (`Powered One Drop Cube`) is stored in `src/reference-cubes.js`. On 13 October 2026 the live smoke test imported the 358-card mainboard and reported 245 maybeboard plus 5 basics entries as available but unselected. Every imported card had a name and artwork URL. The adapter reads canonical fields from nested `details` and prefers per-cube `imgUrl` / `imgBackUrl` overrides.
- The CSV header does **not** contain a durable per-entry or Oracle ID. A cube ID may be supplied from the source URL or by the owner, but CSV rows alone cannot prove a durable external card-entry mapping. Keep row order, set/collector number, and original CSV fields; do not invent a Cube Cobra entry ID.
- User direction: use artwork selected in Cube Cobra. Preserve its image URLs. For a double-faced card, prefer a selected merged custom front image; otherwise prepare a conventional draft placeholder front with a tracking back. Keep the playable double-faced card in a separate side pile.

## Open verification

- Confirm the JSON import and CSV fallback against an owner cube, including duplicates, all boards, art overrides, custom cards, and double-faced image fields.
- Verify image URLs remain fetchable at print time or record an explicit missing-art review item.
- Check Cube Cobra's current performance import/analytics data model before claiming that Cube Buddy exports can be imported there.

## Cube Cobra Records write boundary

- Record creation/import uses a logged-in browser session, CSRF protection, and cube-owner authorization. Cube Cobra's published API does not expose a personal account token for these writes.
- Cube Cobra can issue a signed share token for an existing record through its owner-only `records/sharetoken` route. It permits contribution of a player's deck and self-reported W/L/D to that record; it cannot create records or accept aggregate per-card Games/Wins counts.
- Records analytics derive card performance from event players, decks, and match rounds. Cube Buddy's current observations deliberately lack player, deck, match, and draft attribution, so uploading them as Records would change their meaning.
- Cube Buddy exports versioned `cube-buddy-performance` JSON with cube UUID, Cube Cobra card/Oracle IDs, physical-copy IDs, Games/Wins/losses, dates, and scope. Direct write-back needs either an upstream API for this metric or a decision to collect Cube Cobra-compatible event/deck data.
