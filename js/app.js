const APP_VERSION = 'V41_ASSINATURA_PREMIUM';
const ALLOWED_EMAILS = ['contato.marcusbuceles@gmail.com','contato.ingridbuceles@gmail.com'];
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCr-zPc9UqDSuQRBwXHYguCot9zeChOJI8",
  authDomain: "eterno-compromisso.firebaseapp.com",
  projectId: "eterno-compromisso",
  storageBucket: "eterno-compromisso.firebasestorage.app",
  messagingSenderId: "646110053768",
  appId: "1:646110053768:web:f37795ef1021555a72a63d",
  measurementId: "G-4GP9LFKZHS"
};

// Mantido igual à V23 para preservar progresso já marcado no Firebase.
const COUPLE_DOC = 'marcus_e_ingrid_essencial_v23';
const OPENAI_API_KEY_FIXA = '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';
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5-mini';
const STORAGE_KEY = 'ec_v41_assinatura_premium_state';
const LEGACY_STORAGE_KEYS = ['ec_v40_layout_ajustado_state','ec_v39_visual_palavra_state','ec_v38_premium_total_state','ec_v37_arthur_ilustrado_state','ec_v36_cronologico_state','ec_v35_final_state','ec_v34_refinamento_state','ec_v33_cinematic_state','ec_v32_imersivo_state','ec_v31_formal_state','ec_v29_final_visual_state','ec_v28_fluidez_state','ec_v27_premium_state','ec_v26_floral_state','ec_v25_pastel_state','ec_v24_essencial_state','ec_v23_essencial_state','ec_v22_essencial_state'];
const BR_TZ = 'America/Fortaleza';

let db=null, auth=null, user=null, ref=null, unsub=null, applyingRemote=false, cloudReady=false;
let PLAN=[], SEEDS=[];
let saveTimer=null, lastSyncAt=null, lastSyncStatus='local', swWaiting=null;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (n,min,max)=>Math.max(min,Math.min(max,Number(n)||min));
const safeHTML = s => String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const nl2br = s => safeHTML(s).replace(/\n/g,'<br>');
function appIcon(name){ return `<svg class="appSvg" aria-hidden="true"><use href="#i-${name}"></use></svg>`; }
function appIllu(name){ return `<svg class="heroIllu" aria-hidden="true"><use href="#illu-${name}"></use></svg>`; }

function dateKeyInBrazil(date=new Date()){
  const fmt=new Intl.DateTimeFormat('pt-BR',{timeZone:BR_TZ,year:'numeric',month:'2-digit',day:'2-digit'});
  const p=Object.fromEntries(fmt.formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function todayKey(){ return dateKeyInBrazil(new Date()); }
function parseYMD(key){ const [y,m,d]=String(key||todayKey()).split('-').map(Number); return Date.UTC(y||2026,(m||1)-1,d||1); }
function daysBetween(a,b){ return Math.floor((parseYMD(dateKeyInBrazil(new Date(b)))-parseYMD(a))/86400000); }
function dayOfYear(){ const k=todayKey(); const [y]=k.split('-').map(Number); return Math.floor((parseYMD(k)-Date.UTC(y,0,0))/86400000); }
function isBrazilSunday(){ return new Date(parseYMD(todayKey())).getUTCDay()===0; }
function weekKey(){
  const ms=parseYMD(todayKey());
  const d=new Date(ms);
  const day=d.getUTCDay();
  const monday=new Date(ms-((day+6)%7)*86400000);
  return monday.toISOString().slice(0,10);
}

const CHILD_THEMES = [
  {name:'Jesus me ama', truth:'Jesus ama Arthur.', phrase:'Jesus me ama.'},
  {name:'Deus cuida de mim', truth:'Deus cuida da nossa família.', phrase:'Deus cuida de mim.'},
  {name:'Obedecer com alegria', truth:'Obedecer a papai e mamãe agrada a Deus.', phrase:'Eu posso obedecer.'},
  {name:'Gratidão', truth:'Tudo de bom vem de Deus.', phrase:'Obrigado, Deus.'},
  {name:'Perdão', truth:'Jesus nos ensina a perdoar.', phrase:'Eu posso perdoar.'},
  {name:'Compartilhar', truth:'Deus se alegra quando repartimos.', phrase:'Eu posso compartilhar.'},
  {name:'Deus criou tudo', truth:'Deus fez o céu, a terra e as pessoas.', phrase:'Deus fez tudo.'},
  {name:'Oração simples', truth:'Deus ouve quando oramos.', phrase:'Deus me ouve.'},
  {name:'Sem medo', truth:'Deus está conosco.', phrase:'Deus está comigo.'},
  {name:'Amar a família', truth:'Deus quer amor dentro de casa.', phrase:'Eu amo minha família.'}
];

function emptyState(){
  return {
    version: APP_VERSION,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    activeTab: location.hash?.replace('#','') || 'hoje',
    reading: {
      startDate: todayKey(),
      currentDay: 1,
      readDays: {},
      notes: {},
      resetAt: Date.now(),
      showAll: false,
      searchDay: ''
    },
    checklist: {},
    devotions: { couple:{}, child:{} },
    history: { completedDevotions: [] },
    reviews: {},
    settings: { model: DEFAULT_MODEL, darkMode:false, childStoryPages:{} }
  };
}
let S = emptyState();


async function loadSvgSprite(){
  try{
    const host=document.getElementById('svgSprite');
    if(host && !host.innerHTML.trim()) { const [icons,illus] = await Promise.all([fetch('assets/icons.svg?v='+APP_VERSION).then(r=>r.text()), fetch('assets/illustrations.svg?v='+APP_VERSION).then(r=>r.text())]); host.innerHTML = icons + illus; }
  }catch(e){ console.warn('Ícones SVG indisponíveis', e); }
}
function hideSplash(){
  const s=document.getElementById('splash');
  if(!s) return;
  s.classList.add('splashHide');
  setTimeout(()=>s.classList.add('hidden'),420);
}

function toast(msg){ const t=$('#toast'); if(!t)return; t.textContent=msg; t.classList.add('show'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'),2700); }
function doneCount(){ return Object.values(S.reading?.readDays||{}).filter(Boolean).length; }
function pct(){ return Math.round(doneCount()/365*100); }
function currentDay(){ return clamp(S.reading?.currentDay||1,1,365); }
function expectedDay(){ return clamp(Math.floor((parseYMD(todayKey())-parseYMD(S.reading?.startDate||todayKey()))/86400000)+1,1,365); }
function currentPlan(){ return PLAN[currentDay()-1] || PLAN[0] || {day:1,reading:'Gênesis 1-3',focus:'Criação, queda e promessa'}; }
function expectedPlan(){ return PLAN[expectedDay()-1] || currentPlan(); }
function seedForToday(){ return SEEDS[(dayOfYear()-1)%Math.max(SEEDS.length,1)] || {theme:'Graça',thesis:'Deus sustenta a casa pela graça.',focus:currentPlan().focus}; }
function childThemeForToday(){ return CHILD_THEMES[(dayOfYear()-1)%CHILD_THEMES.length]; }
function isRead(day){ return !!S.reading.readDays[String(day)]; }
function todayChecklist(){ const k=todayKey(); S.checklist[k]=S.checklist[k]||{}; return S.checklist[k]; }
function todayScore(){ const c=todayChecklist(); const keys=['silencio','casal','crianca','leitura','oracao']; return Math.round(keys.filter(k=>c[k]).length/keys.length*100); }
function syncLabel(){
  if(lastSyncStatus==='saved') return `Salvo na nuvem${lastSyncAt?' · '+lastSyncAt:''}`;
  if(lastSyncStatus==='saving') return 'Sincronizando...';
  if(lastSyncStatus==='error') return 'Salvo apenas neste aparelho';
  return cloudReady ? 'Nuvem pronta' : 'Modo local';
}
function syncDotClass(){ return lastSyncStatus==='saved'||cloudReady?'ok':(lastSyncStatus==='saving'?'warn':''); }

function normalizeState(){
  const base=emptyState();
  S={...base,...(S||{})};
  S.version=APP_VERSION;
  S.reading={...base.reading,...(S.reading||{})};
  S.devotions={couple:{},child:{},...(S.devotions||{})};
  S.history={completedDevotions:[],...(S.history||{})};
  S.reviews={...(S.reviews||{})};
  S.settings={...base.settings,...(S.settings||{})}; S.settings.childStoryPages=S.settings.childStoryPages||{};
  if(!['hoje','casal','crianca','leitura','ajustes'].includes(S.activeTab)) S.activeTab='hoje';
}
function localLoad(){
  try{
    let raw=localStorage.getItem(STORAGE_KEY);
    if(!raw){
      for(const key of LEGACY_STORAGE_KEYS){ raw=localStorage.getItem(key); if(raw) break; }
    }
    if(raw) S={...emptyState(), ...JSON.parse(raw)};
  }catch(e){ S=emptyState(); }
  normalizeState();
}
function autoBackup(){
  try{
    const k='ec_v41_auto_backups'; const today=todayKey();
    const backups=JSON.parse(localStorage.getItem(k)||'[]');
    if(backups[0]?.date===today) return;
    backups.unshift({date:today, ts:Date.now(), state:S});
    localStorage.setItem(k, JSON.stringify(backups.slice(0,7)));
  }catch(e){ console.warn(e); }
}
function localSave(){ S.updatedAt=Date.now(); S.version=APP_VERSION; localStorage.setItem(STORAGE_KEY,JSON.stringify(S)); autoBackup(); }
function save(){ localSave(); render(); if(cloudReady && !applyingRemote){ clearTimeout(saveTimer); lastSyncStatus='saving'; saveTimer=setTimeout(syncCloud,650); } }
async function syncCloud(){
  if(!ref||!user)return;
  lastSyncStatus='saving'; renderShell();
  try{
    await ref.set({state:S, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), userEmail:user.email, userName:user.displayName||'', appVersion:APP_VERSION},{merge:true});
    lastSyncStatus='saved'; lastSyncAt=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); renderShell();
  }catch(e){ console.warn(e); lastSyncStatus='error'; renderShell(); toast('Salvo localmente. Nuvem indisponível.'); }
}
async function forceSync(){ await syncCloud(); toast(lastSyncStatus==='saved'?'Sincronizado com a nuvem.':'Não foi possível sincronizar agora.'); }
async function loadDataFiles(){
  try{ PLAN=await fetch('data/reading-plan-365.json?v='+APP_VERSION).then(r=>r.json()); }catch(e){ console.warn(e); PLAN=fallbackPlan(); }
  try{ SEEDS=await fetch('data/devotional-seeds.json?v='+APP_VERSION).then(r=>r.json()); }catch(e){ console.warn(e); SEEDS=[]; }
  if(!Array.isArray(PLAN)||!PLAN.length) PLAN=fallbackPlan();
}
function fallbackPlan(){ return Array.from({length:365},(_,i)=>({day:i+1,reading:`Leitura bíblica — dia ${i+1}`,focus:'Permaneçam constantes na Palavra.'})); }

function switchTab(tab){
  if(!['hoje','casal','crianca','leitura','ajustes'].includes(tab)) tab='hoje';
  const app=document.querySelector('.app');
  window.scrollTo({top:0,left:0,behavior:'auto'});
  app?.classList.add('tab-switching');
  S.activeTab=tab;
  localSave();
  history.replaceState(null,'','#'+tab);
  render();
  requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}));
  setTimeout(()=>window.scrollTo({top:0,left:0,behavior:'auto'}),80);
  clearTimeout(window.__ecTabFx);
  window.__ecTabFx=setTimeout(()=>app?.classList.remove('tab-switching'),520);
}
window.addEventListener('hashchange',()=>{ const tab=location.hash.replace('#',''); if(tab && tab!==S.activeTab) switchTab(tab); });

