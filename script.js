const CONFIG={
  useGoogleSheet:true,
  spreadsheetId:"1SmwOlhhrLwNX96qV6PG7xRR-xCkoQA2Zux5spxjVQkY",
  partsSheetName:"파츠",
  songsSheetName:"악곡",
  // Google Apps Script 웹 앱 배포 후 /exec URL을 여기에 넣으세요.
  apiUrl:"https://script.google.com/macros/s/AKfycbzr9dZbz1CF_g1Dy6UdEjlW00nDo1j599-X02XA-_i9QPYvYCTRYrB6RNdLbw_Zch6D/exec"
};
const CATS=["얼굴 타입","보이스","스킨 컬러","앞머리","뒷머리","헤어 컬러","아이 컬러","매쉬 타입","매쉬 컬러","헤어 데코","메이크업","원 포인트","브레스","팩트"];
const DATA={parts:CATS.map((category,i)=>({id:"P"+String(i+1).padStart(3,"0"),category,name:["오토메","이키이키","스킨 컬러 샘플","드리밍 뱅","키ュ티 트윈","문 블루","프리티 마린","그라데","라벤더","스타 데코","문라이트 메이크업","오버핏 안경","미오 모델","프린세스 팩트"][i],image:"",krImage:"",jpImage:"",description:"샘플 데이터입니다. 실제 파츠 정보로 바꿔주세요.",tags:[category],owned:i%3!==1,krReleased:i!==7&&i!==12})),songs:[
{id:"S001",category:"1인곡",name:"Moonlight Dream",image:"",description:"1인곡 샘플",tags:["솔로"]},
{id:"S002",category:"2인곡",name:"Twinkle Pair",image:"",description:"2인곡 샘플",tags:["듀엣"]},
{id:"S003",category:"3인곡",name:"Dream Trio",image:"",description:"3인곡 샘플",tags:["3인"]},
{id:"S004",category:"4인곡",name:"AIPRI☆STAR",image:"",description:"4인곡 샘플",tags:["4인"]}]};

const OWNED_KEY="aipri_archive_guest_owned_v3";
let ownedMap={};
let activeCode="";
let activeUserName="";
let codeMode=false;
let quickSelect=false;
const s={section:"parts",cat:"전체",status:"all",search:"",sort:"default",categoriesOpen:true,data:{parts:[],songs:[]}};
try{ownedMap=JSON.parse(sessionStorage.getItem(OWNED_KEY)||"{}")}catch(e){ownedMap={}};

function getOwned(i){return Object.prototype.hasOwnProperty.call(ownedMap,i.id)?!!ownedMap[i.id]:false}
function setOwned(i,value){ownedMap[i.id]=!!value;try{sessionStorage.setItem(OWNED_KEY,JSON.stringify(ownedMap))}catch(e){};i.owned=!!value; if(codeMode) queueSaveOwnership(i.id,!!value)}
function apiReady(){return CONFIG.apiUrl&&/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(CONFIG.apiUrl)}

const partCats=document.getElementById("partCats");
partCats.innerHTML=`<button class="chip partCat allParts active" data-cat="전체">전체 파츠</button>`+CATS.map(x=>`<button class="chip partCat" data-cat="${esc(x)}">${esc(x)}</button>`).join("");

document.querySelectorAll(".partCat").forEach(b=>b.onclick=()=>{s.cat=b.dataset.cat;act(".partCat",b);render()});
document.querySelectorAll(".statusFilter").forEach(b=>b.onclick=()=>{s.status=b.dataset.status;act(".statusFilter",b);render()});
document.querySelectorAll(".songCat").forEach(b=>b.onclick=()=>{s.cat=b.dataset.cat;act(".songCat",b);render()});
document.getElementById("search").oninput=e=>{s.search=e.target.value.toLowerCase();render()};
document.getElementById("sort").onchange=e=>{s.sort=e.target.value;render()};

