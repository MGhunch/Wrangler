/* =====================================================================
   WRANGLER — THE PLATE
   A reviewer's whole world: the pages, stacked; a tap drops a pin and
   opens a note right there; the rail lists the notes on a desktop.

   Rules the screen keeps, so no prompt has to:
   - Nobody edits the work. The pages are pictures.
   - Speaks second: you see nobody else's pins on a page until you've
     left one of your own there.
   - A name is a lanyard, not a door. Asked once, at your first note.
   ===================================================================== */

let RID=null, R=null, PINS=[], WHO=null, OPEN=null, WORDS={};

const whoLoad = () => { try{ return JSON.parse(localStorage.getItem('wr_who')||'null'); }catch(e){ return null; } };
const whoSave = w  => { try{ localStorage.setItem('wr_who', JSON.stringify(w)); }catch(e){} };
const isMine  = p  => !!(WHO && p.who===WHO.id);
const initial = n  => (n||'?').trim().charAt(0).toUpperCase();
const isBox   = p  => !!(p && p.w>0 && p.h>0);
const hasSpans= p  => !!(p && p.spans && p.spans.length);
/* the mark on the work: a highlight (spans), a soft area (box with no
   words under it), or a dot (a tap). No numbers on the work — those live
   in the margin. */
function markHtml(p, who){
  const pid=p.id?`data-pid="${p.id}"`:'';
  if(hasSpans(p)) return p.spans.map(([x,y,w,h])=>
    `<div class="hl ${who}" style="left:${x*100}%;top:${y*100}%;width:${w*100}%;height:${h*100}%" ${pid}></div>`).join('');
  if(isBox(p)) return `<div class="hl area ${who}" style="left:${p.x*100}%;top:${p.y*100}%;width:${p.w*100}%;height:${p.h*100}%" ${pid}></div>`;
  return `<span class="dot ${who}" style="left:${p.x*100}%;top:${p.y*100}%" ${pid}></span>`;
}
const markTop = p => hasSpans(p) ? p.spans[0][1] : p.y;
const markBottom = p => hasSpans(p) ? Math.max(...p.spans.map(s=>s[1]+s[3])) : (isBox(p) ? p.y+p.h : p.y);

/* SNAP: a drag across words behaves like selecting text — from the word
   you started on to the word you let go on, whole lines in between — and
   comes back as one rect per line, the way a highlighter pen lands. A drag
   that starts or ends off the words (a picture, white space) falls back to
   the words inside the box; none at all and it's a soft area. */
function wordAt(ws, pt){
  let best=null, bd=1e9;
  ws.forEach((w,i)=>{
    const [x0,y0,x1,y1]=w, lh=y1-y0, tol=lh*0.35;
    if(pt.y<y0-tol||pt.y>y1+tol) return;
    const dx=pt.x<x0?x0-pt.x:(pt.x>x1?pt.x-x1:0);
    if(dx>0.02) return;
    if(dx<bd){ bd=dx; best=i; }
  });
  return best;
}
function snap(page, a, b, r){
  const ws=WORDS[String(page)]; if(!ws||!ws.length) return null;
  let picked=null;
  const i=wordAt(ws,a), j=wordAt(ws,b);
  if(i!==null && j!==null){ const lo=Math.min(i,j), hi=Math.max(i,j); picked=ws.slice(lo,hi+1); }
  else picked=ws.filter(([x0,y0,x1,y1])=>{ const cx=(x0+x1)/2, cy=(y0+y1)/2; return cx>=r.x&&cx<=r.x+r.w&&cy>=r.y&&cy<=r.y+r.h; });
  if(!picked.length) return null;
  const lines=new Map();
  picked.forEach(w=>{ const k=w[5]+':'+w[6]; if(!lines.has(k)) lines.set(k,[]); lines.get(k).push(w); });
  const spans=[], text=[];
  [...lines.values()].sort((p,q)=>p[0][1]-q[0][1]).forEach(ln=>{
    ln.sort((p,q)=>p[0]-q[0]);
    const x0=Math.min(...ln.map(w=>w[0])), x1=Math.max(...ln.map(w=>w[2]));
    const y0=Math.min(...ln.map(w=>w[1])), y1=Math.max(...ln.map(w=>w[3]));
    const padY=(y1-y0)*0.12, padX=0.003;
    spans.push([Math.max(0,x0-padX), Math.max(0,y0-padY), (x1-x0)+padX*2, (y1-y0)+padY*2]);
    text.push(ln.map(w=>w[4]).join(' '));
  });
  return {spans, quote:text.join(' ')};
}

