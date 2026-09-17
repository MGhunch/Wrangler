/* =====================================================================
   WRANGLER — START
   Hunch's side: name the work, drop it in, say the word, get the link.
   Sitting 1: the word is the only door. The real one comes in sitting 2.
   ===================================================================== */

let START_FILES = [];

function startInit(){
  const S=STR.start;
  $('startTitle').textContent=S.title;
  $('lblWhat').textContent=S.what; $('inTitle').placeholder=S.whatEg;
  $('dropT').textContent=S.drop; $('dropD').textContent=S.kinds+' · '+S.choose;
  $('lblWord').textContent=S.word;
  $('goBtn').textContent=S.go;
  $('copyBtn').textContent=S.copy; $('openBtn').textContent=S.open; $('againBtn').textContent=S.again;

  const drop=$('drop'), inp=$('inFiles');
  drop.addEventListener('click', e=>{ if(e.target!==inp) inp.click(); });
  inp.addEventListener('change', ()=>{ startTake([...inp.files]); });
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e=>{ startTake([...e.dataTransfer.files]); });
  $('inWord').addEventListener('keydown', e=>{ if(e.key==='Enter') startGo(); });
}

function startTake(files){
  const ok=files.filter(f=>/\.(pdf|jpe?g|png)$/i.test(f.name));
  if(ok.length!==files.length) robotLineAt($('startLine'), STR.start.kind);
  if(!ok.length) return;
  /* one PDF is the whole stack; images add up as pages */
  START_FILES = ok.some(f=>/\.pdf$/i.test(f.name)) ? [ok.find(f=>/\.pdf$/i.test(f.name))] : ok;
  $('dropFiles').innerHTML = START_FILES.map(f=>`<span class="drop-f">${esc(f.name)}</span>`).join('');
  $('drop').classList.add('has');
}

async function startGo(){
  const S=STR.start, line=$('startLine');
  robotLineClear(line);
  if(!START_FILES.length){ robotLineAt(line, S.nofile); return; }
  const fd=new FormData();
  fd.append('title', $('inTitle').value.trim());
  fd.append('word', $('inWord').value);
  START_FILES.forEach(f=>fd.append('files', f, f.name));
  const btn=$('goBtn'); btn.disabled=true; btn.textContent=S.making+'…';
  try{
    const r=await fetch('/api/upload',{method:'POST',body:fd});
    const d=await r.json().catch(()=>null);
    if(!r.ok||!d){ const code=(d&&d.error)||''; throw Object.assign(new Error(STR.fell),{code}); }
    const url=location.origin+d.url;
    $('madeSay').textContent=S.made;
    $('madeUrl').value=url; $('openBtn').href=url;
    $('startForm').hidden=true; $('startMade').hidden=false;
  }catch(e){
    const said={word:S.badword,nofile:S.nofile,kind:S.kind,big:S.big,render:S.render}[e.code]||STR.fell;
    robotLineAt(line, said);
  }finally{ btn.disabled=false; btn.textContent=S.go; }
}

async function copyLink(){
  try{ await navigator.clipboard.writeText($('madeUrl').value); }
  catch(e){ $('madeUrl').select(); document.execCommand('copy'); }
  const b=$('copyBtn'); b.textContent=STR.start.copied; setTimeout(()=>{ b.textContent=STR.start.copy; },1600);
}

function startAgain(){
  START_FILES=[]; $('dropFiles').innerHTML=''; $('drop').classList.remove('has');
  $('inTitle').value=''; $('inFiles').value='';
  $('startMade').hidden=true; $('startForm').hidden=false;
}