function act(sel,x){document.querySelectorAll(sel).forEach(b=>b.classList.toggle("active",b===x))}
function routeSection(){
  const h=String(location.hash||"").replace(/^#/,"").trim().toLowerCase();
  if(h==="parts"||h==="songs") return h;
  return null;
}
function navigateRoute(route){
  const next=route==="parts"||route==="songs"?route:"";
  const hash=next?`#${next}`:"";
  if(location.hash!==hash){ history.pushState({section:next||"home"},"",location.pathname+location.search+hash); }
}

function goHome(){navigateRoute("home");document.getElementById("home").classList.remove("hidden");document.getElementById("archive").classList.add("hidden");document.querySelectorAll(".topbar nav button").forEach(b=>b.classList.remove("active"))}
function setSection(x){navigateRoute(x);s.section=x;s.cat="전체";s.status="all";s.search="";document.getElementById("search").value="";document.getElementById("home").classList.add("hidden");document.getElementById("archive").classList.remove("hidden");document.getElementById("partFilters").classList.toggle("hidden",x!=="parts");document.getElementById("songFilters").classList.toggle("hidden",x!=="songs");document.getElementById("partStatusFilters").classList.toggle("hidden",x!=="parts");document.getElementById("partsNav").classList.toggle("active",x==="parts");document.getElementById("songsNav").classList.toggle("active",x==="songs");act(".partCat",null);act(".statusFilter",document.querySelector('.statusFilter[data-status="all"]'));act(".songCat",document.querySelector('.songCat[data-cat="전체"]'));document.getElementById("heroEyebrow").textContent=x==="parts"?"MY CHARACTER":"MUSIC";document.getElementById("heroTitle").textContent=x==="parts"?"마이캐릭터 파츠":"악곡";document.getElementById("heroText").textContent=x==="parts"?"파츠의 이미지와 이름, 보유 여부를 확인할 수 있어요.":"1인곡부터 4인곡까지 이미지와 제목을 확인할 수 있어요.";document.getElementById("filters").classList.remove("open");render()}
function toggleFilters(){document.getElementById("filters").classList.toggle("open")}
function togglePartCategories(){s.categoriesOpen=!s.categoriesOpen;document.getElementById("partCats").classList.toggle("collapsed",!s.categoriesOpen);document.getElementById("categoryArrow").textContent=s.categoriesOpen?"⌃":"⌄";document.getElementById("partCategoryToggle").setAttribute("aria-expanded",String(s.categoriesOpen))}
function resetFilters(){s.cat="전체";s.status="all";s.search="";document.getElementById("search").value="";act(".partCat",null);act(".statusFilter",document.querySelector('.statusFilter[data-status="all"]'));act(".songCat",document.querySelector('.songCat[data-cat="전체"]'));render()}

function cleanTags(value){
 const raw=Array.isArray(value)?value:[value];
 return raw.flatMap(x=>String(x??"").split(",")).map(x=>x.trim()).filter(x=>x && !/^(true|false)$/i.test(x));
}
function validId(id){return String(id??"").trim()!==""}

function statusMatch(i){
 if(s.section!=="parts"||s.status==="all")return true;
 if(s.status==="owned")return getOwned(i);
 if(s.status==="unowned")return !getOwned(i);
 if(s.status==="krReleased")return !!i.krReleased;
 if(s.status==="krUnreleased")return !i.krReleased;
 return true;
}
function items(){let a=[...s.data[s.section]].filter(i=>(s.cat==="전체"||i.category===s.cat)&&statusMatch(i)&&(!s.search||[i.name,i.category,i.description,...(i.tags||[])].join(" ").toLowerCase().includes(s.search)));if(s.sort==="name")a.sort((x,y)=>x.name.localeCompare(y.name,"ko"));if(s.sort==="category")a.sort((x,y)=>x.category.localeCompare(y.category,"ko"));return a}
function placeholder(i){let a=s.section==="songs"?["#f4b9d2","#a9c9e9"]:["#f5c7d9","#9fc9e9"];return"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><linearGradient id="g"><stop stop-color="${a[0]}"/><stop offset="1" stop-color="${a[1]}"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><circle cx="300" cy="250" r="120" fill="white" opacity=".35"/><text x="300" y="450" text-anchor="middle" font-family="Arial" font-size="28" fill="white">${i.category}</text><text x="300" y="490" text-anchor="middle" font-family="Arial" font-size="20" fill="white">${i.name}</text></svg>`)}
function status(i){if(s.section!=="parts")return"";let owned=getOwned(i);return `<span class="status ${owned?"owned":"unowned"}">${owned?"✓ 보유":"미보유"}</span><span class="status ${i.krReleased?"krreleased":"unreleased"}">${i.krReleased?"한국 실장":"한국 미실장"}</span>`}
function ownershipControl(i){if(s.section!=="parts")return"";let owned=getOwned(i);return `<label class="ownedCheck" onclick="event.stopPropagation()"><input type="checkbox" ${owned?"checked":""} onchange="toggleOwned('${esc(i.id)}',this.checked)"><span>보유</span></label>`}
function showToast(message){
 const el=document.getElementById("toast");
 if(!el)return;
 clearTimeout(window.__toastFadeTimer);
 clearTimeout(window.__toastHideTimer);
 el.textContent=message;
 el.classList.remove("hidden","fade-out");
 // 약 5초간 표시한 뒤 천천히 흐려집니다.
 window.__toastFadeTimer=setTimeout(()=>el.classList.add("fade-out"),5000);
 window.__toastHideTimer=setTimeout(()=>{el.classList.add("hidden");el.classList.remove("fade-out")},6500);
}
function canCheckOwned(i,value){
 if(!value || !["얼굴 타입","보이스"].includes(i.category))return true;
 return !s.data.parts.some(x=>x.id!==i.id && x.category===i.category && getOwned(x));
}
function toggleOwned(id,value){
 let i=s.data.parts.find(x=>x.id===id);
 if(!i)return;
 if(value && !canCheckOwned(i,value)){
   showToast("얼굴 타입 및 보이스는 1개만 선택할 수 있습니다. 체크 되어 있는 체크 박스 해제 후 다시 시도해주세요.");
   render();
   return;
 }
 setOwned(i,value);render();
}

function toggleQuickSelect(){
 quickSelect=!quickSelect;
 const b=document.getElementById("quickSelectButton");
 if(b){b.classList.toggle("active",quickSelect);b.textContent=quickSelect?"✓ 빠른 선택":"» 빠른 선택 «";}
 document.body.classList.toggle("quick-select-mode",quickSelect);
}
function ensureQuickSelectButton(){
 const bar=document.getElementById("partStatusFilters");
 if(!bar || document.getElementById("quickSelectButton")) return;
 const b=document.createElement("button"); b.id="quickSelectButton"; b.className="quickSelectButton"; b.type="button"; b.textContent="» 빠른 선택 «"; b.onclick=toggleQuickSelect; b.title="파츠 이미지나 이름을 눌러 보유/미보유를 바로 전환합니다."; bar.appendChild(b);
}

function render(){let a=items(),g=document.getElementById("grid");g.innerHTML="";document.getElementById("count").textContent=a.length;document.getElementById("result").textContent=s.section==="parts"?`${s.cat==="전체"?"전체 파츠":s.cat} · ${a.length}개`:`${s.cat} · ${a.length}곡`;document.getElementById("sectionHeading").textContent=s.section==="parts"?(s.cat==="전체"?"전체 파츠":s.cat):(s.cat==="전체"?"전체 악곡":s.cat);document.getElementById("empty").classList.toggle("hidden",a.length>0);a.forEach(i=>{let c=document.createElement("article");c.className="card";const isOwned=s.section==="parts"&&getOwned(i);c.innerHTML=`<div class="cardImg ${isOwned?"owned-bg":"unowned-bg"}"><img src="${esc(i.krImage||i.jpImage||i.image||placeholder(i))}" alt="${esc(i.name)}"></div><div class="cardBody"><div class="cardCat">${esc(i.category)}</div><div class="cardTitle">${esc(i.name)}</div><div class="statusRow">${status(i)}</div><div>${cleanTags(i.tags).map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div>${ownershipControl(i)}</div>`;c.onclick=()=>{if(s.section==="parts"&&quickSelect) toggleOwned(i.id,!getOwned(i)); else openModal(i)};g.appendChild(c)})}
function openModal(i){
 const gallery=document.getElementById("modalGallery");
 if(s.section==="parts"){
   const images=[];
   if(i.krImage||i.image)images.push({label:"한국 버전",src:i.krImage||i.image});
   if(i.jpImage)images.push({label:"일본 버전",src:i.jpImage});
   if(!images.length)images.push({label:"이미지",src:placeholder(i)});
   gallery.innerHTML=images.map(x=>`<div class="modalImagePane"><div class="modalImageLabel">${esc(x.label)}</div><img src="${esc(x.src)}" alt="${esc(i.name)} ${esc(x.label)}"></div>`).join("");
 }else{
   gallery.innerHTML=`<div class="modalImagePane single"><div class="modalImageLabel">악곡 이미지</div><img src="${esc(i.image||placeholder(i))}" alt="${esc(i.name)}"></div>`;
 }
 document.getElementById("modalCat").textContent=i.category;
 document.getElementById("modalTitle").textContent=i.name;
 document.getElementById("modalDesc").textContent=i.description||"";
 document.getElementById("modalStatus").innerHTML=status(i);
 document.getElementById("modalTags").innerHTML=cleanTags(i.tags).map(t=>`<span class="tag">${esc(t)}</span>`).join("");
 document.getElementById("modalActions").innerHTML=s.section==="parts"?`<label class="modalOwned"><input type="checkbox" ${getOwned(i)?"checked":""} onchange="toggleOwnedModal('${esc(i.id)}',this.checked)"><span>이 파츠를 보유 중으로 표시</span></label>`:"";
 document.getElementById("modal").classList.remove("hidden");
}
function toggleOwnedModal(id,value){
 let i=s.data.parts.find(x=>x.id===id);
 if(!i)return;
 if(value && !canCheckOwned(i,value)){
   showToast("얼굴 타입 및 보이스는 1개만 선택할 수 있습니다. 체크 되어 있는 체크 박스 해제 후 다시 시도해주세요.");
   openModal(i);
   return;
 }
 setOwned(i,value);openModal(i);render()
}
function closeModal(){document.getElementById("modal").classList.add("hidden")}
function esc(x){return String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function parseImageValue(value){
 let v=String(value??"").trim();
 const m=v.match(/^=IMAGE\(\s*["']([^"']+)["']/i);
 if(m)return m[1];
 return v;
}
function parseBool(value, defaultValue=false){
 const v=String(value??"").trim().toLowerCase();
 if(["true","1","yes","y","보유","실장","한국 실장"].includes(v))return true;
 if(["false","0","no","n","미보유","미실장","한국 미실장"].includes(v))return false;
 return defaultValue;
}
function loadSheet(name){
  // Apps Script를 우선 사용해 Google Sheets의 최신 값을 직접 읽습니다.
  // 실패하면 기존 GViz 방식으로 한 번 더 시도합니다.
  return new Promise((resolve,reject)=>{
    if(apiReady()){
      const cb=`__aipriSheetApi_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const sc=document.createElement("script");
      const timer=setTimeout(()=>{cleanup();loadSheetGviz(name).then(resolve).catch(reject)},10000);
      function cleanup(){clearTimeout(timer);try{delete window[cb]}catch(e){}if(sc.parentNode)sc.parentNode.removeChild(sc)}
      window[cb]=(data)=>{cleanup();if(data&&data.ok&&Array.isArray(data.rows))resolve(convertSheetRows(name,data.rows));else loadSheetGviz(name).then(resolve).catch(reject)};
      sc.onerror=()=>{cleanup();loadSheetGviz(name).then(resolve).catch(reject)};
      const url=new URL(CONFIG.apiUrl);url.searchParams.set("action","sheet");url.searchParams.set("sheet",name);url.searchParams.set("callback",cb);url.searchParams.set("t",Date.now());
      sc.src=url.toString();document.head.appendChild(sc);
      return;
    }
    loadSheetGviz(name).then(resolve).catch(reject);
  });
}
function loadSheetGviz(name){
 return new Promise((resolve,reject)=>{
  const callbackName=`__aipriSheet_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const script=document.createElement("script");
  const timeout=setTimeout(()=>{cleanup();reject(new Error(`Google Sheets 응답 시간 초과: ${name}`));},15000);
  function cleanup(){clearTimeout(timeout);try{delete window[callbackName]}catch(e){}if(script.parentNode)script.parentNode.removeChild(script)}
  window[callbackName]=(j)=>{cleanup();try{if(!j||!j.table)throw new Error("Google Sheets 데이터 형식이 올바르지 않습니다.");const rows=(j.table.rows||[]).map(row=>(row.c||[]).map(c=>c?(c.v??""):""));resolve(convertSheetRows(name,rows))}catch(e){reject(e)}};
  script.onerror=()=>{cleanup();reject(new Error(`Google Sheets를 불러오지 못했습니다: ${name}`))};
  const params=new URLSearchParams({tqx:`responseHandler:${callbackName}`,sheet:name,headers:"1",t:Date.now()});
  script.src=`https://docs.google.com/spreadsheets/d/${CONFIG.spreadsheetId}/gviz/tq?${params.toString()}`;document.head.appendChild(script);
 });
}
function convertSheetRows(name,rows){
  if(!rows.length)return [];
  rows=rows.map(v=>Array.isArray(v)?v:[]);
  const first=rows[0].map(v=>String(v??"").trim().toLowerCase());
  if(first.some(v=>["id","카테고리","category","이름","name"].includes(v)))rows.shift();
  // A열(ID)이 비어 있는 행은 어떤 내용이 남아 있어도 사이트에 표시하지 않습니다.
  rows=rows.filter(v=>validId(v[0]));
  if(name===CONFIG.songsSheetName){
    return rows.map(v=>({id:String(v[0]??"").trim(),category:String(v[1]??"").trim(),name:String(v[2]??"").trim(),image:parseImageValue(v[3]),description:String(v[4]??"").trim(),tags:cleanTags(v[5])}));
  }
  return rows.map(v=>({id:String(v[0]??"").trim(),category:String(v[1]??"").trim(),name:String(v[2]??"").trim(),image:parseImageValue(v[3]),krImage:parseImageValue(v[3]),jpImage:parseImageValue(v[4]),description:String(v[5]??"").trim(),tags:cleanTags(v[6]),owned:false,krReleased:parseBool(v[8],false)}));
}

let saveTimer=null;
function openCodeModal(){
 const modal=document.getElementById("codeModal"); if(!modal)return;
 document.getElementById("codeInput").value=activeCode;
 document.getElementById("codeState").textContent=activeCode?(activeUserName?`${activeUserName}님으로 연결됨`:`현재 코드: ${activeCode}`):"";
 modal.classList.remove("hidden"); setTimeout(()=>document.getElementById("codeInput").focus(),50);
}
function closeCodeModal(){document.getElementById("codeModal").classList.add("hidden")}
function codeState(message,error=false){const el=document.getElementById("codeState");if(el){el.textContent=message;el.classList.toggle("error",error)}}
function clearOwnership(){ownedMap={};try{sessionStorage.removeItem(OWNED_KEY)}catch(e){};s.data.parts.forEach(i=>i.owned=false)}
function applyOwnershipMap(map){
 ownedMap={};
 Object.keys(map||{}).forEach(id=>ownedMap[id]=!!map[id]);
 s.data.parts.forEach(i=>i.owned=!!ownedMap[i.id]);
 try{sessionStorage.setItem(OWNED_KEY,JSON.stringify(ownedMap))}catch(e){}
}
function loadUserOwnership(code){
 return new Promise((resolve,reject)=>{
   if(!apiReady()) return reject(new Error("Apps Script 웹 앱 URL이 설정되지 않았습니다."));
   const cb=`__aipriUser_${Date.now()}_${Math.random().toString(36).slice(2)}`;
   const sc=document.createElement("script");
   const timer=setTimeout(()=>{cleanup();reject(new Error("개인 보유 데이터를 불러오는 데 시간이 걸리고 있습니다."))},15000);
   function cleanup(){clearTimeout(timer);try{delete window[cb]}catch(e){}sc.remove()}
   window[cb]=(data)=>{cleanup(); if(data&&data.ok) resolve(data); else reject(new Error(data&&data.message||"코드를 확인해주세요."))};
   sc.onerror=()=>{cleanup();reject(new Error("개인 코드 서버에 연결하지 못했습니다."))};
   const url=new URL(CONFIG.apiUrl); url.searchParams.set("action","load");url.searchParams.set("code",code);url.searchParams.set("callback",cb);url.searchParams.set("t",Date.now());
   sc.src=url.toString();document.head.appendChild(sc);
 });
}
function submitCode(){
 const input=document.getElementById("codeInput"); const code=String(input?.value||"").trim();
 if(!code){codeState("개인 코드를 입력해주세요.",true);return}
 if(!apiReady()){codeState("아직 서버 주소가 연결되지 않았어요. Apps Script 웹 앱 URL을 설정한 뒤 사용할 수 있습니다.",true);return}
 codeState("코드를 확인하고 보유 데이터를 불러오는 중…");
 loadUserOwnership(code).then(data=>{
   activeCode=code;activeUserName=String(data.name||"").trim();codeMode=true;applyOwnershipMap(data.owned||{});
   const btn=document.getElementById("codeButton");
   if(btn) btn.textContent=activeUserName?`${activeUserName}님`:"CODE";
   closeCodeModal();showToast(`${activeUserName?activeUserName+"님의 ":""}개인 보유 데이터가 불러와졌습니다.`);render();
 }).catch(err=>codeState(err.message||"코드를 확인해주세요.",true));
}
function queueSaveOwnership(id,value){
 if(!codeMode||!activeCode||!apiReady())return;
 clearTimeout(saveTimer);
 saveTimer=setTimeout(()=>postOwnership(activeCode,id,value),180);
}
function postOwnership(code,id,value){
 const form=document.createElement("form"); form.method="POST";form.action=CONFIG.apiUrl;form.target="aipriSaveFrame";form.style.display="none";
 [["action","save"],["code",code],["partId",id],["owned",value?"true":"false"]].forEach(([k,v])=>{const x=document.createElement("input");x.name=k;x.value=v;form.appendChild(x)});
 document.body.appendChild(form);form.submit();setTimeout(()=>form.remove(),1500);
}
function ensureSaveFrame(){if(document.getElementById("aipriSaveFrame"))return;const f=document.createElement("iframe");f.name="aipriSaveFrame";f.id="aipriSaveFrame";f.style.display="none";document.body.appendChild(f)}
function logoutCode(){
 activeCode="";activeUserName="";codeMode=false;const btn=document.getElementById("codeButton");if(btn)btn.textContent="CODE";clearOwnership();showToast("개인 코드 연결을 종료했습니다. 현재 기기에서는 임시 보유 상태로 사용할 수 있어요.");render();
}

window.addEventListener("popstate",()=>{const r=routeSection(); if(r) setSection(r); else goHome();});

async function init(){
 ensureQuickSelectButton();
 ensureSaveFrame();
 if(CONFIG.useGoogleSheet&&CONFIG.spreadsheetId){
   try{
     const [parts,songs]=await Promise.all([loadSheet(CONFIG.partsSheetName),loadSheet(CONFIG.songsSheetName)]);
     s.data={parts,songs};
   }catch(e){
     console.warn(e);
     showToast("구글 시트를 불러오지 못했습니다. 시트 공유 설정과 시트 이름을 확인해주세요.");
   }
 }
 render();
}
const initialRoute=routeSection();
if(initialRoute){setSection(initialRoute);}else{goHome();}
init();
