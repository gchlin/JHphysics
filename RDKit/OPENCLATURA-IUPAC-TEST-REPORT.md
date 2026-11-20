# RDKit.js × OpenClatura IUPAC 定位號整合測試報告

**日期：** 2026-11-20  
**測試範圍：** 整合前可行性驗證及正式 RDKit Studio 接線紀錄。  
**正式 GUI 接線：** 已加入原始專案與 GitHub Pages 部署副本；本次沒有宣稱完成瀏覽器驗收。

**自動測試：** 8 個 Node 測試檔全數通過。涵蓋 IUPAC 索引、取消競態、API 失敗回退、標籤修改／還原／換分子清除、氫顯示、旋轉與鏡射。API 使用模擬回應；化學解析與繪圖使用真實 RDKit WASM。這些結果不等同整合後瀏覽器端到端測試。

## 結論摘要

- 使用者在 GitHub Pages 測試頁執行瀏覽器測試，回報 RDKit.js 與 WebAssembly 載入成功，8/8 個案例取得 HTTP/JSON、主體定位號及 SVG，0 例失敗。這表示該次 GitHub Pages Origin 可直接以瀏覽器 `fetch()` 讀取 OpenClatura 回應，CORS 測試通過。
- OpenClatura 的 `/describe?format=json&verify=0` 在測試結構中回傳 `substituent_tree[].parent.atom_ids_by_locant` 與 `atom_symbols_by_locant`。應只將元素為碳的主體映射作為主鏈／主環碳標號。
- API 的 Atom ID 不保證等於以原始輸入 SMILES 建立的 GUI RDKit.js 原子索引。API 會提供 `Processed SMILES`；對 `CCC(C)C`，API 改以 `CC(C)CC` 表示，定位號 Atom ID 對原輸入 RDKit 分子不能直接套用。
- `Processed SMILES` 仍不足以保證 API graph ID 等於 RDKit.js 解析索引。正式 GUI 現在要求完整的 `Atom ids in that SMILES` 標記，嚴格轉換成處理後字串的解析順序；沒有完整可驗證對照就拒絕編號。咖啡因實例見下節。
- 不需要新增 Python 後端；OpenClatura 直接呼叫已在該次 GitHub Pages 瀏覽器測試通過。結果只代表本次 Origin、端點和測試條件，不是 API 長期可用性保證。

## 實際測試紀錄

### 瀏覽器端（使用者在 GitHub Pages 執行）

使用者回貼的測試頁總結：

> RDKit.js 與 WebAssembly 載入成功。完成：8/8 例取得 HTTP/JSON、主體定位號及 SVG；0 例失敗。

測試頁在 `https://gchlin.github.io/JHphysics/test/rdkit-iupac.html`。這次結果確認該瀏覽器環境能完成 API `fetch()`、解析 JSON、提取定位號並產生 SVG。回貼內容只包含 `CCC(C)C` 的詳細列，以下其他定位號欄位另以 API 回應交叉核對。

### API 回應與定位號

以下映射為「定位號 → API Atom ID」。API 原子 ID 必須透過其完整內嵌 atom-id 標記轉換；不能一律當成原始或處理後 SMILES 的 RDKit.js 解析索引。

| 輸入 SMILES | API 名稱 | 主體碳定位號 → Atom ID | 備註 |
|---|---|---|---|
| `CCCC` | butane | 1→0、2→1、3→2、4→3 | 4 碳直鏈 |
| `CC(C)CC` | 2-methylbutane | 1→0、2→1、3→3、4→4 | API 處理後仍為 `CC(C)CC` |
| `CCC(C)C` | 2-methylbutane | 1→0、2→1、3→3、4→4 | API 處理後為 `CC(C)CC`；原始輸入的 Atom 1 與 Atom 3 沒有直接鍵，不能直接套用 |
| `CC(O)CC` | butan-2-ol | 1→0、2→1、3→3、4→4 | 氧不是主體碳標號對象 |
| `CC=CCC` | pent-2-ene | 1→0、2→1、3→2、4→3、5→4 | 5 碳主鏈 |
| `CC(C)CC(=O)O` | 3-methylbutanoic acid | 1→4、2→3、3→1、4→0 | 原需求把此 SMILES 誤標成 4-methylpentanoic acid |
| `CC(C)CCC(=O)O` | 4-methylpentanoic acid | 1→5、2→4、3→3、4→1、5→0 | 已向 API 核對名稱與映射；此正確案例已替換測試頁中的錯誤對照 |
| `C1CCCCC1` | cyclohexane | 1→0、2→1、3→2、4→3、5→4、6→5 | 6 碳主環 |