function render(){ renderShell(); renderHoje(); renderCouple(); renderChild(); renderReading(); renderSettings(); applyMotionEnhancements(document); }
function renderShell(){
  const activeTab=S.activeTab||'hoje';
  document.body.setAttribute('data-tab',activeTab); document.body.classList.toggle('darkPremium', !!S.settings?.darkMode);
  $$('.section').forEach(x=>x.classList.toggle('active',x.id==='sec-'+activeTab));
  $$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===activeTab));
  const u=$('#userLabel'); if(u)u.textContent=user?.displayName || user?.email || syncLabel();
}
function applyMotionEnhancements(root=document){
  root.querySelectorAll('.check').forEach(label=>{
    const input=label.querySelector('input[type="checkbox"]');
    if(!input) return;
    label.classList.toggle('checked',!!input.checked);
  });
}

function toggleInsight(id){
  const el=document.getElementById(id);
  if(!el) return;
  el.classList.toggle('open');
}
function scrollToCard(id){
  const el=document.getElementById(id);
  if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
}

function storyPages(text){
  const blocks=String(text||'').split(/\n\s*\n/g).map(x=>x.trim()).filter(Boolean);
  const pages=[];
  let current=[];
  for(const block of blocks){
    current.push(block);
    const words=current.join(' ').split(/\s+/).filter(Boolean).length;
    if(words>=95 || current.length>=3){ pages.push(current.join('\n\n')); current=[]; }
  }
  if(current.length) pages.push(current.join('\n\n'));
  return pages.length?pages:[String(text||'')];
}
function childPageIndex(total){
  const k=todayKey();
  S.settings.childStoryPages=S.settings.childStoryPages||{};
  const current=Number(S.settings.childStoryPages[k]||0);
  return clamp(current,0,Math.max(0,total-1));
}
function turnChildPage(delta){
  const k=todayKey();
  const saved=S.devotions.child?.[k];
  const text=saved?.text || fallbackChildDevotion();
  const pages=storyPages(text);
  const current=childPageIndex(pages.length);
  S.settings.childStoryPages[k]=clamp(current+delta,0,Math.max(0,pages.length-1));
  localSave();
  renderChild();
  requestAnimationFrame(()=>document.querySelector('.storybookPage')?.classList.add('pageTurning'));
}
function toggleDarkMode(){
  S.settings.darkMode=!S.settings.darkMode;
  save();
  toast(S.settings.darkMode?'Modo escuro premium ativado.':'Modo claro premium ativado.');
}

