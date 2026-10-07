# RDKit SVG Studio（GitHub Pages 版本）

此目錄是主網站首頁連結的靜態部署副本。`index.html`、`styles.css`、`script.js`、`renderer.js` 與範例圖檔來自 `../RDKit/RDKit/`；RDKit.js 2025.3.3-1.0.0 的 JavaScript、WebAssembly 和授權文件存放於 `vendor/`。樣式控制區的「CoordGen 排版」開關可在 RDKit 原生 2D 排版和 CoordGen 之間切換。

頁面提供旋轉、化學組態保真的鏡射、立體標註、SVG 與 300/600 DPI PNG。鏡射前後會核對 RDKit 的 R/S 和 E/Z 標記。ACS 預設僅作樣式參考；芳香環圓圈和 PDF/EPS 尚未實作。形式電荷始終顯示。

從儲存庫根目錄執行 `python -m http.server 8000`，開啟 `http://127.0.0.1:8000/rdkit-studio/` 即可在本機使用。發布 GitHub Pages 時，此目錄須與首頁一同提交。
