import {seededRoundV1} from './rounds/seed-v1.js';
export const ROUND_SIZE = 10;
export const STORAGE_KEY = 'bird-or-not:sri-lanka:v1';
export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function createRound(birds, random = Math.random) {
  const unusual=birds.filter(b=>b.oddName), familiar=birds.filter(b=>!b.oddName);
  const picked=unusual.length>=5&&familiar.length>=5 ? shuffle([...shuffle(unusual,random).slice(0,5),...shuffle(familiar,random).slice(0,5)],random) : shuffle(birds,random).slice(0,ROUND_SIZE);
  const used=new Set(),chosen=[];
  function assign(i){if(i===picked.length)return true;for(const fake of shuffle(picked[i].fakes,random)){if(used.has(fake))continue;used.add(fake);chosen[i]=fake;if(assign(i+1))return true;used.delete(fake);}return false;}
  if(!assign(0))throw Error('Not enough distinct fictional names');
  return picked.map((bird,i) => ({bird, options: shuffle([bird.name,chosen[i]], random)}));
}
export function readRecords(storage) {
  try {const r=JSON.parse(storage.getItem(STORAGE_KEY));if(!r||typeof r!=='object') return [];
    return (Array.isArray(r)?r:[]).filter(x=>Number.isInteger(x.score)&&x.score>=0&&x.score<=ROUND_SIZE&&typeof x.date==='string'&&!Number.isNaN(Date.parse(x.date))).slice(0,5);
  } catch { return []; }
}
export function saveRecord(storage, records, score) {
  const next=[...records,{score,date:new Date().toISOString()}].sort((a,b)=>b.score-a.score||b.date.localeCompare(a.date)).slice(0,5);
  try {storage.setItem(STORAGE_KEY,JSON.stringify(next));return {records:next,saved:true};} catch {return {records:next,saved:false};}
}
export function rank(score) {return score===10?'Suspiciously good.':score>=8?'Quite the bird brain.':score>=5?'A promising fledgling.':'Thoroughly bamboozled.';}

// Archive each catalogue revision before changing names, fakes or bird records.
export const CATALOG_VERSION = 3;
export function encodeRound(round, catalog, version = CATALOG_VERSION) {
  if(round.length!==ROUND_SIZE) throw Error('Incomplete flock');
  return version+'.'+round.map(q=>{
    const i=catalog.findIndex(b=>b.id===q.bird.id),side=q.options.indexOf(q.bird.name);
    const fake=catalog[i]?.fakes.indexOf(q.options[1-side]);
    if(i<0||fake<0||![0,1].includes(side))throw Error('Unknown question');
    return [i.toString(36),fake.toString(36),side].join('-');
  }).join('.');
}
export function roundVersion(token) {
  const compact=typeof token==='string'&&/^([1-9][0-9]*)-([A-Za-z0-9_-]{8})$/.exec(token);
  if(compact){const version=Number(compact[1]);if(token.length>30||!Number.isSafeInteger(version)||version>CATALOG_VERSION)throw Error('Unsupported flock link');return version;}
  if(typeof token!=='string'||token.length>300||!/^([1-9][0-9]*)\.(?:[0-9a-z]+-[0-9a-z]+-[01]\.){9}[0-9a-z]+-[0-9a-z]+-[01]$/.test(token))throw Error('Invalid flock link');
  const version=Number(token.split('.')[0]);
  if(!Number.isSafeInteger(version)||version>CATALOG_VERSION)throw Error('Unsupported flock link');
  return version;
}
export function decodeRound(token,catalog) {
  roundVersion(token);if(!token.includes('.'))return seededRoundV1(catalog,token.slice(token.indexOf('-')+1));const seen=new Set();
  return token.split('.').slice(1).map(part=>{
    const [id,f,s]=part.split('-'),i=parseInt(id,36),fake=parseInt(f,36),side=Number(s),bird=catalog[i];
    if(!bird||!bird.fakes[fake]||seen.has(i))throw Error('Unknown or repeated bird');
    seen.add(i);const options=side?[bird.fakes[fake],bird.name]:[bird.name,bird.fakes[fake]];
    return {bird,options};
  });
}
export function shareText(answers) {
  return `Bird or Not? 🐦 ${answers.filter(Boolean).length}/10\n${answers.map(v=>v?'🟩':'⬜').join('')}\nSame ten birds. Can you beat my score?`;
}

export function newRoundCode(version=CATALOG_VERSION) {
  const bytes=crypto.getRandomValues(new Uint8Array(6));
  const seed=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_');
  const code=version+'-'+seed;roundVersion(code);return code;
}
export function roundFragment(token) {
  roundVersion(token);return token.includes('.')?'#r='+token:'#'+token;
}
