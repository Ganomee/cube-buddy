# A4 numbered print proof

Run `npm install` and `npm run proof` to regenerate the files. The PNGs are screen previews. Open and print `front-a4.svg` and `back-a4.svg` at **100% / actual size** on A4 paper. Disable page fitting and borderless enlargement. The nominal card boundary is 63.5 × 88.9 mm. This is a layout proof with sample identities, not a playable cube export.

The back sheet mirrors each front horizontally for a portrait long-edge flip. The numbered front and back, short copy ID, and [`manifest.json`](manifest.json) show which copy belongs in each position. Print one sheet and check the result before choosing automatic duplex or a manual flip procedure for the Canon iP7200 series. Duplex driver behavior, margins, and paper feed can shift the back; no alignment claim is made from SVG coordinates alone.

Check each of the nine pairs for orientation and registration. Scan each QR with a phone and verify that its `cube-buddy:copy:` payload matches the manifest. Also try marking and erasing several Games and Wins squares and pick fields on the intended paper with the intended pen. Note the measured left/right and top/bottom offset for the later printer profile.

This proof has 50 Games squares and 50 Wins squares. The current count convention is one Games mark per recorded relevant game, plus a Wins mark if it was won; reviewed losses are the difference. Draws are skipped. The two top rows have 10 boxes each for two-digit pack-position observations (20 draft entries total). The slightly wider first boxes carry AVG and CNT labels inside, with room beneath to handwrite average pick and draft count. Their readability and the 18.5 mm QR size need physical confirmation.
