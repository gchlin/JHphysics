// data.js (完整擴充版)

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
    "H_8": { type: "text", content: "第八諧音", category: "H" },

    // 圖片選項類 - 兩端固定 (Category: Img_FF)
    "Img_FF_1": { type: "image", content: "assets/images/ff_1.png", category: "Img_FF" },
    "Img_FF_2": { type: "image", content: "assets/images/ff_2.png", category: "Img_FF" },
    "Img_FF_3": { type: "image", content: "assets/images/ff_3.png", category: "Img_FF" },
    "Img_FF_4": { type: "image", content: "assets/images/ff_4.png", category: "Img_FF" },

    // 圖片選項類 - 一端固定 (Category: Img_FO)
    "Img_FO_1": { type: "image", content: "assets/images/fo_1.png", category: "Img_FO" },
    "Img_FO_2": { type: "image", content: "assets/images/fo_2.png", category: "Img_FO" },
    "Img_FO_3": { type: "image", content: "assets/images/fo_3.png", category: "Img_FO" },
    "Img_FO_4": { type: "image", content: "assets/images/fo_4.png", category: "Img_FO" }
};

// 2. 題目分堆

// --- PART 1: 看圖選字 ---

// Level 1: 兩端固定
const Level1_List = [
    { qType: "image", qContent: "assets/images/ff_1.png", aKey: "O_0" },
    { qType: "image", qContent: "assets/images/ff_1.png", aKey: "H_1" },
    { qType: "image", qContent: "assets/images/ff_2.png", aKey: "O_1" },
    { qType: "image", qContent: "assets/images/ff_2.png", aKey: "H_2" },
    { qType: "image", qContent: "assets/images/ff_3.png", aKey: "O_2" },
    { qType: "image", qContent: "assets/images/ff_3.png", aKey: "H_3" },
    { qType: "image", qContent: "assets/images/ff_4.png", aKey: "O_3" },
    { qType: "image", qContent: "assets/images/ff_4.png", aKey: "H_4" }
];

// Level 2: 一端固定
const Level2_List = [
    { qType: "image", qContent: "assets/images/fo_1.png", aKey: "O_0" },
    { qType: "image", qContent: "assets/images/fo_1.png", aKey: "H_1" },
    { qType: "image", qContent: "assets/images/fo_2.png", aKey: "O_1" },
    { qType: "image", qContent: "assets/images/fo_2.png", aKey: "H_3" },
    { qType: "image", qContent: "assets/images/fo_3.png", aKey: "O_2" },
    { qType: "image", qContent: "assets/images/fo_3.png", aKey: "H_5" },
    { qType: "image", qContent: "assets/images/fo_4.png", aKey: "O_3" },
    { qType: "image", qContent: "assets/images/fo_4.png", aKey: "H_7" }
];

// Level 3: 混合
const Level3_List = [...Level1_List, ...Level2_List];


// --- PART 2: 看字選圖 (逆向) ---

// Level 4: 兩端固定 (逆向)
const Level4_List = [
    { qType: "text", qContent: "基音 (兩端固定)", aKey: "Img_FF_1" },
    { qType: "text", qContent: "第一泛音 (兩端固定)", aKey: "Img_FF_2" },
    { qType: "text", qContent: "第二泛音 (兩端固定)", aKey: "Img_FF_3" },
    { qType: "text", qContent: "第三泛音 (兩端固定)", aKey: "Img_FF_4" },
    { qType: "text", qContent: "第一諧音 (兩端固定)", aKey: "Img_FF_1" },
    { qType: "text", qContent: "第二諧音 (兩端固定)", aKey: "Img_FF_2" },
    { qType: "text", qContent: "第三諧音 (兩端固定)", aKey: "Img_FF_3" },
    { qType: "text", qContent: "第四諧音 (兩端固定)", aKey: "Img_FF_4" }
];

// Level 5: 一端固定 (逆向)
const Level5_List = [
    { qType: "text", qContent: "基音 (一端固定)", aKey: "Img_FO_1" },
    { qType: "text", qContent: "第一泛音 (一端固定)", aKey: "Img_FO_2" },
    { qType: "text", qContent: "第二泛音 (一端固定)", aKey: "Img_FO_3" },
    { qType: "text", qContent: "第三泛音 (一端固定)", aKey: "Img_FO_4" },
    { qType: "text", qContent: "第一諧音 (一端固定)", aKey: "Img_FO_1" },
    { qType: "text", qContent: "第三諧音 (一端固定)", aKey: "Img_FO_2" },
    { qType: "text", qContent: "第五諧音 (一端固定)", aKey: "Img_FO_3" },
    { qType: "text", qContent: "第七諧音 (一端固定)", aKey: "Img_FO_4" }
];

// Level 6: 混合 (逆向)
const Level6_List = [...Level4_List, ...Level5_List];


// 匯出給 game.js 使用
const QuestionSets = {
    "level1": Level1_List,
    "level2": Level2_List,
    "level3": Level3_List,
    "level4": Level4_List,
    "level5": Level5_List,
    "level6": Level6_List
};

// 3. 對照表資料
const ReferenceTable = [
    // 兩端固定
    { type: "header", title: "兩端固定" },
    { type: "row", img: "assets/images/ff_1.png", val: "n=1", o: "基音", h: "第一諧音" },
    { type: "row", img: "assets/images/ff_2.png", val: "n=2", o: "第一泛音", h: "第二諧音" },
    { type: "row", img: "assets/images/ff_3.png", val: "n=3", o: "第二泛音", h: "第三諧音" },
    { type: "row", img: "assets/images/ff_4.png", val: "n=4", o: "第三泛音", h: "第四諧音" },

    // 一端固定
    { type: "header", title: "一端固定" },
    { type: "row", img: "assets/images/fo_1.png", val: "m=1", o: "基音", h: "第一諧音" },
    { type: "row", img: "assets/images/fo_2.png", val: "m=3", o: "第一泛音", h: "第三諧音" },
    { type: "row", img: "assets/images/fo_3.png", val: "m=5", o: "第二泛音", h: "第五諧音" },
    { type: "row", img: "assets/images/fo_4.png", val: "m=7", o: "第三泛音", h: "第七諧音" }
];