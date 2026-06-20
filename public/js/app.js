
/* ============== DATA ============== */
const TONE_WORDS = {
  happy: ["haha","lol","lmao","awesome","great","happy","wonderful","amazing","yay","excited","glad","wow","brilliant","superb","cool","proud","thrilled","fun"],
  sad: ["sad","cry","miss","alone","hurt","sorry","upset","lonely","unhappy","disappointed","hopeless","tears","broken","tired","feeling low"],
  angry: ["hate","angry","stupid","idiot","worst","annoying","mad","furious","disgusting","useless","frustrated","irritated","horrible","ridiculous"],
  rude: ["shut up","whatever","don't care","who cares","go away","not my problem","leave me alone","you're annoying","don't have time for this","stop talking"],
  love: ["love","cute","sweetheart","darling","adore","beautiful","heart","kiss","babe","honey","forever","romantic","my everything"],
  caring: ["are you okay","take care","let me know if you need anything","i am here for you","you can talk to me","sending you strength","proud of you","take your time","i understand","i support you","is everything alright","no pressure"],
};
const TONE_ORDER = ["happy","sad","angry","rude","love","caring"];
const TONE_LABEL = {happy:'Happy',sad:'Sad',angry:'Angry',rude:'Rude',love:'Love',caring:'Truly Caring',neutral:'Neutral'};
const TONE_COLOR = {happy:'#FFB23E',sad:'#6FA8E0',angry:'#FF6B5B',rude:'#D98B3E',love:'#FF6FA0',caring:'#3FBFA8',neutral:'#A99AA8'};

const THREAT_CATEGORIES = {
  "Manipulation & Pressure": {weight:15, words:["why aren't you replying","you always do this","if you really cared","everyone else would","don't be so dramatic","i thought you were different","you're overreacting","stop being so sensitive","just this once","don't tell your parents","keep this between us","delete this chat","let's move to telegram","let's move to another app","you're the only one i can talk to","i've never told anyone this before","you owe me"]},
  "Financial / Prize Scam": {weight:15, words:["you have won","claim your prize","lucky winner","claim now","congratulations you have been selected","free gift voucher","work from home earn","guaranteed returns","double your money","investment opportunity","100% guaranteed","risk free"]},
  "OTP / Banking Request": {weight:20, words:["share your otp","send otp","your pin number","cvv number","card number","atm pin","net banking password","account number and ifsc"]},
  "Academic Scam": {weight:15, words:["admission will be cancelled","pay the deposit to confirm your seat","scholarship selected pay","placement guaranteed pay","internship offer pay","refundable deposit","degree will be withheld","submit fee within 24 hours","exclusive seats available pay"]},
  "Authority / Urgency Pressure": {weight:12, words:["this is your bank","account will be blocked","kyc update required","verify your account immediately","legal action will be taken","act now","limited time","before it is too late","respond immediately"]},
  "Impersonation / Account Takeover": {weight:14, words:["this is my new number save it","lost my old phone message me here","my account got hacked this is the real me","do not use my old number anymore","messaging from a friend's phone","new whatsapp number please update"]},
  "Romance / Catfishing Pattern": {weight:16, words:["i have never felt this way before","you are different from everyone else","i want to marry you","i love you so much already","cannot video call right now","my camera is broken","i am stuck abroad","i need money for customs","stationed overseas","lost my wallet need help","western union","gift cards to help me","i promise i will pay you back","you are my soulmate already"]},
};

const SAFETY_TIPS = {
  "Manipulation & Pressure": "Real friends respect your pace. If someone pressures you to reply fast or keep secrets, pause and talk to someone you trust.",
  "Financial / Prize Scam": "No real lottery or prize asks you to pay first. Delete and block these messages.",
  "OTP / Banking Request": "Never share OTP, PIN, or CVV with anyone — not even someone claiming to be your bank.",
  "Academic Scam": "Verify any scholarship, placement, or admission fee request directly with your institution's official office before paying.",
  "Authority / Urgency Pressure": "Real banks and government bodies don't threaten you over chat. Call the official number yourself to verify.",
  "Impersonation / Account Takeover": "If a contact's tone or number suddenly changes, verify their identity through another channel before trusting the chat.",
  "Romance / Catfishing Pattern": "Be cautious of fast declarations of love and any request for money from someone you haven't met in person or video called.",
};

