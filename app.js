
const cfg = window.SUPABASE_CONFIG;
const data = window.CHECKLIST_DATA;
const checklistEl = document.querySelector("#checklist");
const messageEl = document.querySelector("#message");
const state = { items: {}, meta: {}, summary: {} };
let client;

const statusLabels = {
  done: "完成",
  doing: "進行中",
  todo: "未完成",
  na: "不適用"
};

function validConfig() {
  return cfg && cfg.url && cfg.anonKey &&
    !cfg.url.includes("請填入") && !cfg.anonKey.includes("請填入");
}

function allItems() {
  return data.sections.flatMap(section => section.items);
}

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.classList.remove("hidden");
}

function setSync(text) {
  document.querySelector("#syncStatus").textContent = text;
}

function priorityClass(value) {
  return value === "高" ? "high" : value === "中" ? "mid" : "low";
}

function render() {
  checklistEl.innerHTML = "";
  data.sections.forEach(section => {
    const sectionEl = document.createElement("section");
    sectionEl.className = "check-section";
    const h2 = document.createElement("h2");
    h2.textContent = section.title;
    sectionEl.appendChild(h2);

    const table = document.createElement("table");
    table.className = "check-table";
    table.innerHTML = `
      <thead><tr>
        <th class="col-priority">優先</th>
        <th class="col-status">完成</th>
        <th class="col-status">進行中</th>
        <th class="col-status">未完成</th>
        <th class="col-status">不適用</th>
        <th class="col-item">檢核項目</th>
        <th class="col-note">驗收標準／備註</th>
      </tr></thead>
      <tbody></tbody>`;
    const tbody = table.querySelector("tbody");

    section.items.forEach(item => {
      const rowState = state.items[item.id] || {};
      const tr = document.createElement("tr");

      const priority = document.createElement("td");
      priority.className = `priority ${priorityClass(item.priority)}`;
      priority.textContent = item.priority;
      tr.appendChild(priority);

      ["done","doing","todo","na"].forEach(status => {
        const td = document.createElement("td");
        td.className = "status-cell";
        td.dataset.label = statusLabels[status];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `status-btn${rowState.status === status ? " active" : ""}`;
        btn.textContent = "✓";
        btn.setAttribute("aria-label", `${item.title}：${statusLabels[status]}`);
        btn.addEventListener("click", () => saveItem(item, status, rowState.note || ""));
        td.appendChild(btn);
        tr.appendChild(td);
      });

      const titleTd = document.createElement("td");
      titleTd.className = "item-title";
      titleTd.textContent = item.title;
      tr.appendChild(titleTd);

      const noteTd = document.createElement("td");
      const detail = document.createElement("div");
      detail.className = "detail";
      detail.textContent = item.detail;
      const textarea = document.createElement("textarea");
      textarea.className = "note-area";
      textarea.placeholder = "備註：問題、負責人或預計完成日期";
      textarea.value = rowState.note || "";
      let timer;
      textarea.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => saveItem(item, rowState.status || "todo", textarea.value), 600);
      });
      noteTd.append(detail, textarea);
      tr.appendChild(noteTd);

      tbody.appendChild(tr);
    });

    sectionEl.appendChild(table);
    checklistEl.appendChild(sectionEl);
  });
  updateProgress();
}

function updateProgress() {
  const rows = allItems();
  const applicable = rows.filter(item => (state.items[item.id]?.status || "todo") !== "na");
  const done = applicable.filter(item => state.items[item.id]?.status === "done").length;
  const percent = applicable.length ? Math.round(done / applicable.length * 100) : 0;
  document.querySelector("#progressText").textContent = `已完成 ${done}／${applicable.length} 項（${percent}%）`;
  document.querySelector("#overallPercent").textContent = `${percent}%`;
  document.querySelector("#progressBar").style.width = `${percent}%`;
}

async function saveItem(item, status, note) {
  if (!client) return;
  setSync("正在儲存…");
  const payload = {
    checklist_key: data.checklistKey,
    item_id: item.id,
    item_title: item.title,
    status,
    note,
    updated_at: new Date().toISOString()
  };
  const { error } = await client.from("checklist_items").upsert(payload, {
    onConflict: "checklist_key,item_id"
  });
  if (error) {
    setSync("儲存失敗");
    showMessage(`無法儲存：${error.message}`);
    return;
  }
  state.items[item.id] = { status, note };
  render();
  setSync("已儲存到遠端資料庫");
}

async function saveDocumentMeta() {
  if (!client) return;
  const payload = {
    checklist_key: data.checklistKey,
    check_date: document.querySelector("#checkDate").value || null,
    checker: document.querySelector("#checker").value,
    stage: document.querySelector("#stage").value,
    completed_summary: document.querySelector("#completedSummary").value,
    pending_summary: document.querySelector("#pendingSummary").value,
    next_summary: document.querySelector("#nextSummary").value,
    target_date: document.querySelector("#targetDate").value || null,
    result: document.querySelector("#result").value,
    updated_at: new Date().toISOString()
  };
  const { error } = await client.from("checklist_meta").upsert(payload, {
    onConflict: "checklist_key"
  });
  setSync(error ? "基本資料儲存失敗" : "基本資料已儲存");
  if (error) showMessage(`基本資料無法儲存：${error.message}`);
}

async function loadRemote() {
  setSync("正在讀取遠端資料庫…");

  const [itemsRes, metaRes] = await Promise.all([
    client.from("checklist_items").select("item_id,status,note").eq("checklist_key", data.checklistKey),
    client.from("checklist_meta").select("*").eq("checklist_key", data.checklistKey).maybeSingle()
  ]);

  if (itemsRes.error) throw itemsRes.error;
  (itemsRes.data || []).forEach(row => {
    state.items[row.item_id] = { status: row.status, note: row.note || "" };
  });

  if (!metaRes.error && metaRes.data) {
    const m = metaRes.data;
    document.querySelector("#checkDate").value = m.check_date || "";
    document.querySelector("#checker").value = m.checker || "";
    document.querySelector("#stage").value = m.stage || "初次檢核";
    document.querySelector("#completedSummary").value = m.completed_summary || "";
    document.querySelector("#pendingSummary").value = m.pending_summary || "";
    document.querySelector("#nextSummary").value = m.next_summary || "";
    document.querySelector("#targetDate").value = m.target_date || "";
    document.querySelector("#result").value = m.result || "";
  }

  render();
  setSync("已連接遠端資料庫");
}

function bindMetaFields() {
  ["checkDate","checker","stage","completedSummary","pendingSummary","nextSummary","targetDate","result"].forEach(id => {
    let timer;
    document.querySelector(`#${id}`).addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(saveDocumentMeta, 700);
    });
  });
}

async function init() {
  document.querySelector("#siteLink").href = data.siteUrl;
  document.querySelector("#siteLink").textContent = data.siteUrl;
  render();
  bindMetaFields();

  if (!validConfig()) {
    setSync("尚未設定 Supabase");
    showMessage("請先在 config.js 填入 Project URL 與 Publishable key。");
    return;
  }

  client = window.supabase.createClient(cfg.url.replace(/\/+$/,""), cfg.anonKey);

  try {
    await loadRemote();
  } catch (error) {
    setSync("無法連接遠端資料庫");
    showMessage(`連線失敗：${error.message}`);
  }
}

init();
