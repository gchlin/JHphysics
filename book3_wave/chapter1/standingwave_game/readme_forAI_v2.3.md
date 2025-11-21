# 駐波名稱大亂鬥 (Wave Physics Battle) V2.3 - 開發指南

## 專案簡介
這是一個基於 HTML5/JS 的手機網頁遊戲，旨在透過高度遊戲化（Gamification）的方式，幫助學生記憶「駐波」的物理名詞。
**目前版本**：V2.3
**特色**：雙人對戰血條、Combo 攻擊動畫、動態懲罰機制、競速倒數模式、雙向時間條。

---

## 1. 檔案架構
* **index.html**: 
    * 包含三個主要區塊：`main-menu` (選單)、`single-player-area` (單人練習)、`versus-container` (雙人對戰)。
    * **預載機制**：`<div id="preload-container">` 用於緩存圖片。
    * **特效層**：包含 `warning-layer` (最後5秒警告)、`speed-time-bar-container` (上下雙向時間條)。
* **style.css**: 
    * 處理旋轉佈局 (`rotate(180deg)` for P1)。
    * 定義動畫關鍵影格：`shootP1toP2` (Combo攻擊)、`warnPulse` (警告閃爍)、`floatUp` (飄浮得分)。
* **game.js**: 
    * 核心狀態管理 (`state` 物件)。
    * 音效合成 (`AudioContext`)。
    * 遊戲迴圈與邏輯 (Timer, Score, Combo)。
* **data.js**: 
    * 題庫資料 (嚴格區分泛音與諧音體系)。
    * 輔助函式 `getAllImages()` 供預載使用。

---

## 2. 核心邏輯與規則 (Core Mechanics)

### A. 觸控事件處理 (Touch Handling)
**[絕對規則]** 為防止雙人同時點擊導致衝突：
1.  禁止使用 `onclick`。
2.  必須使用 `touchstart` 搭配 `{ passive: false }`。
3.  必須執行 `e.preventDefault()`。

### B. 出題演算法 (Deck System)
* **對戰模式 (Versus/Speed)**：採用「抽牌不放回」機制。
    * 每個玩家/共用牌堆建立 `deck`。
    * 題目抽完後重新洗牌 (`shuffleArray`)，確保週期內題目不重複。
* **練習模式 (Practice)**：錯題加權機制。
    * 記錄答錯的題目至 `wrongHistory`。
    * **50% 機率** 優先從 `wrongHistory` 出題，強化練習。

### C. 動態懲罰機制 (Dynamic Penalty)
為防止亂猜，實作累進式懲罰：
1.  **時間鎖定**：
    * 公式：$Penalty = 800ms \times 1.5^{(streak-1)}$
    * 上限：3000ms。
    * 鎖定期間選項半透明且無法點擊 (`pointer-events: none`)。
2.  **破音懲罰 (Broken Voice)**：
    * 條件：連續答錯 (`wrongStreak`) $\ge 2$。
    * 效果：扣分加重至 **-2 分**。
    * 視覺：飄浮文字顯示「**-2 破音啦**」。

### D. 計分與 Combo 系統
* **搶答權重**：首位答對者 +2 分，次位 +1 分。
* **Combo 計算**：
    * 連續答對累積 Combo 數，答錯歸零。
    * **Combo $\ge$ 2**：觸發攻擊動畫 (`shootCombo`)，光球飛向對手區域。
* **飄浮回饋**：在點擊座標處生成飄浮文字 (+1, +2, -1)。

---

## 3. 視覺與介面設計 (UI/UX)

### A. 雙人對戰佈局 (Versus Container)
* **P1 (Top)**：CSS `transform: rotate(180deg)`，所有文字與素材需考量逆向顯示。
* **P2 (Bottom)**：正常顯示。
* **中線 (Divider)**：
    * 包含雙方 **分數條 (Progress Bar)**，視覺化分數差距。
    * 中央放置 MENU 按鈕與數字倒數。

### B. 競速模式特效 (Speed Mode)
* **雙向時間條**：螢幕最上方 (Top) 與最下方 (Bottom) 各有一條紅色時間條，隨時間減少。
* **最後倒數警告**：
    * **剩餘 5 秒**：全螢幕半透明遮罩 + 巨大紅字閃爍「最後 5 秒」。
    * **剩餘 3,2,1**：播放急促 Beep 音效。
    * **歸零 (Time Up)**：觸發 `determineWinner()` 進行最終比分 (**注意：不能直接結束，必須先比分再 EndGame**)。

### C. 結算畫面 (Game Over)
* 根據勝負顯示不同訊息 (`MSG_WIN`, `MSG_LOSE`, `MSG_DRAW`)。
* 提供情緒價值語錄（如：「你是駐波大師」、「老師在講你有在聽嗎」）。

---

## 4. 音效系統 (Audio System)
使用 `AudioContext` 原生合成，無需外部 mp3 檔案：
* **Correct**: Sine 波 (C5 -> E5 滑音)。
* **Wrong**: Sawtooth 波 (低頻鋸齒)。
* **Countdown (3,2,1)**: Square 波 (440Hz 短音)。
* **GO / TimeUp**: Square 波 (880Hz)。

---

## 5. 維護注意事項
1.  **新增題目**：在 `data.js` 新增項目後，需同步加入對應的 `QuestionSets`。
2.  **圖片路徑**：若新增圖片，確保 `getAllImages()` 能抓取到 (目前邏輯為掃描 AnswerBank 與 Level3 List)。
3.  **CSS 動畫**：Combo 攻擊動畫 (`shootP1toP2`) 使用絕對定位，若調整版面高度需重新校準 keyframes 的 `top` % 數值。