const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/ig;
const SHORTENERS = ["bit.ly","tinyurl.com","cutt.ly","t.co","goo.gl","is.gd","ow.ly","rebrand.ly"];
const SUS_TLDS = [".xyz",".top",".icu",".club",".work",".gq",".tk",".loan",".click"];

/* ============== STATE ============== */
let track = null;
let chosenFile = null;
let voiceLines = [];
let recognition = null;
let isRecording = false;
let moodChart = null, statsChart = null;
let lastData = null;

/* ============== DETECTION ENGINE ============== */
function detectTone(text){
  const low = text.toLowerCase();
  const counts = {};
  TONE_ORDER.forEach(t => { counts[t] = TONE_WORDS[t].filter(w=>low.includes(w)).length; });
  let best='neutral', bestCount=0;
  TONE_ORDER.forEach(t => { if(counts[t]>bestCount){best=t;bestCount=counts[t];} });
  return bestCount>0 ? best : 'neutral';
}
function detectThreats(text){
  const low = text.toLowerCase();
  const hits = [];
  Object.entries(THREAT_CATEGORIES).forEach(([cat,info]) => {
    if(info.words.some(w=>low.includes(w))) hits.push({cat:cat, weight:info.weight});
  });
  return hits;
}
function checkUrl(url){
  const low = url.toLowerCase();
  if(/^(https?:\/\/)?(\d{1,3}\.){3}\d{1,3}/.test(low)) return {risk:'High Risk', reason:'Uses a raw IP address instead of a domain name'};
  for(const s of SHORTENERS) if(low.includes(s)) return {risk:'Caution', reason:'Shortened link — real destination hidden ('+s+')'};
  for(const t of SUS_TLDS) if(low.includes(t)) return {risk:'Caution', reason:'Uncommon domain ending ('+t+') often used in scams'};
  return {risk:'Low Risk', reason:'No obvious red flag — still verify the sender'};
}
function extractLinks(text){
  const matches = text.match(URL_REGEX) || [];
  return matches.map(u => Object.assign({url:u}, checkUrl(u)));
}
function parseChat(raw){
  const lines = raw.split('\n');
  const re = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*([\d:]+\s*[apAP]?[mM]?)\s*-\s*([^:]+):\s*(.+)$/;
  const out = [];
  for(const line of lines){
    if(line.includes('omitted')||line.includes('end-to-end')) continue;
    const m = line.trim().match(re);
    if(!m) continue;
    out.push({date:m[1].trim(), time:m[2].trim(), sender:m[3].trim(), text:m[4].trim()});
  }
  return out;
}
function trustLabel(score){ return score>=80?'Safe':score>=50?'Caution':'High Risk'; }
function detectDrift(personMsgs){
  if(personMsgs.length < 6) return null;
  const split = Math.floor(personMsgs.length*0.7);
  const early = personMsgs.slice(0,split), recent = personMsgs.slice(split);
  if(recent.length < 2) return null;
  const earlyThreats = early.filter(m=>m.threats.length>0).length;
  const recentThreats = recent.filter(m=>m.threats.length>0).length;
  const warm = ['happy','love','caring'], neg = ['angry','rude'];
  const dom = arr => {
    const c={}; arr.forEach(m=>{c[m.tone]=(c[m.tone]||0)+1;});
    let best='neutral',bc=0; Object.entries(c).forEach(([k,v])=>{if(v>bc){best=k;bc=v;}});
    return best;
  };
  const earlyDom = dom(early), recentDom = dom(recent);
  if(recentThreats>0 && earlyThreats===0){
    return {reason:'Risk-pattern messages appeared only recently — not seen earlier in this chat.', earlyDom:earlyDom, recentDom:recentDom};
  }
  if(warm.includes(earlyDom) && neg.includes(recentDom)){
    return {reason:'Tone shifted from "'+TONE_LABEL[earlyDom]+'" to "'+TONE_LABEL[recentDom]+'" in recent messages.', earlyDom:earlyDom, recentDom:recentDom};
  }
  return null;
}
function analyze(raw){
  const parsed = parseChat(raw);
  const people = {};
  const timeline = [];
  const allLinks = [];
  const threatSummary = {};
  const flagged = [];

  parsed.forEach((msg,i) => {
    const tone = detectTone(msg.text);
    const threats = detectThreats(msg.text);
    const links = extractLinks(msg.text);
    allLinks.push.apply(allLinks, links);

    if(!people[msg.sender]) people[msg.sender] = {name:msg.sender, total:0, tones:{}, threatPoints:0, threatHits:0, msgs:[]};
    const p = people[msg.sender];
    p.total++;
    p.tones[tone] = (p.tones[tone]||0)+1;

    const riskPts = threats.reduce((s,t)=>s+t.weight,0) + links.filter(l=>l.risk==='High Risk').length*20 + links.filter(l=>l.risk==='Caution').length*8;
    if(threats.length>0 || links.some(l=>l.risk!=='Low Risk')){
      p.threatPoints += riskPts; p.threatHits++;
      threats.forEach(t=>{ threatSummary[t.cat]=(threatSummary[t.cat]||0)+1; });
      flagged.push({date:msg.date, sender:msg.sender, text:msg.text, categories:threats.map(t=>t.cat), links:links, riskPts:riskPts});
    }
    p.msgs.push({tone:tone, threats:threats, riskPts:riskPts, date:msg.date, text:msg.text});
    timeline.push({index:i, sender:msg.sender, tone:tone, riskPts:riskPts, date:msg.date, text:msg.text});
  });

  const driftAlerts = [];
  Object.values(people).forEach(p => {
    p.trustScore = Math.max(0, 100 - p.threatPoints);
    p.trustLabel = trustLabel(p.trustScore);
    const d = detectDrift(p.msgs);
    if(d) driftAlerts.push(Object.assign({person:p.name}, d));
  });

  const overallTone = {};
  TONE_ORDER.concat('neutral').forEach(t => { overallTone[t] = Object.values(people).reduce((s,p)=>s+(p.tones[t]||0),0); });

  return {
    totalMessages: parsed.length, totalPeople: Object.keys(people).length,
    people: Object.values(people), overallTone: overallTone, timeline: timeline, allLinks: allLinks,
    threatSummary: threatSummary, flagged: flagged, driftAlerts: driftAlerts, totalFlagged: flagged.length,
  };
}
function escapeHtml(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

/* ============== 3D TILT ============== */
function applyTilt(el){
  el.addEventListener('mousemove', e => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left)/r.width - 0.5;
    const y = (e.clientY - r.top)/r.height - 0.5;
    el.style.transform = 'rotateY('+(x*10)+'deg) rotateX('+(-y*10)+'deg) scale(1.02)';
  });
  el.addEventListener('mouseleave', () => { el.style.transform = 'rotateY(0) rotateX(0) scale(1)'; });
}
applyTilt(document.getElementById('cardVibe'));
applyTilt(document.getElementById('cardRadar'));

