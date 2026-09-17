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

let RID=null, R=null, PINS=[], WHO=null, OPEN=null;

const whoLoad = () => { try{ return JSON.parse(localStorage.getItem('wr_who')||'null'); }catch(e){ return null; } };
const whoSave = w  => { try{ localStorage.setItem('wr_who', JSON.stringify(w)); }catch(e){} };
const isMine  = p  => !!(WHO && p.who===WHO.id);
const initial = n  => (n||'?').trim().charAt(0).toUpperCase();
const isBox   = p  => !!(p && p.w>0 && p.h>0);

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

/* what this person may see: their own pins everywhere, everyone's pins on
   the pages where they've already had their say */
function visiblePins(){
  const said=new Set(PINS.filter(isMine).map(p=>p.page));
  return PINS.filter(p=>isMine(p)||said.has(p.page));
}
function myNumber(p){ return PINS.filter(isMine).findIndex(q=>q.id===p.id)+1; }

function drawPins(){
  const seen=visiblePins();
  document.querySelectorAll('.page').forEach(pg=>{
    const n=+pg.dataset.n, box=pg.querySelector('.pins');
    box.innerHTML=seen.filter(p=>p.page===n).map(p=>{
      const who=isMine(p)?'mine':'them', label=isMine(p)?myNumber(p):esc(initial(p.name));
      if(isBox(p)) return `
        <div class="box ${who}" style="left:${p.x*100}%;top:${p.y*100}%;width:${p.w*100}%;height:${p.h*100}%" data-pid="${p.id}">
          <span class="pin corner ${who}" aria-label="${esc(p.name)}">${label}</span></div>`;
      return `<button class="pin ${who}" style="left:${p.x*100}%;top:${p.y*100}%" data-pid="${p.id}" aria-label="${esc(p.name)}">${label}</button>`;
    }).join('');
    box.querySelectorAll('[data-pid]').forEach(b=>b.addEventListener('click', e=>{
      e.stopPropagation(); const p=PINS.find(q=>q.id===b.dataset.pid); if(p) noteOpen({page:p.page,x:p.x,y:p.y,w:p.w,h:p.h,pin:p});
    }));
  });
  $('hello').hidden = PINS.some(isMine);
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
    DRAG.ghost=document.createElement('div'); DRAG.ghost.className='box mine ghost';
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
  const r=boxFrom(d.a, pageFrac(d.pg,e));
  if(r.w<0.01||r.h<0.01){ noteOpen({page:+d.pg.dataset.n, x:d.a.x, y:d.a.y}); return; }
  noteOpen({page:+d.pg.dataset.n, x:r.x, y:r.y, w:r.w, h:r.h});
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
  const box=isBox(o), ax=box?o.x:o.x, ay=box?o.y+o.h:o.y;   // a note hangs off a box's bottom-left
  el.className='note'+(ax>0.55?' flip-x':'')+(ay>0.7?' flip-y':'')+(mine?' mine':' them')+(box?' onbox':'');
  el.style.setProperty('--px',(ax*100)+'%'); el.style.setProperty('--py',(ay*100)+'%');
  const n=PINS.filter(isMine).length+1;
  const ghost = !fresh ? '' : box
    ? `<div class="box mine ghost" style="left:${o.x*100}%;top:${o.y*100}%;width:${o.w*100}%;height:${o.h*100}%"><span class="pin corner mine">${n}</span></div>`
    : `<span class="pin mine ghost" style="left:${o.x*100}%;top:${o.y*100}%">${n}</span>`;
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
    el.innerHTML=`<div class="note-h">${esc(o.pin.name)}</div><div class="note-said">${esc(o.pin.text)}</div>`;
  }
  pg.appendChild(el);
  if(ghost){ const g=document.createElement('div'); g.innerHTML=ghost; pg.querySelector('.pins').appendChild(g.firstElementChild); }
  OPEN={el, page:o.page, x:o.x, y:o.y, w:o.w||0, h:o.h||0, pin:o.pin||null};
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
  OPEN.el.remove(); document.querySelectorAll('.pin.ghost,.box.ghost').forEach(g=>g.remove()); OPEN=null;
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
  const body={page:OPEN.page, x:OPEN.x, y:OPEN.y, w:OPEN.w, h:OPEN.h, text, who:WHO};
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
  const S=STR.review, list=$('railList'), seen=visiblePins().slice().sort((a,b)=>a.page-b.page||a.y-b.y);
  if(!seen.length){ list.innerHTML=`<div class="rail-empty">${esc(S.none)}</div>`; }
  else list.innerHTML=seen.map(p=>`
    <button class="rnote ${isMine(p)?'mine':'them'}" data-pid="${p.id}">
      <span class="rnote-h"><b>${isMine(p)?myNumber(p):esc(initial(p.name))}</b> ${esc(p.name)} · ${esc(S.page)} ${p.page}</span>
      <span class="rnote-t">${esc(p.text)}</span>
    </button>`).join('');
  list.querySelectorAll('.rnote').forEach(b=>b.addEventListener('click', ()=>{
    const p=PINS.find(q=>q.id===b.dataset.pid); if(!p) return;
    const pin=document.querySelector(`.pin[data-pid="${p.id}"]`);
    if(pin) pin.scrollIntoView({block:'center', behavior:'smooth'});
    setTimeout(()=>noteOpen({page:p.page,x:p.x,y:p.y,pin:p}), 350);
  }));
  $('railNote').textContent = PINS.some(isMine) ? '' : S.others;
}
