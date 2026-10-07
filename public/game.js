// SPDX-License-Identifier: GPL-2.0-only
import {seededRoundV1} from './rounds/seed-v1.js';

export const ROUND_SIZE = 10;
export const STORAGE_KEY = 'bird-or-not:sri-lanka:v1';
// Archive each catalogue revision before changing names, fakes or bird records.
export const CATALOG_VERSION = 3;

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createRound(birds, random = Math.random) {
  const unusual = birds.filter(bird => bird.oddName);
  const familiar = birds.filter(bird => !bird.oddName);
  const picked = unusual.length >= 5 && familiar.length >= 5
    ? shuffle([
      ...shuffle(unusual, random).slice(0, 5),
      ...shuffle(familiar, random).slice(0, 5),
    ], random)
    : shuffle(birds, random).slice(0, ROUND_SIZE);
  const used = new Set();
  const chosen = [];

  // Backtrack when a bird's fake choices are already used by earlier birds.
  function assign(index) {
    if (index === picked.length) return true;
    for (const fake of shuffle(picked[index].fakes, random)) {
      if (used.has(fake)) continue;
      used.add(fake);
      chosen[index] = fake;
      if (assign(index + 1)) return true;
      used.delete(fake);
    }
    return false;
  }

  if (!assign(0)) throw Error('Not enough distinct fictional names');
  // Each question shuffles its two options independently; do not balance A/B.
  return picked.map((bird, index) => ({
    bird,
    options: shuffle([bird.name, chosen[index]], random),
  }));
}

export function readRecords(storage) {
  try {
    const records = JSON.parse(storage.getItem(STORAGE_KEY));
    if (!records || typeof records !== 'object') return [];
    return (Array.isArray(records) ? records : []).filter(record =>
      Number.isInteger(record.score) && record.score >= 0 && record.score <= ROUND_SIZE
      && typeof record.date === 'string' && !Number.isNaN(Date.parse(record.date)),
    ).slice(0, 5);
  } catch {
    return [];
  }
}

export function saveRecord(storage, records, score) {
  const next = [...records, {score, date: new Date().toISOString()}]
    .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))
    .slice(0, 5);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
    return {records: next, saved: true};
  } catch {
    return {records: next, saved: false};
  }
}

export function scoreAnswers(answers) {
  return answers.filter(Boolean).length;
}

export function rank(score) {
  if (score === 10) return 'Suspiciously good.';
  if (score >= 8) return 'Quite the bird brain.';
  if (score >= 5) return 'A promising fledgling.';
  return 'Thoroughly bamboozled.';
}

export function encodeRound(round, catalog, version = CATALOG_VERSION) {
  if (round.length !== ROUND_SIZE) throw Error('Incomplete flock');
  const questions = round.map(question => {
    const index = catalog.findIndex(bird => bird.id === question.bird.id);
    const side = question.options.indexOf(question.bird.name);
    const fake = catalog[index]?.fakes.indexOf(question.options[1 - side]);
    if (index < 0 || fake < 0 || ![0, 1].includes(side)) throw Error('Unknown question');
    return [index.toString(36), fake.toString(36), side].join('-');
  });
  return version + '.' + questions.join('.');
}

export function roundVersion(token) {
  const compact = typeof token === 'string'
    && /^([1-9][0-9]*)-([A-Za-z0-9_-]{8})$/.exec(token);
  if (compact) {
    const version = Number(compact[1]);
    if (token.length > 30 || !Number.isSafeInteger(version) || version > CATALOG_VERSION) {
      throw Error('Unsupported flock link');
    }
    return version;
  }
  if (typeof token !== 'string' || token.length > 300
    || !/^([1-9][0-9]*)\.(?:[0-9a-z]+-[0-9a-z]+-[01]\.){9}[0-9a-z]+-[0-9a-z]+-[01]$/.test(token)) {
    throw Error('Invalid flock link');
  }
  const version = Number(token.split('.')[0]);
  if (!Number.isSafeInteger(version) || version > CATALOG_VERSION) {
    throw Error('Unsupported flock link');
  }
  return version;
}

export function decodeRound(token, catalog) {
  roundVersion(token);
  if (!token.includes('.')) {
    return seededRoundV1(catalog, token.slice(token.indexOf('-') + 1));
  }
  const seen = new Set();
  return token.split('.').slice(1).map(part => {
    const [id, fakeId, answerSide] = part.split('-');
    const index = parseInt(id, 36);
    const fake = parseInt(fakeId, 36);
    const side = Number(answerSide);
    const bird = catalog[index];
    if (!bird || !bird.fakes[fake] || seen.has(index)) throw Error('Unknown or repeated bird');
    seen.add(index);
    const options = side ? [bird.fakes[fake], bird.name] : [bird.name, bird.fakes[fake]];
    return {bird, options};
  });
}

export function shareText(answers) {
  return `Bird or Not? 🐦 ${scoreAnswers(answers)}/10\n${answers.map(value => value ? '🟩' : '⬜').join('')}\nSame ten birds. Can you beat my score?`;
}

export function newRoundCode(version = CATALOG_VERSION) {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const seed = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
  const code = version + '-' + seed;
  roundVersion(code);
  return code;
}

export function roundFragment(token) {
  roundVersion(token);
  return token.includes('.') ? '#r=' + token : '#' + token;
}
