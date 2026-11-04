const animations = {
    elastic_ex3: '滑車與彈簧碰撞',
    elastic_ex4: '多物體彈性碰撞',
    non_elastic_ex1: '完全非彈性碰撞',
    non_elastic_ex2: '單擺與小球碰撞'
};
const components = {
    'PHASE-CLOCK-CURRENT': {
        source: 'material/phase-control-styles.html',
        instruction: '沿用弧形按鈕週期圈；內圈正常、外圈慢速，點階段從起點播放，中央播放／暫停。最大壓縮只在物理模型有該狀態時提供。'
    },
    '0206004': {
        source: 'material/phase-control-styles.html',
        instruction: '沿用細線週期圈；內圈正常、外圈慢速，各階段可跳轉，保留播放／暫停及重設。'
    },
    'COLLISION-ENERGY-BARS': {
        source: 'material/collision-chart-materials.html',
        instruction: '參考 drawEnergyBars(ctx,state,layout)。動能及位能共用尺度，百分比放在條外，物體分色固定。非彈性碰撞需表示內能／耗散能，不能假設動能守恆，也不能把損失能量全部畫成彈簧位能。'
    },
    'COLLISION-MOMENTUM-VECTORS': {
        source: 'material/collision-chart-materials.html',
        instruction: '參考 drawMomentumVectors(ctx,state,layout)。共用固定 pxPerMomentum，P=p₁+p₂；分量上下錯開，用虛線連接首尾同一水平座標。保留負向與零值，避免箭頭和標籤互蓋。多物體時擴充為所有物體動量加總，不能漏算；單擺碰撞只在符合外力衝量條件的方向與時間區段使用動量守恆。'
    }
};
const combinedPrompt = document.getElementById('combinedPrompt');
const copyStatus = document.getElementById('copyStatus');

function buildPrompt() {
    const animation = document.querySelector('input[name="animation"]:checked').value;
    const clock = document.querySelector('input[name="clock"]:checked').value;
    const selected = [...document.querySelectorAll('input[name="component"]:checked')].map(input => input.value);
    if (clock !== 'none') selected.unshift(clock);
    const request = document.getElementById('request').value.trim();
    const lines = [
        `請製作教學動畫：${animations[animation]}。`,
        `動畫參考來源：book2/chapter3/${animation}.html。先讀取來源，確認物理模型與互動行為。`,
        '保留正確物理模型；依下列選定元件及風格整合。元件的示範數值不能代替此動畫的物理解算。',
        '', '選定元件：',
        ...selected.map(id => `${id}\n來源：${components[id].source}\n${components[id].instruction}`),
        ...(selected.length ? [] : ['沿用動畫本身必要控制，不額外加入圖表。']),
        '', '階段名稱及起訖須對應此動畫的實際事件；碰撞示範的三階段或最大壓縮不可生硬套用到不相符的物理模型。',
        ...(request ? ['', `老師補充需求：${request}`] : []),
        '', window.MaterialPrompts.requirements
    ];
    combinedPrompt.value = lines.join('\n');
    copyStatus.textContent = '';
    return combinedPrompt.value;
}
document.querySelectorAll('input, #request').forEach(input => input.addEventListener('input', buildPrompt));
document.getElementById('copyPrompt').addEventListener('click', async () => {
    const text = buildPrompt();
    try {
        await navigator.clipboard.writeText(text);
        copyStatus.textContent = '已複製';
    } catch {
        const details = document.getElementById('promptDetails');
        const wasOpen = details.open;
        details.open = true;
        combinedPrompt.focus(); combinedPrompt.select();
        let copied = false;
        try { copied = document.execCommand('copy'); } catch {}
        details.open = copied ? wasOpen : true;
        copyStatus.textContent = copied ? '已複製' : '請複製已選取的文字';
        if (copied) document.getElementById('copyPrompt').focus();
    }
});
buildPrompt();
