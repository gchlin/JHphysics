const rabbit = document.getElementById('rabbit');
const message = document.getElementById('message');
const container = document.querySelector('.container');

// 1. 建立一個存放所有句子的陣列 (list)
const phrases = [
    '我是兔老闆',
    '我愛鼎泰豐',
    '我愛臭豆腐',
    '我愛義大利麵'
];

// 2. 建立一個變數來追蹤現在輪到第幾個句子 (從 0 開始)
let currentIndex = 0;

container.addEventListener('click', () => {
    // 如果正在跳躍中，就不要再觸發，防止動畫錯亂
    if (rabbit.classList.contains('jump')) {
        return;
    }

    // 觸發跳躍動畫
    rabbit.classList.add('jump');

    // 3. 根據目前的 `currentIndex` 來更新文字內容
    message.textContent = phrases[currentIndex];

    // 讓訊息顯示出來
    message.style.visibility = 'visible';

    // 4. 更新索引，準備下一次點擊
    // 使用 % (取餘數) 運算子可以巧妙地實現循環
    // 例如：(0+1)%4=1, (1+1)%4=2, (2+1)%4=3, (3+1)%4=0
    currentIndex = (currentIndex + 1) % phrases.length;

    // 動畫結束後移除 class，以便下次點擊能再次觸發
    rabbit.addEventListener('animationend', () => {
        rabbit.classList.remove('jump');
    }, { once: true });
});