async function reviewInit(rid){
  RID=rid; WHO=whoLoad();
  $('helloT').textContent=STR.review.hello;
  $('railH').textContent=STR.review.rail;
  try{
    const d=await api('/api/review/'+rid);
    R=d.review; PINS=d.pins||[];
  }catch(e){
    $('plate').innerHTML=`<div class="gone">${esc(STR.review.gone)}</div>`; $('rail').hidden=true; return;
  }
  document.title = (R.title||STR.name)+' — '+STR.name;
  $('who').textContent=R.title||'';
  drawPlate();
  /* the words and where they sit — for the highlighter. Not blocking:
     until they arrive a drag is a soft box, which is what a drag over a
     picture is anyway. */
  api('/api/review/'+rid+'/words').then(d=>{ WORDS=d.words||{}; }).catch(()=>{});
}

/* ---------------- the pages ---------------- */
function drawPlate(){
  const host=$('plate');
  host.innerHTML=(R.pages||[]).map(p=>`
    <div class="page" data-n="${p.n}" style="aspect-ratio:${p.w}/${p.h}">
      <img src="/api/review/${RID}/page/${p.n}.png" alt="Page ${p.n}" loading="lazy" draggable="false" width="${p.w}" height="${p.h}">
      <div class="pins"></div>
      <div class="page-n">${esc(STR.review.page)} ${p.n}</div>
    </div>`).join('');
  host.querySelectorAll('.page').forEach(pg=>{
    pg.addEventListener('pointerdown', pageDown); pg.addEventListener('pointermove', pageMove);
    pg.addEventListener('pointerup', pageUp); pg.addEventListener('pointercancel', pageCancel);
  });
  drawPins(); drawRail();
}

/* what this person may see: their own marks everywhere, everyone's marks
   on the pages where they've already had their say */
function visiblePins(){
  const said=new Set(PINS.filter(isMine).map(p=>p.page));
  return PINS.filter(p=>isMine(p)||said.has(p.page));
}
function myNumber(p){ return PINS.filter(isMine).findIndex(q=>q.id===p.id)+1; }

function drawPins(){
  const seen=visiblePins();
  document.querySelectorAll('.page').forEach(pg=>{
    const n=+pg.dataset.n, box=pg.querySelector('.pins');
    const here=seen.filter(p=>p.page===n);
    box.innerHTML=here.map(p=>markHtml(p, isMine(p)?'mine':'them')).join('');
    /* the tags in the margin: one per note, at the note's height, nudged
       apart when two would sit on each other */
    let last=-1; const tags=[];
    here.map(p=>({p, y:markTop(p)})).sort((a,b)=>a.y-b.y).forEach(t=>{
      const H=pg.getBoundingClientRect().height||1000, min=30/H;
      const y=Math.max(t.y, last+min); last=y;
      const who=isMine(t.p)?'mine':'them', label=isMine(t.p)?myNumber(t.p):esc(initial(t.p.name));
      tags.push(`<button class="tag ${who}" style="top:${y*100}%" data-pid="${t.p.id}" aria-label="${esc(t.p.name)}">${label}</button>`);
    });
    box.insertAdjacentHTML('beforeend', tags.join(''));
    box.querySelectorAll('[data-pid]').forEach(b=>b.addEventListener('click', e=>{
      e.stopPropagation(); const p=PINS.find(q=>q.id===b.dataset.pid); if(p) noteOpen(Object.assign({pin:p}, p));
    }));
  });
  $('hello').classList.toggle('gone', PINS.some(isMine));   // fades, keeps its space — no page jump
}

/* ---------------- the tap, or the drag ----------------
   A tap drops a pin. A drag draws a box round the bit you mean, and the
   box is what the robot will look at later. A tiny drag is a tap. */
