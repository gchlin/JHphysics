# RDKit SVG Studio（GitHub Pages 版本）

此目錄是主網站首頁連結的靜態部署副本。`index.html`、`styles.css`、`script.js`、`renderer.js`、`compound-aliases.json` 與範例圖檔來自 `../RDKit/RDKit/`；RDKit.js 2025.3.3-1.0.0 的 JavaScript、WebAssembly 和授權文件存放於 `vendor/`。樣式控制區的「結構美化」預設開啟，使用 CoordGen 產生 2D 座標；關閉後使用 RDKit 原生排版。

頁面提供旋轉、化學組態保真的鏡射、立體標註、SVG 與 300/600 DPI PNG。鏡射前後會核對 RDKit 的 R/S 和 E/Z 標記。ACS 預設僅作樣式參考；芳香環圓圈和 PDF/EPS 尚未實作。形式電荷始終顯示。

輸出區預設固定畫布高度（2、5、10 cm 或自訂），也可改用固定鍵長比例。SVG 以 cm 寫入實際尺寸，PNG 依寬高輸出像素並標記 300/600 DPI。透明背景位於輸出區，預覽會顯示格紋。實作方法與跨程式貼上的限制見 [尺寸控制筆記](SIZING-NOTES.md)。

從儲存庫根目錄執行 `python -m http.server 8000`，開啟 `http://127.0.0.1:8000/rdkit-studio/` 即可在本機使用。發布 GitHub Pages 時，此目錄須與首頁一同提交。

## 名稱、示性式與分子式對照

畫布下方的分子式按鈕會複製 MathML（同時提供 HTML 與純文字剪貼簿格式），供 Microsoft 365 Word 直接貼成可編輯公式；其他純文字編輯器可能顯示 MathML 標記。

尺寸有兩種模式：預設的「固定高度」將畫布鎖定為 2、5、10 cm 或自訂高度，寬度依圖形邊界自動計算；「固定鍵長」則讓不同分子的鍵、文字與線寬使用相同實體比例，畫布寬高隨分子伸縮。固定鍵長的 100% 以 0.508 cm 鍵長為基準，參考 [ACS 圖稿規格](https://researcher-resources.acs.org/publish/author_guidelines/pdf?coden=ansadg)；40% 與 200% 分別按比例縮放。SVG 寫入實體 cm，PNG 依 300 或 600 DPI 產生像素並寫入 `pHYs` 密度資訊。Word／PPT 若將圖片放在行內，段落仍會依圖片高度調整行高；固定高度能讓不同分子的佔位一致。

「複製 PNG」會同時提供原始 PNG 與標示 cm 尺寸的 HTML 圖片，因為瀏覽器的圖片剪貼簿可能移除 PNG 的 `pHYs`。下載的 PNG 檔保留 `pHYs`；貼上時實際採用哪種剪貼簿格式仍由 Word／PPT 決定。

`compound-aliases.json` 是優先查詢的本機資料。每筆化合物包含穩定的 `id`、中文 `name`、`english`、`formula`、可交給 RDKit 的 `smiles`，以及其他名稱 `names` 和示性式 `condensed`。這是**精確對照表**，不是通用的示性式語法解析器。新增條目時，應核對結構、分子式及立體組態；俗名若指混合物或範圍不明，不應直接對到單一 SMILES。

目前收錄 120 筆，涵蓋高中常見的雙原子分子、酸鹼鹽、烷烯炔與其異構物、醇醛酮羧酸酯、芳香族、胺基酸與糖類。選取範圍參考[普通型高中自然科學領域課程綱要](https://stv.naer.edu.tw/data/course_outline/pta_18538_240851_60502.pdf)，資料是便於繪圖的常用範例，並非完整化學物質庫。離子化合物以**化學式單位的分離離子**繪製；溶液名稱（如鹽酸、氨水）、組成不定的材料與網狀固體不直接映射成單一分子。新增的 SMILES 與分子式已由 RDKit 核對；有指定立體組態的乳酸與丙胺酸也核對了 CIP 標記。

```json
{"id":"ethanol","name":"乙醇","english":"Ethanol","formula":"C2H6O","smiles":"CCO","names":["酒精","Ethyl alcohol"],"condensed":["CH3CH2OH","C2H5OH"]}
```

查詢次序為：本機對照表的分子式／示性式與名稱、既有範例庫，最後將輸入交給 RDKit 當作 SMILES。**分子式即使只找到一筆，也要求使用者確認**，因為本機對照表不保證收齊所有異構物；若有多筆，例如 `C2H6O` 對應乙醇和二甲醚，會顯示結構讓使用者選。候選只代表目前已收錄的化合物。若輸入同時是有效 SMILES 且代表不同結構，例如 `CO` 可表示甲醇的 SMILES 或一氧化碳的分子式，也會要求選擇。只有使用者選定後才繪圖與匯出。

常用中文名與英文名採不分大小寫的精確比對；分子式和示性式以元素大小寫為準，也接受下標數字及空白。未收錄的名稱或示性式會顯示說明，不猜測結構，也不連線查詢 PubChem／OPSIN。日後擴充可先加入經人工核對的條目；若要串接外部資料，應另設結果來源、候選上限與選擇步驟，不能默認第一筆搜尋結果。
