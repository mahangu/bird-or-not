// SPDX-License-Identifier: GPL-2.0-only
import {COLLECTION_KEY,readCollection,collectBird,saveCollection,newResetGeneration} from './collection.js';
import {readRecords,saveRecord,rank,scoreAnswers,ROUND_SIZE,decodeRound,roundVersion,shareText,CATALOG_VERSION,newRoundCode,roundFragment} from './game.js';
// Lucide SVG icons, ISC/MIT licences in assets/icons/LICENSE-lucide.txt.
const uiIcons={'mouse-pointer-2': '<svg class="ui-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z" /></svg>', 'external-link': '<svg class="ui-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M15 3h6v6" />\n  <path d="M10 14 21 3" />\n  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>', 'arrow-right': '<svg class="ui-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14" />\n  <path d="m12 5 7 7-7 7" /></svg>', 'check': '<svg class="ui-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5" /></svg>', 'x': '<svg class="ui-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M18 6 6 18" />\n  <path d="m6 6 12 12" /></svg>', 'circle': '<svg class="ui-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10" /></svg>', 'share-2': '<svg class="ui-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="18" cy="5" r="3" />\n  <circle cx="6" cy="12" r="3" />\n  <circle cx="18" cy="19" r="3" />\n  <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />\n  <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" /></svg>'};
const icon=name=>uiIcons[name]||'';
const main=document.querySelector('#game');
const dialog=document.querySelector('#dialog');
let birds=[],round=[],index=0,answers=[],records=[],revealed=false,finished=false,storage,saved=true,roundToken='';
try{storage=window.localStorage;records=readRecords(storage);}catch{storage={getItem(){return null},setItem(){throw Error('Storage unavailable')}};saved=false;}
const flockView=document.querySelector('#flock-view'),flockButton=document.querySelector('#flock-button');
let collectionState=saved?readCollection(storage):{entries:[],problem:'unavailable'};
let flock=collectionState.entries,flockProblem=collectionState.problem,flockCanSave=!flockProblem,collectionMessage='',flockGeneration=collectionState.generation||'initial',resetMessage='';
function knownFlock(){const byId=new Map(birds.map(b=>[b.id,b]));return flock.filter(e=>byId.has(e.id)).map(e=>({bird:byId.get(e.id),earnedAt:e.earnedAt})).sort((a,b)=>(Date.parse(b.earnedAt)||0)-(Date.parse(a.earnedAt)||0));}
function updateFlockCount(){const count=knownFlock().length;document.querySelector('#flock-count').textContent=count;flockButton.setAttribute('aria-label',`My flock, ${count} of ${birds.length} birds collected`);}
function flockNotice(){return flockProblem==='unavailable'?"Your browser couldn't save your flock. You can collect birds for this visit, but they may disappear when you leave.":flockProblem==='unsupported'?"Your saved flock uses a newer format. It has been kept. New birds stay in this tab until you reset My flock.":flockProblem==='corrupt'?"Your saved flock couldn't be fully read. The stored data has been kept; new birds stay in this tab until you reset My flock.":'Saved in this browser. Clearing site data removes your flock.';}
function earnBird(bird){
 if(flockCanSave){const latest=readCollection(storage);if(latest.problem){flockProblem=latest.problem;flockCanSave=false;}else {flock=latest.entries;flockGeneration=latest.generation;}}
 const result=collectBird(flock,bird.id);flock=result.entries;
 if(result.added&&flockCanSave&&!saveCollection(storage,flock,flockGeneration)){flockCanSave=false;flockProblem='unavailable';}
 updateFlockCount();collectionMessage=result.added?(flockCanSave?'Added to My flock.':'Added to My flock for this visit. '+flockNotice()):'Already in My flock.';
}
function renderFlock(){
 const earned=knownFlock();
 flockView.innerHTML=`<div class="flock-top"><div><p class="eyebrow">Your growing collection</p><h1 id="flock-heading" tabindex="-1">My flock.</h1></div><button class="primary" id="back-to-game">Back to the game ${icon('arrow-right')}</button></div><p class="flock-progress" role="status">${earned.length} of ${birds.length} birds collected</p><p class="flock-intro">Guess a real name correctly to add its bird. Each bird joins once, including in shared flocks.</p><p class="flock-storage" role="status">${flockNotice()}</p>${resetMessage?`<p class="flock-storage" role="status">${escape(resetMessage)}</p>`:''}${earned.length?`<div class="flock-grid">${earned.map(({bird,earnedAt})=>`<article class="flock-card" data-bird-id="${escape(bird.id)}">${art(bird,true,'flock-')}<h2>${escape(bird.name)}</h2><p class="flock-scientific">${escape(bird.scientific)}</p><p class="fact">${escape(bird.fact)} <a class="wiki-link" href="${escape(bird.wikiUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Read about ${escape(bird.name)} on Wikipedia">Wikipedia ${icon('external-link')}</a></p>${earnedAt?`<p class="flock-earned">Joined <time datetime="${escape(earnedAt)}">${new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(earnedAt))}</time></p>`:''}</article>`).join('')}</div>`:`<div class="flock-empty"><span aria-hidden="true">${icon('circle')}</span><h2>The first perch is waiting.</h2><p>Play a flock and guess a real bird name correctly to start your collection.</p></div>`}<p class="flock-unfound">${birds.length-earned.length} birds still to find. Their names stay a surprise.</p><div class="flock-bottom"><button class="text-button" id="reset-flock">Reset My flock</button><p>Your scores and current round are kept separately.</p></div>`;
 document.querySelector('#back-to-game').addEventListener('click',closeFlock);
 document.querySelector('#reset-flock').addEventListener('click',()=>{
  if(!window.confirm(`Reset My flock? This removes all ${flock.length} collected birds from this browser. Your scores and current round will stay.`))return;
  flock=[];flockGeneration=newResetGeneration();flockCanSave=saveCollection(storage,flock,flockGeneration);flockProblem=flockCanSave?null:'unavailable';resetMessage=flockCanSave?'My flock reset. Your scores and current round are unchanged.':"This reset couldn't be saved. Your older flock may return when you reload.";updateFlockCount();renderFlock();document.querySelector('#flock-heading').focus();
 });
}
function openFlock(){if(!flockView.hidden){closeFlock();return;}renderFlock();main.hidden=true;flockView.hidden=false;flockButton.setAttribute('aria-expanded','true');document.querySelector('#flock-heading').focus();}
function closeFlock(){flockView.hidden=true;main.hidden=false;flockButton.setAttribute('aria-expanded','false');(main.querySelector(finished?'#again':revealed?'#next':'[data-option]')||main).focus({preventScroll:true});}
flockButton.addEventListener('click',openFlock);
document.querySelector('.skip').addEventListener('click',()=>{if(!flockView.hidden)closeFlock();});
window.addEventListener('storage',e=>{if(e.key!==COLLECTION_KEY||!flockCanSave)return;const next=readCollection(storage);flock=next.entries;flockGeneration=next.generation;resetMessage='';flockProblem=next.problem;flockCanSave=!flockProblem;updateFlockCount();if(!flockView.hidden)renderFlock();});
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const best=()=>records.length?Math.max(...records.map(r=>r.score)):0;
const score=()=>scoreAnswers(answers);
function updateBest(){document.querySelector('#best').textContent=`${best()}/10`;}
function art(bird,answer=false,prefix=''){
 const [x,y,w,h]=bird.crop;const W=bird.width,H=bird.height;
 const imageLabel=answer?bird.name:(bird.medium==='photograph'?'Bird photograph. ':bird.medium==='illustration'?'Bird illustration. ':'Vintage natural-history illustration. ')+(bird.subject||'Identify the pictured species.');
 return `<div class="art-column"><figure class="art-stage"><svg class="art-window ${bird.medium==='photograph'?'photo':''}" viewBox="${x*W} ${y*H} ${w*W} ${h*H}" role="img" aria-label="${escape(imageLabel)}"><defs><clipPath id="crop-${prefix}${bird.id}"><rect x="${x*W}" y="${y*H}" width="${w*W}" height="${h*H}"/></clipPath></defs><image clip-path="url(#crop-${prefix}${bird.id})" href="${escape(bird.image)}" width="${W}" height="${H}"/></svg></figure><div class="art-caption">${answer?`${escape(bird.artist)} · <a href="${escape(bird.source)}" target="_blank" rel="noopener">Original image ${icon('external-link')}</a>`:escape(bird.subject||'Real bird. Two names. Trust your instincts.')}</div></div>`;
}
function progress(){return `<div class="round-bottom"><div class="progress" aria-label="${answers.length} of ${ROUND_SIZE} answered">${round.map((_,i)=>`<span class="pip ${i<answers.length?(answers[i]?'right':'missed'):i===index?'current':''}" aria-label="Question ${i+1}: ${i<answers.length?(answers[i]?'correct':'incorrect'):i===index?'current':'unanswered'}"></span>`).join('')}</div><span class="round-note">10 birds. No timer. No Googling.</span></div>`;}
function renderQuestion(focus=false){
 const {bird,options}=round[index];const streak=answers.slice().reverse().findIndex(v=>!v);const currentStreak=streak<0?answers.length:streak;
 main.className=revealed?'reveal':'';
 main.innerHTML=`<div class="round-top"><span class="round-label">Name that bird <span class="round-number"><strong>${String(index+1).padStart(2,'0')}</strong> / 10</span></span><div class="round-score">${currentStreak>1?`<span>${currentStreak} in a row</span>`:''}<span>Score <strong>${score()} / 10</strong></span></div></div><section class="play-layout">${art(bird,revealed)}<div class="question-column">${revealed?`<p class="eyebrow verdict ${answers[index]?'':'incorrect'}" role="status">${answers[index]?'Correct. Nicely spotted.':'Fooled by a bird name.'}</p><h1 class="reveal-title" id="question-heading" tabindex="-1">${escape(bird.name)}</h1><p class="latin">${escape(bird.scientific)}${bird.endemic?' · Endemic to Sri Lanka':''}</p><p class="fact">${escape(bird.fact)} <a class="wiki-link" href="${escape(bird.wikiUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Read about ${escape(bird.name)} on Wikipedia">Wikipedia ${icon('external-link')}</a></p><p class="quip">${escape(bird.quip)}</p>${collectionMessage?`<p class="collection-message" role="status">${escape(collectionMessage)}</p>`:''}`:`<p class="eyebrow">One real bird. Two names.</p><h1 id="question-heading" tabindex="-1">Well, that’s<br>a name.</h1><p class="question-intro">Choose the real name.<br>Sounding ridiculous is no help whatsoever.</p>`}<div class="answers">${options.map((name,i)=>{let cls='';if(revealed)cls=name===bird.name?'correct':round[index].chosen===name?'wrong':'dim';return `<button class="answer ${cls}" data-option="${i}" ${revealed?'disabled':''}><span class="answer-key" aria-hidden="true">${i?'B':'A'}</span><span>${escape(name)}</span><span class="answer-arrow" aria-hidden="true">${revealed?(name===bird.name?icon('check'):round[index].chosen===name?icon('x'):''):icon('mouse-pointer-2')}</span></button>`;}).join('')}</div>${revealed?`<button class="primary next" id="next">${index===ROUND_SIZE-1?'The final verdict':'Another suspicious bird'} ${icon('arrow-right')}</button><a class="source-link" href="${escape(bird.reference)}" target="_blank" rel="noopener">Check the real bird list ${icon('external-link')}</a>`:'<p class="keyboard-hint">Choose a name, or press <kbd>A</kbd> or <kbd>B</kbd></p>'}</div></section>${progress()}`;
 main.querySelectorAll('[data-option]').forEach(button=>button.addEventListener('click',()=>guess(Number(button.dataset.option))));
 main.querySelector('#next')?.addEventListener('click',next);
 if(focus){if(revealed)main.querySelector('#next').focus({preventScroll:true});else main.querySelector('[data-option]').focus({preventScroll:true});}
 preloadNext();
}
function guess(choice) {
  if (revealed || finished || !round.length || !flockView.hidden) return;
  const question = round[index];
  question.chosen = question.options[choice];
  const correct = question.chosen === question.bird.name;
  answers.push(correct);
  collectionMessage = '';
  if (correct) earnBird(question.bird);
  revealed = true;
  renderQuestion(true);
}
function next() {
  if (!revealed || finished) return;
  if (index === ROUND_SIZE - 1) {
    finish();
    return;
  }
  index++;
  revealed = false;
  collectionMessage = '';
  renderQuestion(true);
}
function start(selected, token) {
  roundToken = token || newRoundCode();
  round = selected || decodeRound(roundToken, birds);
  history.replaceState(null, '', location.pathname + location.search + roundFragment(roundToken));
  index = 0;
  answers = [];
  collectionMessage = '';
  revealed = false;
  finished = false;
  renderQuestion();
}
function preloadNext(){if(round[index+1]){const image=new Image();image.src=round[index+1].bird.image;}}
function finish(){
 finished=true;const total=score(),previousBest=best();const result=saveRecord(storage,records,total);records=result.records;saved=result.saved;updateBest();
 const featured=round.find((q,i)=>!answers[i])?.bird||round[0].bird;
 main.className='';main.innerHTML=`<section class="result-layout"><div class="result-content"><p class="eyebrow">The verdict is in</p><div class="result-number" aria-label="${total} out of 10">${total}<span>/10</span></div><h1 tabindex="-1">${rank(total)}</h1>${total>previousBest?'<span class="new-best">A new personal best. Worth a little chirp.</span>':''}<p class="result-copy">${total===10?'Ten birds. Ten correct names. You’re officially the bird nerd of the group.':total>=7?'You know a real bird name when you see one. Mostly. There are more where those came from.':total>=4?'An entirely reasonable score in an unreasonable branch of English.':'The naming committee has a lot to answer for. Fancy another go?'}</p><div class="result-strip" aria-label="Round results">${answers.map((yes,i)=>`<span class="${yes?'right':'missed'}" role="img" aria-label="${escape(round[i].bird.name)}: ${yes?'correct':'incorrect'}" title="${escape(round[i].bird.name)}: ${yes?'correct':'incorrect'}">${icon(yes?'check':'x')}</span>`).join('')}</div><div class="result-actions"><button class="primary" id="again">Another flock ${icon('arrow-right')}</button><button class="text-button" id="share">Share this flock ${icon('share-2')}</button></div><button class="text-button result-flock" id="result-flock">View My flock · ${knownFlock().length} of ${birds.length}</button><p class="share-explainer">Friends get these exact ten birds. Answers stay out of the shared message.</p><p class="storage-note">${saved?'Best scores saved in this browser. No account, no fuss.':'Your browser couldn’t save this score. You can still keep playing.'}</p><p class="share-status" id="share-status" role="status"></p></div><div class="result-art">${art(featured,true)}</div></section>`;
 main.querySelector('#again').addEventListener('click',()=>{start();main.querySelector('[data-option]').focus({preventScroll:true});});
 main.querySelector('#result-flock').addEventListener('click',openFlock);main.querySelector('#share').addEventListener('click',share);main.querySelector('h1').focus({preventScroll:true});
}
async function share() {
  const text = shareText(answers);
  const url = location.origin + location.pathname + roundFragment(roundToken);
  try {
    if (navigator.share) {
      await navigator.share({title: 'Bird or Not?', text, url});
    } else {
      await navigator.clipboard.writeText(text + ' ' + url);
      document.querySelector('#share-status').textContent = 'Score and this exact flock copied. Send it to your flock.';
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      document.querySelector('#share-status').textContent = `Copy this: ${text} ${url}`;
    }
  }
}
function openDialog(content){document.querySelector('#dialog-content').innerHTML=content;dialog.showModal();}
document.querySelector('#close-dialog').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
document.querySelector('#about-button').addEventListener('click',()=>openDialog(`<h2>A bird. Two names.<br>One very real answer.</h2><div class="rules"><div class="rule"><b>1</b><div><strong>Meet a Sri Lankan bird.</strong>Some plates show more than one species. The caption tells you which bird to name.</div></div><div class="rule"><b>2</b><div><strong>Pick its actual name.</strong>Choose A or B. One is a real English bird name. The other is our invention.</div></div><div class="rule"><b>3</b><div><strong>See how you did.</strong>Ten questions, one point each. No clock. Your top five rounds stay in this browser.</div></div></div><p>This first flock has ${birds.length} species found in Sri Lanka, including ${birds.filter(b=>b.endemic).length} endemics. It’s a growing collection, not a complete field guide.</p>`));
document.querySelector('#scores-button').addEventListener('click',()=>openDialog(`<h2>Your pecking order.</h2><p>Top five completed rounds in this browser.</p>${records.length?`<ol class="scores">${records.map((r,i)=>`<li><span>${i+1}. <strong>${r.score}/10</strong></span><time datetime="${escape(r.date)}">${new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(r.date))}</time></li>`).join('')}</ol>`:'<p>No scores yet. Finish your first flock to put one on the board.</p>'}<p>Scores stay on this device. Clearing browser data clears them too.</p>`));
document.querySelector('#credits-button').addEventListener('click',()=>openDialog(`<h2>Old plates.<br>Questionable names.</h2><p>Historical illustrations are mostly by J. G. Keulemans, from W. V. Legge’s <em>A History of the Birds of Ceylon</em> (1878-1880). Modern illustration and photographs broaden the flock. All species have accepted Sri Lankan records; a photograph may have been taken elsewhere in the species’ range. Artwork uses public-domain scans or the credited Creative Commons licence. Each credit includes the creator, source, reuse terms and changes; follow the source for the original evidence.</p><p>Names and Sri Lankan occurrence were checked against <a href="https://avibase.bsc-eoc.org/checklist.jsp?lang=EN&region=LK" target="_blank" rel="noopener">Avibase’s Clements 2025 checklist</a> and the <a href="https://www.ceylonbirdclub.org/sri-lanka-bird-list.php" target="_blank" rel="noopener">Ceylon Bird Club</a>. Historical names on the plates can differ. Some plates show more than one species: the caption identifies the bird being asked about. Scans are resized, sometimes cropped, and blended with the cream background. Original scans and licence terms are linked below.</p><p>${birds.length} species in this edition. <a href="asset-licenses.json" target="_blank" rel="noopener">Complete asset licence manifest ${icon('external-link')}</a>. <a href="credits.html" target="_blank" rel="noopener">Full image and project credits ${icon('external-link')}</a>. Fonts: DM Sans by the DM Sans Project Authors and Cormorant by Christian Thalmann, under the SIL Open Font License; licence files are included with the fonts. Invented names and jokes are ours. The jokes roast English naming decisions; they are not historical etymologies. No bird has endorsed them.</p><div class="credits-list">${birds.map(b=>`<div class="credit"><strong>${escape(b.name)}</strong><span>${escape(b.scientific)}</span><a href="${escape(b.source)}" target="_blank" rel="noopener">${escape(b.artist)} ${icon('external-link')}</a><span><a href="${escape(b.licenseUrl)}" target="_blank" rel="noopener">${escape(b.license)} ${icon('external-link')}</a></span><span class="source-title">${escape(b.sourceTitle||'')}</span><span>${escape(b.credit||'')}</span>${b.provenanceNote?`<span>${escape(b.provenanceNote)}</span>`:''}${b.sourceRevision?`<span><a href="${escape(b.sourceRevision)}" target="_blank" rel="noopener">Reviewed source record ${icon('external-link')}</a></span>`:''}<span>${escape(b.changes)}${b.adaptationLicense?` Image adaptations remain under ${escape(b.adaptationLicense)}.`:''}</span></div>`).join('')}</div>`));
document.addEventListener('keydown',e=>{if(!dialog.open&&!flockView.hidden){if(e.key==='Escape'){e.preventDefault();closeFlock();}return;}if(dialog.open||e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target.matches('input,textarea,select'))return;const key=e.key.toLowerCase();if(!revealed&&!finished&&['a','b','1','2'].includes(key)){e.preventDefault();guess(['b','2'].includes(key)?1:0);}});
window.addEventListener('hashchange',()=>{if(location.hash!=='#game')location.reload();});
updateBest();
try{const response=await fetch('birds.json');if(!response.ok)throw Error('Bird list unavailable');birds=await response.json();if(!Array.isArray(birds)||birds.length<ROUND_SIZE)throw Error('Incomplete bird list');updateFlockCount();flockButton.disabled=false;
const fragment=location.hash.slice(1),token=fragment.startsWith('r=')?new URLSearchParams(fragment).get('r'):fragment==='game'?null:fragment;
if(token){try{const version=roundVersion(token);const archived=await fetch(`rounds/catalog-${version}.json`);if(!archived.ok)throw Error('Archived flock unavailable');const catalog=await archived.json();start(decodeRound(token,catalog),token);}catch{start();const note=document.createElement('p');note.className='storage-note';note.setAttribute('role','status');note.textContent='That flock link could not be opened. Here is a fresh flock to play.';main.before(note);}}
else start();}catch{main.innerHTML=`<div class="loading"><h1>The flock got lost.</h1><p>The bird book couldn’t load. Please check your connection and try again.</p><button class="primary" style="margin-top:25px" id="retry">Try again <svg class="ui-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14" />
  <path d="m12 5 7 7-7 7" /></svg></button></div>`;document.querySelector('#retry').addEventListener('click',()=>location.reload());}
