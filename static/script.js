'use strict';

/* ════════════════════════════════════════════════════
   LΞNS·AI v2 — script.js
════════════════════════════════════════════════════ */

// ── State ────────────────────────────────────────────
const S = {
  sessionId:   null,
  busy:        false,
  chatLocked:  false,
  msgCount:    0,
  results:     null,
};

const STEP_ORDER = ['audio','transcript','title','summary','extract','rag'];
const STEP_WEIGHT = { audio:15, transcript:30, title:10, summary:20, extract:15, rag:10 };

// ── Helpers ──────────────────────────────────────────
const $  = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);

function toast(msg, type='', dur=2800){
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._tid);
  t._tid = setTimeout(() => { t.className = 'toast'; }, dur);
}

function setStatus(text, cls=''){
  const dot = qs('.sf-dot');
  const lbl = $('sfStatusText');
  lbl.textContent = text;
  dot.className = 'sf-dot ' + cls;
  $('pipelineStatus').textContent = text;
  $('pipelineStatus').className   = 'pipeline-status ' + cls;
}

// ── Canvas particles background ──────────────────────
(function initCanvas(){
  const canvas = $('bgCanvas');
  const ctx    = canvas.getContext('2d');
  let W, H, dots = [];

  function resize(){
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function mkDot(){
    return {
      x: Math.random()*W, y: Math.random()*H,
      r: Math.random()*1.2+0.3,
      vx:(Math.random()-0.5)*0.15,
      vy:(Math.random()-0.5)*0.15,
      a: Math.random()*0.4+0.05,
    };
  }

  function init(){
    resize();
    dots = Array.from({length:80},mkDot);
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    dots.forEach(d => {
      d.x += d.vx; d.y += d.vy;
      if(d.x<0)d.x=W; if(d.x>W)d.x=0;
      if(d.y<0)d.y=H; if(d.y>H)d.y=0;
      ctx.beginPath();
      ctx.arc(d.x,d.y,d.r,0,Math.PI*2);
      ctx.fillStyle = `rgba(77,159,255,${d.a})`;
      ctx.fill();
    });
    // draw faint lines between close dots
    for(let i=0;i<dots.length;i++){
      for(let j=i+1;j<dots.length;j++){
        const dx=dots[i].x-dots[j].x, dy=dots[i].y-dots[j].y;
        const dist=Math.sqrt(dx*dx+dy*dy);
        if(dist<110){
          ctx.beginPath();
          ctx.moveTo(dots[i].x,dots[i].y);
          ctx.lineTo(dots[j].x,dots[j].y);
          ctx.strokeStyle=`rgba(77,159,255,${0.06*(1-dist/110)})`;
          ctx.lineWidth=0.6;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize',resize);
  init(); draw();
})();

// ── Tab switching (sidebar) ──────────────────────────
function switchTab(tab){
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  $('tabPanelAnalyse').style.display  = tab==='analyse' ? 'flex'  : 'none';
  $('tabPanelChat').style.display     = tab==='chat'    ? 'flex'  : 'none';
  if(tab==='chat') $('chatBadge').style.display='none';
}

// ── Result tab switching ─────────────────────────────
function switchResultTab(name){
  document.querySelectorAll('.rt-tab').forEach(b => b.classList.toggle('active', b.dataset.rtab===name));
  document.querySelectorAll('.rt-panel').forEach(p => p.classList.toggle('active', p.id===`panel-${name}`));
  if(name==='chat') { $('rtChatBadge').style.display='none'; }
}

// ── Pipeline helpers ─────────────────────────────────
function resetPipeline(){
  STEP_ORDER.forEach(s => {
    const el = $(`pip-${s}`);
    el.classList.remove('active','done');
  });
  $('pipelineProgress').style.width = '0%';
  $('pipelineWrap').style.display   = 'block';
  setStatus('Idle','idle');
}

function setStep(step, status){
  const el = $(`pip-${step}`);
  if(!el) return;
  el.classList.remove('active','done');
  if(status==='active'||status==='done') el.classList.add(status);

  // update progress bar
  if(status==='done'){
    const doneSteps = STEP_ORDER.filter(s=>$(`pip-${s}`).classList.contains('done'));
    const pct = doneSteps.reduce((a,s)=>a+STEP_WEIGHT[s],0);
    $('pipelineProgress').style.width = Math.min(pct,100)+'%';
  }
}

// ── Busy state ───────────────────────────────────────
function setBusy(on){
  S.busy = on;
  const btn = $('runBtn');
  btn.disabled = on;
  $('sourceInput').disabled = on;
  $('langSelect').disabled  = on;
  if(on){
    $('runBtnText').innerHTML = '<span class="spin"></span> Analysing…';
    setStatus('Running','running');
  } else {
    $('runBtnText').textContent = 'Run Analysis';
  }
}

// ── Start analysis ───────────────────────────────────
function startAnalysis(){
  const source = $('sourceInput').value.trim();
  if(!source){ toast('Please enter a YouTube URL or file path.','error'); return; }
  if(S.busy) return;

  resetPipeline();
  setBusy(true);
  $('heroSection').style.display    = 'flex';
  $('resultsSection').style.display = 'none';

  fetch('/analyse/stream',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({source, language: $('langSelect').value}),
  })
  .then(res=>{
    if(!res.ok) throw new Error(`Server error ${res.status}`);
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    function pump(){
      return reader.read().then(({value,done})=>{
        if(done){ setBusy(false); return; }
        buf += decoder.decode(value,{stream:true});
        const parts = buf.split('\n\n');
        buf = parts.pop();
        parts.forEach(chunk=>{
          const lines = chunk.trim().split('\n');
          let ev='message', data='';
          lines.forEach(l=>{
            if(l.startsWith('event: ')) ev = l.slice(7).trim();
            if(l.startsWith('data: '))  data = l.slice(6).trim();
          });
          if(data) handleSSE(ev, JSON.parse(data));
        });
        return pump();
      });
    }
    return pump();
  })
  .catch(err=>{
    setBusy(false);
    setStatus('Error','error');
    toast(err.message||'Something went wrong.','error',4000);
  });
}

function handleSSE(event, data){
  if(event==='step'){
    setStep(data.step, data.status);
    const labels = {
      audio:'Processing audio',transcript:'Transcribing',
      title:'Generating title',summary:'Summarising',
      extract:'Extracting insights',rag:'Building RAG engine',
    };
    if(data.status==='active') setStatus(labels[data.step]||data.step,'running');
    if(data.step==='rag'&&data.status==='done') setStatus('Done','done');
  }
  if(event==='result'){
    S.sessionId = data.session_id;
    S.results   = data;
    setBusy(false);
    renderResults(data);
    toast('Analysis complete ✓','success');
    // unlock chat tab
    $('chatBadge').style.display='inline';
    $('tabChat').style.opacity='1';
    $('tabChat').style.pointerEvents='auto';
    $('chatBadge').style.display='inline';
    $('chat-info-box') && ($('chat-info-box').innerHTML = '<div class="chat-info-text">Chat is ready. Switch to the Chat tab in results.</div>');
    // enable chat info in sidebar
    const cib = document.querySelector('.chat-info-box');
    if(cib) cib.innerHTML='<div class="chat-info-icon">✅</div><div class="chat-info-text">Analysis done! Go to the Chat tab in results to start chatting.</div>';
  }
  if(event==='error'){
    setBusy(false);
    setStatus('Error','error');
    toast(data.message||'Pipeline error.','error',5000);
    STEP_ORDER.forEach(s=>{ if($(`pip-${s}`).classList.contains('active')) setStep(s,''); });
  }
}

// ── Render results ───────────────────────────────────
function renderResults(data){
  $('resultTitle').textContent = data.title || '—';
  $('heroSection').style.display    = 'none';
  $('resultsSection').style.display = 'flex';

  // Stats
  const words = (data.transcript||'').split(/\s+/).filter(Boolean).length;
  const readMin = Math.max(1,Math.ceil(words/200));
  $('statWordsVal').textContent   = words.toLocaleString();
  $('statTimeVal').textContent    = `${readMin} min`;
  $('statActionsVal').textContent = countBullets(data.action_items);
  $('statDecsVal').textContent    = countBullets(data.key_decisions);

  // Cards
  setCardBody('summaryBody',   data.summary);
  setCardBody('actionsBody',   data.action_items);
  setCardBody('actionsBody2',  data.action_items);
  setCardBody('decisionsBody', data.key_decisions);
  setCardBody('questionsBody', data.open_questions);

  $('transcriptBody').textContent = data.transcript||'';

  // Default to overview
  switchResultTab('overview');
}

function countBullets(text){
  if(!text) return '0';
  const lines = text.split('\n').filter(l=>/\S/.test(l));
  return String(lines.length);
}

function setCardBody(id, text){
  const el = $(id);
  if(!el) return;
  if(!text){ el.innerHTML='<span style="color:var(--text3)">—</span>'; return; }
  const esc = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const lines = esc.split('\n').filter(l=>/\S/.test(l));
  const isList = lines.length>1 && lines.every(l=>/^[\-•*\d]/.test(l.trim()));
  if(isList){
    el.innerHTML = '<ul>'+lines.map(l=>`<li>${l.replace(/^[\-•*\d+\.]+\s*/,'')}</li>`).join('')+'</ul>';
  } else {
    el.innerHTML = lines.map(l=>`<p style="margin-bottom:0.4rem">${l}</p>`).join('');
  }
}

// ── Copy helpers ─────────────────────────────────────
function copyTranscript(){
  const text = $('transcriptBody').textContent;
  navigator.clipboard.writeText(text).then(()=>toast('Transcript copied','success'));
}

function copyAll(){
  if(!S.results) return;
  const r = S.results;
  const txt = [
    `LΞNS·AI Export`,`Title: ${r.title}`,``,
    `── Summary ──`,r.summary,``,
    `── Action Items ──`,r.action_items,``,
    `── Key Decisions ──`,r.key_decisions,``,
    `── Open Questions ──`,r.open_questions,``,
    `── Transcript ──`,r.transcript,
  ].join('\n');
  navigator.clipboard.writeText(txt).then(()=>toast('All results copied','success'));
}

// ── Reset ────────────────────────────────────────────
function resetUI(){
  $('heroSection').style.display    = 'flex';
  $('resultsSection').style.display = 'none';
  $('sourceInput').value            = '';
  S.sessionId = null; S.results = null;
  resetChatMessages();
  setStatus('Ready','idle');
  $('pipelineWrap').style.display='block';
  resetPipeline();
}

// ── Chat ─────────────────────────────────────────────
function resetChatMessages(){
  $('chatMessages').innerHTML=`
  <div class="chat-welcome">
    <div class="cw-icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
    </div>
    <div class="cw-title">Ask LΞNS·AI</div>
    <div class="cw-desc">Ask anything about your video — key moments, decisions, action items, or any specific detail.</div>
    <div class="cw-suggestions" id="cwSuggestions">
      <button class="cw-chip" onclick="useChip(this)">What are the main topics?</button>
      <button class="cw-chip" onclick="useChip(this)">Summarise key decisions</button>
      <button class="cw-chip" onclick="useChip(this)">List all action items</button>
      <button class="cw-chip" onclick="useChip(this)">What questions were raised?</button>
    </div>
  </div>`;
  S.msgCount=0;
}

function useChip(btn){
  $('chatInput').value = btn.textContent;
  btn.closest('.cw-suggestions') && (btn.closest('.chat-welcome').style.display='none');
  sendChat();
}

function chatKeydown(e){
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendChat(); }
}

function autoResize(el){
  el.style.height='auto';
  el.style.height=Math.min(el.scrollHeight,120)+'px';
}

function sendChat(){
  if(S.chatLocked) return;
  const q = $('chatInput').value.trim();
  if(!q) return;
  if(!S.sessionId){ toast('Please run an analysis first.','error'); return; }

  // Remove welcome if present
  const welcome = $('chatMessages').querySelector('.chat-welcome');
  if(welcome) welcome.remove();

  appendMsg('user','You', q);
  $('chatInput').value='';
  autoResize($('chatInput'));

  const thinkId = appendThinking();
  S.chatLocked=true;
  $('chatSendBtn').disabled=true;

  fetch('/chat',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({session_id:S.sessionId, question:q}),
  })
  .then(r=>r.json())
  .then(data=>{
    removeThinking(thinkId);
    appendMsg('bot','LΞNS·AI', data.error||data.answer||'—');
    S.msgCount++;
    // badge on chat tab
    const activePanelIsChat = qs('.rt-tab.active')?.dataset?.rtab==='chat';
    if(!activePanelIsChat){
      $('rtChatBadge').style.display='inline-block';
      $('rtChatBadge').textContent=S.msgCount;
    }
  })
  .catch(()=>{
    removeThinking(thinkId);
    appendMsg('bot','LΞNS·AI','Sorry, something went wrong. Please try again.');
  })
  .finally(()=>{
    S.chatLocked=false;
    $('chatSendBtn').disabled=false;
    $('chatInput').focus();
  });
}

function appendMsg(role, who, text){
  const div=document.createElement('div');
  div.className=`msg-wrap ${role}-wrap`;
  div.innerHTML=`
    <span class="msg-who">${who}</span>
    <div class="msg-bubble ${role}">${escHtml(text)}</div>`;
  $('chatMessages').appendChild(div);
  $('chatMessages').scrollTop=$('chatMessages').scrollHeight;
}

function appendThinking(){
  const id='think_'+Date.now();
  const div=document.createElement('div');
  div.id=id; div.className='msg-wrap bot-wrap';
  div.innerHTML=`
    <span class="msg-who">LΞNS·AI</span>
    <div class="msg-bubble bot thinking-bubble">
      <div class="td"></div><div class="td"></div><div class="td"></div>
    </div>`;
  $('chatMessages').appendChild(div);
  $('chatMessages').scrollTop=$('chatMessages').scrollHeight;
  return id;
}

function removeThinking(id){ const el=$(id); if(el) el.remove(); }

function escHtml(s){
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

// ── Enter key on source input ─────────────────────────
document.getElementById('sourceInput').addEventListener('keydown',e=>{
  if(e.key==='Enter') startAnalysis();
});

// ── Init ─────────────────────────────────────────────
setStatus('Ready','idle');
$('pipelineWrap').style.display='none';