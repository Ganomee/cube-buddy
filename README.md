# Cube Buddy

Cube Buddy helps owners print a physical Magic cube and collect optional, card-specific relevant-game observations over time.

The current app loads a public Cube Cobra URL or imports a Cube Cobra CSV, versions the cube, assigns stable physical-copy IDs, reviews cumulative Games and Wins marks, and shows cube performance. Reimport keeps IDs for unique exact matches and asks you to map duplicate rows or changed printing/artwork to an existing copy or a new one. It can export and restore a local JSON backup and generate a numbered A4 print proof. See [the project plan](docs/PLAN.md) and [the kanban](KANBAN.md) for scope and decision gates.

## Development

Requires Node.js 20 or newer. Run `npm install`, then `npm run dev` for the owner app. Run `npm test`, `npm run test:ui`, and `npm run build` to verify it. On Windows PowerShell, use `npm.cmd` in place of `npm` if script execution is disabled.

Run `npm run test:cubecobra` for the opt-in live smoke test against reference cube `0b0d5ab4-9816-4d1a-b726-bfd211317413`. It currently verifies the 358-card mainboard and reports the available maybeboard and basics without importing them.

Run `npm run proof` to regenerate the numbered A4 proof in `proof/`. The proof still needs a 100% scale print on the Canon iP7200 series to confirm front/back alignment, QR reading, and writing/erasing on the intended surface.

Run `npm run pdf:reference` to fetch the stored reference cube's mainboard and generate a Proxxied-style 600 DPI PDF in `print-output/`. Edit `print-settings.json` first to change the A4 grid, bleed, or guide settings. The command also writes a page manifest and a Cube Buddy backup containing the physical-copy IDs encoded in the printed QR codes. Restore that backup before recording observations from those printed cards. The ignored PDF is large because it contains 84 rasterized A4 pages.

The backup preserves Cube Buddy data and can be restored into an empty project. It is not a Cube Cobra performance import file; that target capability is unverified.

The owner screen exports `cube-buddy-performance` JSON linked to the Cube Cobra UUID and source card identifiers. It preserves Cube Buddy's metric meaning but is not a direct Cube Cobra Records upload.

Cube Cobra URL import uses its public, CORS-enabled cube JSON endpoint and needs no account token. Cube Cobra does not currently document a personal API-token or OAuth flow for account/private-cube access. Use a CSV export when the public endpoint cannot read a cube; do not paste a password or browser session cookie into Cube Buddy.

For a future Records contribution, select an imported cube and follow **Connect a Cube Cobra record** in the app. In Cube Cobra, open that cube's Records page, create or open the destination record, use its share action, and paste the copied contribution link or token into Cube Buddy. The token is stored only in that browser and is excluded from project backups. Saving it prepares the connection; automatic contribution is not implemented yet.

For live integration testing, put `CUBE_COBRA_RECORD_SHARE_URL=<complete contribution URL>` in the ignored `.env.local` file. By default, `npm run test:cubecobra-record` only checks the contribution page. Add `CUBE_COBRA_ENABLE_WRITE_TEST=1` to run the write tests. They create or update stable Cube Buddy test players, upload a one-card deck and result, read the record back, and compare the saved Oracle ID and W/L/D with the request.

The residual planner subtracts outcomes from real Cube Cobra decks containing a card, ignores its own `Cube Buddy · <Oracle ID>` transport deck, and produces one managed one-card deck for the remaining wins and losses. If Cube Cobra already has more wins or losses than Cube Buddy, it returns `needs-review` and does not manufacture a negative result.

The proposed supported write-back contract is documented in [`docs/CUBE_COBRA_WRITEBACK.md`](docs/CUBE_COBRA_WRITEBACK.md).

The preliminary product brief is an input to planning, not an implementation instruction. Proposed defaults and unresolved choices remain explicit decisions in the plan.
