/* Shared requirements included in copied prompts, not displayed as page prose. */
window.MaterialPrompts = {
    requirements: `風格：精簡教學頁（CLASSROOM-SIMPLE）
- 參考 material/classroom-simple.css 與 material/index.html 的實際布局。動畫是主體，控制項集中緊鄰動畫；數值與圖例直接標示，優先使用留白、對齊與細分隔線。
- 不預設製作儀表板；不要把每個數值、控制項或說明各包成卡片，不做巢狀卡片、裝飾性指標磚、大陰影或大面積空白頁首。只在需要分組或比較時使用容器。
- 保留理解物理與操作必要的文字，刪除重複標題、口號、功能介紹及裝飾性說明。使用中性背景、一種操作強調色；物理量的語意配色固定。

共同實作要求：
- 先讀取指定參考檔案與素材編號，沿用可用的實作及視覺規則，再接入目標動畫。來源無法存取時，請明確指出缺少的參考，不可假稱已讀取。
- 手機直向 360px、390px 及桌面 1280px 寬均須可用：圖區保持比例，控制列可換行；不得橫向溢出、裁掉關鍵物件，或把整個桌面介面縮小到文字難讀。窄螢幕需調整圖表配置，重要文字與控制項優先用 HTML，不能只靠縮放 Canvas。
- Canvas 點陣尺寸依實際 CSS 尺寸乘 devicePixelRatio 設定；用 setTransform 映射邏輯座標，ResizeObserver 與視窗尺寸改變時重繪。點擊座標依 CSS 邊界映射到邏輯座標，不能混用點陣尺寸。
- 向量共用固定的物理比例尺；正負方向正確，零向量保留數值而不畫假箭頭，短箭頭的箭頭頭部不能比箭身長。標籤不可重疊或越界。需精細文字／互動時可使用 SVG 或 HTML 疊層；SVG 仍需處理標籤及手機配置。
- 物理狀態、繪製與控制分開；各元件使用同一幀的狀態。可組合的繪圖函式不得清除整張共用畫布或改寫外部模擬狀態。僅維持一條動畫更新迴圈，暫停／跳轉／重設後畫面與數值須一致。
- 驗收須涵蓋手機寬度、縮放後點擊、正／負／零向量、標籤邊界及播放狀態。請說明實際完成的檢查與未驗證項目，不能把 Prompt 當成已通過測試的保證。

程式參考索引：material/REFERENCE.md。`
};
document.querySelectorAll('textarea[readonly]').forEach(textarea => {
    textarea.value += '\n\n' + window.MaterialPrompts.requirements;
});
