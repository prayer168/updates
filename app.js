const config = window.SUPABASE_CONFIG;
const data = window.CHECKLIST_DATA;
const checklistEl = document.querySelector("#checklist");
const progressText = document.querySelector("#progressText");
const progressBar = document.querySelector("#progressBar");
const syncStatus = document.querySelector("#syncStatus");
const messageEl = document.querySelector("#message");

let client;
let completed = new Set();

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.classList.remove("hidden");
}

function validateConfig() {
  return config &&
    config.url &&
    config.anonKey &&
    !config.url.includes("請填入") &&
    !config.anonKey.includes("請填入");
}

function allItems() {
  return data.sections.flatMap(section => section.items);
}

function updateProgress() {
  const total = allItems().length;
  const done = completed.size;
  const percent = total ? Math.round((done / total) * 100) : 0;
  progressText.textContent = `已完成 ${done}／${total} 項（${percent}%）`;
  progressBar.style.width = `${percent}%`;
}

function render() {
  checklistEl.innerHTML = "";
  data.sections.forEach((section, sectionIndex) => {
    const sectionEl = document.createElement("section");
    sectionEl.className = "section";

    const title = document.createElement("h2");
    title.textContent = `${sectionIndex + 1}. ${section.title}`;
    sectionEl.appendChild(title);

    section.items.forEach(item => {
      const isDone = completed.has(item.id);
      const row = document.createElement("article");
      row.className = `item${isDone ? " done" : ""}`;
      row.dataset.itemId = item.id;

      const info = document.createElement("div");
      const badgeClass = item.priority === "高" ? "high" : item.priority === "中" ? "mid" : "low";
      info.innerHTML = `
        <div class="item-title">
          <span class="badge ${badgeClass}">${item.priority}優先</span>${item.title}
        </div>
        <div class="item-detail">${item.detail || ""}</div>
      `;

      const button = document.createElement("button");
      button.className = `toggle${isDone ? " done" : ""}`;
      button.type = "button";
      button.textContent = isDone ? "✓ 已完成" : "標示完成";
      button.addEventListener("click", () => toggleItem(item, button, row));

      row.append(info, button);
      sectionEl.appendChild(row);
    });

    checklistEl.appendChild(sectionEl);
  });
  updateProgress();
}

async function loadRemoteState() {
  syncStatus.textContent = "正在讀取遠端紀錄…";
  const { data: rows, error } = await client
    .from("checklist_items")
    .select("item_id, completed")
    .eq("checklist_key", data.checklistKey);

  if (error) throw error;

  completed = new Set(
    (rows || []).filter(row => row.completed).map(row => row.item_id)
  );
  render();
  syncStatus.textContent = "已連接遠端資料庫，按下按鈕後會自動儲存。";
}

async function toggleItem(item, button, row) {
  const nextValue = !completed.has(item.id);
  button.disabled = true;
  syncStatus.textContent = "正在儲存…";

  const { error } = await client
    .from("checklist_items")
    .upsert({
      checklist_key: data.checklistKey,
      item_id: item.id,
      item_title: item.title,
      completed: nextValue,
      updated_at: new Date().toISOString()
    }, {
      onConflict: "checklist_key,item_id"
    });

  button.disabled = false;

  if (error) {
    syncStatus.textContent = "儲存失敗";
    showMessage(`無法儲存：${error.message}`);
    return;
  }

  if (nextValue) completed.add(item.id);
  else completed.delete(item.id);

  row.classList.toggle("done", nextValue);
  button.classList.toggle("done", nextValue);
  button.textContent = nextValue ? "✓ 已完成" : "標示完成";
  updateProgress();
  syncStatus.textContent = "已儲存到遠端資料庫。";
}

async function init() {
  render();

  if (!validateConfig()) {
    syncStatus.textContent = "尚未設定遠端資料庫";
    showMessage("請先開啟 config.js，填入 Supabase Project URL 與 anon public key。");
    document.querySelectorAll(".toggle").forEach(btn => btn.disabled = true);
    return;
  }

  client = window.supabase.createClient(config.url, config.anonKey);

  try {
    await loadRemoteState();
  } catch (error) {
    syncStatus.textContent = "無法連接遠端資料庫";
    showMessage(`請確認 Supabase 設定與資料表是否完成：${error.message}`);
  }
}

init();
