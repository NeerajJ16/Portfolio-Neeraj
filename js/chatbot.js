  // ===== CONFIG =====
  const API_URL = "https://Neeraj16-portfolio-chat-api.hf.space/api/chat";

  // ===== DOM (scoped under #njc to avoid collisions) =====
  const root   = document.getElementById('njc');
  const wrap   = root.querySelector('#wrap');
  const openBtn= root.querySelector('#openBtn');
  const closeBtn=root.querySelector('#closeBtn');
  const body   = root.querySelector('#body');
  const form   = root.querySelector('#form');
  const inp    = root.querySelector('#inp');

  // ===== STATE =====
  let username = null;

  // ===== HELPERS =====
  function timeNow(){ return new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
  function autosize(){ inp.style.height='auto'; inp.style.height=Math.min(inp.scrollHeight,140)+'px'; }

  function addMsg(text, who='bot'){
    const row = document.createElement('div'); row.className='row';
    const msg = document.createElement('div'); msg.className='msg ' + who;
    if (who === 'bot') { msg.innerHTML = text; } else { msg.textContent = text; }
    const meta = document.createElement('div'); meta.className='meta'; meta.textContent = timeNow();
    row.appendChild(msg); row.appendChild(meta);
    body.appendChild(row); body.scrollTop = body.scrollHeight;
  }

  function addTyping(){
    const row = document.createElement('div'); row.className='row';
    const msg = document.createElement('div'); msg.className='msg bot'; msg.textContent='…';
    row.appendChild(msg); body.appendChild(row); body.scrollTop = body.scrollHeight;
    return row;
  }

  function escapeHTML(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  // Markdown-lite + linkify
  function renderMarkdownLite(raw){
    if(!raw) return "";
    const parts = [];
    const regex = /```([\s\S]*?)```/g;
    let last = 0, m;
    while ((m = regex.exec(raw)) !== null) {
      if (m.index > last) parts.push({type:'text', value: raw.slice(last, m.index)});
      parts.push({type:'code', value: m[1]});
      last = regex.lastIndex;
    }
    if (last < raw.length) parts.push({type:'text', value: raw.slice(last)});

    const html = parts.map(p=>{
      if (p.type === 'code') return `<pre><code>${escapeHTML(p.value)}</code></pre>`;
      return linkify(escapeHTML(p.value));
    }).join("");
    return html;
  }

  function linkify(s){
    s = s.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      '<a href="mailto:$1" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\b(https?:\/\/[^\s<)]+)\b/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\b(www\.[^\s<)]+)\b/g,
      (m)=>`<a href="https://${m}" target="_blank" rel="noopener">${m}</a>`);
    return s;
  }

  // Portfolio formatter
  function formatBotAnswer(text){
    if(!text) return "";
    const sections = text.split("•").map(s => s.trim()).filter(Boolean);
    const html = sections.map(sec=>{
      const i = sec.indexOf(":");
      if(i === -1){
        const header = sec.replace(/^•\s*/,"");
        return `<div class="blk"><div class="title">${renderMarkdownLite(header)}</div></div>`;
      }
      const header = sec.slice(0,i).trim().replace(/^•\s*/,"");
      const rest = sec.slice(i+1);
      const details = rest.split(/;|\n/).map(s=>s.replace(/\s+/g," ").trim()).filter(Boolean);
      if(details.length===0){
        return `<div class="blk"><div class="title">${renderMarkdownLite(header)}</div></div>`;
      }
      const bullets = details.map(d=>`<li>${renderMarkdownLite(d)}</li>`).join("");
      return `<div class="blk"><div class="title">${renderMarkdownLite(header)}</div><ul class="list">${bullets}</ul></div>`;
    }).join("");
    return html || renderMarkdownLite(text);
  }

  function resetChat(){
    username = null;
    body.innerHTML = '';
    addMsg("Hello, hope you are doing good. I'm here to help with your questions. Before we begin, what's your name?", 'bot');

    // re-attach quick actions inside body if you want them after reset:
    const qa = document.createElement('div');
    qa.className = 'quick-actions';
    qa.innerHTML = `
      <button data-q="Tell me about your experiences">💼 Experience</button>
      <button data-q="Tell me about your skills">🛠 Skills</button>
      <button data-q="List your projects">📂 Projects</button>
      <button data-q="Show your education">🎓 Education</button>
      <button data-q="Share your contact details">📞 Contact</button>
      <button data-q="Share your publications">👨‍💻 Publications</button>`;
    body.appendChild(qa);
    bindQuick(qa);
  }

  // ===== OPEN/CLOSE =====
  openBtn.addEventListener('click', ()=>{ wrap.style.display='block'; setTimeout(()=>inp.focus(),120); });
  closeBtn.addEventListener('click', ()=>{ wrap.style.display='none'; resetChat(); });

  // ===== ENTER TO SEND =====
  inp.addEventListener('keydown', (e)=>{
    if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); form.requestSubmit(); }
  });
  inp.addEventListener('input', autosize);

  // ===== Quick Action Buttons =====
  function bindQuick(scope){
    (scope || root).querySelectorAll('.quick-actions button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const q = btn.getAttribute('data-q') || btn.textContent.trim();
        sendQuestion(q);
      });
    });
  }
  bindQuick(); // initial bind for the set in HTML

  // ===== Shared send flow =====
  async function sendQuestion(text){
    if(!text) return;

    addMsg(text, 'user');

    // First message -> capture name
    if(!username){
      username = text.replace(/[^a-zA-Z \-'.]/g,'').trim().split(/\s+/).slice(0,2).join(' ');
      addMsg(`Welcome ${escapeHTML(username)}, how can I help you today?`, 'bot');
      return;
    }

    const typing = addTyping();
    try{
      const resp = await fetch(API_URL, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ question: `${text} (User: ${username})` })
      });
      if(!resp.ok) throw new Error('HTTP '+resp.status);
      const data = await resp.json();
      typing.remove();
      const formatted = formatBotAnswer((data.answer || '').trim());
      addMsg(formatted || "(no answer)", 'bot');
    }catch(err){
      console.error(err);
      typing.remove();
      addMsg("Sorry, something went wrong. Please try again.", 'bot');
    }
  }

  // ===== SUBMIT =====
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const text = inp.value.trim();
    if(!text) return;
    inp.value=''; autosize();
    sendQuestion(text);
  });

  // Init
  autosize();
