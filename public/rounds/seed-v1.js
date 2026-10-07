// Published seed format v1. Keep this algorithm unchanged for existing links.
// Codes carry a 48-bit random seed, not a truncated hash or an answer payload.
export function seededRoundV1(birds, encodedSeed) {
  if(!/^[A-Za-z0-9_-]{8}$/.test(encodedSeed))throw Error('Invalid flock seed');
  const bytes=atob(encodedSeed.replace(/-/g,'+').replace(/_/g,'/'));
  let state=0n;for(const byte of bytes)state=(state<<8n)|BigInt(byte.charCodeAt(0));
  const mask=(1n<<64n)-1n;
  function random(){
    state=(state+0x9e3779b97f4a7c15n)&mask;let z=state;
    z=((z^(z>>30n))*0xbf58476d1ce4e5b9n)&mask;
    z=((z^(z>>27n))*0x94d049bb133111ebn)&mask;
    z=z^(z>>31n);return Number(z>>11n)/9007199254740992;
  }
  function shuffled(items){const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
  if(!Array.isArray(birds)||birds.length<10)throw Error('Incomplete flock catalogue');
  const odd=birds.filter(b=>b.oddName),familiar=birds.filter(b=>!b.oddName);
  const picked=odd.length>=5&&familiar.length>=5?shuffled([...shuffled(odd).slice(0,5),...shuffled(familiar).slice(0,5)]):shuffled(birds).slice(0,10);
  const used=new Set(),chosen=[];
  function assign(i){if(i===picked.length)return true;for(const fake of shuffled(picked[i].fakes)){if(used.has(fake))continue;used.add(fake);chosen[i]=fake;if(assign(i+1))return true;used.delete(fake);}return false;}
  if(!assign(0))throw Error('Not enough distinct fictional names');
  return picked.map((bird,i)=>({bird,options:shuffled([bird.name,chosen[i]])}));
}