function childSceneIllustration(theme,page=0){
  const t=String(theme||'').toLowerCase();
  const scenes={
    amor:`<svg class="childSceneSvg" viewBox="0 0 320 200" aria-hidden="true"><defs><linearGradient id="g1" x1="0" x2="1"><stop offset="0" stop-color="#ffe6ef"/><stop offset="1" stop-color="#fff7dc"/></linearGradient></defs><rect width="320" height="200" rx="28" fill="url(#g1)"/><circle cx="64" cy="48" r="26" fill="#ffd3df"/><circle cx="260" cy="38" r="18" fill="#fff4a8"/><path d="M0 148 C70 118 140 182 212 150 C252 132 285 138 320 126 V200 H0 Z" fill="#d6f1d9"/><rect x="126" y="88" width="68" height="64" rx="20" fill="#fffaf4" stroke="#efcfd8"/><circle cx="146" cy="86" r="18" fill="#ffd1db"/><circle cx="174" cy="86" r="18" fill="#ffd1db"/><path d="M160 116 C146 99 120 107 120 126 C120 146 145 155 160 166 C175 155 200 146 200 126 C200 107 174 99 160 116 Z" fill="#ff96b3"/><text x="160" y="187" text-anchor="middle" font-size="18" font-weight="800" fill="#7e6470">Jesus ama Arthur</text></svg>`,
    cuida:`<svg class="childSceneSvg" viewBox="0 0 320 200" aria-hidden="true"><rect width="320" height="200" rx="28" fill="#eef7ff"/><circle cx="260" cy="42" r="18" fill="#ffef92"/><path d="M0 150 C55 132 109 154 160 144 C215 132 255 158 320 132 V200 H0 Z" fill="#d5f0d6"/><rect x="96" y="98" width="128" height="62" rx="16" fill="#fffaf2" stroke="#d9dfe8"/><path d="M88 109 L160 56 L232 109" fill="#ffcf9f"/><path d="M88 109 L160 56 L232 109" stroke="#e7a86e" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/><rect x="148" y="124" width="26" height="36" rx="9" fill="#bfe3ff"/><circle cx="68" cy="62" r="18" fill="#fff"/><circle cx="84" cy="58" r="14" fill="#fff"/><circle cx="99" cy="63" r="16" fill="#fff"/><circle cx="218" cy="72" r="14" fill="#fff"/><circle cx="234" cy="68" r="12" fill="#fff"/><circle cx="247" cy="72" r="13" fill="#fff"/><text x="160" y="187" text-anchor="middle" font-size="18" font-weight="800" fill="#617183">Deus cuida de Arthur</text></svg>`,
    obedecer:`<svg class="childSceneSvg" viewBox="0 0 320 200" aria-hidden="true"><rect width="320" height="200" rx="28" fill="#fff7ee"/><path d="M0 150 C63 130 110 162 166 147 C229 129 270 147 320 138 V200 H0 Z" fill="#dff4da"/><rect x="114" y="68" width="92" height="86" rx="20" fill="#fff" stroke="#f0d7bd"/><circle cx="132" cy="70" r="18" fill="#ffd4c2"/><circle cx="188" cy="70" r="18" fill="#ffd9cb"/><circle cx="160" cy="110" r="17" fill="#ffe1d1"/><rect x="126" y="114" width="18" height="28" rx="9" fill="#9ad0ff"/><rect x="176" y="114" width="18" height="28" rx="9" fill="#ffd588"/><rect x="151" y="132" width="18" height="22" rx="9" fill="#cdb8ff"/><path d="M72 94 l12 12 l26 -26" stroke="#79b78b" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/><text x="160" y="186" text-anchor="middle" font-size="18" font-weight="800" fill="#7b6a60">Obedecer alegra a Deus</text></svg>`,
    gratidao:`<svg class="childSceneSvg" viewBox="0 0 320 200" aria-hidden="true"><rect width="320" height="200" rx="28" fill="#fff8d9"/><circle cx="262" cy="44" r="24" fill="#ffe66d"/><path d="M0 148 C64 120 130 168 188 144 C234 126 284 148 320 132 V200 H0 Z" fill="#d4f0cb"/><path d="M58 154 C76 116 104 116 122 154" fill="none" stroke="#77b583" stroke-width="8" stroke-linecap="round"/><circle cx="90" cy="120" r="18" fill="#ffb8cf"/><circle cx="110" cy="134" r="18" fill="#ffd18f"/><circle cx="70" cy="136" r="18" fill="#b7ddff"/><path d="M168 122 C168 94 194 76 222 76 C250 76 272 98 272 122 C272 147 249 166 222 166 C194 166 168 148 168 122 Z" fill="#fff" stroke="#f5dc7b"/><path d="M209 123 l10 10 l20 -24" stroke="#7db687" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/><text x="160" y="187" text-anchor="middle" font-size="18" font-weight="800" fill="#7c6e54">Obrigado, Deus!</text></svg>`,
    compartilhar:`<svg class="childSceneSvg" viewBox="0 0 320 200" aria-hidden="true"><rect width="320" height="200" rx="28" fill="#eef6ff"/><path d="M0 154 C57 130 115 160 170 145 C227 130 271 150 320 139 V200 H0 Z" fill="#dff0da"/><circle cx="118" cy="92" r="18" fill="#ffd8ca"/><circle cx="202" cy="92" r="18" fill="#ffd8ca"/><rect x="102" y="110" width="32" height="40" rx="13" fill="#a7d6ff"/><rect x="186" y="110" width="32" height="40" rx="13" fill="#ffc789"/><rect x="148" y="112" width="24" height="24" rx="7" fill="#c4b6ff" stroke="#b09df6"/><path d="M140 124 H100" stroke="#8da7bf" stroke-width="6" stroke-linecap="round"/><path d="M180 124 H220" stroke="#8da7bf" stroke-width="6" stroke-linecap="round"/><text x="160" y="186" text-anchor="middle" font-size="18" font-weight="800" fill="#66778a">Compartilhar com amor</text></svg>`,
    criou:`<svg class="childSceneSvg" viewBox="0 0 320 200" aria-hidden="true"><rect width="320" height="200" rx="28" fill="#eaf7ff"/><circle cx="266" cy="42" r="23" fill="#ffef7e"/><path d="M0 152 C70 132 124 162 182 146 C236 132 281 148 320 138 V200 H0 Z" fill="#cfeec7"/><path d="M0 132 C58 118 105 138 160 124 C224 109 269 128 320 114" fill="none" stroke="#9bd7ff" stroke-width="16" stroke-linecap="round"/><path d="M69 110 C84 90 106 90 120 110" fill="none" stroke="#77b87b" stroke-width="8" stroke-linecap="round"/><circle cx="92" cy="98" r="14" fill="#ffca89"/><circle cx="109" cy="109" r="14" fill="#ff9cc0"/><circle cx="75" cy="109" r="14" fill="#9cd5ff"/><path d="M206 96 C226 72 263 76 280 98" fill="none" stroke="#d6b8ff" stroke-width="7" stroke-linecap="round"/><path d="M194 96 Q232 134 289 96" fill="none" stroke="#ffaec0" stroke-width="7" stroke-linecap="round"/><text x="160" y="186" text-anchor="middle" font-size="18" font-weight="800" fill="#617383">Deus criou tudo</text></svg>`,
    oracao:`<svg class="childSceneSvg" viewBox="0 0 320 200" aria-hidden="true"><rect width="320" height="200" rx="28" fill="#f6f1ff"/><circle cx="252" cy="40" r="20" fill="#ffe68a"/><circle cx="68" cy="42" r="4" fill="#fff"/><circle cx="92" cy="56" r="4" fill="#fff"/><circle cx="110" cy="36" r="4" fill="#fff"/><path d="M0 154 C61 130 116 160 172 146 C229 131 272 152 320 138 V200 H0 Z" fill="#dff0da"/><circle cx="160" cy="88" r="22" fill="#ffd8c8"/><rect x="138" y="110" width="44" height="42" rx="18" fill="#a4c7ff"/><path d="M147 110 Q160 128 173 110" stroke="#8b6d66" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M144 126 Q160 142 176 126" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/><text x="160" y="186" text-anchor="middle" font-size="18" font-weight="800" fill="#75678a">Deus ouve quando Arthur ora</text></svg>`,
    medo:`<svg class="childSceneSvg" viewBox="0 0 320 200" aria-hidden="true"><rect width="320" height="200" rx="28" fill="#1e2942"/><circle cx="258" cy="42" r="18" fill="#ffe792"/><circle cx="74" cy="42" r="3" fill="#fffbe7"/><circle cx="95" cy="58" r="3" fill="#fffbe7"/><circle cx="108" cy="34" r="3" fill="#fffbe7"/><path d="M0 154 C61 130 116 160 172 146 C229 131 272 152 320 138 V200 H0 Z" fill="#2d4f3d"/><rect x="118" y="114" width="84" height="42" rx="18" fill="#fff5e8"/><circle cx="160" cy="100" r="18" fill="#ffd9c4"/><path d="M150 108 l10 -10 l10 10" stroke="#7eb08a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><text x="160" y="186" text-anchor="middle" font-size="18" font-weight="800" fill="#f3eadf">Deus está comigo</text></svg>`,
    familia:`<svg class="childSceneSvg" viewBox="0 0 320 200" aria-hidden="true"><rect width="320" height="200" rx="28" fill="#fff4ec"/><path d="M0 154 C61 132 120 160 176 145 C229 131 271 150 320 139 V200 H0 Z" fill="#dff0da"/><circle cx="108" cy="86" r="18" fill="#ffd8c8"/><circle cx="160" cy="80" r="22" fill="#ffd6c6"/><circle cx="214" cy="86" r="18" fill="#ffd8c8"/><rect x="94" y="108" width="28" height="40" rx="12" fill="#9ecfff"/><rect x="142" y="108" width="36" height="46" rx="14" fill="#ffd18b"/><rect x="200" y="108" width="28" height="40" rx="12" fill="#c9b6ff"/><path d="M136 136 C146 126 174 126 184 136" stroke="#ee90a9" stroke-width="7" fill="none" stroke-linecap="round"/><text x="160" y="186" text-anchor="middle" font-size="18" font-weight="800" fill="#7b665c">Arthur ama sua família</text></svg>`
  };
  if(t.includes('ama')) return scenes.amor;
  if(t.includes('cuida')) return scenes.cuida;
  if(t.includes('obed')) return scenes.obedecer;
  if(t.includes('gratid')) return scenes.gratidao;
  if(t.includes('compart')) return scenes.compartilhar;
  if(t.includes('criou')) return scenes.criou;
  if(t.includes('ora')) return scenes.oracao;
  if(t.includes('medo')) return scenes.medo;
  if(t.includes('fam')) return scenes.familia;
  return [scenes.amor,scenes.cuida,scenes.criou,scenes.familia][page%4];
}
function childStickerRow(){
  return `<div class="childStickerRow" aria-hidden="true"><span>⭐</span><span>☁️</span><span>🧸</span><span>🌈</span><span>🐑</span></div>`;
}

