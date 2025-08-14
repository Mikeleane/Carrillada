function norm(s){return (s||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();}
function uniq(a){return [...new Set(a.filter(Boolean))];}
const app={mode:"listen",recognition:null,voices:[],voiceByLang:{},totalWords:0,done:0};

function loadVoices(){function cache(){app.voices=window.speechSynthesis?speechSynthesis.getVoices():[];app.voiceByLang={};app.voices.forEach(v=>{(app.voiceByLang[v.lang]=app.voiceByLang[v.lang]||[]).push(v);});}
  cache(); if("onvoiceschanged" in speechSynthesis){speechSynthesis.onvoiceschanged=cache;}
}
function speakText(text,lang){ if(!window.speechSynthesis) return; const u=new SpeechSynthesisUtterance(text); u.lang=lang||"en-US"; const v=(app.voiceByLang[u.lang]||[])[0]; if(v) u.voice=v; speechSynthesis.cancel(); speechSynthesis.speak(u); }
function hasSR(){ return !!(window.SpeechRecognition||window.webkitSpeechRecognition); }
function stopSR(){ try{ app.recognition&&app.recognition.stop(); }catch(e){} }
function variantsFor(w){
  const x=norm(w);
  return uniq([x, x.replace(/-/g," "), x.replace(/\s+/g,"-"), x.replace(/[-\s]+/g,""), x.replace(/’/g,"'")]);
}
function updateProgress(){ const el=document.getElementById("progress"); el.textContent=`${app.done} / ${app.totalWords} completed`; }

async function init(){
  loadVoices();
  const res=await fetch("speak-data.json",{cache:"no-store"}); const data=await res.json();
  const a=(data.activities||[])[0]; const defaultLang=a.lang||"en-US";

  document.getElementById("activity-title").textContent=a.title||"Speak/Listen";
  const img=document.getElementById("bg-image"); img.src=a.image; img.alt=a.alt||"";

  // lang selector
  const sel=document.getElementById("lang-select"); (data.languages||["en-US"]).forEach(l=>{const o=document.createElement("option"); o.value=l; o.textContent=l; if(l===defaultLang) o.selected=true; sel.appendChild(o);});

  // mode toggle
  const btnListen=document.getElementById("mode-listen"); const btnSpeak=document.getElementById("mode-speak");
  function setMode(m){ app.mode=m; btnListen.classList.toggle("active",m==="listen"); btnSpeak.classList.toggle("active",m==="speak");
    btnListen.setAttribute("aria-pressed",m==="listen"); btnSpeak.setAttribute("aria-pressed",m==="speak");
  }
  btnListen.onclick=()=>setMode("listen"); btnSpeak.onclick=()=>setMode("speak"); setMode("listen");

  // build 3 columns with per-word rows
  const wrap=document.getElementById("columns"); wrap.innerHTML="";
  const sections=a.hotspots||[];
  sections.forEach(sec=>{
    const col=document.createElement("div"); col.className="col";
    const h2=document.createElement("h2"); h2.textContent=sec.label||"Section"; col.appendChild(h2);
    const ul=document.createElement("ul"); ul.className="wordlist"; col.appendChild(ul);

    (sec.words||[]).forEach(word=>{
      const li=document.createElement("li"); li.className="word-row"; ul.appendChild(li);
      const btn=document.createElement("button"); btn.className="word"; btn.type="button"; btn.textContent=word; li.appendChild(btn);
      const status=document.createElement("span"); status.className="status"; status.setAttribute("aria-live","polite"); li.appendChild(status);

      btn.addEventListener("click",()=>{
        const lang=sel.value||defaultLang;
        if(app.mode==="listen"){ speakText(word,lang); return; }
        if(!hasSR()){ status.textContent="⚠"; status.title="Speech recognition not supported"; return; }
        stopSR();
        const SR=window.SpeechRecognition||window.webkitSpeechRecognition; const rec=new SR();
        app.recognition=rec; rec.lang=lang; rec.interimResults=false; rec.maxAlternatives=5;
        status.textContent="…"; status.title="Listening";
        rec.start();
        rec.onresult=(ev)=>{
          let heard=""; try{ heard=[...ev.results].map(r=>r[0].transcript).join(" "); }catch(_){ heard=""; }
          const heardN=norm(heard), targets=variantsFor(word);
          const ok=targets.some(t=>heardN.includes(t) || t.includes(heardN));
          if(ok){ status.textContent="✅"; btn.classList.add("done"); if(!btn.dataset.done){ btn.dataset.done="1"; app.done++; updateProgress(); } }
          else { status.textContent="❌"; status.title=`Heard: ${heard}`; }
        };
        rec.onerror=()=>{ status.textContent="⚠"; status.title="Recognition error"; };
      });
      app.totalWords++;
    });
  });
  updateProgress();
}
document.addEventListener("DOMContentLoaded",init);
