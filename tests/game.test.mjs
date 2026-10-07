import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
  CATALOG_VERSION, ROUND_SIZE, STORAGE_KEY, createRound, decodeRound,
  encodeRound, newRoundCode, rank, readRecords, roundFragment, roundVersion,
  saveRecord, scoreAnswers, shareText, shuffle,
} from '../public/game.js';
import {
  COLLECTION_KEY, collectBird, newResetGeneration, readCollection, saveCollection,
} from '../public/collection.js';

const read = path => readFileSync(new URL(path, import.meta.url));
const json = path => JSON.parse(read(path));
const birds = json('../public/birds.json');
const fixtures = json('./fixtures/published-rounds.json');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

function random(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

test('published seed module and all archived catalogs remain byte identical', () => {
  assert.equal(hash(read('../public/rounds/seed-v1.js')), fixtures.seedModuleSha256);
  for (const [version, fixture] of Object.entries(fixtures.catalogs)) {
    assert.equal(hash(read(`../public/rounds/catalog-${version}.json`)), fixture.sha256);
  }
  assert.deepEqual(json(`../public/rounds/catalog-${CATALOG_VERSION}.json`), birds);
});

test('compact and verbose codes replay the same published birds, fakes and sides', () => {
  for (const [version, fixture] of Object.entries(fixtures.catalogs)) {
    const catalog = json(`../public/rounds/catalog-${version}.json`);
    for (const [compact, verbose] of Object.entries(fixture.rounds)) {
      const round = decodeRound(compact, catalog);
      assert.deepEqual(round, decodeRound(verbose, catalog));
      assert.equal(encodeRound(round, catalog, Number(version)), verbose);
      assert.equal(roundVersion(compact), Number(version));
      assert.equal(roundVersion(verbose), Number(version));
      assert.equal(roundFragment(compact), `#${compact}`);
      assert.equal(roundFragment(verbose), `#r=${verbose}`);
    }
  }
});

test('unseeded round cleanup preserves the random draw order and backtracking', () => {
  const rounds = Array.from({length: 128}, (_, seed) =>
    encodeRound(createRound(birds, random(seed)), birds));
  assert.equal(hash(rounds.join('\n')), fixtures.createdRoundsSha256);
});

test('rounds have ten unique birds and fakes, with independent answer positions', () => {
  let foundUnbalancedRound = false;
  const sides = new Set();
  for (let seed = 0; seed < 128; seed++) {
    const code = `3-${Buffer.from([0, 0, 0, 0, 0, seed]).toString('base64url')}`;
    const round = decodeRound(code, birds);
    assert.equal(round.length, ROUND_SIZE);
    assert.equal(new Set(round.map(q => q.bird.id)).size, ROUND_SIZE);
    assert.equal(round.filter(q => q.bird.oddName).length, 5);
    const fakes = round.map(q => {
      assert.equal(q.options.length, 2);
      assert.equal(q.options.filter(name => name === q.bird.name).length, 1);
      sides.add(q.options.indexOf(q.bird.name));
      return q.options.find(name => name !== q.bird.name);
    });
    assert.equal(new Set(fakes).size, ROUND_SIZE);
    if (round.filter(q => q.options[0] === q.bird.name).length !== 5) {
      foundUnbalancedRound = true;
    }
  }
  assert.deepEqual([...sides].sort(), [0, 1]);
  assert(foundUnbalancedRound, 'Do not force an equal A/B split in each round');
});

test('shuffle keeps its input intact and handles a small fallback catalog', () => {
  const original = [1, 2, 3];
  assert.deepEqual(shuffle(original, () => 0), [2, 3, 1]);
  assert.deepEqual(original, [1, 2, 3]);
  const catalog = birds.slice(0, 10).map(bird => ({...bird, oddName: false}));
  assert.equal(createRound(catalog, random(42)).length, ROUND_SIZE);
});

test('an impossible set of fictional names fails rather than repeating a fake', () => {
  const catalog = birds.slice(0, 10).map(bird => ({...bird, fakes: ['One fake']}));
  assert.throws(() => createRound(catalog, random(1)), /distinct fictional names/);
});

test('malformed, unsupported, repeated and out of range codes are rejected', () => {
  const bad = [
    '', null, '0-AAAAAAAA', '4-AAAAAAAA', '3-AAAAAAA', '3-AAAAAAAAA',
    '3-AAAAAAA!', '3-AAAA AAA', '9999999999999999999999999-AAAAAAAA',
    '<script>', `3.${'x'.repeat(301)}`,
    `3.${Array(10).fill('0-0-0').join('.')}`,
    `3.${Array.from({length: 10}, (_, i) => `${i.toString(36)}-zzz-0`).join('.')}`,
    `3.${Array.from({length: 10}, (_, i) => `${(i + 1000).toString(36)}-0-0`).join('.')}`,
  ];
  for (const code of bad) assert.throws(() => decodeRound(code, birds), String(code));
  assert.throws(() => encodeRound([], birds), /Incomplete flock/);
});

test('new codes retain the six-byte URL-safe seed format', () => {
  for (const version of [1, 2, 3]) {
    const code = newRoundCode(version);
    assert.match(code, new RegExp(`^${version}-[A-Za-z0-9_-]{8}$`));
    assert.equal(atob(code.slice(2).replace(/-/g, '+').replace(/_/g, '/')).length, 6);
  }
  assert.notDeepEqual(decodeRound('3-AAAAAAAA', birds), decodeRound('3-AAAAAAAB', birds));
});

test('shared results report the score and grid without bird names or fake answers', () => {
  for (const total of [0, 1, 5, 9, 10]) {
    const answers = Array.from({length: ROUND_SIZE}, (_, i) => i < total);
    const text = shareText(answers);
    assert(text.includes(`${total}/10`));
    assert.equal([...text].filter(char => char === '🟩').length, total);
    assert.equal([...text].filter(char => char === '⬜').length, ROUND_SIZE - total);
    for (const bird of birds) {
      assert(!text.includes(bird.name));
      for (const fake of bird.fakes) assert(!text.includes(fake));
    }
  }
});

test('score ranks preserve the published thresholds', () => {
  assert.deepEqual([0, 4, 5, 7, 8, 9, 10].map(rank), [
    'Thoroughly bamboozled.', 'Thoroughly bamboozled.',
    'A promising fledgling.', 'A promising fledgling.',
    'Quite the bird brain.', 'Quite the bird brain.', 'Suspiciously good.',
  ]);
});

test('scoring counts submitted correct answers without changing the answers', () => {
  for (let total = 0; total <= ROUND_SIZE; total++) {
    const answers = Array.from({length: ROUND_SIZE}, (_, index) => index < total);
    const before = [...answers];
    assert.equal(scoreAnswers(answers), total);
    assert.deepEqual(answers, before);
  }
  assert.equal(scoreAnswers([]), 0);
});

test('top five scores persist, with newest dates first when scores tie', () => {
  const storage = memoryStorage();
  let records = [];
  for (const score of [6, 10, 2, 8, 4, 9, 7]) {
    records = saveRecord(storage, records, score).records;
  }
  assert.deepEqual(readRecords(storage).map(record => record.score), [10, 9, 8, 7, 6]);
  const tied = saveRecord(storage, [
    {score: 10, date: '2026-10-01T12:00:00Z'},
    {score: 10, date: '2026-10-02T12:00:00Z'},
  ], 0).records;
  assert.equal(tied[0].date, '2026-10-02T12:00:00Z');
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).length, 3);
});

