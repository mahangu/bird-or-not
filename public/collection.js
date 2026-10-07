export const COLLECTION_KEY='bird-or-not:collection:v1';
const empty=problem=>({entries:[],generation:'initial',problem});
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$/.test(id);
export function readCollection(storage){
  let raw;try{raw=storage.getItem(COLLECTION_KEY);}catch{return empty('unavailable');}
  if(raw===null)return empty(null);
  let value;try{value=JSON.parse(raw);}catch{return empty('corrupt');}
  if(!value||typeof value!=='object'||!Array.isArray(value.entries))return empty('corrupt');
  if(value.version!==1)return empty('unsupported');
  if(value.entries.length>2000)return empty('corrupt');
  const entries=[],seen=new Set();let problem=null;
  for(const item of value.entries){
    if(!item||!validId(item.id)||(item.earnedAt!=null&&(typeof item.earnedAt!=='string'||Number.isNaN(Date.parse(item.earnedAt))))){problem='corrupt';continue;}
    if(seen.has(item.id))continue;seen.add(item.id);entries.push({id:item.id,earnedAt:item.earnedAt||null});
  }
  const generation=value.generation??'initial';if(!validId(generation))problem='corrupt';return {entries,generation:validId(generation)?generation:'initial',problem};
}
export function collectBird(entries,id,earnedAt=new Date().toISOString()){
  if(!validId(id))throw Error('Invalid bird ID');
  if(entries.some(e=>e.id===id))return {entries,added:false};
  return {entries:[...entries,{id,earnedAt}],added:true};
}
export function saveCollection(storage,entries,generation='initial'){
  try{storage.setItem(COLLECTION_KEY,JSON.stringify({version:1,generation,entries}));return true;}catch{return false;}
}

export function newResetGeneration(){return Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');}
