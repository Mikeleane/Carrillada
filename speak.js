function norm(s){return (s||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();}
function uniq(a){return [...new Set(a.filter(Boolean))];}
const app={mode:"listen",recognition:null,voices:[],voiceByLang:{},totalWords:0,done:0,view:"all",secIndex:0,a:null};
const isSmall = matchMedia("(max-width: 640px)");

function showErr(msg){const e=document.getElementById("err"); if(!e) return; e.textContent=msg; e.hidden=false;}
function loadVoices(){function cache(){try{app.voices=speechSynthesis.getVoices();}catch{app.voices=[];} app.voiceByLang={}; app.voices.forEach(v=>{(app.voiceByLang[v.lang]=app.voiceByLang[v.lang]||[]).push(v);});}
  try{cache(); if("onvoiceschanged" in speechSynthesis){speechSynthesis.onvoiceschanged=cache;}}catch{}}
function speakText(text,lang){try{ if(!window.speechSynthesis) return; const u=new SpeechSynthesisUtterance(text); u.lang=lang||"en-US"; const v=(app.voiceByLang[u.lang]||[])[0]; if(v) u.voice=v; speechSynthesis.cancel(); speechSynthesis.speak(u);}catch{}}
function hasSR(){ return !!(window.SpeechRecognition||window.webkitSpeechRecognition); }
function stopSR(){ try{ app.recognition&&app.recognition.stop(); }catch{} }
function variantsFor(w){ const x=norm(w); return uniq([x, x.replace(/-/g," "), x.replace(/\s+/g,"-"), x.replace(/[-\s]+/g,""), x.replace(/’/g,"'")]); }
function countTotalWords(a){return (a.hotspots||[]).reduce((n,sec)=>n+(sec.words?.length||0),0);}
function updateProgress(){ const el=document.getElementById("progress"); if(el) el.textContent=`${app.done} / ${app.totalWords} completed`; }
function resetProgress(){ app.done=0; document.querySelectorAll(".word.done").forEach(b=>{b.classList.remove("done"); b.removeAttribute("data-done");}); document.querySelectorAll(".status").forEach(s=>{s.textContent=""; s.removeAttribute("title");}); updateProgress(); }

function addSpeakHandler(btn, word, langSel, defaultLang){
  btn.addEventListener("click",()=>{
    const lang=langSel.value||defaultLang;
    if(app.mode==="listen"){ speakText(word,lang); return; }
    if(!hasSR()){ const s=btn.nextElementSibling; if(s){s.textContent="⚠"; s.title="Speech recognition not supported";} return; }
    stopSR();
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition; const rec=new SR();
    app.recognition=rec; rec.lang=lang; rec.interimResults=false; rec.maxAlternatives=5;
    const status=btn.nextElementSibling; if(status){ status.textContent="…"; status.title="Listening"; }
    rec.start();
    rec.onresult=(ev)=>{
      let heard=""; try{ heard=[...ev.results].map(r=>r[0].transcript).join(" "); }catch{ heard=""; }
      const heardN=norm(heard), targets=variantsFor(word);
      const ok=targets.some(t=>heardN.includes(t) || t.includes(heardN));
      if(ok){ if(status) status.textContent="✅"; btn.classList.add("done"); if(!btn.dataset.done){ btn.dataset.done="1"; app.done++; updateProgress(); } }
      else { if(status){ status.textContent="❌"; status.title=`Heard: ${heard}`; } }
    };
    rec.onerror=()=>{ if(status){ status.textContent="⚠"; status.title="Recognition error"; } };
  }, {passive:true});
}

function playAll(words, lang){
  let i=0; const next=()=>{ if(i>=words.length) return; speakText(words[i++],lang); setTimeout(next, 900 + Math.min(1600, words[i-1].length*45)); };
  next();
}

function render(view){
  const a=app.a, wrap=document.getElementById("columns"); wrap.innerHTML="";
  const sections=a.hotspots||[];
  const visibleSections = view==="step" ? [sections[Math.max(0,Math.min(app.secIndex,sections.length-1))]] : sections;
  const langSel=document.getElementById("lang-select");
  visibleSections.forEach(sec=>{
    const col=document.createElement("div"); col.className="col";
    const head=document.createElement("div"); head.className="col-head";
    const h2=document.createElement("h2"); h2.textContent=sec.label||"Section";
    const spacer=document.createElement("div"); spacer.className="spacer";
    const play=document.createElement("button"); play.className="btn btn-ghost sm"; play.type="button"; play.textContent="▶ Play all";
    play.onclick=()=>playAll(sec.words||[], langSel.value||a.lang||"en-US");
    head.append(h2, spacer, play); col.appendChild(head);

    const ul=document.createElement("ul"); ul.className="wordlist"; col.appendChild(ul);
    (sec.words||[]).forEach(word=>{
      const li=document.createElement("li"); li.className="word-row";
      const btn=document.createElement("button"); btn.className="word"; btn.type="button"; btn.textContent=word;
      const st=document.createElement("span"); st.className="status"; st.setAttribute("aria-live","polite");
      li.append(btn,st); ul.appendChild(li);
      addSpeakHandler(btn, word, langSel, a.lang||"en-US");
    });
    wrap.appendChild(col);
  });

  const stepNav=document.getElementById("step-nav");
  if(view==="step"){ stepNav.hidden=false; document.getElementById("sec-label").textContent = (sections[app.secIndex]?.label||`Section ${app.secIndex+1}`); }
  else { stepNav.hidden=true; }

  // ensure lists are in view on phones
  if(view==="step" && isSmall.matches){ document.querySelector(".columns")?.scrollIntoView({behavior:"smooth", block:"start"}); }
}

async function init(){
  try{
    loadVoices();
    const res=await fetch("speak-data.json",{cache:"no-store"}); if(!res.ok) throw new Error("Cannot load speak-data.json");
    const data=await res.json(); const a=(data.activities||[])[0]; if(!a) throw new Error("No activity in speak-data.json");
    app.a=a; app.totalWords=countTotalWords(a); app.done=0; app.secIndex=0;

    document.getElementById("activity-title").textContent=a.title||"Speak/Listen";
    const img=document.getElementById("bg-image"); img.src=a.image; img.alt=a.alt||"";

    const sel=document.getElementById("lang-select");
    (data.languages||["en-US"]).forEach(l=>{const o=document.createElement("option"); o.value=l; o.textContent=l; if(l===(a.lang||"en-US")) o.selected=true; sel.appendChild(o);});

    // mode toggle
    const btnL=document.getElementById("mode-listen"), btnS=document.getElementById("mode-speak");
    function setMode(m){ app.mode=m; btnL.classList.toggle("active",m==="listen"); btnS.classList.toggle("active",m==="speak"); btnL.setAttribute("aria-pressed",m==="listen"); btnS.setAttribute("aria-pressed",m==="speak"); }
    btnL.onclick=()=>setMode("listen"); btnS.onclick=()=>setMode("speak"); setMode("listen");

    // default to Step on phones
    const viewSel=document.getElementById("view-mode");
    app.view = isSmall.matches ? "step" : "all";
    viewSel.value = app.view;
    viewSel.onchange=()=>{ app.view=viewSel.value; render(app.view); };
    isSmall.addEventListener?.("change", e=>{ app.view = e.matches ? "step" : "all"; viewSel.value=app.view; render(app.view); });

    // step nav + reset
    document.getElementById("prev-sec").onclick=()=>{ app.secIndex = Math.max(0, app.secIndex-1); render(app.view); };
    document.getElementById("next-sec").onclick=()=>{ const max=(a.hotspots||[]).length-1; app.secIndex = Math.min(max, app.secIndex+1); render(app.view); };
    document.getElementById("reset").onclick=resetProgress;

    render(app.view);
    updateProgress();
  }catch(err){ showErr(err.message||String(err)); }
}
document.addEventListener("DOMContentLoaded",init);