/* ============== TRACK SELECTION ============== */
document.getElementById('cardVibe').addEventListener('click', () => selectTrack('vibe'));
document.getElementById('cardRadar').addEventListener('click', () => selectTrack('radar'));
document.getElementById('switchTrackBtn').addEventListener('click', () => {
  document.getElementById('heroSection').style.display = 'block';
  document.getElementById('uploadStep').style.display = 'none';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('signalWrap').classList.remove('show');
  document.getElementById('switchTrackBtn').style.display = 'none';
  track = null;
});

function selectTrack(t){
  track = t;
  document.getElementById('heroSection').style.display = 'none';
  document.getElementById('uploadStep').style.display = 'block';
  document.getElementById('switchTrackBtn').style.display = 'inline-block';
  const title = document.getElementById('uploadStepTitle');
  const analyzeBtn = document.getElementById('analyzeBtn');
  if(t==='vibe'){
    title.textContent = '🌈 Load a chat for Vibe Check';
    analyzeBtn.textContent = 'Check the Vibe';
    analyzeBtn.className = 'btn-primary';
  } else {
    title.textContent = '🚩 Load a chat for Red Flag Radar';
    analyzeBtn.textContent = 'Scan for Red Flags';
    analyzeBtn.className = 'btn-primary radar-grad';
  }
  document.getElementById('uploadStep').scrollIntoView({behavior:'smooth'});
}

/* ============== UPLOAD TABS ============== */
document.getElementById('tabFileBtn').addEventListener('click', () => switchUploadTab('file'));
document.getElementById('tabPasteBtn').addEventListener('click', () => switchUploadTab('paste'));
document.getElementById('tabVoiceBtn').addEventListener('click', () => switchUploadTab('voice'));
function switchUploadTab(which){
  document.getElementById('tabFileBtn').classList.toggle('active', which==='file');
  document.getElementById('tabPasteBtn').classList.toggle('active', which==='paste');
  document.getElementById('tabVoiceBtn').classList.toggle('active', which==='voice');
  document.getElementById('uploadFilePanel').style.display = which==='file' ? 'block':'none';
  document.getElementById('uploadPastePanel').style.display = which==='paste' ? 'block':'none';
  document.getElementById('uploadVoicePanel').style.display = which==='voice' ? 'block':'none';
}
document.getElementById('dropzone').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change', e => {
  chosenFile = e.target.files[0];
  document.getElementById('fileChosenName').textContent = chosenFile ? ('Selected: '+chosenFile.name) : '';
});