function childSupportByTheme(){
  const t=String(childThemeForToday().name||'').toLowerCase();
  if(t.includes('ama')) return {question:'Quem ama Arthur todos os dias?', activity:'Façam um abraço apertado e repitam 3 vezes: “Jesus me ama”.', prayer:'Jesus, obrigado porque o Senhor ama Arthur.'};
  if(t.includes('cuida')) return {question:'Quem cuida da nossa casa e da nossa família?', activity:'Peçam para Arthur apontar algo que Deus cuida: casa, cama, comida ou família.', prayer:'Deus, obrigado porque o Senhor cuida de nós.'};
  if(t.includes('obed')) return {question:'Como Arthur pode obedecer hoje?', activity:'Façam uma encenação rápida: guardar um brinquedo, sentar ou dar a mão.', prayer:'Senhor, ajuda Arthur a obedecer com alegria.'};
  if(t.includes('gratid')) return {question:'Pelo que Arthur quer agradecer hoje?', activity:'Cada um fala um “obrigado, Deus” por algo simples do dia.', prayer:'Obrigado, Deus, por tudo o que o Senhor nos dá.'};
  if(t.includes('perd')) return {question:'O que fazemos quando erramos?', activity:'Repitam juntos: “Jesus me ensina a pedir perdão e perdoar”.', prayer:'Jesus, ensina nosso coração a perdoar.'};
  if(t.includes('compart')) return {question:'O que Arthur pode compartilhar hoje?', activity:'Separem um brinquedo ou alimento para dividir simbolicamente.', prayer:'Deus, ensina Arthur a repartir com amor.'};
  if(t.includes('criou')) return {question:'Quem fez o céu, a terra e as pessoas?', activity:'Peçam para Arthur apontar algo criado por Deus: céu, árvore, passarinho ou água.', prayer:'Deus, obrigado porque o Senhor fez tudo com sabedoria.'};
  if(t.includes('ora')) return {question:'Quando Arthur fala com Deus, Deus faz o quê?', activity:'Façam uma oração curtinha com Arthur repetindo uma frase de cada vez.', prayer:'Deus, obrigado porque o Senhor ouve nossa oração.'};
  if(t.includes('medo')) return {question:'Quando Arthur fica com medo, quem está com ele?', activity:'Apaguem a luz por 3 segundos, acendam e digam juntos: “Deus está comigo”.', prayer:'Pai, dá paz ao coração do Arthur.'};
  if(t.includes('fam')) return {question:'Como Arthur mostra amor pela família?', activity:'Façam um gesto de carinho: abraço na mamãe e no papai.', prayer:'Senhor, enche nossa casa de amor.'};
  return {question:'O que Arthur aprendeu hoje?', activity:'Repitam a frase principal e façam um gesto para guardar a lição.', prayer:'Senhor, grava a tua verdade no coração do Arthur.'};
}
function coupleGuides(){
  const seed=seedForToday();
  return {
    question:`À luz de “${seed.theme}”, onde nosso casamento precisa se alinhar mais ao evangelho hoje?`,
    practice:`Escolham uma atitude prática para viver hoje a partir desta verdade: ${seed.thesis}`,
    prayer:`Transformem a leitura em oração: confessem, agradeçam e peçam ajuda a Deus para aplicar ${seed.focus.toLowerCase()}.`
  };
}
function saveCoupleJournal(){
  const k=todayKey();
  const reflect=$('#coupleReflect')?.value||'';
  const apply=$('#coupleApply')?.value||'';
  const prayer=$('#couplePrayer')?.value||'';
  S.reading.notes['couple-'+k]=reflect;
  S.reading.notes['couple-reflect-'+k]=reflect;
  S.reading.notes['couple-apply-'+k]=apply;
  S.reading.notes['couple-prayer-'+k]=prayer;
  save();
  toast('Registro espiritual do casal salvo.');
}
function coupleJournalHistory(){
  const notes=S.reading?.notes||{};
  const items=Object.keys(notes)
    .filter(k=>k.startsWith('couple-reflect-') && String(notes[k]||'').trim())
    .sort().reverse().slice(0,4)
    .map(k=>{
      const date=k.replace('couple-reflect-','');
      const reflect=String(notes[k]||'').trim();
      const apply=String(notes['couple-apply-'+date]||'').trim();
      const prayer=String(notes['couple-prayer-'+date]||'').trim();
      return `<div class="historyItem"><strong>${date}</strong><br><span>${safeHTML(reflect.slice(0,140))}${reflect.length>140?'…':''}</span>${apply?`<div class="journalMini"><b>Aplicação:</b> ${safeHTML(apply.slice(0,110))}${apply.length>110?'…':''}</div>`:''}${prayer?`<div class="journalMini"><b>Oração:</b> ${safeHTML(prayer.slice(0,110))}${prayer.length>110?'…':''}</div>`:''}</div>`;
    });
  return items.join('') || '<div class="empty"><strong>Sem registros ainda.</strong><span>Salvem hoje a primeira resposta espiritual do casal.</span></div>';
}
function readingTimelineMeta(day=currentDay()){
  const reading=String((PLAN[day-1]||currentPlan()).reading||'');
  const stages=[
    {id:'origens', label:'Origens e Patriarcas', short:'Origens', books:['Gênesis','Jó'], summary:'Criação, queda, dilúvio, Babel e a formação da família da promessa.'},
    {id:'exodo', label:'Êxodo e Lei', short:'Êxodo', books:['Êxodo','Levítico','Números','Deuteronômio'], summary:'Libertação do Egito, aliança, lei, santidade e peregrinação do povo de Deus.'},
    {id:'conquista', label:'Conquista e Juízes', short:'Conquista', books:['Josué','Juízes','Rute'], summary:'Entrada na terra, ciclos de infidelidade, livramentos e preservação da linhagem messiânica.'},
    {id:'reino', label:'Reino, Sabedoria e Salmos', short:'Reino', books:['1 Samuel','2 Samuel','1 Crônicas','1 Reis','2 Crônicas','Salmos','Provérbios','Eclesiastes','Cânticos'], summary:'Monarquia, Davi, Salomão, culto, sabedoria e esperança do Messias.'},
    {id:'profetas', label:'Reis, Profetas e Exílio', short:'Profetas', books:['2 Reis','Isaías','Jeremias','Lamentações','Ezequiel','Daniel','Oséias','Joel','Amós','Obadias','Jonas','Miquéias','Naum','Habacuque','Sofonias'], summary:'Chamado ao arrependimento, queda dos reinos, exílio e promessa de restauração.'},
    {id:'retorno', label:'Retorno e Reconstrução', short:'Retorno', books:['Esdras','Neemias','Ester','Ageu','Zacarias','Malaquias'], summary:'Retorno do remanescente, reconstrução de Jerusalém e expectativa do Messias.'},
    {id:'cristo', label:'Vida de Cristo', short:'Cristo', books:['Mateus','Marcos','Lucas','João'], summary:'Nascimento, ministério, cruz, ressurreição e anúncio do Reino de Deus.'},
    {id:'igreja', label:'Igreja e Cartas', short:'Igreja', books:['Atos','Romanos','1 Coríntios','2 Coríntios','Gálatas','Efésios','Filipenses','Colossenses','1 Tessalonicenses','2 Tessalonicenses','1 Timóteo','2 Timóteo','Tito','Filemom','Hebreus','Tiago','1 Pedro','2 Pedro','1 João','2 João','3 João','Judas'], summary:'Expansão da igreja, missões, vida comunitária e doutrina apostólica.'},
    {id:'consumacao', label:'Consumação', short:'Fim', books:['Apocalipse'], summary:'Vitória final de Cristo, perseverança da igreja e nova criação.'}
  ];
  let index=stages.findIndex(s=>s.books.some(b=>reading.includes(b)));
  if(index<0) index=0;
  return {index,current:stages[index],stages,progress:Math.round(((index+1)/stages.length)*100)};
}
function timelineHTML(meta){
  return `<div class="timelineRail">${meta.stages.map((s,i)=>`<div class="timelineStep ${i<meta.index?'done':''} ${i===meta.index?'current':''}"><span class="timelineDot"></span><strong>${safeHTML(s.short)}</strong></div>`).join('')}</div>`;
}

function markCheck(id,val){ const c=todayChecklist(); c[id]=!!val; save(); }
function checkHTML(id,title,desc,checked){ return `<label class="check"><input type="checkbox" data-id="${id}" ${checked?'checked':''}><span><strong>${title}</strong><span>${desc}</span></span></label>`; }
function renderHoje(){
  const el=$('#sec-hoje'); if(!el)return;
  const p=currentPlan(); const ep=expectedPlan(); const sc=todayScore(); const c=todayChecklist(); const atraso=Math.max(0, expectedDay()-currentDay());
  const review=renderWeeklyReviewCard();
  el.innerHTML=`
    <div class="hero formalCommand homeHero immersiveHero"><div class="heroMark" aria-hidden="true">${appIcon('spark')}</div>${appIllu('sunrise')}
      <div class="heroMeta"><span>Rotina devocional</span><span>${todayKey()}</span></div>
      <p class="kicker">Um dia com Deus</p>
      <h2>Ambiente de presença para conduzir o lar.</h2>
      <p>Uma jornada interativa para leitura, conversa do casal, narrativa bíblica para Arthur e oração em família.</p>
      <div class="verseCallout">“Aquietai-vos e sabei que eu sou Deus.”</div>
      <div class="syncLine"><span class="dot ${syncDotClass()}"></span><span>${safeHTML(syncLabel())}</span></div>
    </div>

    <div class="journeyRail" aria-label="Atalhos da jornada devocional">
      <button type="button" onclick="scrollToCard('card-silencio')"><span>01</span><strong>Aquietar</strong></button>
      <button type="button" onclick="switchTab('casal')"><span>02</span><strong>Casal</strong></button>
      <button type="button" onclick="switchTab('crianca')"><span>03</span><strong>Arthur</strong></button>
      <button type="button" onclick="switchTab('leitura')"><span>04</span><strong>Palavra</strong></button>
      <button type="button" onclick="scrollToCard('card-oracao')"><span>05</span><strong>Oração</strong></button>
    </div>

    <div class="grid dashboardGrid">
      <div class="card primaryCard devotionalMoment" id="card-silencio">
        <div class="row between"><h3>Central do momento</h3><span class="pill soft">${sc}% concluído</span></div>
        <div class="progress cinematic"><span style="width:${sc}%"></span></div>
        <div class="checks upgradedChecks">
          ${checkHTML('silencio','Silenciar o coração','Respirem, desliguem distrações e entreguem o ambiente ao Senhor.',c.silencio)}
          ${checkHTML('casal','Devocional do casal','Leitura teológica, conversa honesta e prática de obediência.',c.casal)}
          ${checkHTML('crianca','Narrativa do Arthur','Uma historinha curta para ele imaginar, repetir e aplicar.',c.crianca)}
          ${checkHTML('leitura','Leitura bíblica',safeHTML(p.reading),c.leitura)}
          ${checkHTML('oracao','Oração em família','Fé, casamento, Arthur, santidade e trabalho.',c.oracao)}
        </div>
      </div>

      <div class="sideStack">
        <div class="card focusCard interactiveFocus">
          <p class="kicker">Leitura em foco</p>
          <div class="readingHeader"><div class="dayBadge">${p.day}</div><div><p><strong>${safeHTML(p.reading)}</strong></p><p class="sub">${safeHTML(p.focus)}</p></div></div>
          <div class="row" style="margin-top:12px"><button type="button" class="btn" onclick="markRead(${p.day},true); markCheck('leitura',true)">Marcar como lido</button><button type="button" class="btn secondary" onclick="switchTab('leitura')">Abrir plano</button></div>
          ${atraso>0 ? `<p class="sub" style="margin-top:10px;color:#8d6464">Pelo calendário local do Brasil, a leitura esperada hoje seria o dia ${ep.day}. Ajustem manualmente se necessário.</p>` : ''}
        </div>

        <div class="card insightPanel" id="card-oracao">
          <button type="button" class="insightToggle" onclick="toggleInsight('insight-oracao')"><span>Oração guiada</span><b>abrir</b></button>
          <div id="insight-oracao" class="insightBody">
            <p class="quote">Senhor, dá-nos fome pela tua Palavra, humildade para obedecer, amor para servir dentro de casa e constância para viver diante de ti hoje. Amém.</p>
          </div>
        </div>
      </div>
    </div>

    ${review}`;
  $$('.check input').forEach(i=>i.onchange=()=>{ i.closest('.check')?.classList.toggle('checked',i.checked); markCheck(i.dataset.id,i.checked); if(i.checked) toast('Etapa concluída com carinho.'); });
}