## 原子索引差異與繪圖方式

RDKit.js 本機解析結果顯示：

- `CC(C)CC` 與 `CCC(C)C` 是相同化合物，但輸入字串的 Atom Index 排列不同。
- OpenClatura 對這兩個輸入回傳相同的處理字串 `CC(C)CC` 與同一組主鏈定位號。使用者實測列也顯示原始 `CCC(C)C` 下，locant 2→3 對應的 Atom 1–3 不是直接化學鍵，證明 API ID 不可直接用於該原始 RDKit 分子。
- 以 API 的 `Processed SMILES` 重新解析只能統一字串，不能統一 API graph ID。正式 GUI 必須先驗證並轉換 `Atom ids in that SMILES` 的完整標記，再檢查元素、母體完整性及連通性。
- RDKit.js 既有 `svgWithNumberLabels()` helper 可產生碳定位號文字；本機 WASM 實測成功生成 C1–C4 標籤 SVG。只有完成 ID 對照轉換後的解析索引，才可傳給顯示分子。

### 咖啡因真實 API 回應回歸（2026-11-20）

輸入 `Cn1c(=O)c2c(ncn2C)n(C)c1=O`。真實 `/describe?format=json&verify=0` 回傳名稱 `1,3,7-trimethyl-3,7-dihydro-1H-purine-2,6-dione`、處理後字串 `Cn1c2c(=O)n(C)c(=O)n(C)c2nc1`，及標記字串 `C{0}n{1}1c{2}2c{3}(=O{13})n{4}(C{5})c{6}(=O{12})n{7}(C{8})c{9}2n{10}c{11}1`。

API 母體定位號 1 指向 graph ID 4（N），但處理後 SMILES 的 RDKit index 4 是 O；graph ID 4 實際對應解析 index 5。原失敗源於混用了這兩種索引，與 Edge 或互變異構無關。修正後碳定位號對應解析索引為 C2→7、C4→11、C5→2、C6→3、C8→13；N 佔用的定位號 1、3、7、9 不補編碳號。

安全策略：去除標記後必須與 `Processed SMILES` 完全相同；標記需涵蓋全部解析原子、ID 唯一且完整；母體 ID 必須全部存在於對照中，再進行原有元素、結構／立體相等性及母體連通檢查。缺少、不完整、重複或不一致標記一律拒絕，不依元素猜配。真實回應保存於 `RDKit/tests/fixtures/openclatura-caffeine.json`。`iupac-caffeine.test.js`、`iupac-numbering.test.js`、`smiles-help.test.js` 均通過，使用隨附真實 RDKit WASM；包含 9 母體原子／10 環內鍵、bracket atoms／芳香／Cl／Br 及損壞標記拒絕案例。此回歸仍不代表完成 Edge 瀏覽器驗收。

## 化學輸入修正

原清單中的 `CC(C)CC(=O)O` 不是 4-methylpentanoic acid；OpenClatura 回傳 **3-methylbutanoic acid**。另外，曾加入測試頁的 `CCC(C)CC(=O)O` 也不是 4-methylpentanoic acid，而是 **3-methylpentanoic acid**。API 確認的 4-methylpentanoic acid SMILES 是 **`CC(C)CCC(=O)O`**，回傳主體長度 5，定位號映射如上表。

測試頁已在提交 `8ccbf50` 修正該對照。使用者前一次回報的 8/8 技術成功數是在此修正前完成；更新後新增的正確 4-methylpentanoic acid SMILES 已完成 API 查詢核對，但應在 Pages 更新後再按一次該列，補足修正版本的瀏覽器端驗證。