/* ============== VOICE INPUT ============== */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if(SR){
  recognition = new SR();
  recognition.continuous = false;
  recognition.lang = 'en-IN';
  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    const sender = document.getElementById('voiceSender').value.trim() || 'Unknown Number';
    const now = new Date();
    const dateStr = now.getDate()+'/'+(now.getMonth()+1)+'/'+now.getFullYear();
    const timeStr = now.getHours()+':'+String(now.getMinutes()).padStart(2,'0');
    const line = dateStr+', '+timeStr+' - '+sender+': '+transcript;
    voiceLines.push(line);
    renderVoiceLog();
  };
  recognition.onend = () => { isRecording = false; document.getElementById('micBtn').classList.remove('recording'); document.getElementById('voiceHint').textContent = 'Tap the mic, say the message out loud, tap again to stop'; };
  document.getElementById('micBtn').addEventListener('click', () => {
    if(isRecording){ recognition.stop(); return; }
    isRecording = true;
    document.getElementById('micBtn').classList.add('recording');
    document.getElementById('voiceHint').textContent = 'Listening...';
    recognition.start();
  });
} else {
  document.getElementById('uploadVoicePanel').innerHTML = '<div class="voice-unsupported">🎤 Voice input needs a browser with speech recognition support (try Chrome on desktop or Android). Use upload or paste instead for now.</div>';
}
function renderVoiceLog(){
  const log = document.getElementById('voiceLog');
  log.style.display = voiceLines.length ? 'block' : 'none';
  log.innerHTML = voiceLines.map(l => '<div class="voice-log-row">'+escapeHtml(l)+'</div>').join('');
}

/* ============== ANALYZE ============== */
document.getElementById('analyzeBtn').addEventListener('click', () => {
  const statusEl = document.getElementById('statusMsg');
  const activeTab = document.getElementById('tabFileBtn').classList.contains('active') ? 'file'
                   : document.getElementById('tabPasteBtn').classList.contains('active') ? 'paste' : 'voice';

  if(activeTab==='file'){
    if(!chosenFile){ statusEl.textContent='Choose a .txt file first.'; statusEl.className='status-msg err'; return; }
    const reader = new FileReader();
    reader.onload = ev => runAnalysis(ev.target.result);
    reader.readAsText(chosenFile);
  } else if(activeTab==='paste'){
    const text = document.getElementById('chattext').value.trim();
    if(!text){ statusEl.textContent='Paste some chat text first.'; statusEl.className='status-msg err'; return; }
    runAnalysis(text);
  } else {
    if(voiceLines.length===0){ statusEl.textContent='Record at least one voice message first.'; statusEl.className='status-msg err'; return; }
    runAnalysis(voiceLines.join('\n'));
  }
});

document.getElementById('demoBtn').addEventListener('click', () => {
  const demo = `19/04/2026, 09:00 am - Arun: Good morning! happy to see you all here
19/04/2026, 09:01 am - Priya: morning! today feels so great and wonderful
19/04/2026, 09:10 am - Unknown Number: Congratulations!! You have won a lottery prize. Claim now at http://bit.ly/claim-prize99
19/04/2026, 09:11 am - Arun: this looks suspicious
19/04/2026, 09:15 am - Unknown Number: This is your bank. Your account will be blocked today. Share your otp immediately
19/04/2026, 09:18 am - Riya: hey are you okay? you seemed upset yesterday, i am here for you
19/04/2026, 09:19 am - Arun: thanks Riya, i am here for you too, take care
19/04/2026, 09:25 am - Senior Contact: pay the deposit to confirm your seat or admission will be cancelled, submit fee within 24 hours
19/04/2026, 09:26 am - Priya: that sounds like an academic scam, verify with the college office directly
19/04/2026, 09:30 am - Karthik: shut up, whatever, i don't have time for this
19/04/2026, 09:31 am - Karthik: why aren't you replying, you always do this, i thought you were different
19/04/2026, 09:32 am - Karthik: keep this between us, don't tell your parents about what i told you
19/04/2026, 09:34 am - New Contact: i have never felt this way before, you are different from everyone else, i cannot video call right now though
19/04/2026, 09:35 am - Divya: love you all, grateful we look out for each other`;
  runAnalysis(demo);
});

