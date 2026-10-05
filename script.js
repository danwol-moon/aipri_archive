const CONFIG={
  useGoogleSheet:true,
  spreadsheetId:"1SmwOlhhrLwNX96qV6PG7xRR-xCkoQA2Zux5spxjVQkY",
  partsSheetName:"파츠",
  songsSheetName:"악곡",
  // Google Apps Script 웹 앱 배포 후 /exec URL을 여기에 넣으세요.
  apiUrl:"https://script.google.com/macros/s/AKfycbwqpWvfG6O4Tqw32nOXj8P126q0z1iAuD9YikB4CBKX8VqNPpsQF7lh9og6kNGLmI8U/exec"
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
const PAGE_SECTION=(document.body?.dataset?.section==="songs"||location.pathname.includes("/aipri_archive_songs/"))?"songs":(document.body?.dataset?.section==="parts"||location.pathname.includes("/aipri_archive_parts/"))?"parts":"";
const s={section:PAGE_SECTION||"home",cat:"전체",status:"all",search:"",categoriesOpen:true,data:{parts:[],songs:[]}};
try{ownedMap=JSON.parse(sessionStorage.getItem(OWNED_KEY)||"{}")}catch(e){ownedMap={}};

function isHairMeshPart(i){
 return i && ["헤어 컬러","매쉬 컬러"].includes(normalizeCategory(i.category));
}
function ownershipKey(i){
 if(isHairMeshPart(i)) return "hairmesh:" + String(i.name||"").trim().toLowerCase();
 return "id:" + String(i.id||"").trim();
}
function getOwned(i){
 const direct=Object.prototype.hasOwnProperty.call(ownedMap,i.id)?!!ownedMap[i.id]:false;
 if(direct)return true;
 if(isHairMeshPart(i)){
   const key=ownershipKey(i);
   if(Object.prototype.hasOwnProperty.call(ownedMap,key))return !!ownedMap[key];
   return s.data.parts.some(x=>isHairMeshPart(x)&&ownershipKey(x)===key&&Object.prototype.hasOwnProperty.call(ownedMap,x.id)&&!!ownedMap[x.id]);
 }
 return false;
}
function setOwned(i,value){
 const related=isHairMeshPart(i)
   ? s.data.parts.filter(x=>isHairMeshPart(x)&&ownershipKey(x)===ownershipKey(i))
   : [i];
 related.forEach(x=>{
   ownedMap[x.id]=!!value;
   x.owned=!!value;
   if(codeMode) queueSaveOwnership(x.id,!!value);
 });
 if(isHairMeshPart(i)) ownedMap[ownershipKey(i)]=!!value;
 try{sessionStorage.setItem(OWNED_KEY,JSON.stringify(ownedMap))}catch(e){}
}
function apiReady(){return CONFIG.apiUrl&&/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(CONFIG.apiUrl)}

const partCats=document.getElementById("partCats");
if(partCats) partCats.innerHTML=`<button class="chip partCat allParts active" data-cat="전체">전체 파츠</button>`+CATS.map(x=>`<button class="chip partCat" data-cat="${esc(x)}">${esc(x)}</button>`).join("");

document.querySelectorAll(".partCat").forEach(b=>b.onclick=()=>{s.cat=b.dataset.cat;act(".partCat",b);render()});
document.querySelectorAll(".statusFilter").forEach(b=>b.onclick=()=>{s.status=b.dataset.status;act(".statusFilter",b);render()});
document.querySelectorAll(".songCat").forEach(b=>b.onclick=()=>{s.cat=b.dataset.cat;act(".songCat",b);syncSongMobileCategory();render()});
document.querySelectorAll(".songMobileCat").forEach(b=>b.onclick=()=>{s.cat=b.dataset.cat;act(".songMobileCat",b);act(".songCat",Array.from(document.querySelectorAll(".songCat")).find(x=>x.dataset.cat===s.cat)||null);render()});
function syncSongMobileCategory(){
 document.querySelectorAll(".songMobileCat").forEach(b=>b.classList.toggle("active",b.dataset.cat===s.cat));
}
const searchInput=document.getElementById("search");
if(searchInput) searchInput.oninput=e=>{s.search=e.target.value.toLowerCase();render()};

function act(sel,x){document.querySelectorAll(sel).forEach(b=>b.classList.toggle("active",b===x))}
function routeSection(){
  const h=String(location.hash||"").replace(/^#/,"").trim().toLowerCase();
  if(h==="parts"||h==="songs") return h;
  return null;
}
function navigateRoute(route){
  const next=route==="parts"||route==="songs"?route:"";
  const hash=next?"#"+next:"";
  const targetPath="/aipri_archive/";
  const currentRoute=routeSection()||"";
  const hasRouteRefresh=String(new URLSearchParams(location.search).get("_route_refresh")||"")==="1";

  // 해시만 변경하면 브라우저가 같은 문서를 재사용할 수 있으므로,
  // 매번 일회성 쿼리를 붙여 실제 문서 탐색을 발생시킵니다.
  if(location.pathname!==targetPath || currentRoute!==next || !hasRouteRefresh){
    const params=new URLSearchParams(location.search);
    params.set("_route_refresh","1");
    const targetUrl=targetPath+"?"+params.toString()+hash;
    window.location.assign(targetUrl);
    return false;
  }
  return true;
}

function cleanRouteRefreshParam(){
  const params=new URLSearchParams(location.search);
  if(!params.has("_route_refresh")) return;
  params.delete("_route_refresh");
  const query=params.toString();
  const cleanUrl=location.pathname+(query?"?"+query:"")+location.hash;
  history.replaceState(history.state,"",cleanUrl);
}

function goHome(){if(!navigateRoute("home")) return;document.getElementById("home").classList.remove("hidden");document.getElementById("archive").classList.add("hidden");document.querySelectorAll(".topbar nav button").forEach(b=>b.classList.remove("active"))}
let sectionLoadToken=0;
const sectionLoaded={parts:false,songs:false};

async function loadSectionData(section,token){
 if(!["parts","songs"].includes(section)) return;
 if(sectionLoaded[section]){render();return;}
 if(!CONFIG.useGoogleSheet||!CONFIG.spreadsheetId){render();return;}
 const sheetName=section==="songs"?CONFIG.songsSheetName:CONFIG.partsSheetName;
 try{
   const rows=await loadSheet(sheetName);
   if(token!==sectionLoadToken||s.section!==section)return;
   s.data=section==="songs"?{parts:[],songs:rows}:{parts:rows,songs:[]};
   sectionLoaded[section]=true;
   render();
 }catch(e){
   if(token!==sectionLoadToken||s.section!==section)return;
   console.warn(e);
   showToast("구글 시트를 불러오지 못했습니다. 시트 이름이나 Apps Script 배포 상태를 확인해주세요.");
   render();
 }
}

async function setSection(x){
 if(!navigateRoute(x)) return;
 s.section=x;s.cat="전체";s.status="all";s.search="";
 const token=++sectionLoadToken;
 const search=document.getElementById("search");if(search)search.value="";
 ["home","archive"].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.toggle("hidden",id==="home" ? x!=="home" : x==="home")});
 const partFilters=document.getElementById("partFilters");if(partFilters)partFilters.classList.toggle("hidden",x!=="parts");
 const songFilters=document.getElementById("songFilters");if(songFilters)songFilters.classList.toggle("hidden",x!=="songs");
 const partStatus=document.getElementById("partStatusFilters");if(partStatus)partStatus.classList.toggle("hidden",x!=="parts");
 const partsNav=document.getElementById("partsNav");if(partsNav)partsNav.classList.toggle("active",x==="parts");
 const songsNav=document.getElementById("songsNav");if(songsNav)songsNav.classList.toggle("active",x==="songs");
 act(".partCat",null);act(".statusFilter",document.querySelector('.statusFilter[data-status="all"]'));act(".songCat",document.querySelector('.songCat[data-cat="전체"]'));act(".songMobileCat",null);
 const songCategoryBar=document.getElementById("songCategoryBar");if(songCategoryBar)songCategoryBar.classList.toggle("hidden",x!=="songs");
 const heroEyebrow=document.getElementById("heroEyebrow");if(heroEyebrow)heroEyebrow.textContent=x==="parts"?"MY CHARACTER":"MUSIC";
 const heroTitle=document.getElementById("heroTitle");if(heroTitle)heroTitle.textContent=x==="parts"?"마이캐릭터 파츠":"악곡";
 const heroText=document.getElementById("heroText");if(heroText)heroText.textContent=x==="parts"?"파츠의 이미지와 이름, 보유 여부를 확인할 수 있어요.":"1인곡부터 4인곡까지 이미지와 제목을 확인할 수 있어요.";
 const filters=document.getElementById("filters");if(filters)filters.classList.remove("open");
 render();
 await loadSectionData(x,token);
}
function toggleFilters(){document.getElementById("filters").classList.toggle("open")}
function togglePartCategories(){s.categoriesOpen=!s.categoriesOpen;document.getElementById("partCats").classList.toggle("collapsed",!s.categoriesOpen);document.getElementById("categoryArrow").textContent=s.categoriesOpen?"⌃":"⌄";document.getElementById("partCategoryToggle").setAttribute("aria-expanded",String(s.categoriesOpen))}
function resetFilters(){s.cat="전체";s.status="all";s.search="";document.getElementById("search").value="";act(".partCat",null);act(".statusFilter",document.querySelector('.statusFilter[data-status="all"]'));act(".songCat",document.querySelector('.songCat[data-cat="전체"]'));act(".songMobileCat",null);render()}

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
function normalizeSongCategory(value){
 const v=String(value??"").trim().replace(/\s+/g," ");
 if(!v)return "";
 const m=v.match(/([1-4])\s*인/);
 if(m)return m[1]+"인곡";
 const map={"솔로":"1인곡","솔로곡":"1인곡","single":"1인곡","solo":"1인곡","듀엣":"2인곡","듀엣곡":"2인곡","duet":"2인곡","트리오":"3인곡","트리오곡":"3인곡","trio":"3인곡","quartet":"4인곡","콰르텟":"4인곡","콰르텟곡":"4인곡"};
 return map[v.toLowerCase()]||v;
}
function items(){
 return [...s.data[s.section]].filter(i=>{
   const itemCategory=s.section==="songs"?normalizeSongCategory(i.category):i.category;
   const selectedCategory=s.section==="songs"?normalizeSongCategory(s.cat):s.cat;
   const categoryMatch =
     selectedCategory==="전체" ||
     (s.section==="parts" && ["헤어 컬러","매쉬 컬러"].includes(selectedCategory) && isHairMeshColorCategory(i.category)) ||
     itemCategory===selectedCategory;
   return categoryMatch&&statusMatch(i)&&(!s.search||[i.name,itemCategory,i.description,...(i.tags||[])].join(" ").toLowerCase().includes(s.search));
 });
}
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

