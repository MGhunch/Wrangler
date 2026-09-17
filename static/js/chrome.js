/* =====================================================================
   WRANGLER — THE CHROME
   The furniture, lifted from Robot Sandwich's chrome.js and trimmed to
   what Wrangler uses: the helpers, the face, the line, the menu and its
   cards. Knows no room exists. Loads after strings.js, in the head.
   ===================================================================== */

/* ---------------- helpers ---------------- */
const $ = id => document.getElementById(id);
const esc = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* The server sends codes, never sentences. e.code is there for the paths
   that want to say something more specific; e.message is the parachute. */
async function api(path, body, method){
  const opts = body ? {method:method||'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}
                    : (method ? {method} : {});
  const r = await fetch(path, opts);
  const d = await r.json().catch(()=>null);
  if(!r.ok || !d){
    const e = new Error(STR.fell); e.status = r.status; e.code = (d && d.error) || '';
    console.warn('[wrangler]', path, r.status, e.code); throw e;
  }
  return d;
}

/* ================= THE FACE =================
   The same robot as Robot Sandwich — antenna, head, eyes, mouth — white on
   a disc that wears the app's colour. The eyes take the colour too. */
function BOT_FACE(kind){
  const eyes = kind==='err'
    ? '<path class="eye" d="M11 14l4 4M15 14l-4 4" stroke="var(--hue)" stroke-width="1.9" stroke-linecap="round"/>'
    + '<path class="eye" d="M19 14l4 4M23 14l-4 4" stroke="var(--hue)" stroke-width="1.9" stroke-linecap="round"/>'
    : '<circle class="eye" cx="13" cy="16" r="2.2" fill="var(--hue)"/><circle class="eye" cx="21" cy="16" r="2.2" fill="var(--hue)"/>';
  const bulb = kind==='err'
    ? '<circle class="bulb" cx="17" cy="3.5" r="1.8" fill="none" stroke="#fff" stroke-width="1.2"/>'
    : '<circle class="bulb" cx="17" cy="3.5" r="1.8" fill="#fff"/>';
  return '<svg viewBox="0 0 34 32" fill="none" aria-hidden="true">'
    + '<line x1="17" y1="4" x2="17" y2="8.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>' + bulb
    + '<rect x="6" y="8" width="22" height="16" rx="5" fill="#fff"/>' + eyes
    + '<rect x="11" y="26" width="12" height="3.4" rx="1.7" fill="#fff"/></svg>';
}
const BOT_AV = kind => `<span class="botdisc">${BOT_FACE(kind)}</span>`;
function ready(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
function faceFill(){ document.querySelectorAll('[data-face]').forEach(el=>{ el.innerHTML = BOT_FACE(el.dataset.face||''); }); }
ready(faceFill);

/* ================= THE LINE =================
   Something failed; the room stands. The robot says it, near the wound,
   wearing the error face. Fades after 7s unless it's asking for something. */
function robotLine(text, o={}){
  const el=document.createElement('div');
  el.className='line err'+(o.cls?' '+o.cls:'');
  el.setAttribute('role','alert');
  el.innerHTML=`${BOT_AV('err')}<span class="line-t">${esc(text)}</span>`;
  if(!o.stick) el._t=setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(),300); }, 7000);
  return el;
}
/* one line per anchor — a fresh failure replaces the last one, never stacks */
function robotLineAt(anchor, text, o={}){
  if(!anchor) return null;
  robotLineClear(anchor);
  const el=robotLine(text,o); anchor.prepend(el); return el;
}
function robotLineClear(anchor){ if(anchor) anchor.querySelectorAll(':scope > .line.err').forEach(x=>{ clearTimeout(x._t); x.remove(); }); }

const TICK='<svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ================= THE MENU =================
   The burger, the cards behind it. A shade is the modal; menuOpen is the
   shade plus shutting the burger behind you. */
function menuToggle(){
  const on=$('menuBox').classList.toggle('on');
  $('burger').classList.toggle('x',on);
  $('burger').setAttribute('aria-expanded',on);
}
function shadeOpen(id){ $('menu-'+id).classList.add('on'); }
function menuOpen(id){ menuToggle(); shadeOpen(id); }
function menuClose(id){ $('menu-'+id).classList.remove('on'); }
ready(()=>{
  document.querySelectorAll('.menu-shade').forEach(s=>{
    s.addEventListener('click',e=>{ if(e.target===s) s.classList.remove('on'); });
  });
  /* HOW IT WORKS pours from STR */
  const t=$('hiwTitle'), b=$('hiwBody');
  if(t) t.textContent=STR.hiw.title;
  if(b) b.innerHTML=STR.hiw.lines.map(l=>`<p>${esc(l)}</p>`).join('');
  const by=$('by'); if(by) by.textContent=STR.by;
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    document.querySelectorAll('.menu-shade.on').forEach(s=>s.classList.remove('on'));
    if($('menuBox') && $('menuBox').classList.contains('on')) menuToggle();
  }
});
document.addEventListener('click',e=>{
  const m=$('menuBox'),b=$('burger');
  if(!m||!b) return;
  if(m.classList.contains('on') && !m.contains(e.target) && !b.contains(e.target)) menuToggle();
});