function runAnalysis(raw){
  const statusEl = document.getElementById('statusMsg');
  const data = analyze(raw);
  if(data.totalMessages===0){
    statusEl.textContent='No valid WhatsApp-format messages found.'; statusEl.className='status-msg err'; return;
  }
  statusEl.textContent = '✓ Analyzed '+data.totalMessages+' messages from '+data.totalPeople+' people';
  statusEl.className = 'status-msg ok';
  lastData = data;
  renderAll(data);
}

/* ============== RENDER ============== */
function renderAll(data){
  document.getElementById('signalWrap').classList.add('show');
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('dashTitle').textContent = track==='vibe' ? '🌈 Vibe Check results' : '🚩 Red Flag Radar results';
  renderSignal(data.timeline);
  renderSummary(data);
  buildTabs(data);
  document.getElementById('dashboard').scrollIntoView({behavior:'smooth'});
}

function renderSignal(timeline){
  const svg = document.getElementById('signalSvg');
  const statusEl = document.getElementById('signalStatus');
  const w=880,h=96,mid=h/2,n=timeline.length;
  const step = w/Math.max(n-1,1);
  let path = 'M 0 '+mid; let dots='';
  timeline.forEach((m,i)=>{
    const x=i*step;
    const amp = m.riskPts>0 ? Math.min(36,8+m.riskPts) : (m.tone!=='neutral'?6:2);
    const dir = i%2===0?-1:1;
    const y = mid + dir*amp*(m.riskPts>0?1.3:0.5);
    path += ' L '+x.toFixed(1)+' '+y.toFixed(1);
    if(m.riskPts>0) dots += '<circle class="signal-spike" cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="4" fill="#FF5C5C"></circle>';
  });
  path += ' L '+w+' '+mid;
  svg.innerHTML = '<path class="signal-path" d="'+path+'"></path>'+dots;
  const flaggedN = timeline.filter(m=>m.riskPts>0).length;
  statusEl.textContent = flaggedN>0 ? (flaggedN+' anomal'+(flaggedN>1?'ies':'y')+' in '+n+' messages') : ('clean — '+n+' messages');
}

function renderSummary(data){
  const el = document.getElementById('summaryRow');
  const pct = data.totalMessages ? Math.round(data.totalFlagged*100/data.totalMessages) : 0;
  let html = '<div class="summary-card"><div class="label">Messages</div><div class="value">'+data.totalMessages+'</div></div>'+
  '<div class="summary-card"><div class="label">People</div><div class="value">'+data.totalPeople+'</div></div>';
  if(track==='radar'){
    html += '<div class="summary-card"><div class="label">Flagged</div><div class="value '+(data.totalFlagged>0?'risk':'safe')+'">'+data.totalFlagged+'</div></div>'+
    '<div class="summary-card"><div class="label">Flag Rate</div><div class="value '+(pct>0?'risk':'safe')+'">'+pct+'%</div></div>'+
    '<div class="summary-card"><div class="label">Drift Alerts</div><div class="value '+(data.driftAlerts.length>0?'risk':'safe')+'">'+data.driftAlerts.length+'</div></div>';
  } else {
    const top = Object.entries(data.overallTone).sort((a,b)=>b[1]-a[1])[0];
    html += '<div class="summary-card"><div class="label">Dominant Vibe</div><div class="value" style="font-size:17px;">'+TONE_LABEL[top[0]]+'</div></div>';
  }
  el.innerHTML = html;
}

function buildTabs(data){
  const tabs = [];
  if(track==='vibe'){
    tabs.push({id:'mood', label:'Mood Report'});
    tabs.push({id:'stats', label:'Statistics'});
    tabs.push({id:'search', label:'Search by Vibe'});
    tabs.push({id:'messages', label:'All Messages'});
  } else {
    tabs.push({id:'safety', label:'Safety Report'});
    tabs.push({id:'trust', label:'Trust Score'});
    tabs.push({id:'drift', label:'Vibe Shift Alerts'});
    tabs.push({id:'links', label:'Link Safety'});
    tabs.push({id:'tips', label:'Safety Tips'});
    tabs.push({id:'messages', label:'All Messages'});
  }

  const tabbar = document.getElementById('tabbar');
  tabbar.innerHTML = tabs.map((t,i)=>'<button class="tabbtn '+(i===0?'active':'')+'" data-tab="'+t.id+'">'+t.label+'</button>').join('');
  const panels = document.getElementById('panels');
  panels.innerHTML = tabs.map((t,i)=>'<div class="panel '+(i===0?'active':'')+'" id="panel-'+t.id+'"></div>').join('');

  tabbar.querySelectorAll('.tabbtn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      tabbar.querySelectorAll('.tabbtn').forEach(b=>b.classList.remove('active'));
      panels.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-'+btn.dataset.tab).classList.add('active');
    });
  });

  if(track==='vibe'){
    renderMood(data); renderStats(data); renderSearch(data);
  } else {
    renderSafety(data); renderTrust(data); renderDrift(data); renderLinks(data); renderTips(data);
  }
  renderMessages(data);
}

