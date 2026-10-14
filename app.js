/*
 * HQ BÁ KHÍ LIVE CONTROL
 * Configure API_BASE_URL to the deployed Cloudflare Worker.
 * The public LIVE directory is loaded from live-links.json unless LIVE_API_URL is configured.
 */
const CONFIG = {
  API_BASE_URL: "https://YOUR-WORKER.your-subdomain.workers.dev",
  LIVE_API_URL: "", // Optional trusted public JSON endpoint; must return an array or {items:[...]}.
  REFRESH_MS: 15000 // Directory refresh interval. Real per-second metrics require a live data source.
};
const $ = id => document.getElementById(id);
let accessKey = sessionStorage.getItem("hq_access_key") || "";
let deviceId = sessionStorage.getItem("hq_device_id") || "";
let liveItems = [];
function makeDeviceId(){const a=new Uint8Array(16);crypto.getRandomValues(a);return "HQD-"+Array.from(a,x=>x.toString(16).padStart(2,"0")).join("").toUpperCase()}
if(!deviceId){deviceId=makeDeviceId();sessionStorage.setItem("hq_device_id",deviceId)}
$("deviceInput").value=deviceId;
function message(text,type=""){$("gateMessage").textContent=text;$("gateMessage").className="message "+type}
function apiConfigured(){return CONFIG.API_BASE_URL&&!CONFIG.API_BASE_URL.includes("YOUR-WORKER")}
async function api(path,payload){if(!apiConfigured())throw Error("Backend chưa cấu hình. Hãy đặt API_BASE_URL trong app.js.");const r=await fetch(CONFIG.API_BASE_URL.replace(/\/$/,"")+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw Error(d.error||"Yêu cầu thất bại.");return d}
async function activate(key){const d=await api("/api/activate",{key,deviceId});return d}
function showDashboard(){ $("gate").classList.add("hidden");$("dashboard").classList.remove("hidden");$("logoutBtn").classList.remove("hidden");loadLives(); }
$("keyForm").addEventListener("submit",async e=>{e.preventDefault();const b=$("activateBtn");b.disabled=true;message("Đang kiểm tra KEY với máy chủ…");try{const k=$("keyInput").value.trim();await activate(k);accessKey=k;sessionStorage.setItem("hq_access_key",k);message("KEY hợp lệ. Đang mở dashboard…","ok");showDashboard()}catch(err){message(err.message,"error")}finally{b.disabled=false}});
$("copyDevice").onclick=async()=>{try{await navigator.clipboard.writeText(deviceId);$("copyDevice").textContent="ĐÃ COPY";setTimeout(()=>$("copyDevice").textContent="COPY",1200)}catch{message("Không thể sao chép Device ID tự động.")}};
$("logoutBtn").onclick=()=>{sessionStorage.removeItem("hq_access_key");accessKey="";location.reload()};
$("refreshBtn").onclick=()=>loadLives(true);$("searchInput").oninput=renderLives;$("sourceSelect").onchange=renderLives;
function validHttpUrl(s){try{const u=new URL(s);return u.protocol==="https:"||u.protocol==="http:"}catch{return false}}
async function loadLives(showToast=false){
 $("refreshState").textContent="Đang tải…";
 try{
   let data;
   if(CONFIG.LIVE_API_URL){const r=await fetch(CONFIG.LIVE_API_URL,{cache:"no-store"});if(!r.ok)throw Error("Nguồn LIVE trả về lỗi HTTP "+r.status);data=await r.json()}
   else {const r=await fetch("live-links.json?t="+Date.now(),{cache:"no-store"});if(!r.ok)throw Error("Chưa có file live-links.json");data=await r.json()}
   liveItems=Array.isArray(data)?data:(Array.isArray(data.items)?data.items:[]);
   liveItems=liveItems.filter(x=>x&&typeof x.url==="string"&&validHttpUrl(x.url)).map((x,i)=>({id:String(x.id||i),name:String(x.name||"LIVE "+(i+1)),url:x.url,source:String(x.source||"Nguồn công khai"),status:String(x.status||"Link được cung cấp"),chest:finiteOrNull(x.chest),bag:finiteOrNull(x.bag),updatedAt:x.updatedAt||null}));
   $("connectionLabel").textContent="DỮ LIỆU ĐÃ TẢI";$("connectionLabel").style.color="var(--green)";
   $("updatedAt").textContent=new Date().toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
   $("refreshState").textContent="Tải thành công";
   const counts=liveItems.filter(x=>x.chest!==null||x.bag!==null);
   $("lootCount").textContent=counts.length?counts.length:"—";
   $("lootHint").textContent=counts.length?"LIVE có số liệu rương/túi":"Nguồn chưa cung cấp số liệu rương/túi";
   if(showToast) $("refreshState").textContent="Đã làm mới";
 }catch(err){
   liveItems=[];$("connectionLabel").textContent="CHƯA CÓ NGUỒN LIVE";$("connectionLabel").style.color="var(--orange)";
   $("updatedAt").textContent="—";$("refreshState").textContent="Chưa tải được dữ liệu";$("lootCount").textContent="—";$("lootHint").textContent="Nguồn chưa cung cấp số liệu";
 }
 $("linkCount").textContent=liveItems.length;renderLives();
}
function finiteOrNull(v){return Number.isFinite(Number(v))&&v!==null&&v!==""?Number(v):null}
function renderLives(){
 const q=$("searchInput").value.trim().toLowerCase();const list=liveItems.filter(x=>!q||(x.name+" "+x.url+" "+x.source).toLowerCase().includes(q));
 $("visibleCount").textContent=list.length;
 const root=$("liveList");root.replaceChildren();
 if(!list.length){const empty=document.createElement("div");empty.className="empty panel";empty.textContent=liveItems.length?"Không tìm thấy LIVE phù hợp.":"Chưa có nguồn LIVE được cấu hình. Hãy thêm link công khai trong live-links.json.";root.append(empty);return}
 for(const item of list){
   const card=document.createElement("article");card.className="live-card";
   const top=document.createElement("div");top.className="live-card-top";
   const name=document.createElement("div");name.className="live-name";name.textContent=item.name;
   const state=document.createElement("span");state.className="live-state";state.textContent=item.status;
   top.append(name,state);card.append(top);
   const url=document.createElement("div");url.className="live-url";url.textContent=item.url;card.append(url);
   const meta=document.createElement("div");meta.className="card-meta";
   for(const [label,value] of [["RƯƠNG",item.chest===null?"Chưa có dữ liệu":item.chest],["TÚI",item.bag===null?"Chưa có dữ liệu":item.bag]]){
     const box=document.createElement("div");box.className="meta-box";const small=document.createElement("small");small.textContent=label;const b=document.createElement("b");b.textContent=String(value);box.append(small,b);meta.append(box)
   }card.append(meta);
   const actions=document.createElement("div");actions.className="card-actions";const a=document.createElement("a");a.className="open-live";a.href=item.url;a.target="_blank";a.rel="noopener noreferrer";a.textContent="MỞ LIVE ↗";const copy=document.createElement("button");copy.className="copy-link";copy.textContent="SAO CHÉP LINK";copy.onclick=async()=>{try{await navigator.clipboard.writeText(item.url);copy.textContent="ĐÃ COPY";setTimeout(()=>copy.textContent="SAO CHÉP LINK",1200)}catch{copy.textContent="KHÔNG COPY ĐƯỢC"}};actions.append(a,copy);card.append(actions);root.append(card);
 }
}
setInterval(()=>{if(!$("dashboard").classList.contains("hidden"))loadLives()},CONFIG.REFRESH_MS);
// Do not bypass the KEY gate on reload; ask the server to revalidate saved key first.
if(accessKey&&apiConfigured()){activate(accessKey).then(()=>showDashboard()).catch(()=>{sessionStorage.removeItem("hq_access_key");accessKey=""})}
