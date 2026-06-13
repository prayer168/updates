const cfg = window.SUPABASE_CONFIG;
const data = window.CHECKLIST_DATA;
const state = { items: {} };
let client = null;

const labels = { done: "完成", doing: "進行中", todo: "未完成", na: "不適用" };
const LOCAL_KEY = `${data.checklistKey}-local-cache`;

function validConfig() {
  return cfg && cfg.url && cfg.anonKey &&
    !cfg.url.includes("請填入") && !cfg.anonKey.includes("請填入");
}
function allItems() { return data.sections.flatMap(s => s.items); }
function showMessage(text) {
  const el = document.querySelector("#message");
  el.textContent = text;
  el.classList.remove("hidden");
}
function clearMessage() { document.querySelector("#message").classList.add("hidden"); }
function setSync(text) { document.querySelector("#syncStatus").textContent = text; }
function pClass(v) { return v === "高" ? "high" : v === "中" ? "mid" : "low"; }
function normalizeStatus(value) { return ["done","doing","todo","na"].includes(value) ? value : "todo"; }

function loadLocalCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
    if (cached.items) Object.assign(state.items, cached.items);
  } catch (_) {}
}
function saveLocalCache() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ items: state.items }));
}

function render() {
  const root = document.querySelector("#checklist");
  root.innerHTML = "";

  data.sections.forEach(section => {
    const sec = document.createElement("section");
    sec.className = "check-section";
    const h = document.createElement("h2");
    h.textContent = section.title;
    sec.appendChild(h);

    const table = document.createElement("table");
    table.className = "check-table";
    table.innerHTML = `<thead><tr>
      <th class="col-priority">優先</th>
      <th class="col-status">完成</th>
      <th class="col-status">進行中</th>
      <th class="col-status">未完成</th>
      <th class="col-status">不適用</th>
      <th class="col-item">檢核項目</th>
      <th class="col-note">驗收標準／備註</th>
    </tr></thead><tbody></tbody>`;
    const tbody = table.querySelector("tbody");

    section.items.forEach(item => {
      const saved = state.items[item.id] || {};
      const row = { status: normalizeStatus(saved.status), note: saved.note || "" };
      state.items[item.id] = row;

      const tr = document.createElement("tr");
      const p = document.createElement("td");
      p.className = `priority ${pClass(item.priority)}`;
      p.textContent = item.priority;
      tr.appendChild(p);

      ["done","doing","todo","na"].forEach(status => {
        const td = document.createElement("td");
        td.className = "status-cell";
        td.dataset.label = labels[status];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `status-btn${row.status === status ? " active" : ""}`;
        btn.textContent = "✓";
        btn.setAttribute("aria-pressed", row.status === status ? "true" : "false");
        btn.setAttribute("aria-label", `${item.title}：${labels[status]}`);
        btn.addEventListener("click", () => chooseStatus(item, status));
        td.appendChild(btn);
        tr.appendChild(td);
      });

      const title = document.createElement("td");
      title.className = "item-title";
      title.textContent = item.title;
      tr.appendChild(title);

      const note = document.createElement("td");
      const d = document.createElement("div");
      d.className = "detail";
      d.textContent = item.detail;
      const ta = document.createElement("textarea");
      ta.className = "note-area";
      ta.placeholder = "備註：請記錄問題、或預計完成日期";
      ta.value = row.note;
      let timer;
      ta.addEventListener("input", () => {
        state.items[item.id].note = ta.value;
        saveLocalCache();
        clearTimeout(timer);
        timer = setTimeout(() => syncItem(item), 700);
      });
      note.append(d, ta);
      tr.appendChild(note);
      tbody.appendChild(tr);
    });

    sec.appendChild(table);
    root.appendChild(sec);
  });
  updateProgress();
}

function updateProgress() {
  const items = allItems();
  const applicable = items.filter(i => normalizeStatus(state.items[i.id]?.status) !== "na");
  const done = applicable.filter(i => normalizeStatus(state.items[i.id]?.status) === "done").length;
  const pct = applicable.length ? Math.round(done / applicable.length * 100) : 0;
  document.querySelector("#progressText").textContent = `已完成 ${done}／${applicable.length} 項（${pct}%）`;
  document.querySelector("#progressBar").style.width = `${pct}%`;
}

