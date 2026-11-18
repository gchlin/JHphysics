# SMILES 求助：邊界測試

在儲存庫根目錄執行（使用現有 Node 與本地 RDKit，不需安裝套件或連外）：

```powershell
node RDKit/RDKit/tests/smiles-help.test.js
node RDKit/RDKit/tests/name-lookup.test.js
node RDKit/RDKit/tests/history-store.test.js
```

腳本使用實際 `script.js` 的查表、候選、繪製流程與事件處理器及 `name-lookup.js`，載入現有 RDKit WebAssembly 真正解析 SMILES。名稱服務使用固定回應，不連網；DOM、剪貼簿與畫面量測採簡化替身。因此腳本通過不等於完成實機視覺、無障礙或作業系統剪貼簿驗收。測試不會開啟 Gemini 或傳送問題；實際頁面按繪製查詢未收錄名稱則會向 OPSIN／PubChem 送出文字。

## 輸入邊界

每列先清空輸入欄，輸入下列文字並按「繪製」。自動欄的「已測」表示上述腳本包含此項；真實畫面仍可照表複查。

| 輸入 | 預期結果 | 自動 |
|---|---|---|
| 空字串、空格／Tab／換行／全形空格 | 提示先輸入；不顯示名稱求助 CTA。打開求助顯示「請填入…」佔位文字 | 已測 |
| `4-bromo-2-methylbenzoic acid` | 本機未收錄、無法作為 SMILES，先查 OPSIN，失敗再查 PubChem；兩者未找到才顯示 Gemini CTA，不宣稱名稱有錯 | 已測固定未找到回應；live 實際答案依服務結果 |
| `四溴雙酚甲` | 同上；這是測試用中文文字，不以此推定真實化合物存在；外部中文名稱不保證收錄 | 已測固定未找到回應 |
| `CCO` | 可繪圖，出現「結構已繪製，請確認是否為你要的化合物。」；不出現名稱 CTA | 已測 |
| `C1(` | 解析失敗；名稱 API 亦未找到時，顯示各服務說明與求助 CTA | 已測固定未找到回應 |
| `CO` | 顯示一氧化碳與依 SMILES 解析等候選，等待選擇，不逕自畫成唯一答案 | 已測 |
| `C2H6O` | 顯示乙醇／二甲醚候選；候選不代表全部可能結構 | 已測 |
| `C99H200` | 未收錄分子式且無法直接當 SMILES；顯示歧義引導及求助，不送名稱 API，不聲稱找到全部異構物 | 已測 |
| `三酸甘油酯` | 保留組成不固定／需具體分子的概念說明，不冒充唯一結構，不顯示名稱未收錄 CTA | 已測 |
| `<img src=x onerror=alert(1)> " & <script>alert(1)</script>` | 提示詞保留為文字；服務失敗只顯示友善錯誤。不得產生圖片、執行程式或跳出 alert | `textContent`／`value` 寫入路徑已測；非真實瀏覽器 XSS 執行測試 |

## 狀態、複製與非同步

輸入區只有一個持續可見的查詢狀態列，以 `data-kind` 區分狀態。初始／修改輸入為 `idle`；本機結果為 `local-found`、直接 SMILES 為 `smiles`、連網中為 `querying-opsin`／`querying-pubchem`、線上成功為 `remote-found`、候選待選為 `candidates`。成功來源不會在繪製結束後消失；只有實際命中成功快取才標示「快取」。兩服務都查無為 `not-found`；連線失敗及逾時分為 `connection-error`／`timeout`。尺寸等設定錯誤為 `settings-error`，不當作搜尋失敗。以上狀態、來源及取消後回 idle 已加入自動測試；實機可見性仍需下方瀏覽器驗收。

Gemini 失敗引導依真實服務結果顯示：只有 OPSIN 與 PubChem 都確實查無，才說「可能是 IUPAC 或俗名，繪圖需要 SMILES，已查找但未找到」，並引導取得 SMILES 後貼回。任一服務連線失敗、逾時或回傳資料不可用時，改說「未能完成查詢，尚不能判定」，不把服務故障當成查無或名稱錯誤。未收錄分子式則另說明多解與未送名稱 API，提供「複製分子式的 Gemini 查詢提示詞」。自動測試包含合法名稱 `(2E,4E)-hexa-2,4-dienoic acid` 的模擬查無，不因查無而判定名稱不正確；也涵蓋單服務查無、另一服務網路失敗的混合情境。

