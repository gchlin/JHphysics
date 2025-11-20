const Game = (function() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playBeep(freq, type, duration = 0.1) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }

    // --- 渲染核心 ---
    function renderContentTo(element, dataObj, isOption = false) {
        element.innerHTML = ''; 
        if(!dataObj) return;
        let type, content;
        
        if (isOption) {
            const ansData = AnswerBank[dataObj];
            if (!ansData) { element.textContent = "Err"; return; }
            type = ansData.type; 
            content = ansData.content;
        } else { 
            type = dataObj.qType; 
            content = dataObj.qContent; 
        }

        if (type === 'image') {
            const img = document.createElement('img'); 
            img.src = content; 
            img.className = 'img-content'; 
            img.alt = 'content';
            element.appendChild(img);
        } else if (type === 'text') {
            const span = document.createElement('span'); 
            if (isOption) span.className = 'text-answer';
            span.textContent = content; 
            element.appendChild(span);
        }
    }

    // --- 遊戲狀態 ---
    let state = {
        mode: 'versus',
        targetScore: 0,
        scores: { p1: 0, p2: 0 },
        questions: { p1: null, p2: null },
        status: { p1: false, p2: false },
        firstSolver: null,
        timerVal: 0,
        timerInterval: null,
        currentList: [] 
    };

    // --- 初始化 (支援 Level & 練習模式按鈕) ---
    function init(mode, target = 0, levelKey = 'level3') {
        // 1. 音效初始化
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        // 2. 遊戲狀態初始化 (包含新增的鎖定狀態)
        state.mode = mode;
        state.targetScore = target;
        state.scores = { p1: 0, p2: 0 };
        state.status = { p1: false, p2: false };
        state.firstSolver = null;
        state.locked = { p1: false, p2: false }; // 【防作弊】重置鎖定狀態
        state.currentList = QuestionSets[levelKey] || QuestionSets['level3'];

        // 3. 介面顯示設定：練習模式隱藏 P1 (對手)
        const p1Area = document.getElementById('p1-area');
        if (mode === 'practice') {
            p1Area.style.visibility = 'hidden'; // 隱藏上方，但保留空間
        } else {
            p1Area.style.visibility = 'visible'; // 其他模式恢復顯示
        }

        // 4. 介面顯示設定：練習模式顯示「圖表」按鈕
        const tableBtn = document.getElementById('btn-ingame-table');
        if (mode === 'practice') {
            tableBtn.style.display = 'block';
        } else {
            tableBtn.style.display = 'none';
        }

        // 5. UI 重置 (清除上一局的分數與回饋)
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('score-p1').innerText = "0";
        document.getElementById('score-p2').innerText = "0";
        document.getElementById('feedback-p1').classList.add('hidden');
        document.getElementById('feedback-p2').classList.add('hidden');

        // 6. 設定目標分數文字
        const tText = (mode === 'versus') ? `/ ${target}` : "";
        document.getElementById('target-p1').innerText = tText;
        document.getElementById('target-p2').innerText = tText;

        // 7. 啟動倒數 -> 開始遊戲
        startCountdown(() => { realStartGame(); });
    }

    function startCountdown(cb) {
        const overlay = document.getElementById('countdown-overlay');
        const topNum = document.getElementById('cd-num-top'), botNum = document.getElementById('cd-num-bot');
        overlay.classList.remove('hidden');
        let count = 3;
        const run = () => {
            const txt = count === 0 ? "GO" : count;
            topNum.innerText = txt; botNum.innerText = txt;
            topNum.style.animation = 'none'; botNum.style.animation = 'none'; 
            topNum.offsetHeight; 
            topNum.style.animation = 'countPop 0.8s ease-out'; botNum.style.animation = 'countPop 0.8s ease-out';
            const color = count === 0 ? '#e74c3c' : '#2c3e50'; 
            topNum.style.color = color; botNum.style.color = color;
            if(txt === "GO") playBeep(880, 'square', 0.6); else playBeep(440, 'sine', 0.3);
            if (count < 0) { overlay.classList.add('hidden'); cb(); return; }
            count--; setTimeout(run, 1000);
        }; run();
    }

    function realStartGame() {
            const t1 = document.getElementById('timer-p1'), t2 = document.getElementById('timer-p2');
            if (state.mode === 'speed') { 
                state.timerVal = 30; 
                t1.innerText = "30"; t2.innerText = "30"; 
                startTimer(); 
            } else { 
                t1.innerText = "--"; t2.innerText = "--"; 
            }
            
            if (state.mode === 'versus') {
                generateVersusQuestion();
            } else { 
                // --- 修改這段：練習模式不產生 P1 題目 ---
                if (state.mode !== 'practice') {
                    generateIndependentQuestion('p1'); 
                }
                generateIndependentQuestion('p2'); 
            }
        }

    function startTimer() {
        clearInterval(state.timerInterval);
        state.timerInterval = setInterval(() => {
            state.timerVal--;
            document.getElementById('timer-p1').innerText = state.timerVal; 
            document.getElementById('timer-p2').innerText = state.timerVal;
            if (state.timerVal <= 0) { 
                clearInterval(state.timerInterval); 
                playBeep(200, 'sawtooth', 0.5); 
                endGame('TIME UP'); 
            }
        }, 1000);
    }

    function generateVersusQuestion() {
        state.status.p1 = false; state.status.p2 = false; state.firstSolver = null;
        document.getElementById('feedback-p1').classList.add('hidden'); 
        document.getElementById('feedback-p2').classList.add('hidden');
        const q = getRandomQuestion(); 
        state.questions.p1 = q; state.questions.p2 = q;
        renderSide('p1', q); renderSide('p2', q);
    }

    function generateIndependentQuestion(player) {
        state.status[player] = false; 
        document.getElementById(`feedback-${player}`).classList.add('hidden');
        const q = getRandomQuestion(); 
        state.questions[player] = q; 
        renderSide(player, q);
    }

    function getRandomQuestion() {
        const list = state.currentList;
        const qData = list[Math.floor(Math.random() * list.length)];
        
        const correctAnsData = AnswerBank[qData.aKey];
        if (!correctAnsData) {
            console.error("Error key:", qData.aKey);
            return { ...qData, opts: ["Err", "Err", "Err", "Err"] };
        }
        const targetCategory = correctAnsData.category;

        const allKeys = Object.keys(AnswerBank);
        const validDistractors = allKeys.filter(key => {
            const item = AnswerBank[key];
            return (item.category === targetCategory) && (key !== qData.aKey);
        });

        for (let i = validDistractors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [validDistractors[i], validDistractors[j]] = [validDistractors[j], validDistractors[i]];
        }
        const distractors = validDistractors.slice(0, 3);
        let options = [qData.aKey].concat(distractors);

        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }
        return { ...qData, opts: options };
    }

