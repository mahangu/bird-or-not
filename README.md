# Bird or Not?

An illustrated Sri Lankan bird-name quiz. Each flock has ten birds: choose the real name, collect correct guesses in My flock, and share the exact round with a friend. This edition contains 82 species. Scores and collections stay in the player's browser.

## Run locally

Use Node.js 22 or newer:

```sh
git clone https://github.com/mahangu/bird-or-not.git
cd bird-or-not
npm run dev
```

Open http://127.0.0.1:4173. No dependency installation is needed to play. Stop the server with Ctrl+C. To use another port on macOS or Linux, run `PORT=4180 npm run dev`; in PowerShell, run `$env:PORT=4180; npm run dev`.

The game has no runtime dependencies, build step, account system or backend. Serve it over HTTP; opening `index.html` directly does not support its module and catalogue requests.

## Test

The unit and asset checks need no dependency installation:

```sh
npm test
```

For browser checks, install the development dependency and use an installed Google Chrome:

```sh
npm ci
npm run test:browser
```

The browser script starts and stops its own local server. Stop an existing dev server first, or reuse it by setting `BIRD_TEST_URL`, for example `BIRD_TEST_URL=http://127.0.0.1:4180 npm run test:browser` on macOS or Linux. In PowerShell, use `$env:BIRD_TEST_URL='http://127.0.0.1:4180'; npm run test:browser`.

`BIRD_BROWSER_CHANNEL` defaults to `chrome`; set it to `chromium` after `npx playwright install chromium` to use Playwright's Chromium. Screenshots and browser results go into ignored `qa/`.

Tests pin published compact and verbose rounds for catalogues 1, 2 and 3, check scoring and persistence, and verify the asset manifest and hashes. The browser suite plays both link formats, checks repeated-answer protection and sharing, and exercises reload, collection navigation and blocked storage.

## Source and compatibility

`public/` is the complete static site. It was imported from the supported Spacefast source archive for v17, hosted commit `ee2631dfd6438de6269c0d2f8745f756c8f2407e`: 109 files, 39,174,796 uncompressed bytes. The first Git commit preserves those bytes. See [SOURCE.md](SOURCE.md) for provenance.

`public/game.js` handles rounds, shared codes and scores; `public/collection.js` handles browser-local collections; `public/app.js` renders the game. Keep `public/rounds/seed-v1.js` unchanged: six crypto bytes form a 48-bit seed, and its deterministic dealing algorithm is part of every published compact link. Correct-answer positions are randomized independently for each question; an equal A/B split per round is not required.

Retain the archived catalogue files and their images. Compact links use `#3-AbCdEfGh`; older verbose links use `#r=3.<questions>`. Decode each link against its named catalogue. Future dealing changes need a new format; future catalogue changes need a new numbered snapshot. Existing links must replay the same birds, fake names and answer positions.

Serve only `public/` when hosting the game. The repository has no automatic deployment workflow.

## License

Original application code, tooling, tests and documentation are licensed under **GPL-2.0-only**; see [LICENSE](LICENSE). Original game copy and invented names are included in that grant. Third-party artwork, fonts, icon SVGs, source quotations/credits and the Urban Fishing Cat logo retain their own terms.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [the asset manifest](public/asset-licenses.json) and [the full credits](public/credits.html). The logo and social compositions containing it are authorized for this project; their inclusion does not grant a general GPL or Creative Commons license to the logo.