function render(){let a=items(),g=document.getElementById("grid");g.innerHTML="";document.getElementById("count").textContent=a.length;document.getElementById("result").textContent=s.section==="parts"?`${s.cat==="전체"?"전체 파츠":s.cat} · ${a.length}개`:`${s.cat} · ${a.length}곡`;document.getElementById("sectionHeading").textContent=s.section==="parts"?(s.cat==="전체"?"전체 파츠":s.cat):(s.cat==="전체"?"전체 악곡":s.cat);document.getElementById("empty").classList.toggle("hidden",a.length>0);a.forEach(i=>{let c=document.createElement("article");c.className="card";const isOwned=s.section==="parts"&&getOwned(i);const imageSrc=imageUrlForItem(i)||placeholder(i);const displayCategory=s.section==="songs"?normalizeSongCategory(i.category):i.category;c.innerHTML=`<div class="cardImg ${isOwned?"owned-bg":"unowned-bg"}"><img src="${esc(imageSrc)}" alt="${esc(i.name)}" loading="lazy" decoding="async"></div><div class="cardBody"><div class="cardCat">${esc(displayCategory)}</div><div class="cardTitle">${esc(i.name)}</div><div class="statusRow">${status(i)}</div><div>${cleanTags(i.tags).map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div>${ownershipControl(i)}</div>`;const cardImg=c.querySelector(".cardImg img");if(cardImg&&imageSrc&&!imageSrc.startsWith("data:")){cardImg.addEventListener("error",()=>{if(cardImg.dataset.retried!=="1"){cardImg.dataset.retried="1";cardImg.src=imageSrc+(imageSrc.includes("?")?"&":"?")+"retry="+Date.now()}else{cardImg.src=placeholder(i)}},{once:false});}c.onclick=()=>{if(s.section==="parts"&&quickSelect) toggleOwned(i.id,!getOwned(i)); else openModal(i)};g.appendChild(c)})}
function openModal(i){
 const gallery=document.getElementById("modalGallery");
 if(s.section==="parts"){
   const images=[];
   const krImage=imageUrlForPart({...i,jpImage:""});
   if(krImage)images.push({label:"한국 버전",src:krImage});
   const jpImage=parseImageValue(i.jpImage);
   if(jpImage)images.push({label:"일본 버전",src:jpImage});
   if(!images.length)images.push({label:"이미지",src:placeholder(i)});
   gallery.innerHTML=images.map(x=>`<div class="modalImagePane"><div class="modalImageLabel">${esc(x.label)}</div><img src="${esc(x.src)}" alt="${esc(i.name)} ${esc(x.label)}"></div>`).join("");
 }else{
   gallery.innerHTML=`<div class="modalImagePane single"><div class="modalImageLabel">악곡 이미지</div><img src="${esc(imageUrlForItem(i)||placeholder(i))}" alt="${esc(i.name)}"></div>`;
 }
 document.getElementById("modalCat").textContent=s.section==="songs"?normalizeSongCategory(i.category):i.category;
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
function normalizeImageUrl(value){
 let v=String(value??"").trim();
 if(!v)return "";
 // GitHub Pages는 HTTPS로 서비스되므로 한국 아이프리 이미지의
 // 오래된 HTTP 주소를 HTTPS로 통일해 Mixed Content 경고를 방지합니다.
 v=v.replace(/^http:\/\/aipri\.co\.kr\//i,"https://aipri.co.kr/");
 return v;
}
function parseImageValue(value){
 let v=String(value??"").trim();
 const m=v.match(/^=IMAGE\(\s*["']([^"']+)["']/i);
 if(m)return normalizeImageUrl(m[1]);
 return normalizeImageUrl(v);
}
function extractDriveIdInBrowser(value){
 let v=String(value??"").trim();
 let m=v.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
 if(m)return m[1];
 m=v.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
 return m?m[1]:"";
}
function normalizeSongBrowserImage(value){
 const v=String(value??"").trim();
 const id=extractDriveIdInBrowser(v);
 if(id)return "https://drive.google.com/thumbnail?id="+encodeURIComponent(id)+"&sz=w1600";
 return v;
}
function withSongCacheBust(value,id){
 let v=normalizeSongBrowserImage(value);
 if(!v||!id)return v;
 const sep=v.includes("?")?"&":"?";
 return v + sep + "aipri_song=" + encodeURIComponent(id);
}
function parseBool(value, defaultValue=false){
 const v=String(value??"").trim().toLowerCase();
 if(["true","1","yes","y","보유","실장","한국 실장","TRUE"].includes(v))return true;
 if(["false","0","no","n","미보유","미실장","한국 미실장","FALSE"].includes(v))return false;
 return defaultValue;
}
function loadSheet(name){
  // 파츠와 악곡 모두 Apps Script에서 읽습니다.
  // 악곡 이미지 하나가 잘못되어도 목록 전체는 계속 표시되도록
  // 서버 쪽에서 이미지 변환 실패를 개별 행 단위로 처리합니다.
  return new Promise((resolve,reject)=>{
    if(!apiReady()) return loadSheetGviz(name).then(resolve).catch(reject);

    const cb=`__aipriSheetApi_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const sc=document.createElement("script");
    const timer=setTimeout(()=>{
      cleanup();
      loadSheetGviz(name).then(resolve).catch(reject);
    },10000);

    function cleanup(){
      clearTimeout(timer);
      try{delete window[cb]}catch(e){}
      if(sc.parentNode)sc.parentNode.removeChild(sc);
    }

    window[cb]=(data)=>{
      cleanup();
      const returnedSheet=String(data?.sheet||"").trim();
      if(!data || !data.ok || returnedSheet!==name || !Array.isArray(data.rows)){
        loadSheetGviz(name).then(resolve).catch(reject);
        return;
      }
      const rows=data.rows.map(v=>Array.isArray(v)?v:[]);
      resolve(convertSheetRows(name,name===CONFIG.songsSheetName?rows.map(v=>v.slice(0,4)):rows));
    };

    sc.onerror=()=>{
      cleanup();
      loadSheetGviz(name).then(resolve).catch(reject);
    };

    const url=new URL(CONFIG.apiUrl);
    url.searchParams.set("action","sheet");
    url.searchParams.set("sheet",name);
    url.searchParams.set("callback",cb);
    url.searchParams.set("t",Date.now());
    sc.src=url.toString();
    document.head.appendChild(sc);
  });
}
function loadSheetGviz(name){
 return new Promise((resolve,reject)=>{
  const callbackName=`__aipriSheet_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const script=document.createElement("script");
  const timeout=setTimeout(()=>{cleanup();reject(new Error(`Google Sheets 응답 시간 초과: ${name}`));},15000);
  function cleanup(){clearTimeout(timeout);try{delete window[callbackName]}catch(e){}if(script.parentNode)script.parentNode.removeChild(script)}
  window[callbackName]=(j)=>{
    cleanup();
    try{
      if(!j||!j.table)throw new Error("Google Sheets 데이터 형식이 올바르지 않습니다.");
      const rows=(j.table.rows||[]).map(row=>(row.c||[]).map(c=>c?(c.v??""):""));
      resolve(convertSheetRows(name,name===CONFIG.songsSheetName?rows.map(v=>v.slice(0,4)):rows));
    }catch(e){reject(e)}
  };
  script.onerror=()=>{cleanup();reject(new Error(`Google Sheets를 불러오지 못했습니다: ${name}`))};
  const params=new URLSearchParams({tqx:`responseHandler:${callbackName}`,sheet:name,headers:"1",t:Date.now()});
  script.src=`https://docs.google.com/spreadsheets/d/${CONFIG.spreadsheetId}/gviz/tq?${params.toString()}`;document.head.appendChild(script);
 });
}
function normalizeCategory(value){
 const v=String(value??"").trim();
 const map={
   "헤어컬러":"헤어 컬러",
   "헤어 컬러":"헤어 컬러",
   "매쉬컬러":"매쉬 컬러",
   "메쉬컬러":"매쉬 컬러",
   "매쉬 컬러":"매쉬 컬러",
   "메쉬 컬러":"매쉬 컬러",
   "헤어/매쉬 컬러":"헤어/매쉬 컬러",
   "헤어 & 매쉬 컬러":"헤어/매쉬 컬러",
   "헤어·매쉬 컬러":"헤어/매쉬 컬러",
   "헤어·메쉬 컬러":"헤어/매쉬 컬러"
 };
 return map[v]||v;
}
function isHairMeshColorCategory(value){
 const v=normalizeCategory(value);
 return ["헤어 컬러","매쉬 컬러","헤어/매쉬 컬러"].includes(v);
}
function imageUrlForPart(i){
  if(!i || i.dataType!=="part") return "";
  const kr=parseImageValue(i.krImage);
  const jp=parseImageValue(i.jpImage);
  return kr||jp||"";
}
function imageUrlForSong(i){
  if(!i || i.dataType!=="song") return "";
  return parseImageValue(i.songImage);
}
function imageUrlForItem(i){
  return s.section==="songs" ? imageUrlForSong(i) : imageUrlForPart(i);
}
function parseKoreaReleased(value){
 const v=String(value??"").trim().toLowerCase();
 return ["true","1","yes","y","실장","한국 실장"].includes(v);
}
function convertSheetRows(name,rows){
  if(!Array.isArray(rows)||!rows.length)return [];
  rows=rows.map(v=>Array.isArray(v)?v:[]);
  const first=rows[0].map(v=>String(v??"").trim().toLowerCase());
  if(first.some(v=>["id","카테고리","category","이름","name"].includes(v)))rows.shift();
  rows=rows.filter(v=>validId(v[0]));

  if(name===CONFIG.songsSheetName){
    return rows.map(v=>({
      dataType:"song",
      id:String(v[0]??"").trim(),
      category:normalizeSongCategory(v[1]),
      name:String(v[2]??"").trim(),
      songImage:withSongCacheBust(parseImageValue(v[3]),String(v[0]??"").trim()),
      description:"",
      tags:[]
    }));
  }

  return rows.map(v=>({
    dataType:"part",
    id:String(v[0]??"").trim(),
    category:normalizeCategory(v[1]),
    name:String(v[2]??"").trim(),
    krImage:parseImageValue(v[3]),
    jpImage:parseImageValue(v[4]),
    description:"",
    tags:[],
    owned:parseBool(v[5],false),
    krReleased:parseKoreaReleased(v[6])
  }));
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
 const ownedHairMeshNames=new Set();
 s.data.parts.forEach(i=>{
   if(isHairMeshPart(i)&&ownedMap[i.id]) ownedHairMeshNames.add(ownershipKey(i));
 });
 s.data.parts.forEach(i=>{
   if(isHairMeshPart(i)&&ownedHairMeshNames.has(ownershipKey(i))){
     ownedMap[i.id]=true;
     ownedMap[ownershipKey(i)]=true;
   }
   i.owned=getOwned(i);
 });
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
   if(btn) btn.textContent=activeUserName?`${activeUserName}님`:"CODE"; const logout=document.getElementById("logoutButton"); if(logout) logout.classList.toggle("hidden",!activeUserName);
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
 activeCode="";activeUserName="";codeMode=false;const btn=document.getElementById("codeButton");if(btn)btn.textContent="CODE";const logout=document.getElementById("logoutButton");if(logout)logout.classList.add("hidden");clearOwnership();showToast("개인 코드 연결을 종료했습니다. 현재 기기에서는 임시 보유 상태로 사용할 수 있어요.");render();
}

window.addEventListener("popstate",()=>{const r=routeSection(); if(r) setSection(r); else goHome();});
window.addEventListener("hashchange",()=>{const r=routeSection(); if(r) setSection(r); else goHome();});

async function init(){
  ensureQuickSelectButton();
  ensureSaveFrame();
  cleanRouteRefreshParam();

  const initialRoute=routeSection();
  if(PAGE_SECTION==="songs"||PAGE_SECTION==="parts") s.section=PAGE_SECTION;
  else if(initialRoute) s.section=initialRoute;
  else s.section="home";

  if(s.section==="home"){
    goHome();
    return;
  }

  await setSection(s.section);
}
init();
