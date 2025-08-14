function norm(s){return (s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();}
function uniq(a){return [...new Set(a.filter(Boolean))];}

const app={mode:'listen',expectedWord:null,currentHotspot:null,currentBtn:null,recognition:null,voices:[],voiceByLang:{}};

function loadVoices(){function cache(){app.voices=window.speechSynthesis?speechSynthesis.getVoices():[];app.voiceByLang={};app.voices.forEach(v=>{(app.voiceByLang[v.lang]=app.voiceByLang[v.lang]||[]).push(v);});}
  cache(); if('onvoiceschanged' in speechSynthesis){speechSynthesis.onvoiceschanged=cache;}
}
function speakText(text,lang){ if(!window.speechSynthesis) return; const u=new SpeechSynthesisUtterance(text); u.lang=lang||'en-US'; const v=(app.voiceByLang[u.lang]||[])[0]; if(v) u.voice=v; speechSynthesis.cancel(); speechSynthesis.speak(u); }
function hasSR(){ return !!(window.SpeechRecognition||window.webkitSpeechRecognition); }
function stopSR(){ try{ app.recognition&&app.recognition.stop(); }catch(e){} }

async function init(){
  loadVoices();
  const res=await fetch('speak-data.json',{cache:'no-store'}); const data=await res.json();
  const activity=(data.activities||[])[0]; const defaultLang=activity.lang||'en-US';
  document.getElementById('activity-title').textContent=activity.title||'Activity';
  const img=document.getElementById('bg-image'); img.src=activity.image; img.alt=activity.alt||''; document.getElementById('image-alt').textContent=activity.alt||'';

  const langSel=document.getElementById('lang-select'); (data.languages||['en-US']).forEach(l=>{const o=document.createElement('option'); o.value=l; o.textContent=l; if(l===defaultLang) o.selected=true; langSel.appendChild(o);});

  const btnListen=document.getElementById('mode-listen'); const btnSpeak=document.getElementById('mode-speak');
  function setMode(m){ app.mode=m; btnListen.classList.toggle('active',m==='listen'); btnSpeak.classList.toggle('active',m==='speak');
    btnListen.setAttribute('aria-pressed',m==='listen'); btnSpeak.setAttribute('aria-pressed',m==='speak');
    const s=document.getElementById('start-btn'); if(s) s.textContent=m==='speak'?'🎤 Start speaking':'▶︎ Play all';
  }
  btnListen.onclick=()=>setMode('listen'); btnSpeak.onclick=()=>setMode('speak'); setMode('listen');

  const stage=document.getElementById('stage'); const hotspots=activity.hotspots||[]; let completed=0;
  function updateProgress(){ document.getElementById('progress').textContent = `${completed} / ${hotspots.length} completed`; }
  updateProgress();

  hotspots.forEach((h,i)=>{ const b=document.createElement('button'); b.className='hotspot'; b.style.left=`${h.x}%`; b.style.top=`${h.y}%`;
    b.setAttribute('aria-label',h.label||`Hotspot ${i+1}`); b.innerHTML=`<span class="label">+</span>`; b.onclick=()=>openModal(h,b,defaultLang); stage.appendChild(b);
  });

  const modal=document.getElementById('modal'); const closeBtn=document.getElementById('close-modal');
  const startBtn=document.getElementById('start-btn'); const typeBtn=document.getElementById('type-btn'); const playBtn=document.getElementById('play-target');
  const promptEl=document.getElementById('modal-prompt'); const resultEl=document.getElementById('result');
  const typedWrap=document.getElementById('typed-wrapper'); const typedInput=document.getElementById('typed-input'); const typedSubmit=document.getElementById('typed-submit');
  const wordbank=document.getElementById('wordbank');

  function openModal(h,btn,lang){
    app.currentHotspot=h; app.currentBtn=btn; app.expectedWord=null; stopSR(); resultEl.textContent=''; typedWrap.hidden=true; typedInput.value='';
    wordbank.innerHTML=''; const words=uniq([...(h.words||[]),...(h.answers||[])]); words.forEach(w=>{const chip=document.createElement('button'); chip.type='button'; chip.className='chip'; chip.textContent=w;
      chip.onclick=()=>{ document.querySelectorAll('.chip').forEach(c=>c.classList.remove('selected')); chip.classList.add('selected'); app.expectedWord=w;
        if(app.mode==='listen'){ speakText(w,document.getElementById('lang-select').value||lang); } else { promptEl.textContent=`Say: “${w}”`; }
      }; wordbank.appendChild(chip);
    });
    promptEl.textContent = app.mode==='listen' ? (h.prompt_listen||'Click a word to hear it.') : (h.prompt||'Choose a word, then say it.');
    modal.hidden=false; startBtn.focus();
  }
  function closeModal(){ stopSR(); modal.hidden=true; }
  closeBtn.onclick=closeModal; window.addEventListener('keydown',e=>{ if(e.key==='Escape' && !modal.hidden) closeModal(); });

  startBtn.onclick=()=>{
    const lang=document.getElementById('lang-select').value||defaultLang;
    if(app.mode==='listen'){
      const sel=document.querySelector('.chip.selected'); if(sel) speakText(sel.textContent,lang);
      else { const chips=[...document.querySelectorAll('.chip')]; (function seq(i=0){ if(i>=chips.length) return; speakText(chips[i].textContent,lang); setTimeout(()=>seq(i+1),900+Math.min(1600,chips[i].textContent.length*45)); })(); }
      return;
    }
    if(!hasSR()){ resultEl.textContent='Speech recognition not supported in this browser.'; return; }
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition; app.recognition=new SR(); app.recognition.lang=lang; app.recognition.interimResults=false; app.recognition.maxAlternatives=5;
    resultEl.textContent='Listening…'; app.recognition.start();
    app.recognition.onresult=(ev)=>{ let t=[]; for(let i=0;i<ev.results.length;i++){ for(let j=0;j<ev.results[i].length;j++){ t.push(ev.results[i][j].transcript); } }
      const heardRaw=t[0]||''; const heard=norm(heardRaw); const conf=ev.results?.[0]?.[0]?.confidence;
      const h=app.currentHotspot||{}; const answers=uniq([...(h.answers||[])]); let ok=false;
      if(app.expectedWord){ const target=norm(app.expectedWord); ok=heard.includes(target)||target.includes(heard); }
      else { ok=answers.map(norm).some(a=>heard.includes(a)||a.includes(heard)); }
      if(ok){ resultEl.innerHTML=`✅ Correct!<br><small>Heard: “${heardRaw}”${conf?` (${(conf*100).toFixed(0)}%)`:''}</small>`;
        if(!app.currentBtn.classList.contains('completed')){ app.currentBtn.classList.add('completed'); completed++; updateProgress(); }
        setTimeout(closeModal,900);
      } else { resultEl.innerHTML=`❌ Not quite.<br><small>Heard: “${heardRaw}”${conf?` (${(conf*100).toFixed(0)}%)`:''}</small>`; }
    };
    app.recognition.onerror=(e)=>{ resultEl.textContent='Error: '+(e.error||'Unknown error'); };
  };

  typeBtn.onclick=()=>{ typedWrap.hidden=false; typedInput.focus(); };
  typedSubmit.onclick=()=>{ const val=norm(typedInput.value); const h=app.currentHotspot||{}; const answers=uniq([...(h.answers||[])]); let ok=false;
    if(app.expectedWord){ const target=norm(app.expectedWord); ok=val.includes(target)||target.includes(val); }
    else { ok=answers.map(norm).some(a=>val.includes(a)||a.includes(val)); }
    if(ok){ resultEl.textContent='✅ Correct!'; if(!app.currentBtn.classList.contains('completed')){ app.currentBtn.classList.add('completed'); completed++; updateProgress(); } setTimeout(()=>{typedWrap.hidden=true;},700); }
    else { resultEl.textContent='❌ Not quite. Try again.'; }
  };
  document.getElementById('play-target').onclick=()=>{ const lang=document.getElementById('lang-select').value||defaultLang; if(app.expectedWord) speakText(app.expectedWord,lang); };
}
document.addEventListener('DOMContentLoaded',init);
