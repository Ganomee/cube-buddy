# Draft roster handoff

Open `/draft-roster.html` on a Vite production build or in the dev server. Select a UTF-8 Draftmancer DraftLog v2.0 or v2.1 (`.txt` or `.json`, up to 16 MiB), review attendance, and opt in to the available decks you want to carry over. Select **Confirm roster** and **Download roster**. The same file input opens a downloaded Cube Buddy roster. The browser keeps the latest confirmed roster for refresh recovery when local storage is available. A new confirmation or a reopened handoff replaces that saved snapshot.

Draftmancer exports the same JSON structure in its `.txt` download. Cube Buddy uses `users` for seat identity, `cards` for the draft-pool preview, and `decklist` for available deck contents. Draftmancer can populate `decklist` automatically, so the organizer chooses whether the recorded deck is ready to carry over. Locked logs require an unlocked download. If a log has withheld or unresolved deck data, the affected seat can still attend. [v2.0 schema](https://github.com/Senryoku/Draftmancer/blob/475f3368bad714652455e8f7131849edb93166db/src/DraftLog.ts) · [v2.1 schema](https://github.com/Senryoku/Draftmancer/blob/2c5e5ba865e9d1ef16b2eae78a940f548ad86fa8/src/DraftLog.ts#L36) · [DeckList schema](https://github.com/Senryoku/Draftmancer/blob/2c5e5ba865e9d1ef16b2eae78a940f548ad86fa8/src/CardTypes.ts) · [Download implementation](https://github.com/Senryoku/Draftmancer/blob/2c5e5ba865e9d1ef16b2eae78a940f548ad86fa8/client/src/components/DraftLogHistory.vue#L168)

## Version 1

```json
{
  "format": "cube-buddy-draft-roster",
  "schemaVersion": 1,
  "source": {
    "provider": "draftmancer",
    "sessionId": "Friday Cube 42",
    "draftTime": 1795212000000,
    "logVersion": "2.1"
  },
  "players": [
    {
      "playerId": "c0f420ee-edbc-4a58-a1a5-111111111111",
      "name": "Alex",
      "deck": {
        "mainboard": [
          {
            "cardId": "b513532b-8214-428d-b536-f90b44a88ac5",
            "name": "Lightning Bolt",
            "quantity": 2,
            "oracleId": "9141e3cb-a635-48ea-b42f-5d4ab16e42a9",
            "set": "m11",
            "collectorNumber": "149"
          }
        ],
        "sideboard": [],
        "basicLands": {"W": 0, "U": 0, "B": 0, "R": 17, "G": 0}
      }
    },
    {
      "playerId": "eb796ba1-af24-4b3d-8c5f-222222222222",
      "name": "Alex"
    }
  ]
}
```

- `source.sessionId` and `source.draftTime` preserve Draftmancer's session ID and log start time in Unix milliseconds. Together with `source.provider`, they identify the draft when a session ID is reused.
- `players` contains one or more attending humans in review order. Use the original `playerId` as the seat key within the draft. Display names can repeat.
- `deck` is optional. Gameplay can use just the player IDs and names. Both board arrays are required in an included deck and can be empty. Each board lists a source `cardId` once with a positive integer `quantity`. The same ID can appear on both boards. Optional `oracleId`, `set`, and `collectorNumber` come from the embedded card data. Custom card IDs are valid.
- `basicLands` is optional and captures additional basic lands recorded outside the board arrays. Its keys are `W`, `U`, `B`, `R`, and `G` for Plains, Island, Swamp, Mountain, and Forest. Each supplied count is a nonnegative integer, including explicit zeroes. Missing counts are unspecified. A basic-land card listed in a board keeps its own quantity there.

The native tournament slice can import `parseDraftRosterHandoff(jsonText)` from `src/draft-roster.js`. It returns the validated snapshot or throws an actionable error. It preserves source seat IDs across imports. To retry an import into the same tournament, apply the snapshot using the source draft identity and player IDs so repeated names and retries keep each physical seat distinct.