function renderSide(player, qObj) {
        const qEl = document.getElementById(`q-${player}`); 
        renderContentTo(qEl, qObj, false); 
        const grid = document.getElementById(`opts-${player}`); 
        grid.innerHTML = '';
        qObj.opts.forEach(optKey => {
            const btn = document.createElement('div'); 
            btn.className = 'option-btn';
            renderContentTo(btn, optKey, true);
            
            // --- 修正開始：解決多點觸控衝突 ---
            const handleInput = (e) => {
                // 關鍵：阻止瀏覽器預設行為 (如雙指縮放)，確保邏輯被執行
                // 加上 if (e.cancelable) 是為了避免某些瀏覽器報錯
                if (e.cancelable) e.preventDefault(); 
                handleAnswer(player, optKey, btn);
            };

            // 使用 addEventListener 綁定
            // { passive: false } 是必須的，允許我們使用 preventDefault
            btn.addEventListener('touchstart', handleInput, { passive: false });
            
            // 保留 mousedown 以支援電腦版測試 (避免 onclick 的延遲)
            btn.addEventListener('mousedown', handleInput);
            // --- 修正結束 ---

            grid.appendChild(btn);
        });
    }

    function handleAnswer(player, answerKey, btnElement) {
            // 1. 檢查是否已經答對(本題結束) 或 正在處罰冷卻中(locked)
            if (state.status[player]) return;
            if (state.locked && state.locked[player]) return; // 如果被鎖定，直接無視
            
            if (state.timerVal <= 0 && state.mode === 'speed') return;
            
            const currentQ = state.questions[player];
            
            if (answerKey === currentQ.aKey) {
                // --- 答對邏輯 (保持不變) ---
                btnElement.classList.add('correct-mark'); 
                state.status[player] = true; 
                showFeedback(player);
                
                if (state.mode === 'versus') {
                    if (state.firstSolver === null) { 
                        state.firstSolver = player; 
                        state.scores[player] += 2; 
                    } else { 
                        state.scores[player] += 1; 
                    }
                    updateScore();
                    if (state.scores[player] >= state.targetScore) setTimeout(determineWinner, 500);
                    else if (state.status.p1 && state.status.p2) setTimeout(generateVersusQuestion, 1000);
                } else {
                    state.scores[player]++; 
                    updateScore();
                    setTimeout(() => { if(state.mode !== 'versus') generateIndependentQuestion(player); }, 500);
                }
    
            } else { 
                // --- 答錯邏輯 (新增防作弊機制) ---
                
                // 1. 播放錯誤動畫
                btnElement.classList.add('shake'); 
                setTimeout(() => { btnElement.classList.remove('shake'); }, 400); 
                
                // 2. 扣分機制 (防止亂猜)
                // 如果分數大於 0 才扣分，避免負分打擊太大 (或者你可以狠一點直接扣)
                if (state.scores[player] > 0) {
                    state.scores[player] -= 1; 
                    updateScore();
                }
    
                // 3. 冷卻懲罰 (Lockout) - 關鍵防作弊
                // 初始化鎖定狀態 (如果不存在)
                if (!state.locked) state.locked = { p1: false, p2: false };
                
                state.locked[player] = true;
                
                // 視覺回饋：讓該玩家的選項區變半透明
                const grid = document.getElementById(`opts-${player}`);
                grid.style.opacity = "0.4";
                grid.style.pointerEvents = "none"; // 物理上禁止點擊
    
                // 0.8秒後解鎖
                setTimeout(() => {
                    state.locked[player] = false;
                    grid.style.opacity = "1";
                    grid.style.pointerEvents = "auto";
                }, 800); 
            }
    }

    function showFeedback(player) {
        const fb = document.getElementById(`feedback-${player}`); 
        const txt = document.getElementById(`wait-text-${player}`);
        fb.classList.remove('hidden'); 
        txt.style.display = (state.mode === 'versus') ? 'block' : 'none';
    }
    function updateScore() { 
        document.getElementById('score-p1').innerText = state.scores.p1; 
        document.getElementById('score-p2').innerText = state.scores.p2; 
    }
    function determineWinner() { 
        let winner = null; 
        if (state.scores.p1 > state.scores.p2) winner = 'p1'; 
        else if (state.scores.p2 > state.scores.p1) winner = 'p2'; 
        else winner = 'draw'; 
        endGame(winner); 
    }
    function endGame(result) {
        clearInterval(state.timerInterval); 
        document.getElementById('game-over').classList.remove('hidden');
        const t1 = document.getElementById('res-title-p1'), t2 = document.getElementById('res-title-p2');
        document.getElementById('res-score-p1').innerText = `Score: ${state.scores.p1}`; 
        document.getElementById('res-score-p2').innerText = `Score: ${state.scores.p2}`;
        t1.className = "result-title"; t2.className = "result-title";
        if (result === 'p1') { t1.innerText = "太棒啦！"; t1.classList.add('win-msg'); t2.innerText = "加油再練練！"; t2.classList.add('lose-msg'); }
        else if (result === 'p2') { t2.innerText = "太棒啦！"; t2.classList.add('win-msg'); t1.innerText = "加油再練練！"; t1.classList.add('lose-msg'); }
        else { t1.innerText = "平手！"; t2.innerText = "平手！"; if (state.scores.p1 > state.scores.p2) endGame('p1'); else if (state.scores.p2 > state.scores.p1) endGame('p2'); }
    }
    function showMenu() { 
        clearInterval(state.timerInterval); 
        document.getElementById('main-menu').classList.remove('hidden'); 
        document.getElementById('game-over').classList.add('hidden'); 
        document.getElementById('countdown-overlay').classList.add('hidden'); 
    }

    // --- 表格渲染 (更新版：支援代號欄位) ---
    function toggleTable(show) {
        const el = document.getElementById('ref-table-overlay');
        const tbody = document.getElementById('math-table-body');
        
        if(show) {
            tbody.innerHTML = ''; 
            const headerRow = document.createElement('tr');
            // 調整欄位寬度：圖, 代號, 泛音, 諧音
            headerRow.innerHTML = '<th style="width:35%">圖</th><th style="width:15%">代號</th><th style="width:25%">泛音</th><th style="width:25%">諧音</th>';
            tbody.appendChild(headerRow);

            if(typeof ReferenceTable !== 'undefined') {
                ReferenceTable.forEach(item => {
                    const tr = document.createElement('tr');
                    if (item.type === "header") {
                        tr.style.background = "#eee";
                        const td = document.createElement('td');
                        td.colSpan = 4; // 跨 4 欄
                        td.style.fontWeight = "bold"; td.style.padding = "10px"; td.style.color = "#333";
                        td.textContent = item.title;
                        tr.appendChild(td);
                    } else {
                        // 1. 圖
                        const tdImg = document.createElement('td');
                        const img = document.createElement('img');
                        img.src = item.img; img.style.maxHeight = "50px"; img.style.maxWidth = "100%"; img.style.display = "block"; img.style.margin = "0 auto";
                        tdImg.appendChild(img); tr.appendChild(tdImg);
                        
                        // 2. 代號 (n/m)
                        const tdVal = document.createElement('td'); 
                        tdVal.textContent = item.val; 
                        tdVal.style.fontWeight = "bold"; 
                        tdVal.style.color = "#e67e22"; // 橘色強調
                        tr.appendChild(tdVal);

                        // 3. 泛音
                        const tdO = document.createElement('td'); tdO.textContent = item.o; tr.appendChild(tdO);
                        
                        // 4. 諧音
                        const tdH = document.createElement('td'); tdH.textContent = item.h; tr.appendChild(tdH);
                    }
                    tbody.appendChild(tr);
                });
            } el.classList.remove('hidden');
        } else { el.classList.add('hidden'); }
    }

    return { init, showMenu, toggleTable };

})();


