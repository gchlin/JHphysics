# 動畫素材參考

用途：老師挑選動畫與元件後，將來源、設計要求與技術防錯規則交給 AI。
請先讀來源再整合，不要將素材示範數據誤用為真實物理解算。

| 編號 | 參考檔案 | 程式定位 | 可組合用途 |
| --- | --- | --- | --- |
| CLASSROOM-SIMPLE | material/classroom-simple.css、material/index.html | flat section layout、animation-list、component-list | 精簡教學頁風格，動畫優先、控制集中、用細線分組 |
| PHASE-CLOCK-CURRENT | material/phase-control-styles.html | clock、draw、startPhase、resizeCanvas | 弧形階段選取及慢速播放 |
| 0206004 | material/phase-control-styles.html | legacyClock、drawLegacy、startLegacyPhase | 細線階段圈 |
| COLLISION-ENERGY-BARS | material/collision-chart-materials.html | drawEnergyBars(ctx, state, layout) | 同尺度動能／位能列 |
| COLLISION-MOMENTUM-VECTORS | material/collision-chart-materials.html | drawMomentumVectors(ctx, state, layout) | 正負動量與首尾相接關係 |

共同要求來源：`material/prompt-common.js` 的 `MaterialPrompts.requirements`。
素材標記使用 `MATERIAL_ID`，不依賴會隨編輯改變的行號。

動畫來源：
- book2/chapter3/elastic_ex3.html：滑車與彈簧、動能與位能交換。
- book2/chapter3/elastic_ex4.html：多物體彈性碰撞。
- book2/chapter3/non_elastic_ex1.html：完全非彈性碰撞。
- book2/chapter3/non_elastic_ex2.html：單擺與小球完全非彈性碰撞。

向量圖上下錯開分量以避免反向箭頭互相覆蓋；虛線連接 p₁ 終點與 p₂ 起點，
兩者的水平座標必須相同。P、p₁、p₂ 共用尺度，P = p₁ + p₂。
固定尺度須根據預期參數範圍與圖區寬度配置，不能每幀以當前總動量重新縮放。

共用 Canvas 圖表只負責繪製，不負責清除整張畫布。呼叫端提供有效物理狀態、
圖區配置及清除策略。手機版不能只縮小圖區，需另處理文字、按鈕與窄版布局。
