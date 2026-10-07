// SPDX-License-Identifier: GPL-2.0-only
import {chromium, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

const fixtures = JSON.parse(await readFile('tests/fixtures/published-rounds.json', 'utf8'));
const baseURL = process.env.BIRD_TEST_URL || 'http://127.0.0.1:4173';
const issues = [];
const results = [];
let server;
let browser;

async function ready(page) {
  await expect(page.locator('.answer')).toHaveCount(2);
  await expect(page.locator('.answer').first()).toBeEnabled();
}

function monitor(page) {
  page.on('pageerror', error => issues.push(error.message));
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) issues.push(message.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) issues.push(`HTTP ${response.status()}: ${response.url()}`);
  });
}

function expectedRound(verbose, catalog) {
  return verbose.split('.').slice(1).map(part => {
    const [birdIndex, fakeIndex, side] = part.split('-');
    const bird = catalog[parseInt(birdIndex, 36)];
    const fake = bird.fakes[parseInt(fakeIndex, 36)];
    return {bird, options: side === '0' ? [bird.name, fake] : [fake, bird.name]};
  });
}

async function play(page, round, total) {
  for (const [index, question] of round.entries()) {
    assert.deepEqual(await page.locator('.answer > span:nth-child(2)').allTextContents(), question.options);
    const correct = question.options.indexOf(question.bird.name);
    const chosen = index < total ? correct : 1 - correct;
    const keys = index % 2 ? ['1', '2'] : ['a', 'b'];
    await page.keyboard.press(keys[chosen]);
    await expect(page.locator('.answer:disabled')).toHaveCount(2);
    await expect(page.locator('.reveal-title')).toHaveText(question.bird.name);
    await expect(page.locator('.round-score strong')).toHaveText(`${Math.min(index + 1, total)} / 10`);
    await page.keyboard.press(keys[1 - chosen]);
    await expect(page.locator('.round-score strong')).toHaveText(`${Math.min(index + 1, total)} / 10`);
    await expect(page.locator('#next')).toBeFocused();
    await page.keyboard.press('Enter');
  }
  await expect(page.locator('.result-number')).toHaveAttribute('aria-label', `${total} out of 10`);
}

try {
  if (!process.env.BIRD_TEST_URL) {
    server = spawn(process.execPath, ['scripts/serve.mjs'], {env: {...process.env, PORT: '4173'}});
    server.stderr.pipe(process.stderr);
    await Promise.race([
      once(server.stdout, 'data'),
      once(server, 'exit').then(([code]) => {throw Error(`Dev server exited: ${code}`);}),
    ]);
  }
  browser = await chromium.launch({channel: process.env.BIRD_BROWSER_CHANNEL || 'chrome', headless: true});
  const context = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {value: async payload => {window.sharedResult = payload;}});
  });
  const page = await context.newPage();
  monitor(page);

  for (const version of [1, 2, 3]) {
    const catalog = JSON.parse(await readFile(`public/rounds/catalog-${version}.json`, 'utf8'));
    const compact = `${version}-AAAAAAAA`;
    const verbose = fixtures.catalogs[version].rounds[compact];
    const round = expectedRound(verbose, catalog);
    const total = (version - 1) * 5;
    for (const token of [compact, `r=${verbose}`]) {
      await page.goto(`${baseURL}/#${token}`);
      await ready(page);
      assert.equal(new URL(page.url()).hash, `#${token}`);
      await play(page, round, total);
      await page.locator('#share').click();
      const payload = await page.evaluate(() => window.sharedResult);
      assert.equal(payload.url, `${baseURL}/#${token}`);
      assert(payload.text.includes(`${total}/10`));
      assert(!round.some(question => payload.text.includes(question.bird.name)));
      results.push(`Catalog ${version}, ${token === compact ? 'compact' : 'verbose'}: exact replay and ${total}/10 score.`);
    }
  }
  await expect(page.locator('#best')).toHaveText('10/10');
  await page.locator('#scores-button').click();
  assert.deepEqual(await page.locator('.scores strong').allTextContents(), ['10/10', '10/10', '5/10', '5/10', '0/10']);
  await page.keyboard.press('Escape');
  await page.locator('#again').click();
  await ready(page);
  const newHash = new URL(page.url()).hash;
  assert.match(newHash, /^#3-[A-Za-z0-9_-]{8}$/);
  const names = await page.locator('.answer > span:nth-child(2)').allTextContents();
  await page.reload();
  await ready(page);
  assert.deepEqual(await page.locator('.answer > span:nth-child(2)').allTextContents(), names);
  await expect(page.locator('#best')).toHaveText('10/10');
  await page.locator('#flock-button').click();
  await expect(page.locator('.flock-card')).not.toHaveCount(0);
  await page.locator('#back-to-game').click();
  assert.equal(new URL(page.url()).hash, newHash);
  assert.deepEqual(await page.locator('.answer > span:nth-child(2)').allTextContents(), names);
  results.push('Fresh compact links, reload, top-five persistence and My flock navigation preserve game state.');

  await page.setViewportSize({width: 375, height: 812});
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mkdir('qa', {recursive: true});
  await page.screenshot({path: 'qa/mobile-game.png', fullPage: true});

  await page.goto(`${baseURL}/#4-AAAAAAAA`);
  await ready(page);
  await expect(page.locator('body')).toContainText('That flock link could not be opened.');
  assert.match(new URL(page.url()).hash, /^#3-[A-Za-z0-9_-]{8}$/);
  results.push('Unsupported links recover to a new round; mobile layout has no horizontal overflow.');

  const blockedContext = await browser.newContext();
  await blockedContext.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {get() {throw Error('Blocked');}});
  });
  const blocked = await blockedContext.newPage();
  monitor(blocked);
  await blocked.goto(`${baseURL}/#3-AAAAAAAA`);
  await ready(blocked);
  const catalog = JSON.parse(await readFile('public/rounds/catalog-3.json', 'utf8'));
  await play(blocked, expectedRound(fixtures.catalogs[3].rounds['3-AAAAAAAA'], catalog), 5);
  await expect(blocked.locator('.storage-note')).toContainText('couldn’t save');
  await blockedContext.close();
  results.push('Blocked storage still permits a full 5/10 round and reports the failed score save.');

  assert.deepEqual(issues, []);
  await writeFile('qa/browser-results.json', JSON.stringify({browser: browser.version(), results, issues}, null, 2) + '\n');
  for (const result of results) console.log('PASS:', result);
  console.log('PASS: 70 scored answers; zero unexpected browser errors or warnings.');
} finally {
  await browser?.close();
  server?.kill();
}
