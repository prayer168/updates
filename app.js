
const cfg = window.SUPABASE_CONFIG;
const data = window.CHECKLIST_DATA;
const state = { items: {} };
let client;

const labels = {done:"完成",doing:"進行中",todo:"未完成",na:"不適用"};

function validConfig(){
  return cfg && cfg.url && cfg.anonKey &&
    !cfg.url.includes("請填入") && !cfg.anonKey.includes("請填入");
}
function allItems(){ return data.sections.flatMap(s=>s.items); }
function showMessage(t){
  const el=document.querySelector("#message"); el.textContent=t; el.classList.remove("hidden");
}
function setSync(t){ document.querySelector("#syncStatus").textContent=t; }
function pClass(v){ return v==="高"?"high":v==="中"?"mid":"low"; }

function render(){
  const root=document.querySelector("#checklist");
  root.innerHTML="";
  data.sections.forEach(section=>{
    const sec=document.createElement("section");
    sec.className="check-section";
    const h=document.createElement("h2");
    h.textContent=section.title;
    sec.appendChild(h);

    const table=document.createElement("table");
    table.className="check-table";
    table.innerHTML=`<thead><tr>
      <th class="col-priority">優先</th>
      <th class="col-status">完成</th>
      <th class="col-status">進行中</th>
      <th class="col-status">未完成</th>
      <th class="col-status">不適用</th>
      <th class="col-item">檢核項目</th>
      <th class="col-note">驗收標準／備註</th>
    </tr></thead><tbody></tbody>`;
    const tbody=table.querySelector("tbody");

    section.items.forEach(item=>{
      const row=state.items[item.id]||{status:"todo",note:""};
      const tr=document.createElement("tr");

      const p=document.createElement("td");
      p.className=`priority ${pClass(item.priority)}`;
      p.textContent=item.priority;
      tr.appendChild(p);

      ["done","doing","todo","na"].forEach(status=>{
        const td=document.createElement("td");
        td.className="status-cell";
        td.dataset.label=labels[status];
        const b=document.createElement("button");
        b.type="button";
        b.className=`status-btn${row.status===status?" active":""}`;
        b.textContent="✓";
        b.setAttribute("aria-label",`${item.title}：${labels[status]}`);
        b.addEventListener("click",()=>saveItem(item,status,row.note||""));
        td.appendChild(b); tr.appendChild(td);
      });

      const title=document.createElement("td");
      title.className="item-title"; title.textContent=item.title; tr.appendChild(title);

      const note=document.createElement("td");
      const d=document.createElement("div");
      d.className="detail"; d.textContent=item.detail;
      const ta=document.createElement("textarea");
      ta.className="note-area";
      ta.placeholder="備註：請記錄問題、或預計完成日期";
      ta.value=row.note||"";
      let timer;
      ta.addEventListener("input",()=>{
        clearTimeout(timer);
        timer=setTimeout(()=>saveItem(item,row.status||"todo",ta.value),600);
      });
      note.append(d,ta); tr.appendChild(note);
      tbody.appendChild(tr);
    });

    sec.appendChild(table); root.appendChild(sec);
  });
  updateProgress();
}

function updateProgress(){
  const items=allItems();
  const applicable=items.filter(i=>(state.items[i.id]?.status||"todo")!=="na");
  const done=applicable.filter(i=>state.items[i.id]?.status==="done").length;
  const pct=applicable.length?Math.round(done/applicable.length*100):0;
  document.querySelector("#progressText").textContent=`已完成 ${done}／${applicable.length} 項（${pct}%）`;
  document.querySelector("#progressBar").style.width=`${pct}%`;
}

async function saveItem(item,status,note){
  if(!client) return;
  setSync("正在儲存…");
  const {error}=await client.from("checklist_items").upsert({
    checklist_key:data.checklistKey,
    item_id:item.id,
    item_title:item.title,
    status,
    note,
    updated_at:new Date().toISOString()
  },{onConflict:"checklist_key,item_id"});
  if(error){setSync("儲存失敗");showMessage(`無法儲存：${error.message}`);return;}
  state.items[item.id]={status,note};
  render(); setSync("已儲存到遠端資料庫");
}

async function saveSummary(){
  if(!client) return;
  const {error}=await client.from("checklist_meta").upsert({
    checklist_key:data.checklistKey,
    completed_summary:document.querySelector("#completedSummary").value,
    pending_summary:document.querySelector("#pendingSummary").value,
    next_summary:document.querySelector("#nextSummary").value,
    target_date:document.querySelector("#targetDate").value||null,
    result:document.querySelector("#result").value,
    updated_at:new Date().toISOString()
  },{onConflict:"checklist_key"});
  setSync(error?"驗收總結儲存失敗":"驗收總結已儲存");
  if(error) showMessage(`驗收總結無法儲存：${error.message}`);
}

async function loadRemote(){
  setSync("正在讀取遠端資料庫…");
  const [itemsRes,metaRes]=await Promise.all([
    client.from("checklist_items").select("item_id,status,note").eq("checklist_key",data.checklistKey),
    client.from("checklist_meta").select("*").eq("checklist_key",data.checklistKey).maybeSingle()
  ]);
  if(itemsRes.error) throw itemsRes.error;
  (itemsRes.data||[]).forEach(r=>state.items[r.item_id]={status:r.status,note:r.note||""});
  if(!metaRes.error && metaRes.data){
    const m=metaRes.data;
    document.querySelector("#completedSummary").value=m.completed_summary||"";
    document.querySelector("#pendingSummary").value=m.pending_summary||"";
    document.querySelector("#nextSummary").value=m.next_summary||"";
    document.querySelector("#targetDate").value=m.target_date||"";
    document.querySelector("#result").value=m.result||"";
  }
  render(); setSync("已連接遠端資料庫");
}

function bindSummary(){
  ["completedSummary","pendingSummary","nextSummary","targetDate","result"].forEach(id=>{
    let timer;
    document.querySelector(`#${id}`).addEventListener("input",()=>{
      clearTimeout(timer); timer=setTimeout(saveSummary,700);
    });
  });
}

async function init(){
  document.querySelector("#siteLink").href=data.siteUrl;
  document.querySelector("#siteLink").textContent=data.siteUrl;
  document.querySelector("#instructionText").textContent=data.instructions;
  render(); bindSummary();

  if(!validConfig()){
    setSync("尚未設定 Supabase");
    showMessage("請先在 config.js 填入 Project URL 與 Publishable key。");
    return;
  }
  client=window.supabase.createClient(cfg.url.replace(/\/+$/,""),cfg.anonKey);
  try{await loadRemote();}
  catch(error){setSync("無法連接遠端資料庫");showMessage(`連線失敗：${error.message}`);}
}
init();