function renderWeeklyReviewCard(){
  if(!isBrazilSunday()) return '';
  const wk=weekKey(); const r=S.reviews[wk]||{};
  return `<div class="card weeklyReview">
    <p class="kicker">Domingo · revisão da semana</p>
    <h3>Parar, confessar e obedecer</h3>
    <p class="sub">Uma revisão simples, sem virar outra área do app.</p>
    <div class="stack">
      <textarea id="rev1" class="input" placeholder="O que Deus nos ensinou esta semana?">${safeHTML(r.ensino||'')}</textarea>
      <textarea id="rev2" class="input" placeholder="Onde precisamos nos arrepender?">${safeHTML(r.arrependimento||'')}</textarea>
      <textarea id="rev3" class="input" placeholder="Como vamos obedecer na próxima semana?">${safeHTML(r.obediencia||'')}</textarea>
      <button type="button" class="btn full" onclick="saveWeeklyReview()">Salvar revisão semanal</button>
    </div>
  </div>`;
}
function saveWeeklyReview(){
  const wk=weekKey();
  S.reviews[wk]={ensino:$('#rev1')?.value||'', arrependimento:$('#rev2')?.value||'', obediencia:$('#rev3')?.value||'', ts:Date.now()};
  save(); toast('Revisão semanal guardada com carinho.');
}

function fallbackCoupleDevotion(){
  const s=seedForToday(); const p=currentPlan();
  return `Título: Cristo no centro da nossa casa

Texto bíblico base: ${p.reading}

Contexto bíblico e teológico:
A leitura de hoje deve ser recebida como Palavra de Deus antes de ser aplicada como conselho para a rotina. A Escritura revela o Deus santo, fiel e misericordioso, que forma um povo para viver em aliança com Ele. Por isso, o casamento não é apenas convivência; é um lugar onde fé, arrependimento, perdão e serviço precisam ganhar forma concreta.

Verdade teológica central:
${s.thesis || 'A graça de Deus sustenta a obediência dentro de casa.'} A vida espiritual verdadeira não termina quando fechamos a Bíblia; ela aparece no modo como falamos, ouvimos, perdoamos, educamos, servimos e tomamos decisões.

Cristo no texto:
Toda a Escritura expõe nossa necessidade de redenção e aponta para Cristo. Nele, Deus não apenas perdoa pecadores; Ele nos une a si mesmo, muda nossos afetos e nos capacita a amar quando o orgulho, o cansaço e o egoísmo querem governar.

Aplicação para Marcus:
Considere onde Deus está chamando você a liderar com humildade, presença e serviço, não com cobrança ou distância. Liderança cristã começa com arrependimento, oração e responsabilidade diante de Deus.

Aplicação para Ingrid:
Considere onde Deus está chamando você a descansar na fidelidade dele, responder com sabedoria e edificar a casa com palavras, constância e fé. A força cristã nasce da dependência do Senhor.

Aplicação para o casamento:
Hoje, troquem acusação por confissão, pressa por presença e silêncio frio por conversa honesta. O evangelho precisa ser visto na forma como vocês tratam um ao outro quando ninguém mais está vendo.

Perguntas de exame do coração:
1. O que este texto revela sobre Deus que precisamos crer hoje?
2. Que pecado, medo ou orgulho precisamos confessar?
3. Que atitude concreta demonstrará o amor de Cristo no nosso casamento hoje?

Prática de obediência para hoje:
Façam uma oração juntos e cada um diga uma forma prática de servir o outro antes do fim do dia.

Oração final:
Senhor, coloca Cristo no centro da nossa aliança. Purifica nossas motivações, ensina-nos a perdoar com humildade e faz da nossa casa um lugar onde tua Palavra governa com graça e verdade. Amém.`;
}
function fallbackChildDevotion(){
  const t=childThemeForToday();
  return `Título da historinha: O pequeno Arthur e a verdade de Deus

Verdade bíblica de hoje:
${t.truth}

Historinha para contar:
Era uma vez um menino chamado Arthur. Arthur acordou, abriu os olhinhos e viu que mais um dia tinha começado. Ele queria brincar, correr e fazer muitas coisas.

Então papai e mamãe chamaram Arthur para sentar bem pertinho. Papai disse:
“Arthur, hoje vamos lembrar uma verdade muito importante: ${t.phrase}.”

Arthur colocou a mão no coração e perguntou:
“Deus cuida de mim?”

Mamãe respondeu:
“Sim, meu filho. Deus vê você quando acorda, quando brinca, quando come, quando toma banho e quando vai dormir. Deus ama Arthur e ensina Arthur a obedecer.”

Então Arthur pegou um brinquedo e lembrou que podia dividir. Ele sorriu e disse:
“Eu quero obedecer a Deus.”

Papai falou:
“Isso alegra o coração do Senhor. Quando Arthur obedece, compartilha e ama, Arthur está aprendendo a andar no caminho de Deus.”

E naquele dia, Arthur repetiu bem devagar:
“${t.phrase}.”

Moral da historinha:
Deus ama Arthur, cuida da família e ensina o coração da criança a obedecer com alegria.

Perguntinhas para Arthur:
1. Quem cuida de Arthur?
2. O que Arthur pode fazer para obedecer hoje?
3. Vamos repetir a frase de hoje?

Frase para repetir 3 vezes:
${t.phrase}

Atividade de 2 minutos:
Peça para Arthur escolher um brinquedo e entregar para alguém por alguns segundos. Depois diga: “Arthur compartilhou com amor.” Finalizem com um abraço.

Oração curtinha:
Papai do céu, obrigado por amar Arthur. Ajuda Arthur a obedecer, compartilhar e amar a família. Amém.`;
}