/* ---- Track 1 panels ---- */
function renderMood(data){
  const el = document.getElementById('panel-mood');
  let html = '<div class="section-title">Overall mood breakdown</div><div class="legend">'+TONE_ORDER.map(t=>'<span><span class="ldot" style="background:'+TONE_COLOR[t]+'"></span>'+TONE_LABEL[t]+'</span>').join('')+'</div>';
  const total = data.totalMessages||1;
  TONE_ORDER.forEach(t=>{
    const pct = Math.round((data.overallTone[t]||0)*100/total);
    html += '<div class="bar-row"><span class="bl">'+TONE_LABEL[t]+'</span><div class="bar-track"><div class="bar-fill" style="width:'+pct+'%;background:'+TONE_COLOR[t]+'"></div></div><span class="bar-pct">'+pct+'%</span></div>';
  });
  html += '<div class="section-title">Per person</div>';
  data.people.forEach(p=>{
    const t = p.total||1;
    html += '<div class="person-card"><div class="person-head"><div><div class="person-name">'+escapeHtml(p.name)+'</div><div class="person-sub">'+p.total+' messages</div></div></div>';
    TONE_ORDER.forEach(tone=>{
      const pct = Math.round((p.tones[tone]||0)*100/t);
      html += '<div class="bar-row"><span class="bl">'+TONE_LABEL[tone]+'</span><div class="bar-track"><div class="bar-fill" style="width:'+pct+'%;background:'+TONE_COLOR[tone]+'"></div></div><span class="bar-pct">'+pct+'%</span></div>';
    });
    html += '</div>';
  });
  el.innerHTML = html;
}

function renderStats(data){
  const el = document.getElementById('panel-stats');
  const mostActive = data.people.reduce((a,b)=> a.total>b.total?a:b, {total:0,name:'—'});
  el.innerHTML =
    '<div class="summary-row" style="margin-bottom:20px;">'+
      '<div class="summary-card"><div class="label">Most Active</div><div class="value" style="font-size:16px;">'+escapeHtml(mostActive.name)+'</div></div>'+
      '<div class="summary-card"><div class="label">Their Messages</div><div class="value">'+mostActive.total+'</div></div>'+
    '</div>'+
    '<div class="section-title">Mood distribution</div>'+
    '<div class="chart-card"><div class="chart-wrap"><canvas id="moodChartCanvas"></canvas></div></div>'+
    '<div class="section-title">Messages per person, by mood</div>'+
    '<div class="chart-card"><div class="chart-wrap tall"><canvas id="statsChartCanvas"></canvas></div></div>';

  if(moodChart) moodChart.destroy();
  const ctx1 = document.getElementById('moodChartCanvas');
  moodChart = new Chart(ctx1, {
    type:'doughnut',
    data:{ labels: TONE_ORDER.map(t=>TONE_LABEL[t]), datasets:[{ data: TONE_ORDER.map(t=>data.overallTone[t]||0), backgroundColor: TONE_ORDER.map(t=>TONE_COLOR[t]), borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ font:{family:'Plus Jakarta Sans', size:11}, boxWidth:10 } } } }
  });

  if(statsChart) statsChart.destroy();
  const ctx2 = document.getElementById('statsChartCanvas');
  statsChart = new Chart(ctx2, {
    type:'bar',
    data:{
      labels: data.people.map(p=>p.name),
      datasets: TONE_ORDER.map(t => ({ label: TONE_LABEL[t], data: data.people.map(p=>p.tones[t]||0), backgroundColor: TONE_COLOR[t] }))
    },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{font:{family:'Plus Jakarta Sans', size:10.5}, boxWidth:10}}}, scales:{x:{stacked:true},y:{stacked:true}} }
  });
}

