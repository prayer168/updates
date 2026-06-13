# 黑熊老師網站優化互動檢核表

這是一個可部署到 GitHub Pages 的簡易互動檢核網站。

## 功能

- 完整列出 Word 檢核表中的 101 項改善項目
- 每一項只有一個按鈕：`標示完成`
- 再按一次可取消完成
- 自動顯示完成數量與百分比
- 每次操作都立即儲存到 Supabase 遠端資料庫
- 手機、平板、電腦皆可使用

## 一、建立 Supabase 遠端資料庫

1. 到 Supabase 建立免費專案。
2. 打開 `SQL Editor`。
3. 複製 `supabase.sql` 的全部內容並執行。
4. 到 `Project Settings → API`。
5. 找到：
   - Project URL
   - anon public key

## 二、填入網站設定

開啟 `config.js`，將以下兩項換成自己的資料：

```javascript
window.SUPABASE_CONFIG = {
  url: "你的 Project URL",
  anonKey: "你的 anon public key"
};
```

匿名金鑰本來就可放在前端網站；真正的資料權限由 Supabase RLS 規則控制。

## 三、先在電腦測試

不要直接雙擊 `index.html` 測試，建議使用本機伺服器。

若已安裝 Python，可在資料夾中執行：

```bash
python -m http.server 8000
```

瀏覽器開啟：

```text
http://localhost:8000
```

## 四、部署到 GitHub Pages

1. 在 GitHub 建立新 Repository。
2. 把本資料夾中的所有檔案上傳到 Repository 根目錄。
3. 開啟 Repository 的 `Settings → Pages`。
4. Source 選擇 `Deploy from a branch`。
5. Branch 選擇 `main`，資料夾選擇 `/root`。
6. 儲存後等待 GitHub 顯示網站網址。

## 檔案說明

- `index.html`：網頁主畫面
- `styles.css`：版面樣式
- `app.js`：按鈕與遠端儲存功能
- `checklist-data.js`：全部檢核項目
- `config.js`：Supabase 連線設定
- `supabase.sql`：建立遠端資料表及權限

## 安全提醒

目前採用最簡易的公開共用模式。任何知道網站網址的人，都可以修改同一份檢核紀錄。

這種設定適合：
- 個人使用
- 教師小團隊共用
- 不含敏感資料的網站改版追蹤

若未來需要「每位教師各自登入、各自保存紀錄」，可再加入 Supabase Authentication。