async function callAI(prompt,max=2600){
  const r=await fetch(OPENAI_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+OPENAI_API_KEY_FIXA},body:JSON.stringify({model:S.settings?.model||DEFAULT_MODEL,store:false,max_output_tokens:max,input:prompt})});
  if(!r.ok) throw new Error(await r.text());
  const data=await r.json(); let out='';
  if(typeof data.output_text==='string') out=data.output_text;
  if(!out && Array.isArray(data.output)) for(const item of data.output) for(const c of (item.content||[])) if(c.text) out+=c.text;
  return out.trim();
}
function promptCouple(){
  const p=currentPlan();
  return `Escreva um devocional diário profundo, reflexivo e teológico para um casal cristão chamado Marcus e Ingrid.

Leitura bíblica do plano: ${p.reading}
Foco da leitura: ${p.focus}
Data local do devocional: ${todayKey()}.

Linha doutrinária e tom:
- português do Brasil;
- bíblico, cristocêntrico, pastoral e reverente;
- faça exposição do texto antes da aplicação;
- explique contexto bíblico, doutrina central e relação com a história da redenção;
- mostre como Cristo cumpre, revela, redime ou governa a verdade do texto;
- trate pecado, graça, arrependimento, fé, santificação, perdão, aliança e vida doméstica;
- aplique separadamente para Marcus, para Ingrid e para o casamento;
- seja direto, concreto e pastoral, sem soar como texto genérico de IA;
- não use promessas de prosperidade automática, misticismo, chavões ou frases motivacionais rasas;
- escreva com profundidade teológica acessível, como material devocional sério para leitura a dois.

Estrutura obrigatória:
1. Título
2. Texto bíblico base
3. Exposição do texto
4. Contexto bíblico e teológico
5. Verdade teológica central
6. Cristo no texto
7. Aplicação para Marcus
8. Aplicação para Ingrid
9. Aplicação para o casamento
10. Perguntas de exame do coração
11. Prática de obediência para hoje
12. Oração final.`;
}
function promptChild(){
  const p=currentPlan(); const t=childThemeForToday();
  return `Crie um devocional infantil em formato de historinha narrativa para Arthur, 3 anos, em português, curto, concreto, fácil de imaginar e com clima de livrinho infantil.

Tema infantil de hoje: ${t.name}
Verdade desejada: ${t.truth}
Frase para repetir: ${t.phrase}
Base bíblica do plano da família: ${p.reading}
Foco: ${p.focus}

Estrutura obrigatória:
1. Título da historinha
2. Verdade bíblica de hoje
3. Historinha para contar, com começo, meio e fim, Arthur como personagem principal, cenas simples da rotina dele, diálogo curto entre papai, mamãe e Arthur, e uma ação prática de obediência
4. Moral da historinha
5. Perguntinhas para Arthur
6. Frase para repetir 3 vezes
7. Atividade de 2 minutos
8. Oração curtinha

Regras:
- português do Brasil;
- linguagem de criança de 3 anos;
- frases curtas;
- imagem mental simples;
- sem abstração pesada;
- sem temas assustadores;
- tom carinhoso, cristão e familiar;
- sensação de livrinho narrado pelos pais;
- ajude Marcus e Ingrid a conduzir em 2 a 4 minutos.`;
}
async function generateDevotion(type, force=false){
  const k=todayKey();
  if(!force && S.devotions[type]?.[k]?.text){ toast('O devocional de hoje já está guardado para vocês.'); return; }
  if(force && S.devotions[type]?.[k]?.text && !confirm('Gerar novamente e substituir o devocional de hoje?')) return;
  const box = type==='couple' ? $('#coupleText') : $('#childText');
  if(box) box.textContent='Gerando devocional com IA...';
  try{
    const text=await callAI(type==='couple'?promptCouple():promptChild(), type==='couple'?4300:1900);
    S.devotions[type][k]={text,ts:Date.now(),reading:currentPlan().reading,theme:type==='child'?childThemeForToday().name:'casal',generatedBy:'ai'};
    save(); toast('Devocional salvo. Que a Palavra frutifique no lar.');
  }catch(e){
    console.warn(e);
    S.devotions[type][k]={text:type==='couple'?fallbackCoupleDevotion():fallbackChildDevotion(),ts:Date.now(),reading:currentPlan().reading,theme:type==='child'?childThemeForToday().name:'casal',generatedBy:'local'};
    save(); toast('A IA não respondeu agora, mas deixei uma versão local salva.');
  }
}
function completeDevotion(type){
  const k=todayKey();
  markCheck(type==='couple'?'casal':'crianca',true);
  S.history.completedDevotions = S.history.completedDevotions || [];
  const id=type+'-'+k;
  if(!S.history.completedDevotions.some(x=>x.id===id)) S.history.completedDevotions.unshift({id,type,date:k,reading:currentPlan().reading,ts:Date.now()});
  S.history.completedDevotions = S.history.completedDevotions.slice(0,50);
  save(); toast('Momento registrado com carinho.');
}
function renderCouple(){
  const el=$('#sec-casal'); if(!el)return;
  const k=todayKey(); const saved=S.devotions.couple?.[k]; const text=saved?.text || fallbackCoupleDevotion();
  const g=coupleGuides();
  const reflect=S.reading.notes['couple-reflect-'+k] || S.reading.notes['couple-'+k] || '';
  const apply=S.reading.notes['couple-apply-'+k] || '';
  const prayer=S.reading.notes['couple-prayer-'+k] || '';
  el.innerHTML=`
    <div class="hero floralHero rose"><div class="heroMark" aria-hidden="true">${appIcon('heart')}</div>${appIllu('couple')}<p class="kicker">Devocional diário do casal</p><h2>Teologia para dentro da aliança.</h2><p>Uma reflexão para ler com reverência, conversar com honestidade e praticar o evangelho dentro de casa.</p></div>
    <div class="card">
      <div class="row between"><h3>Meditação de hoje</h3><span class="pill">${saved?'Salvo':'Base local'}</span></div>
      <div id="coupleText" class="devotional">${safeHTML(text)}</div>
      <div class="row" style="margin-top:12px">
        <button type="button" class="btn" onclick="generateDevotion('couple', ${saved?'true':'false'})">${saved?'Gerar novamente':'Gerar com IA'}</button>
        <button type="button" class="btn secondary" onclick="openReadMode('couple')">Modo leitura</button>
        <button type="button" class="btn secondary" onclick="completeDevotion('couple')">Concluir</button>
      </div>
      <p class="sub" style="margin-top:8px">O devocional gerado fica salvo durante o dia local do Brasil. Ele só muda se vocês escolherem gerar novamente.</p>
    </div>
    <div class="grid two coupleResponseGrid">
      <div class="card guideCard">
        <h3>Conversa guiada</h3>
        <div class="guideItem"><span>01</span><div><strong>Pergunta reflexiva</strong><p>${safeHTML(g.question)}</p></div></div>
        <div class="guideItem"><span>02</span><div><strong>Aplicação prática</strong><p>${safeHTML(g.practice)}</p></div></div>
        <div class="guideItem"><span>03</span><div><strong>Oração do casal</strong><p>${safeHTML(g.prayer)}</p></div></div>
      </div>
      <div class="card journalCard">
        <h3>Registro espiritual do casal</h3>
        <label class="sub" for="coupleReflect">O que Deus mostrou para nós hoje?</label>
        <textarea id="coupleReflect" class="input" placeholder="Escrevam a principal verdade recebida hoje.">${safeHTML(reflect)}</textarea>
        <label class="sub" for="coupleApply" style="margin-top:10px">Qual atitude prática vamos viver hoje?</label>
        <textarea id="coupleApply" class="input" placeholder="Ex.: ouvir com paciência, orar juntos, pedir perdão, servir um ao outro.">${safeHTML(apply)}</textarea>
        <label class="sub" for="couplePrayer" style="margin-top:10px">Oração do casal</label>
        <textarea id="couplePrayer" class="input" placeholder="Transformem a leitura em oração simples e sincera.">${safeHTML(prayer)}</textarea>
        <button type="button" class="btn full" style="margin-top:10px" onclick="saveCoupleJournal()">Salvar registro do casal</button>
      </div>
    </div>
    <div class="card">
      <h3>Histórico espiritual recente</h3>
      <div class="history">${coupleJournalHistory()}</div>
    </div>`;
}
function renderChild(){
  const el=$('#sec-crianca'); if(!el)return;
  const k=todayKey(); const saved=S.devotions.child?.[k]; const text=saved?.text || fallbackChildDevotion(); const t=childThemeForToday();
  const pages=storyPages(text); const pg=childPageIndex(pages.length); const pageText=pages[pg];
  el.innerHTML=`
    <div class="hero floralHero lilac storyHero childPlayHero"><div class="heroMark" aria-hidden="true">${appIcon('child')}</div>${appIllu('child')}<p class="kicker">Devocional infantil</p><h2>O livrinho ilustrado de hoje para Arthur.</h2><p>Uma página mais infantil, suave e visual para ajudar Arthur a imaginar, ouvir e guardar a verdade bíblica.</p><div class="storyMetaPills"><span class="themePill">Tema: ${safeHTML(t.name)}</span><span class="themePill">Frase: ${safeHTML(t.phrase)}</span><span class="themePill">Página ${pg+1} de ${pages.length}</span></div>${childStickerRow()}</div>

    <div class="storybookLayout childPlayLayout">
      <div class="card storybookCover childPlayCover">
        <div class="coverIllustration">${childSceneIllustration(t.name,pg)}</div>
        <p class="kicker">Livrinho do dia</p>
        <h3>${safeHTML(t.name)}</h3>
        <p>Conduzam como uma pequena leitura em família: voz calma, contato visual e repetição carinhosa.</p>
        <div class="storyReminder">Repitam juntos: “${safeHTML(t.phrase)}”</div>
        <div class="storySteps">
          <button type="button" onclick="scrollToCard('storybook-text')"><span>01</span><strong>Ouvir a história</strong></button>
          <button type="button" onclick="openReadMode('child')"><span>02</span><strong>Livro completo</strong></button>
          <button type="button" onclick="completeDevotion('child')"><span>03</span><strong>Concluir momento</strong></button>
        </div>
      </div>

      <div class="card storybookBook childStoryBook" id="storybook-text">
        <div class="row between"><h3>Historinha de hoje</h3><span class="pill">${saved?'Salvo':'Base local'}</span></div>
        <div class="storybookRibbon">Arthur • Palavra • Família</div>
        <div class="storybookPage childStoryPage" aria-live="polite">
          <div class="pageNumber">Página ${pg+1} / ${pages.length}</div>
          <div class="storyPictureFrame">${childSceneIllustration(t.name,pg+1)}</div>
          <div id="childText" class="devotional storyText childStoryText">${safeHTML(pageText)}</div>
        </div>
        <div class="pageControls">
          <button type="button" class="btn secondary" onclick="turnChildPage(-1)" ${pg<=0?'disabled':''}>Página anterior</button>
          <button type="button" class="btn" onclick="turnChildPage(1)" ${pg>=pages.length-1?'disabled':''}>Virar página</button>
        </div>
        <div class="row" style="margin-top:14px">
          <button type="button" class="btn" onclick="generateDevotion('child', ${saved?'true':'false'})">${saved?'Gerar novamente':'Gerar historinha com IA'}</button>
          <button type="button" class="btn secondary" onclick="openReadMode('child')">Abrir livro completo</button>
          <button type="button" class="btn secondary" onclick="completeDevotion('child')">Concluir</button>
        </div>
      </div>
    </div>

    <div class="grid two storyHelperGrid childHelperGrid">
      <div class="card storyCueCard childCueCard">
        <h3>Como conduzir</h3>
        <ul class="storyCueList">
          <li>Leiam uma página por vez, sem pressa.</li>
          <li>Mostrem a ilustração e perguntem o que Arthur está vendo.</li>
          <li>Virem a página junto com Arthur.</li>
          <li>Peçam para ele repetir a frase principal.</li>
          <li>Façam a atividade de 2 minutos e terminem em oração.</li>
        </ul>
      </div>
      <div class="card storyPrayerCard childPrayerCard">
        <h3>Clima do momento</h3>
        <p>Transformem esse tempo em um pequeno ritual familiar: sentem perto, apontem a ilustração, contem a história com expressão e celebrem cada resposta dele com alegria.</p>
        <div class="storyMiniActions">
          <span class="themePill">Imaginar</span>
          <span class="themePill">Olhar</span>
          <span class="themePill">Virar página</span>
          <span class="themePill">Orar</span>
        </div>
      </div>
    </div>
    <div class="grid two childSupportGrid">
      <div class="card childQuestionCard">
        <h3>Perguntinha para Arthur</h3>
        <p>${safeHTML(childSupportByTheme().question)}</p>
        <div class="themePill">Façam a pergunta com calma e deixem Arthur responder do jeitinho dele.</div>
      </div>
      <div class="card childActivityCard">
        <h3>Atividade de 2 minutos</h3>
        <p>${safeHTML(childSupportByTheme().activity)}</p>
        <div class="storyReminder">Oração final: ${safeHTML(childSupportByTheme().prayer)}</div>
      </div>
    </div>`;
}
function openReadMode(type){
  const k=todayKey(); const saved=S.devotions[type]?.[k]; const text=saved?.text || (type==='couple'?fallbackCoupleDevotion():fallbackChildDevotion());
  $('#readerKicker').textContent = type==='couple' ? 'Devocional do casal' : 'Devocional do Arthur';
  $('#readerTitle').textContent = type==='couple' ? 'Leitura devocional serena' : 'Historinha devocional do Arthur';
  $('#readerBody').textContent = text;
  document.querySelector('.readerPanel')?.classList.toggle('childBookMode', type==='child');
  const btn=$('#readerComplete'); btn.textContent = type==='couple' ? 'Concluir leitura do casal' : 'Concluir historinha do Arthur'; btn.onclick=()=>{ completeDevotion(type); closeReadMode(); };
  $('#reader').classList.remove('hidden'); document.body.classList.add('reader-open');
}
function closeReadMode(){ $('#reader')?.classList.add('hidden'); document.body.classList.remove('reader-open'); document.querySelector('.readerPanel')?.classList.remove('childBookMode'); }

