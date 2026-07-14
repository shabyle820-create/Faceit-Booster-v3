
(()=>{
const D={
  enabled:true,autoAnalyze:true,showTeamElo:true,showFlags:true,showPerformance:true,
  showSmurfRisk:true,showEloEstimate:true,highlightTeamLeaders:true,compactMode:false,autoReady:false,autoParty:false,
  readyDelay:3,partyDelay:3,nickname:""
};

let s={...D},lastHref=location.href,lastMatchId="",loading=false;
const cache=new Map(),scheduled=new WeakSet(),clicked=new WeakSet();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=x=>String(x||"").replace(/\s+/g," ").trim().toLowerCase();
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function getMatchId(){
  const p=location.pathname;
  for(const re of [/\/room\/([^/?#]+)/i,/\/match\/([^/?#]+)/i]){
    const m=p.match(re); if(m) return decodeURIComponent(m[1]);
  }
  const q=new URLSearchParams(location.search);
  return q.get("matchId")||q.get("match_id")||"";
}

function isRoom(){return !!getMatchId()}

function api(type,value){
  const key=`${type}:${value}`;
  if(cache.has(key)) return cache.get(key);
  const p=new Promise((resolve,reject)=>{
    const field={GET_MATCH:"matchId",GET_PLAYER:"playerId",GET_PLAYER_STATS:"playerId",GET_PLAYER_BY_NICKNAME:"nickname"}[type];
    chrome.runtime.sendMessage({type,[field]:value},r=>{
      if(chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if(!r?.ok) return reject(new Error(r?.error||"API request failed"));
      resolve(r.data);
    });
  });
  cache.set(key,p);
  p.catch(()=>cache.delete(key));
  return p;
}

function toast(title,text,cancellable=false){
  let root=document.getElementById("fb-toasts");
  if(!root){root=document.createElement("div");root.id="fb-toasts";document.documentElement.append(root)}
  const e=document.createElement("div");e.className="fb-toast";
  e.innerHTML="<b></b><span></span>";e.querySelector("b").textContent=title;e.querySelector("span").textContent=text;
  let cancelled=false;
  if(cancellable){
    const b=document.createElement("button");b.textContent="Cancel";
    b.onclick=()=>{cancelled=true;e.remove()};e.append(b);
  }
  root.append(e);setTimeout(()=>e.remove(),8500);
  return{cancelled:()=>cancelled,el:e};
}

function launch(){
  let b=document.getElementById("fb-launch");
  if(!isRoom()||!s.enabled){b?.remove();return}
  if(!b){
    b=document.createElement("button");
    b.id="fb-launch";
    b.textContent="Enhance Matchroom";
    b.onclick=()=>enhance(true);
    document.documentElement.append(b);
  }
}

function cleanupInline(){
  document.querySelectorAll(".fb-inline-player-data,.fb-inline-loading,.fb-team-summary-inline,.fb-match-estimate-inline")
    .forEach(e=>e.remove());
  document.querySelectorAll("[data-fb-enhanced]").forEach(e=>e.removeAttribute("data-fb-enhanced"));
}

function gameData(p){return p?.games?.cs2||p?.games?.csgo||{}}
function number(v){const n=Number(String(v??"").replace("%",""));return Number.isFinite(n)?n:0}
function lifetime(stats,name){
  const l=stats?.lifetime||{};
  const key=Object.keys(l).find(k=>norm(k)===norm(name));
  return key?l[key]:null;
}
function normalizeCountryCode(code){
  let c=String(code||"").trim().toLowerCase();
  // FACEIT may return XK for Kosovo. FlagCDN uses XK as well.
  if(!/^[a-z]{2}$/.test(c)) return "";
  return c;
}
function flagImageHtml(code){
  const c=normalizeCountryCode(code);
  if(!c) return '<span title="Unknown country">🌐</span>';
  return `<img class="fb-real-flag" src="https://flagcdn.com/24x18/${c}.png" srcset="https://flagcdn.com/48x36/${c}.png 2x" alt="${esc(c.toUpperCase())}" title="${esc(c.toUpperCase())}">`;
}
function smurfScore(profile,stats){
  const matches=number(lifetime(stats,"Matches"));
  const wr=number(lifetime(stats,"Win Rate %"));
  const kd=number(lifetime(stats,"Average K/D Ratio"));
  const elo=number(gameData(profile).faceit_elo);
  const created=number(profile?.created_at);
  const ageDays=created?Math.floor((Date.now()/1000-created)/86400):9999;

  let score=0;
  const reasons=[];

  // Account age: maximum 25 points
  if(ageDays<30){score+=25;reasons.push("very new account")}
  else if(ageDays<90){score+=20;reasons.push("new account")}
  else if(ageDays<180){score+=14}
  else if(ageDays<365){score+=7}

  // Match count: maximum 25 points
  if(matches>0&&matches<40){score+=25;reasons.push("very few matches")}
  else if(matches<80){score+=20;reasons.push("few matches")}
  else if(matches<150){score+=12}
  else if(matches<250){score+=6}

  // K/D: maximum 20 points
  if(kd>=1.70){score+=20;reasons.push("extremely high K/D")}
  else if(kd>=1.50){score+=16;reasons.push("very high K/D")}
  else if(kd>=1.30){score+=10}
  else if(kd>=1.15){score+=5}

  // Win rate: maximum 15 points
  if(wr>=75){score+=15;reasons.push("extremely high win rate")}
  else if(wr>=68){score+=12;reasons.push("very high win rate")}
  else if(wr>=60){score+=8}
  else if(wr>=55){score+=4}

  // Elo gained quickly: maximum 15 points
  if(elo>=2200&&matches>0&&matches<120){score+=15;reasons.push("very high Elo quickly")}
  else if(elo>=1900&&matches>0&&matches<150){score+=12;reasons.push("high Elo quickly")}
  else if(elo>=1600&&matches>0&&matches<100){score+=8}

  score=Math.max(0,Math.min(100,Math.round(score)));

  let cls="low";
  if(score>=75) cls="high";
  else if(score>=50) cls="suspicious";
  else if(score>=25) cls="possible";

  return {score,cls,reasons};
}

async function fetchPlayer(member){
  let id=member?.player_id||member?.playerId||member?.id;
  let profile;
  if(id) profile=await api("GET_PLAYER",id);
  else if(member?.nickname) profile=await api("GET_PLAYER_BY_NICKNAME",member.nickname);
  else throw new Error("Missing player identifier");
  id=profile.player_id;
  let stats=null;
  try{stats=await api("GET_PLAYER_STATS",id)}catch(_){}
  return{profile,stats};
}

function teamsFromMatch(match){
  const entries=Object.entries(match?.teams||{}).filter(([,v])=>Array.isArray(v?.roster)&&v.roster.length);
  return entries.slice(0,2);
}

function textNodesWithNickname(nickname){
  const target=norm(nickname);
  const all=[...document.querySelectorAll("span,div,p,a,strong,b")];
  return all.filter(el=>{
    if(el.children.length>2) return false;
    const text=norm(el.textContent);
    return text===target || text.includes(target);
  });
}

function findPlayerCard(nickname){
  const target=norm(nickname);
  const candidates=[...document.querySelectorAll("div,li,article,section")].filter(el=>{
    const text=norm(el.innerText);
    if(!text.includes(target)) return false;
    const rect=el.getBoundingClientRect();
    return rect.width>=220&&rect.width<=520&&rect.height>=45&&rect.height<=190;
  });

  let best=null,bestScore=-999;
  for(const el of candidates){
    const rect=el.getBoundingClientRect();
    const text=norm(el.innerText);
    let score=0;

    if(rect.width>=280&&rect.width<=430) score+=6;
    if(rect.height>=55&&rect.height<=130) score+=6;
    if(el.querySelector("img")) score+=3;
    if(/\b(8|9|10)\b/.test(text)) score+=2;
    if(/\b\d{3,4}\b/.test(text)) score+=2;
    if(el.querySelector(".fb-inline-player-data")) score+=5;

    score-=Math.max(0,(rect.height-120)/20);
    score-=Math.max(0,(rect.width-430)/40);

    if(score>bestScore){best=el;bestScore=score}
  }
  return best;
}

function addLoading(card){
  if(!card||card.querySelector(".fb-inline-loading,.fb-inline-player-data")) return;
  const e=document.createElement("div");
  e.className="fb-inline-loading";
  e.textContent="Loading FACEIT Booster stats…";
  card.append(e);
}

function fixVisiblePlayerName(card,nickname){
  if(!card) return;
  const target=norm(nickname);
  const nodes=[...card.querySelectorAll("span,div,a,strong,b")];
  const nameNode=nodes.find(el=>{
    const t=norm(el.textContent);
    return t===target || (t.includes(target)&&el.children.length===0);
  });
  if(nameNode){
    nameNode.classList.add("fb-name-fix");
    let p=nameNode.parentElement;
    for(let i=0;i<2&&p;i++,p=p.parentElement){
      p.style.minWidth="0";
      p.style.overflow="visible";
    }
  }
}

function injectPlayer(card,item){
  if(!card) return false;
  card.querySelector(".fb-inline-loading,.fb-inline-player-data")?.remove();

  const p=item.profile||{},stats=item.stats,g=gameData(p);
  fixVisiblePlayerName(card,p.nickname||"");
  const elo=number(g.faceit_elo),level=number(g.skill_level);
  const matches=number(lifetime(stats,"Matches"));
  const wr=number(lifetime(stats,"Win Rate %"));
  const kd=number(lifetime(stats,"Average K/D Ratio"));
  const recent=lifetime(stats,"Recent Results");
  const form=Array.isArray(recent)?recent.slice(-5).join(""):String(recent||"").slice(-5);
  const r=smurfScore(p,stats);

  const row=document.createElement("div");
  row.className="fb-inline-player-data";
  row.dataset.fbNickname=p.nickname||"";

  const parts=[];
  if(s.showFlags){
    const displayCountry = norm(p.nickname)==="--banii--s" ? "al" : p.country;
    parts.push(`<span class="fb-inline-chip fb-flag-chip" title="${esc(displayCountry||"Unknown country")}">${flagImageHtml(displayCountry)}</span>`);
  }
  if(s.showTeamElo) parts.push(`<span class="fb-inline-chip"><strong>${elo||"—"}</strong> Elo</span><span class="fb-inline-chip">Lv ${level||"—"}</span>`);
  if(s.showPerformance){
    parts.push(`<span class="fb-inline-chip"><strong>${matches||"—"}</strong> matches</span>`);
    parts.push(`<span class="fb-inline-chip"><strong>${wr||"—"}%</strong> WR</span>`);
    parts.push(`<span class="fb-inline-chip"><strong>${kd||"—"}</strong> K/D</span>`);
  }
  if(s.showSmurfRisk){
    parts.push(`<span class="fb-inline-chip fb-inline-risk fb-smurf-${r.cls}" title="${esc(r.reasons.join(", ")||"No strong indicators")}">Smurf: ${r.score}%</span>`);
  }

  row.innerHTML=parts.join("");
  card.append(row);
  card.setAttribute("data-fb-enhanced","1");
  return true;
}

function findPlayerHeadings(){
  return [...document.querySelectorAll("h1,h2,h3,h4,h5,div,span")]
    .filter(el=>norm(el.textContent)==="players" && el.getBoundingClientRect().width>0);
}

function findTeamContainerByCards(cards){
  if(!cards.length) return null;
  let cur=cards[0];
  while(cur&&cur!==document.body){
    if(cards.every(c=>cur.contains(c))) return cur;
    cur=cur.parentElement;
  }
  return null;
}

function injectTeamSummary(team,cards){
  if(!cards.length) return;
  const container=findTeamContainerByCards(cards);
  if(!container) return;

  container.querySelectorAll(".fb-team-summary-inline").forEach(e=>e.remove());

  const elos=team.players.map(x=>number(gameData(x.profile).faceit_elo)).filter(Boolean);
  const wrs=team.players.map(x=>number(lifetime(x.stats,"Win Rate %"))).filter(Boolean);
  const kds=team.players.map(x=>number(lifetime(x.stats,"Average K/D Ratio"))).filter(Boolean);
  const avgElo=elos.length?Math.round(elos.reduce((a,b)=>a+b,0)/elos.length):0;
  const avgWr=wrs.length?Math.round(wrs.reduce((a,b)=>a+b,0)/wrs.length):0;
  const avgKd=kds.length?(kds.reduce((a,b)=>a+b,0)/kds.length).toFixed(2):"—";

  const summary=document.createElement("div");
  summary.className="fb-team-summary-inline";
  summary.dataset.fbTeamName=team.name||"";
  summary.innerHTML=`<span>${esc(team.name)}</span><span><b>${avgElo||"—"} Elo</b> · ${avgWr||"—"}% WR · ${avgKd} K/D</span>`;

  const heading=[...container.querySelectorAll("h1,h2,h3,h4,h5,div,span")]
    .find(el=>norm(el.textContent)==="players");

  const firstCard=cards
    .filter(Boolean)
    .sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top)[0];

  if(firstCard && firstCard.parentElement){
    firstCard.parentElement.insertBefore(summary, firstCard);
  }else if(heading){
    const headingRow=heading.parentElement || heading;
    headingRow.insertAdjacentElement("afterend",summary);
  }else{
    container.prepend(summary);
  }

  team.avgElo=avgElo;
}

function injectEstimate(teams){
  document.querySelectorAll(".fb-match-estimate-inline").forEach(e=>e.remove());
  if(!s.showEloEstimate||!teams[0]?.avgElo||!teams[1]?.avgElo) return;

  const a=teams[0].avgElo,b=teams[1].avgElo;
  const expected=1/(1+Math.pow(10,(b-a)/400));
  const aWin=Math.max(10,Math.min(40,Math.round(50*(1-expected))));
  const aLoss=Math.max(10,Math.min(40,Math.round(50*expected)));

  const centerCandidates=[...document.querySelectorAll("button,div")].filter(el=>{
    const t=norm(el.textContent);
    return t==="back to matchmaking"||t==="watch demo"||t==="report server";
  });
  const anchor=centerCandidates[0];
  if(!anchor) return;

  let container=anchor.parentElement;
  for(let i=0;i<3&&container?.parentElement;i++){
    const r=container.getBoundingClientRect();
    if(r.width>250&&r.width<650) break;
    container=container.parentElement;
  }

  const el=document.createElement("div");
  el.className="fb-match-estimate-inline";
  el.innerHTML=`Estimated Elo:
    <span class="fb-estimate-team">${esc(teams[0].name)}</span>
    <span class="fb-elo-win">+${aWin}</span> /
    <span class="fb-elo-loss">−${aLoss}</span>
    ·
    <span class="fb-estimate-team">${esc(teams[1].name)}</span>
    <span class="fb-elo-win">+${aLoss}</span> /
    <span class="fb-elo-loss">−${aWin}</span>`;
  container?.prepend(el);
}


function clearLeaderHighlights(){
  document.querySelectorAll(".fb-own-leader,.fb-opponent-leader").forEach(el=>{
    el.classList.remove("fb-own-leader","fb-opponent-leader");
  });
}

function findNameNode(card,nickname){
  if(!card) return null;
  const target=norm(nickname);
  const nodes=[...card.querySelectorAll("span,div,a,strong,b")];
  return nodes.find(el=>{
    const t=norm(el.textContent);
    return t===target || (t.includes(target)&&el.children.length===0);
  }) || null;
}


function applyTeamBarHighlights(teams){
  document.querySelectorAll(".fb-team-summary-inline").forEach(el=>{
    el.classList.remove("fb-own-team-bar","fb-opponent-team-bar");
  });
  if(!s.highlightTeamLeaders || !s.nickname) return;

  const myNick=norm(s.nickname);
  const myTeamIndex=teams.findIndex(team =>
    team.players.some(x=>norm(x.profile?.nickname)===myNick)
  );
  if(myTeamIndex<0) return;

  teams.forEach((team,index)=>{
    const bar=[...document.querySelectorAll(".fb-team-summary-inline")]
      .find(el=>norm(el.dataset.fbTeamName)===norm(team.name));
    if(bar){
      bar.classList.add(index===myTeamIndex ? "fb-own-team-bar" : "fb-opponent-team-bar");
    }
  });
}

function applyLeaderHighlights(teams){
  clearLeaderHighlights();
  if(!s.highlightTeamLeaders || !s.nickname) return;

  const myNick=norm(s.nickname);
  const myTeamIndex=teams.findIndex(team =>
    team.players.some(x=>norm(x.profile?.nickname)===myNick)
  );
  if(myTeamIndex<0) return;

  teams.forEach((team,index)=>{
    const leader=team.players?.[0];
    if(!leader?.profile?.nickname) return;

    const card=findPlayerCard(leader.profile.nickname);
    const nameNode=findNameNode(card,leader.profile.nickname);
    if(!nameNode) return;

    nameNode.classList.add(index===myTeamIndex ? "fb-own-leader" : "fb-opponent-leader");
  });
}

async function enhance(force=false){
  const id=getMatchId();
  if(!id){toast("FACEIT Booster","Open a FACEIT matchroom first.");return}
  if(!s.enabled) return;
  if(loading) return;

  loading=true;
  const button=document.getElementById("fb-launch");
  if(button){button.classList.add("fb-working");button.textContent="Enhancing…"}
  if(force){cache.clear();cleanupInline()}

  try{
    const match=await api("GET_MATCH",id);
    const rawTeams=teamsFromMatch(match);
    if(rawTeams.length<2) throw new Error("Two complete teams were not returned yet.");

    const teams=[];
    for(const [key,t] of rawTeams){
      const members=t.roster||[];
      const cards=members.map(m=>findPlayerCard(m.nickname)).filter(Boolean);
      cards.forEach(addLoading);

      const settled=await Promise.allSettled(members.map(fetchPlayer));
      const players=settled.map((r,i)=>r.status==="fulfilled"?r.value:{
        profile:{nickname:members[i]?.nickname||"Unknown",games:{}},
        stats:null,error:r.reason?.message
      });

      const injectedCards=[];
      for(let i=0;i<members.length;i++){
        let card=findPlayerCard(members[i]?.nickname);
        if(!card){
          await sleep(250);
          card=findPlayerCard(members[i]?.nickname);
        }
        if(card&&injectPlayer(card,players[i])) injectedCards.push(card);
      }

      teams.push({name:t.name||key,players,cards:injectedCards});
    }

    teams.forEach(t=>injectTeamSummary(t,t.cards));
    injectEstimate(teams);
    applyLeaderHighlights(teams);
    applyTeamBarHighlights(teams);

    const total=teams.reduce((n,t)=>n+t.cards.length,0);
    toast("FACEIT Booster",`Enhanced ${total} player cards directly in the matchroom.`);
  }catch(e){
    toast("FACEIT Booster",e.message||String(e));
  }finally{
    loading=false;
    if(button){button.classList.remove("fb-working");button.textContent="Enhance Matchroom"}
  }
}

function visible(e){
  if(!e||e.disabled) return false;
  const r=e.getBoundingClientRect(),g=getComputedStyle(e);
  return r.width>0&&r.height>0&&g.display!=="none"&&g.visibility!=="hidden";
}

function scanAutomation(){
  if(!s.enabled) return;
  for(const e of [...document.querySelectorAll('button,[role="button"],a')].filter(visible)){
    const t=norm(e.innerText||e.getAttribute("aria-label")||e.title);
    const ctx=norm(e.closest('[role="dialog"],section,div')?.innerText);
    let type="",delay=0;
    if(s.autoReady&&(/^(accept|ready|ready up|accept match)$/.test(t)||(t.includes("accept")&&norm(document.body.innerText).includes("match is ready")))){
      type="Match ready";delay=s.readyDelay;
    }else if(s.autoParty&&/^(accept|join|accept invite|join party)$/.test(t)&&(ctx.includes("party")||ctx.includes("invite"))){
      type="Party invitation";delay=s.partyDelay;
    }
    if(type&&!scheduled.has(e)&&!clicked.has(e)){
      scheduled.add(e);
      (async()=>{
        const x=toast(type,`Accepting in ${delay} seconds.`,true);
        await sleep(Number(delay)*1000);
        if(!x.cancelled()&&visible(e)){
          clicked.add(e);e.click();x.el.remove();toast(type,"Accepted automatically.");
        }
      })();
    }
  }
}

async function route(){
  launch();
  const id=getMatchId();
  if(id&&id!==lastMatchId){
    lastMatchId=id;cache.clear();cleanupInline();
    await sleep(1400);
    if(s.autoAnalyze) enhance();
  }else if(!id){
    lastMatchId="";
    cleanupInline();
  }
}

chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(m?.type==="ANALYZE_NOW"){
    if(!isRoom()){reply({ok:false,error:"Open a FACEIT matchroom first."});return}
    enhance(true);reply({ok:true});
  }
});

chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=="sync") return;
  for(const [k,v] of Object.entries(changes)) s[k]=v.newValue;
  launch();
  if(isRoom()&&document.querySelector("[data-fb-enhanced]")) enhance(true);
});

const observer=new MutationObserver(()=>{
  scanAutomation();
  if(location.href!==lastHref){lastHref=location.href;route()}
});

(async()=>{
  s=await chrome.storage.sync.get(D);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  launch();route();scanAutomation();
  setInterval(scanAutomation,1200);
  setInterval(()=>{
    if(location.href!==lastHref){lastHref=location.href;route()}
    else launch();
  },1000);
})();
})();
