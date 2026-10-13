# Cube Cobra write-back proposal

## Current boundary

Cube Buddy reads the public Cube Cobra cube JSON endpoint without credentials. Cube Cobra's existing record writes use a logged-in browser session, CSRF protection, and owner authorization. The signed record share token applies only to an existing record and allows a contributor to submit a player deck plus W/L/D.

Cube Buddy currently records a different fact: cumulative Games and Wins marks for a physical card copy. It does not know the player, deck, opposing deck, match, round, or Cube Cobra record. These observations must not be represented as synthetic one-card decks or fabricated records. Doing so would contaminate Cube Cobra's deck inclusion, synergy, trophy, record, and card analytics.

## Proposed supported integration

Cube Cobra would expose an authenticated integration endpoint for a separately labeled physical-card observation metric. Authentication should use a revocable, scoped token or OAuth grant issued by Cube Cobra. Cube Buddy should never collect a Cube Cobra password or reusable browser session cookie.

Suggested request:

```json
{
  "source": "cube-buddy",
  "schemaVersion": 1,
  "cubeId": "0b0d5ab4-9816-4d1a-b726-bfd211317413",
  "cubeVersionId": "local-version-id",
  "exportedAt": "2026-10-13T12:00:00.000Z",
  "metric": "player-selected-relevant-game-outcomes",
  "draws": "skipped",
  "observations": [
    {
      "observationId": "stable-snapshot-or-cycle-id",
      "physicalCopyId": "cube-buddy-copy-id",
      "cubeCobraCardId": "printing-id",
      "oracleId": "oracle-id",
      "games": 10,
      "wins": 6,
      "losses": 4,
      "capturedAt": "2026-10-13T10:00:00.000Z"
    }
  ]
}
```

Required server behavior:

- Scope authorization to one cube and this observation type.
- Deduplicate by `source`, cube, and `observationId`; retries must be idempotent.
- Keep this metric separate from Cube Cobra Records unless a shared real event/deck identifier proves they describe the same game.
- Preserve the source metric definition and display sample size and capture date.
- Return accepted, duplicate, and rejected observation IDs with validation errors.
- Allow the cube owner to revoke access and delete imported Cube Buddy observations.

## Existing Records compatibility

### Manual record connection

Cube Buddy now lets the owner prepare an existing Records connection without entering Cube Cobra credentials:

1. Select the cube in Cube Buddy and open its linked Cube Cobra Records page.
2. Log in to Cube Cobra, create or open the destination record, and use Cube Cobra's share action.
3. Copy the contribution link or token and paste it into Cube Buddy.

The token is scoped to that existing record. Cube Buddy stores it in separate browser-local integration storage and excludes it from project backups and performance exports. Saving the token does not yet submit data.

If Cube Buddy later captures real events with players, complete decks, rounds, and matches, it can produce a separate Cube Cobra Records export. At that point an official Records API or the existing owner-created record contribution flow may be appropriate. Aggregate physical-card marks alone are insufficient for that conversion.