function renderSearch(data){
  const el = document.getElementById('panel-search');
  el.innerHTML =
    '<div class="filter-row">'+
      '<select class="filter-select" id="searchPersonFilter"><option value="all">All people</option>'+data.people.map(p=>'<option value="'+escapeHtml(p.name)+'">'+escapeHtml(p.name)+'</option>').join('')+'</select>'+
      '<select class="filter-select" id="searchMoodFilter"><option value="all">All vibes</option>'+TONE_ORDER.map(t=>'<option value="'+t+'">'+TONE_LABEL[t]+'</option>').join('')+'</select>'+
    '</div>'+
    '<div class="msg-list" id="searchResults"></div>';
  document.getElementById('searchPersonFilter').addEventListener('change', ()=>paintSearch(data));
  document.getElementById('searchMoodFilter').addEventListener('change', ()=>paintSearch(data));
  paintSearch(data);
}
function paintSearch(data){
  const person = document.getElementById('searchPersonFilter').value;
  const mood = document.getElementById('searchMoodFilter').value;
  let list = data.timeline;
  if(person!=='all') list = list.filter(m=>m.sender===person);
  if(mood!=='all') list = list.filter(m=>m.tone===mood);
  const wrap = document.getElementById('searchResults');
  if(list.length===0){ wrap.innerHTML = '<div class="no-data">No messages match this filter.</div>'; return; }
  wrap.innerHTML = list.map(m=>'<div class="msg-row"><span class="msg-date">'+m.date+'</span><span class="msg-sender">'+escapeHtml(m.sender)+'</span><span class="msg-dot" style="background:'+TONE_COLOR[m.tone]+'"></span><span class="msg-text">'+escapeHtml(m.text)+'</span></div>').join('');
}

/* ---- Track 2 panels ---- */
function renderSafety(data){
  const el = document.getElementById('panel-safety');
  if(data.totalFlagged===0){ el.innerHTML = '<div class="no-data"><div class="ic">✓</div>No threat patterns detected in this chat.</div>'; return; }
  let html = '<div class="section-title">Categories found</div><div class="threat-grid">';
  Object.entries(data.threatSummary).forEach(([cat,count])=>{
    html += '<div class="threat-cat-card"><div class="cname">'+cat+'</div><div class="ccount">'+count+'</div></div>';
  });
  html += '</div><div class="section-title">Flagged messages</div>';
  data.flagged.forEach(f=>{
    html += '<div class="flag-card"><div class="flag-top"><span class="flag-sender">'+escapeHtml(f.sender)+'</span><span class="flag-date">'+f.date+'</span></div>'+
    '<div class="flag-text">"'+escapeHtml(f.text)+'"</div>'+
    '<div class="flag-tags">'+f.categories.map(c=>'<span class="flag-tag">'+c+'</span>').join('')+f.links.map(l=>'<span class="flag-tag link-tag">🔗 '+l.risk+'</span>').join('')+'</div></div>';
  });
  el.innerHTML = html;
}
function renderTrust(data){
  const el = document.getElementById('panel-trust');
  let html = '<div class="section-title">Trust score per contact</div>';
  const sorted = data.people.slice().sort((a,b)=>a.trustScore-b.trustScore);
  sorted.forEach(p=>{
    const pc = p.trustLabel==='Safe'?'safe':p.trustLabel==='Caution'?'caution':'risk';
    const barColor = p.trustScore>=80?'#2FBE85':p.trustScore>=50?'#F0A23B':'#FF5C5C';
    html += '<div class="person-card"><div class="person-head"><div><div class="person-name">'+escapeHtml(p.name)+'</div><div class="person-sub">'+p.threatHits+' flagged of '+p.total+' messages</div></div><span class="pill '+pc+'">'+p.trustLabel+' · '+p.trustScore+'/100</span></div>'+
    '<div class="bar-row"><span class="bl">Trust</span><div class="bar-track"><div class="bar-fill" style="width:'+p.trustScore+'%;background:'+barColor+'"></div></div><span class="bar-pct">'+p.trustScore+'</span></div></div>';
  });
  el.innerHTML = html;
}
function renderDrift(data){
  const el = document.getElementById('panel-drift');
  if(data.driftAlerts.length===0){ el.innerHTML = "<div class=\"no-data\"><div class=\"ic\">✓</div>No vibe shifts detected — everyone's recent tone matches their usual pattern.</div>"; return; }
  let html = "<div class=\"callout\">These compare a person's recent messages to their own earlier pattern in this chat. It's a nudge to double-check, not proof something is wrong.</div>";
  data.driftAlerts.forEach(d=>{
    html += '<div class="flag-card"><div class="flag-top"><span class="flag-sender">'+escapeHtml(d.person)+'</span><span class="pill caution">Worth a check</span></div><div class="flag-text">'+escapeHtml(d.reason)+'</div></div>';
  });
  el.innerHTML = html;
}
function renderLinks(data){
  const el = document.getElementById('panel-links');
  if(data.allLinks.length===0){ el.innerHTML = '<div class="no-data"><div class="ic">🔗</div>No links found in this chat.</div>'; return; }
  let html = '<div class="section-title">'+data.allLinks.length+' link(s) found</div>';
  data.allLinks.forEach(l=>{
    const pc = l.risk==='High Risk'?'risk':l.risk==='Caution'?'caution':'safe';
    html += '<div class="link-row"><div><div class="link-url">'+escapeHtml(l.url)+'</div><div class="link-reason">'+l.reason+'</div></div><span class="pill '+pc+'">'+l.risk+'</span></div>';
  });
  el.innerHTML = html;
}
function renderTips(data){
  const el = document.getElementById('panel-tips');
  const cats = Object.keys(data.threatSummary);
  if(cats.length===0){ el.innerHTML = '<div class="no-data"><div class="ic">✓</div>Nothing flagged, so no extra tips needed right now.</div>'; return; }
  let html = '<div class="section-title">Based on what we found in this chat</div>';
  cats.forEach(c=>{
    html += '<div class="tip-card"><strong>'+c+'</strong>'+SAFETY_TIPS[c]+'</div>';
  });
  el.innerHTML = html;
}

