# 在瀏覽器產圖後維持文件中的實體尺寸

這份筆記記錄 RDKit SVG Studio 的做法，供日後開發圖表、流程圖、數學圖或其他會貼進 Word／PowerPoint 的工具時參考。核心原則是**分開處理圖形內容、文件尺寸、點陣像素和剪貼簿格式**。只改 CSS 預覽大小，不能決定文件中的大小。

## 1. 先定義使用者要鎖定的是什麼

- **固定畫布高度**：適合講義與題目。使用者指定 2、5、10 cm 或自訂高度；以實際圖形的邊界計算寬高比，寬度自動變動。旋轉後重新計算邊界，但高度仍是指定值。
- **固定鍵長**：適合比較不同分子。相同百分比下，鍵長、原子文字和鍵線寬度使用相同的實體比例；畫布的寬與高都由結構決定。本站的 100% 鍵長為 0.508 cm，參考 [ACS 圖稿規格](https://researcher-resources.acs.org/publish/author_guidelines/pdf?coden=ansadg)，透過 [RDKit `fixedBondLength`](https://www.rdkit.org/rdkitjs/beta/GettingStartedInJS.html) 繪製。

這兩種模式不能同時保證「所有分子高度一樣」和「所有分子鍵長一樣」；長鏈與小環的外形不同，必須讓使用者選擇優先條件。

## 2. 把圖形包絡盒轉成畫布尺寸

RDKit 先產生 SVG。`renderer.js` 的 `fitSvgToArtwork()` 量測實際路徑、文字等圖形元素的邊界，四周加入留白，再改寫 SVG 的 `viewBox`。背景矩形不能納入圖形邊界，否則整張原始畫布的空白也會留下。

固定高度時：

```text
內部高度 px = round(指定高度 cm × 300 / 2.54)
內部寬度 px = round(內部高度 px × 圖形邊界寬 / 圖形邊界高)
實體寬度 cm = 內部寬度 px ÷ (300 / 2.54)
```

固定鍵長時，以指定的鍵長產生結構，再按內容裁切 SVG。裁切只改畫布的 `viewBox`，不把分子重新縮放。這能避免兩個分子雖然輸出尺寸不同，鍵卻被各自撐大到相同寬度。

## 3. SVG 和 PNG 各自寫入實體尺寸

SVG 匯出時，在根元素寫入 `width="4.39cm" height="5.00cm"` 這類**帶單位**的尺寸，同時保留對應的 `viewBox`。`width`／`height` 是文件中的預設尺寸，`viewBox` 決定內容如何映射到畫布。狀態列顯示同一組公分數值，避免 UI 與檔案互相矛盾。

PNG 匯出時，不用預覽圖片的螢幕像素數推算尺寸，而是從公分與使用者選的 DPI 計算：

```text
pixelWidth  = round(widthCm  / 2.54 × DPI)
pixelHeight = round(heightCm / 2.54 × DPI)
pixelsPerMeter = round(DPI / 0.0254)
```

例如高度 5 cm：300 DPI 是 591 像素，600 DPI 是 1181 像素；兩張圖在文件中的目標高度都是 5 cm。PNG 的 `pHYs` 區塊要寫入每公尺像素數，並重新計算 CRC。若瀏覽器輸出的 PNG 已有 `pHYs`，先移除舊區塊，避免重複。 [Microsoft 說明 `pHYs` 對 Word 判斷 PNG 實體像素大小的作用](https://learn.microsoft.com/en-us/troubleshoot/windows-client/printing/png-images-not-correctly-change-display-scaling)。

## 4. 「下載後插入」和「複製後貼上」是兩條路徑

下載的 PNG 檔保留 `pHYs`，可用圖片工具讀回像素與 DPI。瀏覽器的 `navigator.clipboard.write()` 則可能在處理 `image/png` 時重編碼圖片，移除 `pHYs`；本站在 Chromium 實測曾讀回沒有 `pHYs` 的剪貼簿 PNG。因此，不能只因下載檔正確，就認定貼上 Word 的尺寸也正確。

本站複製 PNG 時，同時放入：

1. `image/png`，供一般圖片貼上使用。
2. `text/html`，內含同一張 PNG 的資料 URL、`style="width:...cm;height:...cm"`，以及以 96 DPI 換算的 HTML `width`／`height` 備援值。

Word／PowerPoint 會自行決定採用哪一種剪貼簿格式；網頁無法強制它們選用 HTML，也不能保證文件頁寬、圖片佔位或使用者的貼上設定不會再縮放。因此**下載檔的實體尺寸可以由本站驗證，跨程式貼上結果仍需在目標版本實測**。

## 5. 驗收時分層檢查

1. 同一分子在固定高度模式下旋轉，狀態列和 SVG 的 `height` 仍相同。
2. 不同分子在固定鍵長模式下，鍵長相同，畫布寬高依內容變動。
3. 300／600 DPI 的 PNG 像素數按比例變動；各自的 `pHYs` 換算回相同公分尺寸。
4. 檢查 PNG 非透明圖形的邊界，確認沒有大片多餘空白。
5. 分別檢查下載檔、剪貼簿內容及目標 Word／PowerPoint 的實際貼上尺寸。不要以網頁預覽大小代替其中任何一步。

Word 的行內圖片仍會撐高所在段落。固定高度保證不同結構使用一致的圖片高度；若段落行高不應被圖片影響，還需要在文件中使用浮動排版或其他版面容器。
