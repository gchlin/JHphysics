# 化學繪圖功能計畫：測試報告

測試日期：2026-11-19

## 計畫完成狀態

| 階段 | 狀態 | 程式碼檢查結果 |
|---|---|---|
| 第一階段：教學標色 | 已實作 | 有標示工具列、直接點選、元素／官能基選取、套用與清除，以及匯出處理。 |
| 第二階段：環與基團縮寫 | 未實作 | 未找到環候選選取或展開／簡明／自選縮寫模式。 |
| 第三階段：反應圖 | 未實作 | 頁面仍以單一結構為輸入；未找到反應物／產物介面、`get_rxn` 呼叫或反應 SVG 流程。 |

計畫原文提到「已實測目前套件 `get_rxn` 與反應 SVG 輸出」，但本次程式碼與測試目錄未找到對應的應用程式流程或測試，因此無法重現或確認這項底層能力。

## 已執行的自動測試

以下測試於儲存庫根目錄執行，全部通過：

| 指令 | 結果 |
|---|---|
| `node RDKit/RDKit/tests/highlight-selection.test.js` | 通過：元素與八種官能基辨識、正反例、多個匹配、分子不變性；使用隨附 RDKit WASM。 |
| `node RDKit/RDKit/tests/highlight-integration.test.js` | 通過：點選幾何、變換／立體／氫／編號相容性、套用清除、重繪保留、換分子與氫模式重設、匯出隔離。 |
| `node RDKit/RDKit/tests/studio-ui.test.js` | 通過：UI 狀態、教學預設、唯一 ID、HTML 結構及預覽／控制區分離。 |
| `node RDKit/RDKit/tests/steroid-numbering.test.js` | 通過：範例化合物、SMILES 順序、旋轉、鏡射、展開氫及不支援分子。 |
| `node RDKit/RDKit/tests/name-lookup.test.js` | 通過：名稱查詢固定回應、驗證、fallback、逾時與取消等。 |
| `node RDKit/RDKit/tests/history-store.test.js` | 通過：歷史保存、去重、儲存失敗與資料驗證。 |
| `node RDKit/RDKit/tests/smiles-help.test.js` | 通過：SMILES 求助邊界、實際 RDKit 解析與競態處理。 |

## 官能基邊界測試

使用 `rdkit-studio` 隨附 WASM 與 `highlight-selection.js`，另外檢查以下案例：

| 案例 | 輸入 SMILES | 預期與結果 |
|---|---|---|
| 羧酸不誤判為醇或酯 | `CC(=O)O` | 通過：羧酸 1、醇 0、酯 0。 |
| 酯不誤判為羧酸或醇 | `CC(=O)OC` | 通過：酯 1、羧酸 0、醇 0。 |
| 酚羥基不誤判為一般醇 | `c1ccccc1O` | 通過：酚 1、醇 0。 |
| 醯胺不誤判為一般胺 | `CC(=O)N` | 通過：醯胺 1、胺 0。 |
| 不同官能基可在同一分子分別辨識 | `CC(=O)CCN` | 通過：酮 1、胺 1。 |
| 甲醛辨識 | `C=O` | **失敗**：預期醛 1，實際醛 0。 |
| 苯環不誤判為醛或酮 | `c1ccccc1` | 通過：醛 0、酮 0。 |

### 已知失敗與限制

目前醛基 SMARTS 要求羰基碳連接另一個碳，因而漏掉甲醛。若第一階段要求涵蓋甲醛，需調整辨識規則並新增回歸測試。此次只執行測試，沒有修改程式碼。

自動測試不取代實際瀏覽器驗收；手機／桌面排版、觸控、鍵盤焦點與實際剪貼簿行為仍需人工檢查。本報告未執行這些檢查。

## 部署副本檢查

比對 `RDKit/RDKit/` 與 `rdkit-studio/` 的 `index.html`、`styles.css`、`script.js`、`name-lookup.js`、`renderer.js`、`compound-aliases.json`、`highlight-selection.js`，七個檔案的 SHA-256 均一致。