const DRAG_MIN = 8;                                    // px before a press becomes a drag
let DRAG=null;
function pageFrac(pg, e){
  const r=pg.getBoundingClientRect();
  return { x:Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)), y:Math.min(1,Math.max(0,(e.clientY-r.top)/r.height)) };
}
function pageDown(e){
  if(e.button!==undefined && e.button!==0) return;
  if(e.target.closest('.note')||e.target.closest('[data-pid]')) return;
  const pg=e.currentTarget;
  DRAG={pg, sx:e.clientX, sy:e.clientY, a:pageFrac(pg,e), ghost:null, moved:false};
}
function pageMove(e){
  if(!DRAG) return;
  if(!DRAG.moved){
    if(Math.hypot(e.clientX-DRAG.sx, e.clientY-DRAG.sy)<DRAG_MIN) return;
    DRAG.moved=true; noteClose();
    DRAG.ghost=document.createElement('div'); DRAG.ghost.className='hl area mine ghost';
    DRAG.pg.querySelector('.pins').appendChild(DRAG.ghost);
    try{ DRAG.pg.setPointerCapture(e.pointerId); }catch(x){}
  }
  const b=pageFrac(DRAG.pg,e), r=boxFrom(DRAG.a,b);
  Object.assign(DRAG.ghost.style,{left:r.x*100+'%',top:r.y*100+'%',width:r.w*100+'%',height:r.h*100+'%'});
  e.preventDefault();
}
function pageUp(e){
  if(!DRAG) return;
  const d=DRAG; DRAG=null;
  if(d.ghost) d.ghost.remove();
  if(!d.moved){
    if(OPEN){ noteClose(); return; }                   // a tap outside an open note just closes it
    noteOpen({page:+d.pg.dataset.n, x:d.a.x, y:d.a.y}); return;
  }
  const r=boxFrom(d.a, pageFrac(d.pg,e)), page=+d.pg.dataset.n;
  if(r.w<0.01||r.h<0.01){ noteOpen({page, x:d.a.x, y:d.a.y}); return; }
  const sn=snap(page, d.a, pageFrac(d.pg,e), r);
  noteOpen(Object.assign({page, x:r.x, y:r.y, w:r.w, h:r.h}, sn||{}));
}
function pageCancel(){ if(DRAG&&DRAG.ghost) DRAG.ghost.remove(); DRAG=null; }
const boxFrom=(a,b)=>({x:Math.min(a.x,b.x), y:Math.min(a.y,b.y), w:Math.abs(b.x-a.x), h:Math.abs(b.y-a.y)});

/* ---------------- the note ----------------
   One box, three moods: a fresh note, your own note (editable), someone
   else's (read only). It sits by the pin, flipping to stay on the page. */
function noteOpen(o){
  noteClose();
  const pg=document.querySelector(`.page[data-n="${o.page}"]`); if(!pg) return;
  const S=STR.review, mine=o.pin?isMine(o.pin):true, fresh=!o.pin;
  const el=document.createElement('div');
  const ax=hasSpans(o)?o.spans[0][0]:o.x, ay=markBottom(o);   // a note hangs under the mark
  el.className='note'+(ax>0.55?' flip-x':'')+(ay>0.7?' flip-y':'')+(mine?' mine':' them')+(isBox(o)||hasSpans(o)?' onbox':'');
  el.style.setProperty('--px',(ax*100)+'%'); el.style.setProperty('--py',(ay*100)+'%');
  const ghost = fresh ? `<div class="ghost-wrap">${markHtml(o,'mine')}</div>` : '';
  if(mine){
    el.innerHTML=`
      ${!WHO?`<input type="text" class="note-who" id="noteWho" maxlength="40" placeholder="${esc(S.who)}" autocomplete="given-name">`:''}
      <textarea class="note-t" id="noteT" rows="3" placeholder="${esc(S.say)}" maxlength="2000">${esc(o.pin?o.pin.text:'')}</textarea>
      <div class="note-row">
        ${o.pin?`<button class="note-bin" id="noteBin">${esc(S.bin)}</button>`:''}
        <span class="sp"></span>
        <button class="note-cancel" id="noteCancel">${esc(S.cancel)}</button>
        <button class="note-save" id="noteSave">${esc(S.save)}</button>
      </div>`;
  }else{
    el.innerHTML=`<div class="note-h">${esc(o.pin.name)}</div>${o.pin.quote?`<div class="note-q">${esc(o.pin.quote)}</div>`:''}<div class="note-said">${esc(o.pin.text)}</div>`;
  }
  pg.appendChild(el);
  if(ghost){ pg.querySelector('.pins').insertAdjacentHTML('beforeend', ghost); }
  pg.querySelectorAll('[data-pid]').forEach(m=>m.classList.toggle('lit', !!(o.pin&&m.dataset.pid===o.pin.id)));
  OPEN={el, page:o.page, x:o.x, y:o.y, w:o.w||0, h:o.h||0, spans:o.spans||null, quote:o.quote||'', pin:o.pin||null};
  if(mine){
    $('noteSave').addEventListener('click', noteSave);
    $('noteCancel').addEventListener('click', noteClose);
    if(o.pin) $('noteBin').addEventListener('click', ()=>pinBin(o.pin));
    const first=$('noteWho')||$('noteT');
    setTimeout(()=>first.focus(), 30);
    el.addEventListener('keydown', e=>{
      if(e.key==='Escape') noteClose();
      if(e.key==='Enter' && (e.metaKey||e.ctrlKey)) noteSave();
    });
  }
  el.scrollIntoView({block:'nearest', behavior:'smooth'});
}
function noteClose(){
  if(!OPEN) return;
  OPEN.el.remove(); document.querySelectorAll('.ghost-wrap,.hl.ghost').forEach(g=>g.remove()); document.querySelectorAll('.lit').forEach(m=>m.classList.remove('lit')); OPEN=null;
}

