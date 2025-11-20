# 波動物理大亂鬥 (Wave Physics Battle) - 開發指南

## 專案簡介
這是一個基於 HTML5/JS 的手機網頁遊戲，旨在透過遊戲化方式幫助學生記憶「駐波」的物理名詞（基音、泛音、諧音）。
**專案目標**：極簡、輕量、無須後端，直接在瀏覽器運行。

## 1. 專案架構
- **index.html**: 遊戲介面與選單結構。
- **style.css**: 視覺樣式 (包含 Flexbox 佈局與響應式設計)。
- **game.js**: 核心遊戲邏輯、計分、計時與 DOM 操作。
- **data.js**: 題庫資料 (嚴格區分泛音與諧音體系)。

## 2. 核心邏輯與規則 (重要)

### A. 互動事件處理 (Touch Handling)
**[絕對規則]** 為了防止手機雙人同時點擊導致的瀏覽器手勢衝突（如縮放、卡住）：
1.  **禁止使用** `onclick` 綁定遊戲按鈕。
2.  **必須使用** `touchstart` 事件。
3.  **必須加入** `{ passive: false }` 並執行 `e.preventDefault()` 以攔截瀏覽器預設行為。
   ```javascript
   btn.addEventListener('touchstart', (e) => {
       if (e.cancelable) e.preventDefault();
       handleAnswer(...);
   }, { passive: false });


### B. 防作弊機制 (Anti-Cheat)
為了防止玩家同時點擊所有選項（亂按流）：
- **答錯懲罰**：除了扣分外，觸發 **0.8秒 鎖定 (Lockout)**。
- **鎖定效果**：選項半透明 (Opacity 0.4) 且無法點擊 (`pointer-events: none`)。
- **狀態重置**：每次 `init` 新遊戲時，務必重置鎖定狀態 `state.locked = { p1: false, p2: false }`。

### C. 題目生成規則 (Strict Isolation)
- **選項隔離**：題目分為「泛音體系 (Category: O)」與「諧音體系 (Category: H)」。
- **生成邏輯**：
  - 若正解為 O 類，干擾選項**必須全部**來自 O 類。
  - 若正解為 H 類，干擾選項**必須全部**來自 H 類。
  - *禁止混雜不同體系的選項，以免造成觀念混淆。*

## 3. 介面與模式設計

### 主選單 (Main Menu)
- **佈局**：採用 `.btn-group` Flexbox 容器，將每個 Level 的三個按鈕（練習、對戰、競速）**橫向排列**，以節省垂直空間。
- **按鈕風格**：保持原有立體按鈕樣式，僅調整排列方式。

### 遊戲模式 (Game Modes)
1.  **練習模式 (Practice)**
    - **特徵**：單人遊玩。
    - **優化**：透過 CSS `visibility: hidden` 隱藏上方 P1 (對手) 區域，保持版面置中且不干擾視線，並顯示「圖表」輔助按鈕。
    - **運算優化**：此模式下不生成 P1 的題目，節省資源。
2.  **對戰模式 (Versus)**
    - **特徵**：雙人搶答，搶 20 分。
    - **計分**：首位答對 +2，次位答對 +1。
3.  **競速模式 (Speed)**
    - **特徵**：雙人限時 30 秒，比誰答對題數多。

## 4. 變數命名約定
- **玩家**：`p1` (上方, 旋轉180度), `p2` (下方)。
- **題庫 Key**：
  - 圖片題：`Img_FO_1` (First Overtone), `Img_H_2` (Second Harmonic)...
  - 文字題：`O_1`, `H_2`...

## 5. 未來維護注意事項
- 修改 `handleAnswer` 時，必須保留防作弊的 Lockout 邏輯。
- 修改 `renderSide` 時，必須保留 `touchstart` 的事件綁定邏輯。
- 任何新增的 UI 元素需確保不會破壞 `flex` 結構，並在手機直式畫面下可正常顯示。