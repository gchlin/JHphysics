// data.js (表格修正版)

// 1. 選項資料庫
const AnswerBank = {
    // 泛音類 (Category: O)
    "O_0": { type: "text", content: "基音", category: "O" },
    "O_1": { type: "text", content: "第一泛音", category: "O" },
    "O_2": { type: "text", content: "第二泛音", category: "O" },
    "O_3": { type: "text", content: "第三泛音", category: "O" },
    "O_4": { type: "text", content: "第四泛音", category: "O" },
    "O_5": { type: "text", content: "第五泛音", category: "O" },
    "O_6": { type: "text", content: "第六泛音", category: "O" },

    // 諧音類 (Category: H)
    "H_1": { type: "text", content: "第一諧音", category: "H" },
    "H_2": { type: "text", content: "第二諧音", category: "H" },
    "H_3": { type: "text", content: "第三諧音", category: "H" },
    "H_4": { type: "text", content: "第四諧音", category: "H" },
    "H_5": { type: "text", content: "第五諧音", category: "H" },
    "H_6": { type: "text", content: "第六諧音", category: "H" },
    "H_7": { type: "text", content: "第七諧音", category: "H" },
    "H_8": { type: "text", content: "第八諧音", category: "H" }
};

// 2. 題目分堆
// Level 1: 泛音
const Level1_List = [
    { qType: "image", qContent: "assets/images/ff_1.png", aKey: "O_0" },
    { qType: "image", qContent: "assets/images/ff_2.png", aKey: "O_1" },
    { qType: "image", qContent: "assets/images/ff_3.png", aKey: "O_2" },
    { qType: "image", qContent: "assets/images/ff_4.png", aKey: "O_3" },
    { qType: "image", qContent: "assets/images/fo_1.png", aKey: "O_0" },
    { qType: "image", qContent: "assets/images/fo_2.png", aKey: "O_1" },
    { qType: "image", qContent: "assets/images/fo_3.png", aKey: "O_2" },
    { qType: "image", qContent: "assets/images/fo_4.png", aKey: "O_3" }
];

// Level 2: 諧音
const Level2_List = [
    { qType: "image", qContent: "assets/images/ff_1.png", aKey: "H_1" },
    { qType: "image", qContent: "assets/images/ff_2.png", aKey: "H_2" },
    { qType: "image", qContent: "assets/images/ff_3.png", aKey: "H_3" },
    { qType: "image", qContent: "assets/images/ff_4.png", aKey: "H_4" },
    { qType: "image", qContent: "assets/images/fo_1.png", aKey: "H_1" },
    { qType: "image", qContent: "assets/images/fo_2.png", aKey: "H_3" },
    { qType: "image", qContent: "assets/images/fo_3.png", aKey: "H_5" },
    { qType: "image", qContent: "assets/images/fo_4.png", aKey: "H_7" }
];

// Level 3: 綜合
const Level3_List = [...Level1_List, ...Level2_List];

// 匯出給 game.js 使用
const QuestionSets = {
    "level1": Level1_List,
    "level2": Level2_List,
    "level3": Level3_List
};

// 3. 對照表資料 (更新代號 m)
const ReferenceTable = [
    { type: "header", title: "兩端固定 (弦 / 開管) —— 代號 n" },
    { type: "row", img: "assets/images/ff_1.png", o: "基音", h: "第一諧音 (n=1)" },
    { type: "row", img: "assets/images/ff_2.png", o: "第一泛音", h: "第二諧音 (n=2)" },
    { type: "row", img: "assets/images/ff_3.png", o: "第二泛音", h: "第三諧音 (n=3)" },
    { type: "row", img: "assets/images/ff_4.png", o: "第三泛音", h: "第四諧音 (n=4)" },

    { type: "header", title: "一端固定 (閉管) —— 代號 m" },
    { type: "row", img: "assets/images/fo_1.png", o: "基音", h: "第一諧音 (m=1)" },
    { type: "row", img: "assets/images/fo_2.png", o: "第一泛音", h: "第三諧音 (m=3)" },
    { type: "row", img: "assets/images/fo_3.png", o: "第二泛音", h: "第五諧音 (m=5)" },
    { type: "row", img: "assets/images/fo_4.png", o: "第三泛音", h: "第七諧音 (m=7)" }
];