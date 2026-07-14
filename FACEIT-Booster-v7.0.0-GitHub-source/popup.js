
const DEFAULTS={enabled:true,autoAnalyze:true,showTeamElo:true,showFlags:true,showPerformance:true,showSmurfRisk:true,showEloEstimate:true,highlightTeamLeaders:true,compactMode:false,autoReady:false,autoParty:false,readyDelay:3,partyDelay:3,nickname:""};
const ids=Object.keys(DEFAULTS);let loading=true,timer=null;
function status(text,ok=true){const e=document.getElementById("status");e.textContent=text;e.className=ok?"ok":"bad"}
function collect(){const out={};for(const id of ids){const e=document.getElementById(id);if(!e)continue;out[id]=e.type==="checkbox"?e.checked:(id.endsWith("Delay")?Number(e.value):e.value.trim())}return out}
async function save(message="Saved automatically."){if(loading)return;try{await chrome.storage.sync.set(collect());status(message,true)}catch(e){status(e.message||"Save failed",false)}}
function queue(){if(loading)return;clearTimeout(timer);status("Saving…",true);timer=setTimeout(()=>save(),250)}
async function init(){const s=await chrome.storage.sync.get(DEFAULTS);for(const id of ids){const e=document.getElementById(id);if(!e)continue;e.type==="checkbox"?e.checked=!!s[id]:e.value=s[id]??""}loading=false;status("Settings are saved permanently.",true)}
for(const id of ids){const e=document.getElementById(id);if(e)e.addEventListener(e.type==="checkbox"||e.tagName==="SELECT"?"change":"input",queue)}
document.getElementById("analyze").onclick=async()=>{clearTimeout(timer);await save("Opening analyzer…");const tabs=await chrome.tabs.query({active:true,currentWindow:true});const tab=tabs[0];if(!tab?.id||!String(tab.url||"").includes("faceit.com"))return status("Open a FACEIT matchroom first.",false);chrome.tabs.sendMessage(tab.id,{type:"ANALYZE_NOW"},r=>{if(chrome.runtime.lastError)return status("Refresh FACEIT once, then try again.",false);r?.ok?status("Inline matchroom enhancement started.",true):status(r?.error||"Open a matchroom first.",false)})};
init();


const discordButton = document.getElementById("discordCredit");
if (discordButton) {
  discordButton.addEventListener("click", async () => {
    const username = "shabyyy2";
    const statusEl = document.getElementById("discordStatus");

    try {
      await navigator.clipboard.writeText(username);
      if (statusEl) statusEl.textContent = "Copied: " + username;
    } catch (_) {
      if (statusEl) statusEl.textContent = "Discord: " + username;
    }

    chrome.tabs.create({ url: "https://discord.com/app" });
  });
}