/* ---- Shared ---- */
function renderMessages(data){
  const el = document.getElementById('panel-messages');
  el.innerHTML = '<div class="msg-list">'+data.timeline.map(m=>'<div class="msg-row"><span class="msg-date">'+m.date+'</span><span class="msg-sender">'+escapeHtml(m.sender)+'</span><span class="msg-dot" style="background:'+TONE_COLOR[m.tone]+'"></span><span class="msg-text">'+(m.riskPts>0?'⚠️ ':'')+escapeHtml(m.text)+'</span></div>').join('')+'</div>';
}

/* ============== DOWNLOAD REPORT ============== */
document.getElementById('downloadBtn').addEventListener('click', () => {
  if(!lastData) return;
  const d = lastData;
  let out = '=====================================================\\n';
  out += 'Aura — '+(track==='vibe' ? 'VIBE CHECK REPORT' : 'RED FLAG RADAR REPORT')+'\\n';
  out += '=====================================================\\n';
  out += 'Total Messages : '+d.totalMessages+'\\n';
  out += 'Total People   : '+d.totalPeople+'\\n\\n';

  if(track==='vibe'){
    d.people.forEach(p=>{
      const t = p.total||1;
      out += '-----------------------------------------------------\\n';
      out += 'Person   : '+p.name+'\\n';
      out += 'Messages : '+p.total+'\\n';
      TONE_ORDER.forEach(tone=>{ out += TONE_LABEL[tone]+'  : '+Math.round((p.tones[tone]||0)*100/t)+'%\\n'; });
      out += '\\n';
    });
  } else {
    out += 'Flagged Messages : '+d.totalFlagged+'\\n\\n';
    out += '--- Trust Scores ---\\n';
    d.people.forEach(p=>{ out += p.name+' : '+p.trustScore+'/100 ('+p.trustLabel+')\\n'; });
    out += '\\n--- Flagged Messages ---\\n';
    d.flagged.forEach(f=>{ out += '['+f.date+'] '+f.sender+': "'+f.text+'"  <-- '+f.categories.join(', ')+'\\n'; });
    if(d.driftAlerts.length>0){
      out += '\\n--- Vibe Shift Alerts ---\\n';
      d.driftAlerts.forEach(a=>{ out += a.person+': '+a.reason+'\\n'; });
    }
  }

  out += '\\n=====================================================\\n';
  out += 'ALL MESSAGES\\n';
  out += '=====================================================\\n';
  d.timeline.forEach(m=>{ out += '['+m.date+'] '+m.sender+' ('+TONE_LABEL[m.tone]+'): '+m.text+'\\n'; });

  const blob = new Blob([out], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'aura_report_'+(track==='vibe'?'vibe':'radar')+'.txt';
  a.click();
});