test('invalid score records and unavailable storage do not prevent playing', () => {
  for (const raw of ['{bad', 'null', '{}', JSON.stringify([
    {score: 11, date: '2026-10-01'}, {score: 8, date: 'invalid'},
    {score: -1, date: '2026-10-01'}, {score: 1.5, date: '2026-10-01'},
  ])]) assert.deepEqual(readRecords({getItem: () => raw}), []);
  assert.deepEqual(readRecords({getItem() {throw Error('Blocked');}}), []);
  const result = saveRecord({setItem() {throw Error('Quota');}}, [], 8);
  assert.equal(result.saved, false);
  assert.equal(result.records[0].score, 8);
});

test('collection deduplicates stable IDs and retains the first earned date', () => {
  const first = collectBird([], 'bird-1', '2026-10-01T12:00:00Z');
  const duplicate = collectBird(first.entries, 'bird-1', '2026-10-02T12:00:00Z');
  assert.equal(first.added, true);
  assert.equal(duplicate.added, false);
  assert.deepEqual(duplicate.entries, first.entries);
  const storage = memoryStorage();
  assert(saveCollection(storage, duplicate.entries));
  assert.deepEqual(readCollection(storage).entries, first.entries);
  assert.equal(JSON.parse(storage.getItem(COLLECTION_KEY)).version, 1);
});

test('corrupt and newer collections are reported without overwriting stored data', () => {
  for (const [raw, problem] of [
    ['{bad', 'corrupt'],
    [JSON.stringify({version: 1, entries: [{id: '<script>', earnedAt: null}]}), 'corrupt'],
    [JSON.stringify({version: 1, entries: [{id: 'bird-1', earnedAt: 'bad'}]}), 'corrupt'],
    [JSON.stringify({version: 2, entries: []}), 'unsupported'],
  ]) {
    let writes = 0;
    assert.equal(readCollection({getItem: () => raw, setItem() {writes++;}}).problem, problem);
    assert.equal(writes, 0);
  }
  assert.equal(readCollection({getItem() {throw Error('Blocked');}}).problem, 'unavailable');
  assert.equal(saveCollection({setItem() {throw Error('Quota');}}, []), false);
});

test('reset generations persist while legacy collection records remain readable', () => {
  const generation = newResetGeneration();
  assert.match(generation, /^[0-9a-f]{32}$/);
  const storage = memoryStorage();
  assert(saveCollection(storage, [], generation));
  assert.equal(readCollection(storage).generation, generation);
  assert.equal(readCollection({getItem: () => JSON.stringify({version: 1, entries: []})}).generation, 'initial');
});