function markRead(day,val){
  day=clamp(day,1,365);
  const wasCurrent = day===currentDay();
  if(val) S.reading.readDays[String(day)]=true; else delete S.reading.readDays[String(day)];
  if(val && wasCurrent) todayChecklist().leitura=true;
  if(val && day>=currentDay()) S.reading.currentDay=clamp(day+1,1,365);
  save(); toast(val?'Leitura marcada para hoje.':'Leitura desmarcada.');
}
function setCurrentDay(day){ S.reading.currentDay=clamp(day,1,365); save(); toast('Dia atual ajustado com suavidade.'); }
function resetReading(){
  if(confirm('Resetar todo o progresso de leitura? Vocês poderão marcar manualmente o que já leram.')){
    S.reading={...emptyState().reading,startDate:todayKey(), currentDay:1, readDays:{}, notes:{}, resetAt:Date.now()}; save(); toast('Plano reiniciado. Vocês podem marcar novamente com calma.');
  }
}
function markUntil(day){
  day=clamp(day,1,365); if(!day||!confirm(`Marcar do dia 1 até o dia ${day} como lido?`)) return;
  for(let i=1;i<=day;i++) S.reading.readDays[String(i)]=true;
  S.reading.currentDay=clamp(day+1,1,365); save(); toast('Leituras marcadas com sucesso.');
}
function unmarkFrom(day){
  day=clamp(day,1,365); if(!day||!confirm(`Desmarcar do dia ${day} até o dia 365?`)) return;
  for(let i=day;i<=365;i++) delete S.reading.readDays[String(i)];
  S.reading.currentDay=day; save(); toast('Leituras desmarcadas.');
}
function setStartToday(){ if(confirm('Definir hoje como o dia 1 do plano? Isso não apaga leituras marcadas.')){ S.reading.startDate=todayKey(); save(); toast('Calendário ajustado para continuar em paz.'); } }
function jumpExpected(){ setCurrentDay(expectedDay()); }
function toggleAllReading(){ S.reading.showAll=!S.reading.showAll; save(); }
function searchReading(){ const v=clamp($('#searchDay')?.value||S.reading.searchDay||currentDay(),1,365); S.reading.searchDay=String(v); S.reading.showAll=false; setCurrentDay(v); }
function dayItem(x){
  const doneDay=isRead(x.day), current=x.day===currentDay(), late=x.day<expectedDay() && !doneDay;
  return `<div class="dayItem ${doneDay?'done':''} ${current?'current':''} ${late?'late':''}">
    <div class="dayBadge">${x.day}</div>
    <div class="grow"><strong>${safeHTML(x.reading)}</strong><span>${safeHTML(x.focus)}</span></div>
    <button type="button" class="btn mini ${doneDay?'secondary':''}" onclick="markRead(${x.day},${doneDay?'false':'true'})">${doneDay?'Lido':'Marcar'}</button>
  </div>`;
}
function renderReading(){
  const el=$('#sec-leitura'); if(!el)return;
  const d=currentDay(); const e=expectedDay(); const p=currentPlan(); const done=doneCount(); const atraso=Math.max(0,e-d);
  const meta=readingTimelineMeta(d);
  const next=PLAN.slice(d-1, Math.min(365,d+7)).map(dayItem).join('');
  const previous=PLAN.slice(Math.max(0,d-4), d-1).map(dayItem).join('');
  const allList=S.reading.showAll ? PLAN.map(dayItem).join('') : '';
  el.innerHTML=`
    <div class="hero floralHero sage"><div class="heroMark" aria-hidden="true">${appIcon('bible')}</div>${appIllu('bible')}<p class="kicker">Plano cronológico 365 dias</p><h2>Leitura bíblica anual em ordem cronológica.</h2><p>A jornada acompanha a linha histórica da redenção: origens, patriarcas, reino, profetas, Cristo e igreja primitiva.</p></div>
    <div class="card timelineCard">
      <div class="row between"><h3>Linha do tempo bíblica</h3><span class="pill">${meta.progress}% da jornada temática</span></div>
      ${timelineHTML(meta)}
      <div class="timelineSummary"><strong>Fase atual: ${safeHTML(meta.current.label)}</strong><p>${safeHTML(meta.current.summary)}</p></div>
    </div>
    <div class="grid two">
      <div class="card">
        <h3>Progresso</h3>
        <div class="progress"><span style="width:${pct()}%"></span></div>
        <p><strong>${done}</strong> de 365 dias concluídos — ${pct()}%</p>
        <p class="sub">Dia atual: <strong>${p.day}</strong> · ${safeHTML(p.reading)}</p>
        ${atraso>0?`<p class="sub" style="color:#ffd7d4">Possível atraso pelo calendário local do Brasil: ${atraso} dia(s). Ajuste manualmente se necessário.</p>`:''}
        <div class="toolbar">
          <button type="button" class="btn" onclick="markRead(${p.day},true)">Marcar atual</button>
          <button type="button" class="btn secondary" onclick="markUntil(prompt('Marcar até qual dia?', '${Math.max(1,d-1)}'))">Marcar até...</button>
          <button type="button" class="btn secondary" onclick="unmarkFrom(prompt('Desmarcar a partir de qual dia?', '${d}'))">Desmarcar de...</button>
          <button type="button" class="btn ghost" onclick="jumpExpected()">Pular para hoje</button>
        </div>
      </div>
      <div class="card readingContextCard">
        <h3>Contexto da leitura de hoje</h3>
        <p><strong>Leitura:</strong> ${safeHTML(p.reading)}</p>
        <p><strong>Foco:</strong> ${safeHTML(p.focus)}</p>
        <p class="sub">Vocês não estão apenas lendo capítulos soltos. Hoje vocês estão dentro da fase <strong>${safeHTML(meta.current.label)}</strong> da história da redenção.</p>
        <div class="themePill">Leiam perguntando: o que Deus está revelando sobre si, sobre seu povo e sobre Cristo?</div>
      </div>
      <div class="card">
        <h3>Ajustar continuação</h3>
        <label class="sub" for="currentDayInput">Escolha o dia em que vocês querem continuar</label>
        <input id="currentDayInput" class="input" type="number" min="1" max="365" value="${d}" onchange="setCurrentDay(this.value)">
        <div class="readingSearch">
          <input id="searchDay" class="input" type="number" min="1" max="365" value="${safeHTML(S.reading.searchDay||'')}" placeholder="Ir para o dia...">
          <button type="button" class="btn secondary" onclick="searchReading()">Buscar dia</button>
        </div>
        <div class="row" style="margin-top:10px"><button type="button" class="btn secondary" onclick="setStartToday()">Dia 1 = hoje</button><button type="button" class="btn danger" onclick="resetReading()">Resetar plano</button></div>
      </div>
      <div class="card">
        <h3>Leitura atual</h3>
        ${dayItem(p)}
      </div>
    </div>
    <div class="card"><h3>Próximos 7 dias</h3><div class="compactList">${next||'<div class="empty"><strong>Plano concluído.</strong><span>Permaneçam na Palavra com gratidão.</span></div>'}</div></div>
    <div class="card"><h3>Dias anteriores próximos</h3><div class="compactList">${previous||'<div class="empty"><strong>Começo da jornada.</strong><span>Um passo por dia, com constância.</span></div>'}</div></div>
    <div class="card"><div class="row between"><h3>Todos os 365 dias</h3><button type="button" class="btn mini secondary" onclick="toggleAllReading()">${S.reading.showAll?'Ocultar lista':'Ver todos'}</button></div><p class="sub">Para deixar o celular rápido, a lista completa só é montada quando necessário.</p>${S.reading.showAll?`<div class="list compact">${allList}</div>`:''}</div>`;
}
function saveNote(id,val){ S.reading.notes[id]=val; save(); toast('Reflexão salva com carinho.'); }

