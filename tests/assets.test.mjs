import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root = new URL('../public/', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const manifest = JSON.parse(read('asset-licenses.json'));

test('every shipped image and font has complete notices and a matching hash', () => {
  const byPath = new Map(manifest.assets.map(asset => [asset.path, asset]));
  assert.equal(byPath.size, manifest.assets.length);
  const binaries = [];
  function walk(path) {
    for (const file of readdirSync(new URL(path, root), {withFileTypes: true})) {
      const child = `${path}${file.name}`;
      if (file.isDirectory()) walk(`${child}/`);
      else if (/\.(jpg|png|woff2)$/i.test(file.name)) binaries.push(child);
    }
  }
  walk('assets/');
  assert.equal(binaries.length, manifest.assets.length);
  for (const path of binaries) {
    const asset = byPath.get(path);
    assert(asset, path);
    for (const field of ['creator', 'source', 'license', 'licenseUrl', 'changes', 'sha256']) {
      assert(asset[field], `${path}: ${field}`);
    }
    assert.equal(createHash('sha256').update(read(path)).digest('hex'), asset.sha256, path);
    if (asset.license.includes('BY-SA')) assert.equal(asset.adaptationLicense, asset.license);
    if (asset.licenseFile) assert(existsSync(new URL(asset.licenseFile, root)));
    if (asset.license === 'Public domain') assert(asset.publicDomainBasis || asset.licenseBasis?.length);
  }
  assert(existsSync(new URL('assets/icons/LICENSE-lucide.txt', root)));
});

test('current and archived species reference retained credited assets', () => {
  const byPath = new Map(manifest.assets.map(asset => [asset.path, asset]));
  for (const path of ['birds.json', 'rounds/catalog-1.json', 'rounds/catalog-2.json', 'rounds/catalog-3.json']) {
    const catalog = JSON.parse(read(path));
    assert.equal(new Set(catalog.map(bird => bird.id)).size, catalog.length);
    for (const bird of catalog) {
      assert(byPath.has(bird.image), `${path}: ${bird.image}`);
      assert(bird.artist && bird.source && bird.license && bird.licenseUrl && bird.changes, bird.name);
      assert.equal(byPath.get(bird.image).license, bird.license, bird.image);
    }
  }
});
