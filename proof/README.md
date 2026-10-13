# A4 numbered print proof

Run `npm install` and `npm run proof` to regenerate the files. The PNGs are screen previews. Open and print `front-a4.svg` and `back-a4.svg` at **100% / actual size** on A4 paper. Disable page fitting and borderless enlargement. The nominal card boundary is 63.5 × 88.9 mm. This is a layout proof with sample identities, not a playable cube export.

The back sheet mirrors each front horizontally for a portrait long-edge flip. The numbered front and back, short copy ID, and [`manifest.json`](manifest.json) show which copy belongs in each position. Print one sheet and check the result before choosing automatic duplex or a manual flip procedure for the Canon iP7200 series. Duplex driver behavior, margins, and paper feed can shift the back; no alignment claim is made from SVG coordinates alone.

Check each of the nine pairs for orientation and registration. Scan each QR with a phone and verify that its `cube-buddy:copy:` payload matches the manifest. Also try writing and erasing several W/L circles and pick fields on the intended paper with the intended pen. Note the measured left/right and top/bottom offset for the later printer profile.

This proof uses a 50-slot grid and skips draws. The two top rows are handwritten average-pick and draft-count fields, with open boxes for pack-position observations. Their readability and the 18.5 mm QR size need physical confirmation.