function exportBackup(){ const blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='backup-eterno-compromisso-v41-'+todayKey()+'.json'; a.click(); URL.revokeObjectURL(a.href); }
function importBackup(file){ if(!file)return; const r=new FileReader(); r.onload=()=>{ try{ const imported=JSON.parse(r.result); S={...emptyState(),...imported,version:APP_VERSION}; normalizeState(); save(); toast('Backup restaurado com sucesso.'); }catch(e){ toast('Arquivo inválido.'); } }; r.readAsText(file); }
function restoreAutoBackup(index=0){
  try{
    const backups=JSON.parse(localStorage.getItem('ec_v41_auto_backups')||'[]');
    if(!backups[index]) return toast('Backup automático não encontrado.');
    if(confirm(`Restaurar backup automático de ${backups[index].date}?`)){ S={...emptyState(),...backups[index].state,version:APP_VERSION}; normalizeState(); save(); toast('Backup automático restaurado.'); }
  }catch(e){ toast('Não foi possível restaurar.'); }
}
function renderSettings(){
  const el=$('#sec-ajustes'); if(!el)return;
  const hist=(S.history.completedDevotions||[]).slice(0,6).map(x=>`<div class="historyItem">${x.date} — ${x.type==='couple'?'Devocional do casal':'Devocional do Arthur'}<br><span>${safeHTML(x.reading||'')}</span></div>`).join('') || '<div class="empty"><strong>Ainda não há registros.</strong><span>Comecem hoje com uma oração simples.</span></div>';
  let backups=[]; try{ backups=JSON.parse(localStorage.getItem('ec_v41_auto_backups')||'[]'); }catch(e){}
  const backupList=backups.slice(0,4).map((b,i)=>`<div class="historyItem"><strong>${b.date}</strong><br><span>Backup automático local</span><br><button type="button" class="btn mini secondary" onclick="restoreAutoBackup(${i})">Restaurar</button></div>`).join('') || '<div class="empty"><strong>Sem backup automático ainda.</strong><span>Ele será criado quando vocês salvarem algo hoje.</span></div>';
  el.innerHTML=`
    <div class="hero floralHero peach"><div class="heroMark" aria-hidden="true">${appIcon('settings')}</div>${appIllu('settings')}<p class="kicker">Ajustes</p><h2>Essencial, leve e confiável.</h2><p>Conta, backup, sincronização, histórico simples e manutenção do aplicativo.</p><div class="syncLine"><span class="dot ${syncDotClass()}"></span><span>${safeHTML(syncLabel())}</span></div></div>
    <div class="grid two">
      <div class="card"><h3>Conta</h3><p class="sub">${safeHTML(user?.email||'Não conectado')}</p><button type="button" class="btn secondary full" onclick="logout()">Sair</button></div>
      <div class="card"><h3>Sincronização</h3><p class="sub">${safeHTML(syncLabel())}</p><button type="button" class="btn full" onclick="forceSync()">Sincronizar agora</button></div>
      <div class="card"><h3>Backup manual</h3><div class="row"><button type="button" class="btn" onclick="exportBackup()">Exportar</button><label class="btn secondary">Importar<input type="file" accept="application/json" class="hidden" onchange="importBackup(this.files[0])"></label></div></div>
      <div class="card"><h3>Backups automáticos</h3><div class="history">${backupList}</div></div>
      <div class="card"><h3>Diagnóstico</h3><div class="stats"><div class="stat"><b>41</b><span>Versão</span></div><div class="stat"><b>${doneCount()}</b><span>Dias lidos</span></div><div class="stat"><b>${cloudReady?'Nuvem':'Local'}</b><span>Status</span></div></div><button type="button" class="btn secondary full" style="margin-top:10px" onclick="clearCaches()">Limpar cache</button></div>
      <div class="card"><h3>Histórico simples</h3><div class="history">${hist}</div></div>
    </div>`;
}
async function clearCaches(){ if('caches' in window){ const ks=await caches.keys(); await Promise.all(ks.map(k=>caches.delete(k))); } toast('Cache limpo. Reabra o app para sentir a nova versão.'); }

async function initFirebase(){
  try{
    if(!window.firebase) throw new Error('Firebase não carregou');
    firebase.initializeApp(FIREBASE_CONFIG); auth=firebase.auth(); db=firebase.firestore();
    auth.getRedirectResult?.().catch(()=>{});
  }catch(e){ console.warn(e); toast('Firebase indisponível. Recarregue o app.'); showLogin(); return; }
  auth.onAuthStateChanged(async u=>{
    if(!u){ user=null; cloudReady=false; lastSyncStatus='local'; showLogin(); return; }
    const email=String(u.email||'').toLowerCase();
    if(!ALLOWED_EMAILS.includes(email)){ await auth.signOut(); toast('Este e-mail não está autorizado.'); showLogin(); return; }
    user=u; hideLogin(); ref=db.collection('casais').doc(COUPLE_DOC);
    if(unsub)unsub();
    unsub=ref.onSnapshot(snap=>{
      if(!snap.exists){ cloudReady=true; lastSyncStatus='saving'; syncCloud(); render(); return; }
      const remote=snap.data()?.state;
      if(remote && remote.updatedAt && remote.updatedAt>(S.updatedAt||0)){
        applyingRemote=true;
        S={...emptyState(),...remote,version:APP_VERSION}; normalizeState(); localSave(); applyingRemote=false;
        lastSyncStatus='saved'; lastSyncAt='nuvem';
      }
      cloudReady=true; render();
    },err=>{ console.warn(err); cloudReady=false; lastSyncStatus='error'; render(); });
  });
}
async function loginGoogle(){
  try{
    if(!auth) throw new Error('Auth não iniciado');
    const provider=new firebase.auth.GoogleAuthProvider(); provider.setCustomParameters({prompt:'select_account'});
    await auth.signInWithPopup(provider);
  }catch(e){
    try{ const provider=new firebase.auth.GoogleAuthProvider(); provider.setCustomParameters({prompt:'select_account'}); await auth.signInWithRedirect(provider); }
    catch(err){ console.warn(err); toast('Não foi possível entrar com Google.'); }
  }
}
async function logout(){ try{ await auth.signOut(); }catch(e){} }
function showLogin(){ $('#login')?.classList.remove('hidden'); $('#app')?.classList.add('hidden'); $('#mainNav')?.classList.add('hidden'); }
function hideLogin(){ $('#login')?.classList.add('hidden'); $('#app')?.classList.remove('hidden'); $('#mainNav')?.classList.remove('hidden'); }

function installSW(){
  if(!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('service-worker.js?v='+APP_VERSION).then(reg=>{
    if(reg.waiting) showUpdate(reg.waiting);
    reg.addEventListener('updatefound',()=>{
      const worker=reg.installing;
      if(!worker) return;
      worker.addEventListener('statechange',()=>{ if(worker.state==='installed' && navigator.serviceWorker.controller) showUpdate(worker); });
    });
  }).catch(console.warn);
  navigator.serviceWorker.addEventListener('controllerchange',()=>{ if(!window.__reloading){ window.__reloading=true; location.reload(); }});
}
function showUpdate(worker){ swWaiting=worker; $('#updateBanner')?.classList.remove('hidden'); }
function applyAppUpdate(){ if(swWaiting){ swWaiting.postMessage({type:'SKIP_WAITING'}); } else location.reload(); }

window.switchTab=switchTab; window.markRead=markRead; window.setCurrentDay=setCurrentDay; window.resetReading=resetReading; window.markUntil=markUntil; window.unmarkFrom=unmarkFrom; window.setStartToday=setStartToday; window.jumpExpected=jumpExpected; window.toggleAllReading=toggleAllReading; window.searchReading=searchReading; window.generateDevotion=generateDevotion; window.completeDevotion=completeDevotion; window.openReadMode=openReadMode; window.closeReadMode=closeReadMode; window.saveNote=saveNote; window.saveWeeklyReview=saveWeeklyReview; window.loginGoogle=loginGoogle; window.logout=logout; window.exportBackup=exportBackup; window.importBackup=importBackup; window.restoreAutoBackup=restoreAutoBackup; window.clearCaches=clearCaches; window.forceSync=forceSync; window.applyAppUpdate=applyAppUpdate; window.toggleInsight=toggleInsight; window.scrollToCard=scrollToCard; window.turnChildPage=turnChildPage; window.toggleDarkMode=toggleDarkMode;

(async function main(){ localLoad(); await loadSvgSprite(); await loadDataFiles(); installSW(); initFirebase(); render(); setTimeout(hideSplash,520); })();