async function noteSave(){
  if(!OPEN) return;
  const S=STR.review, text=$('noteT').value.trim();
  if(!WHO){
    const name=($('noteWho').value||'').trim();
    if(!name){ $('noteWho').focus(); $('noteWho').classList.add('miss'); return; }
    WHO={id:Math.random().toString(36).slice(2,12)+Date.now().toString(36), name}; whoSave(WHO);
  }
  if(!text){ $('noteT').focus(); return; }
  const body={page:OPEN.page, x:OPEN.x, y:OPEN.y, w:OPEN.w, h:OPEN.h, spans:OPEN.spans, quote:OPEN.quote, text, who:WHO};
  if(OPEN.pin) body.id=OPEN.pin.id;
  const btn=$('noteSave'); btn.disabled=true;
  try{
    const d=await api(`/api/review/${RID}/pin`, body);
    if(OPEN.pin){ const i=PINS.findIndex(q=>q.id===OPEN.pin.id); if(i>-1) PINS[i]=d.pin; }
    else PINS.push(d.pin);
    noteClose(); drawPins(); drawRail();
  }catch(e){
    btn.disabled=false; robotLineAt(OPEN.el, STR.fell);
  }
}

async function pinBin(p){
  try{
    await api(`/api/review/${RID}/pin/${p.id}`, {who:WHO.id}, 'DELETE');
    PINS=PINS.filter(q=>q.id!==p.id);
    noteClose(); drawPins(); drawRail();
  }catch(e){ if(OPEN) robotLineAt(OPEN.el, STR.fell); }
}

/* ---------------- the rail ----------------
   Desktop only (CSS hides it narrow). Every note this person may see,
   in page order; a click goes to the pin and opens it. */
function drawRail(){
  const S=STR.review, list=$('railList'), seen=visiblePins().slice().sort((a,b)=>a.page-b.page||markTop(a)-markTop(b));
  if(!seen.length){ list.innerHTML=`<div class="rail-empty">${esc(S.none)}</div>`; }
  else list.innerHTML=seen.map(p=>`
    <button class="rnote ${isMine(p)?'mine':'them'}" data-pid="${p.id}">
      <span class="rnote-h"><b>${isMine(p)?myNumber(p):esc(initial(p.name))}</b> ${esc(p.name)} · ${esc(S.page)} ${p.page}</span>
      ${p.quote?`<span class="rnote-q">${esc(p.quote)}</span>`:''}<span class="rnote-t">${esc(p.text)}</span>
    </button>`).join('');
  list.querySelectorAll('.rnote').forEach(b=>b.addEventListener('click', ()=>{
    const p=PINS.find(q=>q.id===b.dataset.pid); if(!p) return;
    const m=document.querySelector(`.tag[data-pid="${p.id}"]`);
    if(m) m.scrollIntoView({block:'center', behavior:'smooth'});
    setTimeout(()=>noteOpen(Object.assign({pin:p}, p)), 350);
  }));
  $('railNote').textContent = PINS.some(isMine) ? '' : S.others;
}
