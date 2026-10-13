# Cube Buddy

Cube Buddy helps owners print a physical Magic cube and collect optional, card-specific relevant-game observations over time.

The current app loads a public Cube Cobra URL or imports a Cube Cobra CSV, versions the cube, assigns stable physical-copy IDs, reviews cumulative Games and Wins marks, and shows cube performance. Reimport keeps IDs for unique exact matches and asks you to map duplicate rows or changed printing/artwork to an existing copy or a new one. It can export and restore a local JSON backup and generate a numbered A4 print proof. See [the project plan](docs/PLAN.md) and [the kanban](KANBAN.md) for scope and decision gates.

## Development

Requires Node.js 20 or newer. Run `npm install`, then `npm run dev` for the owner app. Run `npm test`, `npm run test:ui`, and `npm run build` to verify it. On Windows PowerShell, use `npm.cmd` in place of `npm` if script execution is disabled.

Run `npm run proof` to regenerate the numbered A4 proof in `proof/`. The proof still needs a 100% scale print on the Canon iP7200 series to confirm front/back alignment, QR reading, and writing/erasing on the intended surface.

The backup preserves Cube Buddy data and can be restored into an empty project. It is not a Cube Cobra performance import file; that target capability is unverified.

Cube Cobra URL import uses its public, CORS-enabled cube JSON endpoint and needs no account token. Cube Cobra does not currently document a personal API-token or OAuth flow for account/private-cube access. Use a CSV export when the public endpoint cannot read a cube; do not paste a password or browser session cookie into Cube Buddy.

The preliminary product brief is an input to planning, not an implementation instruction. Proposed defaults and unresolved choices remain explicit decisions in the plan.
