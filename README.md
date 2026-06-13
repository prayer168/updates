# 黑熊老師網站優化檢核表｜完全依附檔版

- 完整依照最新附檔的章節、項目與順序製作
- 共 101 項
- 使用方式文字已改為：
  依實際狀況勾選「完成／進行中／未完成／不適用」，並在備註欄記錄問題、或預計完成日期。
- 已移除「負責人」文字
- 四種狀態、備註與驗收總結皆可儲存到 Supabase

## 更新方式
1. 在 Supabase SQL Editor 執行 `supabase.sql`
2. 將原本有效的 Project URL 與 Publishable key 填入 `config.js`
3. 將所有檔案上傳 GitHub Pages


## 本次修正
- 狀態按鈕按下後立即切換，不再等待 Supabase 回應。
- 遠端連線失敗時先保存於瀏覽器 localStorage。
- Supabase 恢復連線後，後續操作會繼續同步。
