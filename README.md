# Cube Buddy

Cube Buddy helps owners print a physical Magic cube and collect optional, card-specific relevant-game observations over time.

The current app imports a Cube Cobra CSV, assigns stable physical-copy IDs, reviews cumulative Games and Wins marks, and shows cube performance. It also generates a numbered A4 print proof. See [the project plan](docs/PLAN.md) and [the kanban](KANBAN.md) for scope and decision gates.

## Development

Requires Node.js 20 or newer. Run `npm install`, then `npm run dev` for the owner app. Run `npm test`, `npm run test:ui`, and `npm run build` to verify it. On Windows PowerShell, use `npm.cmd` in place of `npm` if script execution is disabled.

Run `npm run proof` to regenerate the numbered A4 proof in `proof/`. The proof still needs a 100% scale print on the Canon iP7200 series to confirm front/back alignment, QR reading, and writing/erasing on the intended surface.

The preliminary product brief is an input to planning, not an implementation instruction. Proposed defaults and unresolved choices remain explicit decisions in the plan.