結構下方的 SMILES 列只顯示當次成功繪製的結構，所有本機、直接解析與線上結果均適用；「複製」只複製該列。新輸入、開始重新繪圖及清預覽時隱藏並禁用，防止複製舊結果。剪貼簿不存在或拒絕時選取唯讀文字供手動複製。自動測試涵蓋真 RDKit R↔S 事件後更新、應用程式旋轉／鏡射流程保持該值、兩種剪貼失敗、清預覽及舊繪圖競態；不替代 renderer 的圖形組態測試或 OS 剪貼簿實測。來源 details 只顯示來源，不再重複 SMILES。

| 實際步驟 | 預期結果 | 自動 |
|---|---|---|
| 輸入 `first query`，開求助，再改為 `second query` | 面板提示詞立即改成新輸入 | 已測 |
| 載入苯範例（或 console 呼叫 `loadCode('c1ccccc1', 'benzene')`） | 求助使用程式載入的新值，成功後提示確認結構 | 已測程式載入路徑 |
| console 設定 `document.querySelector('#structureInput').value='latest query without input event'`，直接按複製 | 複製時重新讀取最新值，不依賴先前 input 事件 | 已測 |
| 複製查詢提示詞，貼到本機文字編輯器 | 完整文字包含目前輸入；面板保持開啟，仍可點 Gemini | 替身已測；OS 剪貼簿需手測 |
| 瀏覽器拒絕剪貼簿權限／API 不存在，再按複製 | 不崩潰；面板保持開啟，提示詞被選取，可 Ctrl/Cmd+C 手動複製 | 兩種替身已測；實機權限需手測 |
| 已成功繪圖後改輸入；或將高度設為自訂 `31` cm 再繪製 | 新輸入清成功提示及名稱 CTA；高度錯誤僅提示尺寸問題，不顯示名稱 CTA | 已測 |
| 在 DevTools 將繪圖回傳暫停，繪製 `CCO` 後立刻改成 `new query`，再繼續舊繪圖 | 舊成功或舊錯誤不得覆寫新輸入狀態；不顯示舊確認提示／名稱 CTA；繪製按鈕可再次操作、匯出仍禁用 | 已測受控延遲的成功／失敗兩路 |
| 成功後呼叫 `clearPreview()`／改成錯誤輸入再繪製 | 清除成功提示，不殘留在空白預覽 | 失敗清除路徑已測 |

原先 input 事件未使等待中的 render 失效，舊結果可能覆寫新輸入。修正為輸入時遞增 render 版本並解除 loading；舊 await 結果不再更新 UI。開始新繪圖也先清除舊成功提示。這不驗證 RDKit 所有內部非同步行為。

回歸證據：在記憶體中移除 input 的版本遞增與 loading 重設後，使用同一腳本可重現舊成功結果讓確認提示重新出現，測試斷言失敗；保留修正則全部通過。未為此回改磁碟檔案。

## 必須手動的瀏覽器驗收

歷史自動測試涵蓋成功才寫入、候選未選不寫入、30 筆上限、SMILES 去重最近優先、重建 store 後讀回及持久清除、schema／長度／來源 URL allowlist、儲存禁止／損壞／容量不足降級、歷史點選不查 API、非法保存 SMILES 解析失敗不送 API、安全 DOM 文字、R↔S 後不沿用來源及一般 IUPAC 名稱、Escape 與 aria。localStorage 替身驗證存取契約，尚需下列真實瀏覽器驗收：

- 成功畫兩個分子，打開「歷史」，最近結果在上方；重新整理仍可見。只打開候選不選取時不增加記錄。
- 點歷史結果，Network 不應新增 OPSIN／PubChem 請求，狀態顯示「歷史」；原名稱保留在記錄中，輸入列使用保存的 SMILES。清除後重新整理仍為空態。
- DevTools 封鎖 storage，或將 `rdkit-studio-history-v1` 設成壞 JSON，重整並成功繪圖仍可操作；打開歷史應提示僅本頁記憶體。若無法清除磁碟資料，應如實提示從瀏覽器網站資料清除，不宣稱已永久刪除。
- 歷史面板可用鍵盤開啟、關閉，Escape 關閉並回到歷史按鈕；320／375 px 下列表可捲動、名稱與長 SMILES 不造成橫向裁切。

從儲存庫根目錄執行 `python -m http.server 8000`，開啟 `http://127.0.0.1:8000/rdkit-studio/`。以下未在實機瀏覽器完成，請勿當作已通過：

