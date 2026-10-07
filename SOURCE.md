# Source provenance

The initial repository snapshot is a supported Spacefast archive, not a scrape of the deployed site.

- Space: `spc_8eb0898b9f284faeb21233d21f8ec379`
- Release: v17 (`ver_eb7ab74a94e74b8e8974640f0bab858c`)
- Hosted source commit: `ee2631dfd6438de6269c0d2f8745f756c8f2407e`
- Exported: 2026-10-07, using the existing authenticated Spacefast CLI
- Contents: 109 files, 39,174,796 uncompressed bytes

```sh
sf source archive \
  --space spc_8eb0898b9f284faeb21233d21f8ec379 \
  --connection-type hosted \
  --ref ee2631dfd6438de6269c0d2f8745f756c8f2407e \
  --output bird-or-not-v17.tar.gz \
  --archive-prefix bird-or-not-v17/
```

The archive's files were placed in `public/` without content changes for the first Git commit. Cleanup changes `app.js`, `game.js` and `collection.js`; `index.html` and `style.css` add footer links to the source and code license. Artwork, credits, bird data, all three catalogues and the published seed module retain their source bytes. The imported archive contains the static site; it does not include the upstream Git history or earlier local research scripts.

Replay fixtures in `tests/fixtures/published-rounds.json` were recorded from the unmodified import. They pin the seed module and catalogues by SHA-256, selected published compact rounds by their verbose encoding, and the original random draw order for 128 `createRound` runs.