## 範圍與限制

本階段只驗證 API、原子索引依據與 SVG 標號可行性，沒有接線到正式 GUI。正式整合由 Sol 負責；建議依本報告採用以下不變條件：

1. 呼叫 API 的 SMILES 與原始 GUI 分子索引不可假定一致。
2. 從 API `paragraphs` 取得 `Processed SMILES` 與完整 atom-id 標記，嚴格轉換 graph ID 至解析索引後建立顯示分子；缺少資料、解析失敗或映射無效時不猜標號。
3. 只顯示 `atom_symbols_by_locant[locant] === "C"` 的主體碳。
4. 結構變更時丟棄舊映射並重新查詢；API 失敗時保留原繪圖功能。
5. 後續需在正式 GUI 驗收開關編號、主體高亮、不同佈局／旋轉／鏡射、結構修改競態與離線回退；這些尚未由獨立測試頁涵蓋。

## 測試頁與程式範圍

- 瀏覽器測試頁：[test/rdkit-iupac.html](../test/rdkit-iupac.html)
- 原 OpenClatura 測試入口：[test/index.html](../test/index.html)
- 正式繪圖入口與 renderer 已加入 OpenClatura 流程。下節記錄本次整合及尚待驗收事項。

## 正式 GUI 整合（2026-11-20）

- 編號選單新增按需啟用的「IUPAC 母體碳」模式。選用時才呼叫 OpenClatura；成功結果在目前頁面快取。API 回應解析 `Processed SMILES`，以 RDKit canonical SMILES equality 確認其與目前結構相同，再嚴格依完整 atom-id 標記將 graph ID 轉成顯示分子的解析索引。若 API、對照、解析、相等性檢查或標號繪製失敗，保留未標號的普通結構。
- 請求取消與過期回應有保護，避免輸入結構已變更後套用舊結果。結構變更會清除自訂編號調整。精簡編輯區允許修改已標示母體碳的文字、留空隱藏標籤，或還原該碳的 API 編號；目前不能為任意支鏈碳新增標籤。
- SMILES 資訊列旁提供外連至 OpenClatura 根頁，供手動複製 SMILES、查詢及貼回；不帶入查詢內容，也沒有深連結。氫顯示維持一般表示與全部展開兩種；未展開時依結構標示正常的 OH／NH 等氫。頁面小字列出 RDKit.js、OpenClatura 與授權資訊。
- 本節描述程式行為，不代表本次完成實際瀏覽器 QA。歷史上的 GitHub Pages 測試頁 8/8 回報仍保留於上方；它不涵蓋正式 GUI 的完整互動，也是在酸例修正前完成。

### 尚待實際瀏覽器驗收

1. 在 GitHub Pages 部署副本與本機靜態伺服器分別載入 RDKit.js/WASM，首次按 IUPAC 編號時確認模組按需載入、API fetch 與快取行為，並查看 Network/CORS 結果。
2. 測試 `CCCC`、`CC(C)CC`、`CCC(C)C`、含氧官能基、正確酸例 `CC(C)CCC(=O)O` 及環狀例；確認母體碳標籤位置與名稱，並確認碳以外原子不被標號。
3. 測試版面樣式切換、旋轉／鏡射、氫的一般／全部展開、SVG/PNG/複製匯出，確認標號與正常 OH／NH 顯示正確。
4. 編輯、清空、還原可編輯母體碳標籤；更換結構時確認調整清除。快速連續切換結構／模式並取消請求，確認不會套用過期結果。
5. 阻擋網路或模擬 API 格式錯誤，確認錯誤訊息與未編號普通繪圖仍可用；檢查 OpenClatura 外連只開根頁、不含 SMILES 查詢參數。

自動測試通過的是程式行為與真實 RDKit WASM 繪圖；OpenClatura API 在本輪測試使用模擬回應。整合後尚未在瀏覽器實際呼叫 API，也尚未對 GitHub Pages 部署副本做上述手動驗收。