1. **桌面短視窗**：設為約 1024×600，展開求助、觸發未知名稱 CTA。左欄可捲到底、樣式控制可操作；面板不遮住輸入或複製入口。
2. **320／375 px 手機**：DevTools 裝置模式切換兩種寬度，重複上述操作。文字與兩個動作可換行，不需橫向捲動；軟鍵盤打開時仍能找到輸入與求助內容。
3. **鍵盤**：Tab 到「不知道 SMILES？」；Enter／Space 開關。開啟時 `aria-expanded=true`，關閉為 false。Tab 可到提示詞、複製及 Gemini 連結，Escape 關閉，焦點可繼續移動。腳本只驗證 click／Escape 處理器與 aria，不模擬瀏覽器原生鍵盤操作或讀屏。
4. **外點行為**：面板開啟時點未知名稱 CTA，應能複製並保持面板開啟；點一般外部區域應收起；面板內選文字及按複製不應誤關閉。CTA 的 pointerdown 排除已自動測試。
5. **安全連結與傳輸**：檢查「開啟 Gemini」連結為 `https://gemini.google.com/`、新分頁、`rel="noopener noreferrer"`，沒有輸入值或查詢參數（靜態標記已自動測試）。Network 面板確認展開求助／修改／複製不產生 Gemini 查詢；只有手動點外連才開啟網站，使用者仍需自行貼上。無需把測試內容真的送給 Gemini。

## 名稱 API 邊界與 live smoke

`name-lookup.test.js` 的固定回應測試包含 OPSIN 成功／WARNING／未找到、PubChem fallback／多筆／單筆強制確認／前 8 筆上限、保留原名稱空白及大小寫、成功快取上限、錯誤不快取、429／503、JSON 格式錯誤、非法 SMILES／非法立體語法、缺少 `SMILES` 但只有 `ConnectivitySMILES` 時拒絕使用、逾時與取消。每筆採用的 SMILES 由真實 RDKit 解析。整合腳本另外測試線上來源顯示、重繪命中快取、PubChem 酸鹽回傳名稱不被原輸入冒充、修改輸入取消正在進行的 HTTP。

人工 live smoke（會將下列名稱送至公開服務）：輸入 `2-methylpentan-3-ol` 按繪製，應顯示 OPSIN 查詢狀態，成功後可展開來源及 SMILES。輸入 `Advil` 可測試 OPSIN 未找到後轉 PubChem 並要求確認候選；候選顯示服務回傳 IUPAC 名與分子式，選定後才繪製。品牌查詢結果不能代表商品所有成分；仍須確認具體化合物。另可用 `(S)-ibuprofen` 檢查酸／陰離子差異：不能只看原輸入名稱便認定是酸，應核對回傳名稱、式尾電荷及 SMILES。

2026-11-18 實際 HTTP 檢查：OPSIN `/ws/2-methylpropane.json` 回 `status:SUCCESS`、`smiles:CC(C)C`，並對 `Origin: http://localhost:8000` 回同值 `Access-Control-Allow-Origin`；PubChem `loratadine/property/SMILES,IUPACName,MolecularFormula/JSON` 回 HTTP 200，實際欄位為 `PropertyTable.Properties[].SMILES`，CORS 為 `*`。因此不需新增代理服務。另參照 [PubChem 官方欄位規格](https://pubchem.ncbi.nlm.nih.gov/pcfe/docs/markdown/pug-rest.md)，`SMILES` 含立體與同位素資訊，`ConnectivitySMILES` 不含；不可互換。這些是 HTTP／標頭檢查，尚非真實瀏覽器端到端驗證，服務可用性及收錄內容可能改變。

同日另以新名稱模組＋Node fetch＋本地真 RDKit 實測：`2-methylpentan-3-ol` → OPSIN `CC(C)C(CC)O`；`ibuprofen` 也由 OPSIN 成功處理；`Advil` → OPSIN 失敗後 PubChem CID 3672，回傳 IUPAC 名、分子式、SMILES 並要求確認。此為實際模組整合連線測試，仍非瀏覽器端到端測試。

## 化學答案的人工邊界

本頁可驗證「本機是否收錄」、「SMILES 是否能被 RDKit 解析」與介面狀態；**合法 SMILES 不等於符合輸入名稱**，也不表示已經查證來源。

若日後人工測試 Gemini 回覆，請逐項核對原名稱、來源頁實際結構、分子式、電荷、酸鹽／質子化及 R/S、E/Z。`C2H6O` 不足以指定乙醇；`CO` 同時有分子式及 SMILES 語境；未指定立體化學不應自行補上；混合物先問具體成分。有歧義應先提問／列候選，不應先給唯一最終答案。提示詞能表達這些要求，無法保證 Gemini 遵守；本測試不連外驗證 Gemini 答案。

## Repository 接續紀錄

切換帳號或模型後，先在主儲存庫與 `RDKit/RDKit` 各執行 `git log -5 --oneline`、`git status --short`，再讀取現有差異。兩個目錄是各自的提交紀錄，前端檔需同步；不要用舊對話 context 覆蓋已完成的新檔案。若發現另一帳號仍寫入，先協調再編輯。各階段由負責驗收者 review／commit 後再接續下一階段。