function chooseStatus(item, status) {
  clearMessage();
  state.items[item.id] ||= { status: "todo", note: "" };
  state.items[item.id].status = status;
  saveLocalCache();
  render(); // 立即顯示勾選，不等待 Supabase
  syncItem(item);
}

async function syncItem(item) {
  if (!client) {
    setSync("已暫存在此裝置；遠端資料庫尚未連線");
    return;
  }
  const row = state.items[item.id] || { status: "todo", note: "" };
  setSync("正在儲存…");
  const { error } = await client.from("checklist_items").upsert({
    checklist_key: data.checklistKey,
    item_id: item.id,
    item_title: item.title,
    status: normalizeStatus(row.status),
    note: row.note || "",
    updated_at: new Date().toISOString()
  }, { onConflict: "checklist_key,item_id" });

  if (error) {
    setSync("已暫存在此裝置，遠端同步失敗");
    showMessage(`遠端同步失敗：${error.message}`);
    return;
  }
  setSync("已儲存到遠端資料庫");
}

async function saveSummary() {
  const summary = {
    completed_summary: document.querySelector("#completedSummary").value,
    pending_summary: document.querySelector("#pendingSummary").value,
    next_summary: document.querySelector("#nextSummary").value,
    target_date: document.querySelector("#targetDate").value || null,
    result: document.querySelector("#result").value
  };
  localStorage.setItem(`${LOCAL_KEY}-summary`, JSON.stringify(summary));
  if (!client) return;
  const { error } = await client.from("checklist_meta").upsert({
    checklist_key: data.checklistKey,
    ...summary,
    updated_at: new Date().toISOString()
  }, { onConflict: "checklist_key" });
  setSync(error ? "驗收總結遠端同步失敗" : "驗收總結已儲存");
  if (error) showMessage(`驗收總結無法同步：${error.message}`);
}

function loadLocalSummary() {
  try {
    const m = JSON.parse(localStorage.getItem(`${LOCAL_KEY}-summary`) || "{}");
    document.querySelector("#completedSummary").value = m.completed_summary || "";
    document.querySelector("#pendingSummary").value = m.pending_summary || "";
    document.querySelector("#nextSummary").value = m.next_summary || "";
    document.querySelector("#targetDate").value = m.target_date || "";
    document.querySelector("#result").value = m.result || "";
  } catch (_) {}
}

async function loadRemote() {
  setSync("正在讀取遠端資料庫…");
  const [itemsRes, metaRes] = await Promise.all([
    client.from("checklist_items").select("item_id,status,note").eq("checklist_key", data.checklistKey),
    client.from("checklist_meta").select("*").eq("checklist_key", data.checklistKey).maybeSingle()
  ]);
  if (itemsRes.error) throw itemsRes.error;

  (itemsRes.data || []).forEach(r => {
    state.items[r.item_id] = {
      status: normalizeStatus(r.status),
      note: r.note || ""
    };
  });
  saveLocalCache();

  if (!metaRes.error && metaRes.data) {
    const m = metaRes.data;
    document.querySelector("#completedSummary").value = m.completed_summary || "";
    document.querySelector("#pendingSummary").value = m.pending_summary || "";
    document.querySelector("#nextSummary").value = m.next_summary || "";
    document.querySelector("#targetDate").value = m.target_date || "";
    document.querySelector("#result").value = m.result || "";
  }
  render();
  setSync("已連接遠端資料庫");
}

function bindSummary() {
  ["completedSummary","pendingSummary","nextSummary","targetDate","result"].forEach(id => {
    let timer;
    document.querySelector(`#${id}`).addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(saveSummary, 700);
    });
  });
}

async function init() {
  document.querySelector("#siteLink").href = data.siteUrl;
  document.querySelector("#siteLink").textContent = data.siteUrl;
  document.querySelector("#instructionText").textContent = data.instructions;
  loadLocalCache();
  loadLocalSummary();
  render();
  bindSummary();

  if (!validConfig()) {
    setSync("按鈕可使用；尚未設定 Supabase，紀錄暫存在此裝置");
    return;
  }

  client = window.supabase.createClient(cfg.url.replace(/\/+$/, ""), cfg.anonKey);
  try {
    await loadRemote();
  } catch (error) {
    setSync("按鈕可使用；遠端資料庫暫時無法連線");
    showMessage(`遠端連線失敗：${error.message}`);
  }
}

init();
