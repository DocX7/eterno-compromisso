const APP_VERSION = 'V29_FINAL_VISUAL_COMPLETA';
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
const STORAGE_KEY = 'ec_v29_final_visual_state';
const LEGACY_STORAGE_KEYS = ['ec_v28_fluidez_state','ec_v27_premium_state','ec_v26_floral_state','ec_v25_pastel_state','ec_v24_essencial_state','ec_v23_essencial_state','ec_v22_essencial_state'];
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
    settings: { model: DEFAULT_MODEL }
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
  S.settings={...base.settings,...(S.settings||{})};
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
    const k='ec_v29_auto_backups'; const today=todayKey();
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
  S.activeTab=tab; localSave(); history.replaceState(null,'','#'+tab); render(); window.scrollTo({top:0,behavior:'smooth'});
}
window.addEventListener('hashchange',()=>{ const tab=location.hash.replace('#',''); if(tab && tab!==S.activeTab) switchTab(tab); });

function render(){ renderShell(); renderHoje(); renderCouple(); renderChild(); renderReading(); renderSettings(); applyMotionEnhancements(document); }
function renderShell(){
  const activeTab=S.activeTab||'hoje';
  document.body.setAttribute('data-tab',activeTab);
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

function markCheck(id,val){ const c=todayChecklist(); c[id]=!!val; save(); }
function checkHTML(id,title,desc,checked){ return `<label class="check"><input type="checkbox" data-id="${id}" ${checked?'checked':''}><span><strong>${title}</strong><span>${desc}</span></span></label>`; }
function renderHoje(){
  const el=$('#sec-hoje'); if(!el)return;
  const p=currentPlan(); const ep=expectedPlan(); const sc=todayScore(); const c=todayChecklist(); const atraso=Math.max(0, expectedDay()-currentDay());
  const review=renderWeeklyReviewCard();
  el.innerHTML=`
    <div class="hero floralHero sunrise homeHero"><div class="heroMark" aria-hidden="true">${appIcon('spark')}</div>${appIllu('sunrise')}
      <p class="kicker">Um dia com Deus</p>
      <h2>O que vamos viver hoje diante do Senhor?</h2>
      <p>Um caminho simples para conduzir o lar: Palavra, conversa sincera, ensino para Arthur e oração em família.</p>
      <div class="verseCallout">“A tua palavra é lâmpada para os meus pés e luz para o meu caminho.”</div>
      <div class="syncLine"><span class="dot ${syncDotClass()}"></span><span>${safeHTML(syncLabel())}</span></div>
    </div>

    <div class="actionGrid">
      <button type="button" class="action" onclick="switchTab('casal')"><span class="ico">${appIcon('heart')}</span><span><strong>Devocional do casal</strong><span>Reflexão teológica, exame do coração e prática de hoje.</span></span></button>
      <button type="button" class="action" onclick="switchTab('crianca')"><span class="ico">${appIcon('child')}</span><span><strong>Devocional do Arthur</strong><span>Tema de hoje: ${safeHTML(childThemeForToday().name)}.</span></span></button>
      <button type="button" class="action" onclick="switchTab('leitura')"><span class="ico">${appIcon('bible')}</span><span><strong>Leitura bíblica</strong><span>Dia ${p.day}: ${safeHTML(p.reading)}</span></span></button>
    </div>

    <div class="grid two homeGrid">
      <div class="card primaryCard devotionalMoment">
        <div class="row between"><h3>Momento devocional</h3><span class="pill soft">${sc}%</span></div>
        <div class="progress"><span style="width:${sc}%"></span></div>
        <div class="checks">
          ${checkHTML('silencio','Silenciar o coração','Um minuto de quietude antes da Palavra.',c.silencio)}
          ${checkHTML('casal','Ler o devocional do casal','Conversem com sinceridade, sem pressa.',c.casal)}
          ${checkHTML('crianca','Fazer o devocional do Arthur','Uma frase bíblica para ele repetir.',c.crianca)}
          ${checkHTML('leitura','Concluir a leitura bíblica',safeHTML(p.reading),c.leitura)}
          ${checkHTML('oracao','Orar em família','Fé, casamento, Arthur, santidade e trabalho.',c.oracao)}
        </div>
      </div>
      <div class="card focusCard">
        <h3>Leitura em foco</h3>
        <div class="readingHeader"><div class="dayBadge">${p.day}</div><div><p><strong>${safeHTML(p.reading)}</strong></p><p class="sub">${safeHTML(p.focus)}</p></div></div>
        <div class="row" style="margin-top:10px"><button type="button" class="btn" onclick="markRead(${p.day},true); markCheck('leitura',true)">Marcar como lido</button><button type="button" class="btn secondary" onclick="switchTab('leitura')">Abrir plano</button></div>
        ${atraso>0 ? `<p class="sub" style="margin-top:10px;color:#ffd7d4">Pelo calendário local do Brasil, a leitura esperada hoje seria o dia ${ep.day}. Ajuste manualmente se vocês já estavam em outro ponto.</p>` : ''}
      </div>
    </div>

    ${review}

    <div class="card prayerCard">
      <h3>Oração breve</h3>
      <p class="quote">Senhor, dá-nos fome pela tua Palavra, humildade para obedecer, amor para servir dentro de casa e constância para viver diante de ti hoje. Amém.</p>
    </div>`;
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
  return `Título: ${t.name}

Verdade bíblica em uma frase:
${t.truth}

Explicação para Arthur:
Arthur, Deus é bom. Ele ama você e cuida da nossa família. Hoje nós vamos lembrar uma coisa bem simples: ${t.phrase}

Exemplo da rotina:
Quando você acorda, brinca, come, toma banho e vai dormir, Deus continua vendo você e cuidando de você.

Perguntinha:
O que vamos repetir hoje? Resposta: ${t.phrase}

Atividade de 2 minutos:
Peça para Arthur colocar a mão no coração e repetir três vezes: “${t.phrase}”. Depois, dê um abraço nele e agradeçam a Deus juntos.

Frase para repetir:
${t.phrase}

Oração curtinha:
Papai do céu, obrigado por me amar. Ajuda-me a obedecer, compartilhar e amar minha família. Amém.`;
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
  return `Crie um devocional bíblico para uma criança de 3 anos chamada Arthur.

Tema infantil de hoje: ${t.name}
Verdade desejada: ${t.truth}
Frase para repetir: ${t.phrase}
Base bíblica do plano da família: ${p.reading}
Foco: ${p.focus}

Requisitos:
- português do Brasil;
- curto, carinhoso, concreto e bíblico;
- linguagem de criança de 3 anos;
- sem temas assustadores;
- sem explicações abstratas longas;
- use repetição, imagem mental simples e rotina da criança;
- ajude Marcus e Ingrid a conduzir em 2 a 4 minutos.

Estrutura obrigatória:
1. Título
2. Verdade bíblica em uma frase
3. História ou explicação curta para criança
4. Exemplo da rotina da criança
5. Pergunta simples para os pais fazerem
6. Atividade de 2 minutos
7. Frase para repetir
8. Oração curtinha.`;
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
    <div class="card">
      <h3>Resposta do casal</h3>
      <textarea id="coupleNote" class="input" placeholder="O que Deus mostrou para nós hoje? Que atitude precisa mudar?">${safeHTML(S.reading.notes['couple-'+k]||'')}</textarea>
      <button type="button" class="btn full" style="margin-top:10px" onclick="saveNote('couple-${k}', document.getElementById('coupleNote').value)">Salvar reflexão</button>
    </div>`;
}
function renderChild(){
  const el=$('#sec-crianca'); if(!el)return;
  const k=todayKey(); const saved=S.devotions.child?.[k]; const text=saved?.text || fallbackChildDevotion(); const t=childThemeForToday();
  el.innerHTML=`
    <div class="hero floralHero lilac"><div class="heroMark" aria-hidden="true">${appIcon('child')}</div>${appIllu('child')}<p class="kicker">Devocional infantil</p><h2>Para Arthur, 3 anos.</h2><p>Curto, repetível, carinhoso e adequado para ensinar uma verdade bíblica simples.</p><span class="themePill">Tema: ${safeHTML(t.name)}</span><span class="themePill">Frase: ${safeHTML(t.phrase)}</span></div>
    <div class="card">
      <div class="row between"><h3>Devocional de hoje</h3><span class="pill">${saved?'Salvo':'Base local'}</span></div>
      <div id="childText" class="devotional">${safeHTML(text)}</div>
      <div class="row" style="margin-top:12px">
        <button type="button" class="btn" onclick="generateDevotion('child', ${saved?'true':'false'})">${saved?'Gerar novamente':'Gerar com IA'}</button>
        <button type="button" class="btn secondary" onclick="openReadMode('child')">Modo leitura</button>
        <button type="button" class="btn secondary" onclick="completeDevotion('child')">Concluir</button>
      </div>
    </div>
    <div class="card"><h3>Como conduzir</h3><p>Leia devagar, peça para Arthur repetir a frase principal, faça a atividade de 2 minutos e termine com uma oração bem curta. Para essa idade, constância vale mais que quantidade.</p></div>`;
}
function openReadMode(type){
  const k=todayKey(); const saved=S.devotions[type]?.[k]; const text=saved?.text || (type==='couple'?fallbackCoupleDevotion():fallbackChildDevotion());
  $('#readerKicker').textContent = type==='couple' ? 'Devocional do casal' : 'Devocional do Arthur';
  $('#readerTitle').textContent = type==='couple' ? 'Leitura devocional serena' : 'Momento devocional com Arthur';
  $('#readerBody').textContent = text;
  const btn=$('#readerComplete'); btn.textContent = type==='couple' ? 'Concluir leitura do casal' : 'Concluir momento com Arthur'; btn.onclick=()=>{ completeDevotion(type); closeReadMode(); };
  $('#reader').classList.remove('hidden'); document.body.classList.add('reader-open');
}
function closeReadMode(){ $('#reader')?.classList.add('hidden'); document.body.classList.remove('reader-open'); }

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
  const next=PLAN.slice(d-1, Math.min(365,d+7)).map(dayItem).join('');
  const previous=PLAN.slice(Math.max(0,d-4), d-1).map(dayItem).join('');
  const allList=S.reading.showAll ? PLAN.map(dayItem).join('') : '';
  el.innerHTML=`
    <div class="hero floralHero sage"><div class="heroMark" aria-hidden="true">${appIcon('bible')}</div>${appIllu('bible')}<p class="kicker">Plano cronológico 365 dias</p><h2>Leitura bíblica anual, leve no celular.</h2><p>A tela mostra o essencial. A lista completa só aparece quando vocês pedirem.</p></div>
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
    </div>
    <div class="card"><h3>Leitura atual</h3>${dayItem(p)}</div>
    <div class="card"><h3>Próximos 7 dias</h3><div class="compactList">${next||'<div class="empty"><strong>Plano concluído.</strong><span>Permaneçam na Palavra com gratidão.</span></div>'}</div></div>
    <div class="card"><h3>Dias anteriores próximos</h3><div class="compactList">${previous||'<div class="empty"><strong>Começo da jornada.</strong><span>Um passo por dia, com constância.</span></div>'}</div></div>
    <div class="card"><div class="row between"><h3>Todos os 365 dias</h3><button type="button" class="btn mini secondary" onclick="toggleAllReading()">${S.reading.showAll?'Ocultar lista':'Ver todos'}</button></div><p class="sub">Para deixar o celular rápido, a lista completa só é montada quando necessário.</p>${S.reading.showAll?`<div class="list compact">${allList}</div>`:''}</div>`;
}
function saveNote(id,val){ S.reading.notes[id]=val; save(); toast('Reflexão salva com carinho.'); }

function exportBackup(){ const blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='backup-eterno-compromisso-v29-'+todayKey()+'.json'; a.click(); URL.revokeObjectURL(a.href); }
function importBackup(file){ if(!file)return; const r=new FileReader(); r.onload=()=>{ try{ const imported=JSON.parse(r.result); S={...emptyState(),...imported,version:APP_VERSION}; normalizeState(); save(); toast('Backup restaurado com sucesso.'); }catch(e){ toast('Arquivo inválido.'); } }; r.readAsText(file); }
function restoreAutoBackup(index=0){
  try{
    const backups=JSON.parse(localStorage.getItem('ec_v29_auto_backups')||'[]');
    if(!backups[index]) return toast('Backup automático não encontrado.');
    if(confirm(`Restaurar backup automático de ${backups[index].date}?`)){ S={...emptyState(),...backups[index].state,version:APP_VERSION}; normalizeState(); save(); toast('Backup automático restaurado.'); }
  }catch(e){ toast('Não foi possível restaurar.'); }
}
function renderSettings(){
  const el=$('#sec-ajustes'); if(!el)return;
  const hist=(S.history.completedDevotions||[]).slice(0,6).map(x=>`<div class="historyItem">${x.date} — ${x.type==='couple'?'Devocional do casal':'Devocional do Arthur'}<br><span>${safeHTML(x.reading||'')}</span></div>`).join('') || '<div class="empty"><strong>Ainda não há registros.</strong><span>Comecem hoje com uma oração simples.</span></div>';
  let backups=[]; try{ backups=JSON.parse(localStorage.getItem('ec_v29_auto_backups')||'[]'); }catch(e){}
  const backupList=backups.slice(0,4).map((b,i)=>`<div class="historyItem"><strong>${b.date}</strong><br><span>Backup automático local</span><br><button type="button" class="btn mini secondary" onclick="restoreAutoBackup(${i})">Restaurar</button></div>`).join('') || '<div class="empty"><strong>Sem backup automático ainda.</strong><span>Ele será criado quando vocês salvarem algo hoje.</span></div>';
  el.innerHTML=`
    <div class="hero floralHero peach"><div class="heroMark" aria-hidden="true">${appIcon('settings')}</div>${appIllu('settings')}<p class="kicker">Ajustes</p><h2>Essencial, leve e confiável.</h2><p>Conta, backup, sincronização, histórico simples e manutenção do aplicativo.</p><div class="syncLine"><span class="dot ${syncDotClass()}"></span><span>${safeHTML(syncLabel())}</span></div></div>
    <div class="grid two">
      <div class="card"><h3>Conta</h3><p class="sub">${safeHTML(user?.email||'Não conectado')}</p><button type="button" class="btn secondary full" onclick="logout()">Sair</button></div>
      <div class="card"><h3>Sincronização</h3><p class="sub">${safeHTML(syncLabel())}</p><button type="button" class="btn full" onclick="forceSync()">Sincronizar agora</button></div>
      <div class="card"><h3>Backup manual</h3><div class="row"><button type="button" class="btn" onclick="exportBackup()">Exportar</button><label class="btn secondary">Importar<input type="file" accept="application/json" class="hidden" onchange="importBackup(this.files[0])"></label></div></div>
      <div class="card"><h3>Backups automáticos</h3><div class="history">${backupList}</div></div>
      <div class="card"><h3>Diagnóstico</h3><div class="stats"><div class="stat"><b>29</b><span>Versão</span></div><div class="stat"><b>${doneCount()}</b><span>Dias lidos</span></div><div class="stat"><b>${cloudReady?'Nuvem':'Local'}</b><span>Status</span></div></div><button type="button" class="btn secondary full" style="margin-top:10px" onclick="clearCaches()">Limpar cache</button></div>
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

window.switchTab=switchTab; window.markRead=markRead; window.setCurrentDay=setCurrentDay; window.resetReading=resetReading; window.markUntil=markUntil; window.unmarkFrom=unmarkFrom; window.setStartToday=setStartToday; window.jumpExpected=jumpExpected; window.toggleAllReading=toggleAllReading; window.searchReading=searchReading; window.generateDevotion=generateDevotion; window.completeDevotion=completeDevotion; window.openReadMode=openReadMode; window.closeReadMode=closeReadMode; window.saveNote=saveNote; window.saveWeeklyReview=saveWeeklyReview; window.loginGoogle=loginGoogle; window.logout=logout; window.exportBackup=exportBackup; window.importBackup=importBackup; window.restoreAutoBackup=restoreAutoBackup; window.clearCaches=clearCaches; window.forceSync=forceSync; window.applyAppUpdate=applyAppUpdate;

(async function main(){ localLoad(); await loadSvgSprite(); await loadDataFiles(); installSW(); initFirebase(); render(); setTimeout(hideSplash,520); })();
