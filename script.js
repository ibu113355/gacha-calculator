// ========================================
// グローバル変数
// ========================================
let probabilityChart = null;
let currentMode = 'stone'; // 'stone' or 'money'

// ========================================
// DOM要素の取得
// ========================================
const stoneToggle = document.getElementById('stoneToggle');
const moneyToggle = document.getElementById('moneyToggle');
const stoneFormCard = document.getElementById('stoneForm');
const moneyFormCard = document.getElementById('moneyForm');
const gachaFormStone = document.getElementById('gachaFormStone');
const gachaFormMoney = document.getElementById('gachaFormMoney');
const resultCard = document.getElementById('resultCard');
const chartCard = document.getElementById('chartCard');
const pullCountEl = document.getElementById('pullCount');
const winProbEl = document.getElementById('winProb');
const probLabel = document.getElementById('probLabel');
const bankruptAlert = document.getElementById('bankruptAlert');
const alertIcon = document.getElementById('alertIcon');
const alertMessage = document.getElementById('alertMessage');
const targetMessage = document.getElementById('targetMessage');
const targetStats = document.getElementById('targetStats');
const diagnosisMessage = document.getElementById('diagnosisMessage');
const resourceHeader = document.getElementById('resourceHeader');
const statsTableBody = document.getElementById('statsTableBody');
const shareBtn = document.getElementById('shareBtn');
const lineShareBtn = document.getElementById('lineShareBtn');
const copyFeedback = document.getElementById('copyFeedback');

// ========================================
// モード切り替え
// ========================================
if (stoneToggle) stoneToggle.addEventListener('change', () => switchMode('stone'));
if (moneyToggle) moneyToggle.addEventListener('change', () => switchMode('money'));

function switchMode(mode) {
    currentMode = mode;
    if (mode === 'stone') {
        stoneFormCard.classList.remove('hidden');
        moneyFormCard.classList.add('hidden');
        resourceHeader.textContent = '必要な石';
    } else {
        moneyFormCard.classList.remove('hidden');
        stoneFormCard.classList.add('hidden');
        resourceHeader.textContent = '必要な金額';
    }
    resultCard.style.display = 'none';
    chartCard.style.display = 'none';
}

// ========================================
// クイックボタン & 目標選択
// ========================================
document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
        e.preventDefault();
        const input = document.getElementById(this.getAttribute('data-target'));
        if (input) input.value = this.getAttribute('data-value');
    });
});

document.querySelectorAll('.goal-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
        e.preventDefault();
        const input = document.getElementById(this.getAttribute('data-target'));
        if (input) {
            input.value = this.getAttribute('data-value');
            this.closest('.goal-buttons').querySelectorAll('.goal-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            input.dispatchEvent(new Event('change'));
        }
    });
});

document.querySelectorAll('#targetCountStone, #targetCountMoney').forEach(input => {
    input.addEventListener('input', function () {
        const wrapper = this.closest('.goal-selection-wrapper');
        if (wrapper) wrapper.querySelectorAll('.goal-btn').forEach(btn => btn.classList.remove('active'));
    });
});

// 天井プリセット連動
const gachaPresetStone = document.getElementById('gachaPresetStone');
const gachaPresetMoney = document.getElementById('gachaPresetMoney');
const rateStoneInput = document.getElementById('rateStone');
const rateMoneyInput = document.getElementById('rateMoney');
const stonePerPullInput = document.getElementById('stonePerPull');

function updateRateFromPreset(preset, targetInput, stoneInput = null) {
    if (preset === 'genshin_char' || preset === 'zzz_char') {
        targetInput.value = 0.6;
        if (stoneInput) stoneInput.value = 160;
    } else if (preset === 'genshin_weapon') {
        targetInput.value = 0.7;
        if (stoneInput) stoneInput.value = 160;
    } else if (preset === 'zzz_weapon') {
        targetInput.value = 1.0;
        if (stoneInput) stoneInput.value = 160;
    }
}

gachaPresetStone.addEventListener('change', (e) => updateRateFromPreset(e.target.value, rateStoneInput, stonePerPullInput));
gachaPresetMoney.addEventListener('change', (e) => updateRateFromPreset(e.target.value, rateMoneyInput));

// ========================================
// 計算ロジック
// ========================================
function combination(n, k) {
    if (k > n) return 0;
    if (k === 0 || k === n) return 1;
    k = Math.min(k, n - k);
    let result = 1;
    for (let i = 0; i < k; i++) {
        result *= (n - i);
        result /= (i + 1);
    }
    return result;
}

function calculateMultipleWinProbability(rate, trials, targetCount) {
    const p = rate / 100;
    if (targetCount <= 0) return 100;
    if (trials < targetCount) return 0;
    if (p >= 1) return 100;

    let probLessThanK = 0;
    for (let i = 0; i < targetCount; i++) {
        probLessThanK += combination(trials, i) * Math.pow(p, i) * Math.pow(1 - p, trials - i);
    }
    return Math.min(Math.max((1 - probLessThanK) * 100, 0), 100);
}

/**
 * 原神・ゼンゼロのソフト天井を考慮した確率計算 (DP)
 * @param {number} trials 試行回数
 * @param {number} targetCount 目標取得数
 * @param {string} preset プリセットID
 */
function calculatePityProbability(trials, targetCount, preset, isSurinike = false) {
    if (targetCount <= 0) return 100;
    if (trials <= 0) return 0;

    let softPityStart, maxPity, baseRate, rateIncrease;

    if (preset === 'genshin_char' || preset === 'zzz_char') {
        softPityStart = 73;
        maxPity = 90;
        baseRate = 0.006;
        rateIncrease = 0.06;
    } else if (preset === 'genshin_weapon') {
        softPityStart = 62;
        maxPity = 80;
        baseRate = 0.007;
        rateIncrease = 0.07;
    } else if (preset === 'zzz_weapon') {
        softPityStart = 62;
        maxPity = 80;
        baseRate = 0.01;
        rateIncrease = 0.06;
    } else {
        return 0; // 不明なプリセット
    }

    function getRate(pityCount) {
        if (pityCount >= maxPity) return 1.0;
        if (pityCount > softPityStart) {
            return Math.min(1.0, baseRate + (pityCount - softPityStart) * rateIncrease);
        }
        return baseRate;
    }

    // dp[i][j][k] = i回引いて、j体引いていて、現在天井カウントがkである確率
    // メモリ節約のため i は 1世代前のみ保持
    let dp = new Array(targetCount + 1).fill(0).map(() => new Array(maxPity + 1).fill(0));
    dp[0][0] = 1.0;
    // すり抜け確定の場合、最初の星5は100%ピックアップとして扱う
    // （通常は50%すり抜けの可能性があるが、それをスキップ）
    const surinikeBonus = isSurinike ? 1.0 : 0.5;

    for (let i = 0; i < trials; i++) {
        let nextDp = new Array(targetCount + 1).fill(0).map(() => new Array(maxPity + 1).fill(0));
        for (let j = 0; j <= targetCount; j++) {
            for (let k = 0; k < maxPity; k++) {
                if (dp[j][k] === 0) continue;

                const winRate = getRate(k + 1);

                // 当たった場合
                const nextJ = Math.min(targetCount, j + 1);
                nextDp[nextJ][0] += dp[j][k] * winRate;

                // 外れた場合
                if (k + 1 < maxPity) {
                    nextDp[j][k + 1] += dp[j][k] * (1 - winRate);
                } else {
                    // 天井到達時は必ず当たるのでここには来ないはずだが、安全のため
                    nextDp[nextJ][0] += dp[j][k] * (1 - winRate);
                }
            }
        }
        dp = nextDp;
    }

    // 目標体数以上に達している確率の合計
    return dp[targetCount].reduce((a, b) => a + b, 0) * 100;
}

function calculateRequiredTrialsForMultiple(rate, targetProb, targetCount) {
    if (targetCount <= 0) return 0;
    if (rate >= 100) return targetCount;
    let low = targetCount, high = targetCount * 1000, result = high;
    if (calculateMultipleWinProbability(rate, high, targetCount) < targetProb) return high;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (calculateMultipleWinProbability(rate, mid, targetCount) >= targetProb) {
            result = mid; high = mid - 1;
        } else { low = mid + 1; }
    }
    return result;
}

// ========================================
// 表示・UI更新
// ========================================
function displayResults(rate, pullCount, winProb, targetProb, costPerPull, mode, targetCount, preset = 'custom') {
    pullCountEl.textContent = pullCount.toLocaleString();
    winProbEl.textContent = winProb.toFixed(2) + '%';
    probLabel.textContent = `${targetCount}体以上取得する確率`;

    const alert = (function (p, tc) {
        if (p < 30) return { icon: '😱', message: `絶望的です。${tc}体確保は厳しいかも...`, level: 'despair' };
        if (p < 70) return { icon: '😰', message: `五分五分です。${tc}体確保は運次第。`, level: 'risky' };
        if (p < 95) return { icon: '😊', message: `あと一息！期待値は高いです！`, level: 'hopeful' };
        return { icon: '🎉', message: `勝利は目前！ほぼ確実です。`, level: 'victory' };
    })(winProb, targetCount);

    alertIcon.textContent = alert.icon;
    alertMessage.textContent = alert.message;
    bankruptAlert.className = 'alert level-' + alert.level;

    // 必要回数の計算 (プリセット時は近似値またはDPの逆引きが必要だが、ここでは簡易化のため従来の関数を使用)
    // ただし、プリセット時は天井があるため、実際のリソースより少なく済む傾向を反映させたい
    const reqTrials = (preset === 'custom')
        ? calculateRequiredTrialsForMultiple(rate, targetProb, targetCount)
        : calculateRequiredTrialsWithPity(targetProb, targetCount, preset);

    const reqRes = reqTrials * costPerPull;
    const currentRes = pullCount * costPerPull;

    if (reqRes > currentRes) {
        targetMessage.innerHTML = `<strong>${targetCount}体</strong>を<strong>${targetProb}%</strong>で確保するには...`;
        targetStats.innerHTML = `あと<strong>${(reqRes - currentRes).toLocaleString()}</strong>${mode === 'stone' ? '個' : '円'}必要!`;
    } else {
        targetMessage.innerHTML = `🎉 おめでとうございます!`;
        targetStats.innerHTML = `現在の予算/石で<strong>${targetCount}体</strong>確保できます!`;
    }

    statsTableBody.innerHTML = '';
    [50, 70, 80, 90, 95, 99].forEach(p => {
        const t = (preset === 'custom')
            ? calculateRequiredTrialsForMultiple(rate, p, targetCount)
            : calculateRequiredTrialsWithPity(p, targetCount, preset);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="prob-cell">${p}%</td><td class="value-cell">${t.toLocaleString()}回</td><td class="value-cell">${(t * costPerPull).toLocaleString()}${mode === 'stone' ? '個' : '円'}</td>`;
        statsTableBody.appendChild(tr);
    });

    resultCard.style.display = 'block';
    chartCard.style.display = 'block';

    // 描画先の要素が表示された後にグラフを描画する（サイズ計算ミスを防ぐ）
    drawProbabilityChart(rate, pullCount, winProb, targetCount, preset);

    diagnosisMessage.textContent = winProb >= 95 ? "勝利確定！？推しが待っています！" : winProb >= 70 ? "勝率は悪くない！" : "覚悟を決めて挑みましょう。";
}

/**
 * プリセット（天井）ありの場合の必要回数を計算
 */
function calculateRequiredTrialsWithPity(targetProb, targetCount, preset) {
    let low = targetCount, high = targetCount * 150, result = high;
    // 原神の期待値的には、90 * targetCount 程度でほぼ確実
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (calculatePityProbability(mid, targetCount, preset) >= targetProb) {
            result = mid; high = mid - 1;
        } else { low = mid + 1; }
    }
    return result;
}

function drawProbabilityChart(rate, currentTrials, currentProb, targetCount, preset = 'custom') {
    const ctx = document.getElementById('probabilityChart').getContext('2d');
    if (probabilityChart) probabilityChart.destroy();
    const maxTrials = Math.max(currentTrials * 2, 100);
    const dataPoints = [];
    const step = Math.max(1, Math.floor(maxTrials / 50));
    for (let i = 0; i <= maxTrials; i += step) {
        const y = (preset === 'custom')
            ? calculateMultipleWinProbability(rate, i, targetCount)
            : calculatePityProbability(i, targetCount, preset);
        dataPoints.push({ x: i, y: y });
    }
    probabilityChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{ label: '確率 (%)', data: dataPoints, borderColor: '#6ea8fe', fill: true, tension: 0.4, pointRadius: 0 },
            { label: '現在位置', data: [{ x: currentTrials, y: currentProb }], backgroundColor: '#f687b3', pointRadius: 8 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Prevent squashing
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '試行回数'
                    }
                },
                y: {
                    min: 0,
                    max: 100,
                    ticks: {
                        callback: function (value) { return value + '%'; }
                    },
                    title: {
                        display: true,
                        text: '当たる確率'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        filter: function (item) { return item.datasetIndex === 1; }
                    }
                }
            }
        }
    });
}

// ========================================
// イベントリスナー
// ========================================
gachaFormStone.addEventListener('submit', (e) => {
    e.preventDefault();
    const rate = parseFloat(document.getElementById('rateStone').value);
    const stonePerPull = parseFloat(document.getElementById('stonePerPull').value);
    if (stonePerPull <= 0) {
        alert("「1回に必要な石」には0より大きい数字を入力してください");
        return;
    }
    const count = Math.floor(parseFloat(document.getElementById('stoneCount').value) / stonePerPull);
    const target = parseInt(document.getElementById('targetCountStone').value);
    const preset = gachaPresetStone.value;
    const targetProb = parseFloat(document.getElementById('targetProbStone').value);

    let winProb;
    if (preset !== 'custom') {
        winProb = calculatePityProbability(count, target, preset);
    } else {
        winProb = calculateMultipleWinProbability(rate, count, target);
    }

    displayResults(rate, count, winProb, targetProb, parseFloat(document.getElementById('stonePerPull').value), 'stone', target, preset);
});

gachaFormMoney.addEventListener('submit', (e) => {
    e.preventDefault();
    const rate = parseFloat(document.getElementById('rateMoney').value);
    const budget = parseFloat(document.getElementById('budget').value.replace(/[^0-9.]/g, '')) || 0;
    const price = parseFloat(document.getElementById('price').value.replace(/[^0-9.]/g, '')) || 0;

    // ★ ここに挿入！
    if (price <= 0) {
        alert("「1回あたりの金額」には0より大きい数字を入力してください");
        return; // ここで処理を中断させる
    }

    const count = Math.floor(budget / price); // priceが0だとここでInfinityになり、無限ループします
    const target = parseInt(document.getElementById('targetCountMoney').value);
    const preset = gachaPresetMoney.value;
    const targetProb = parseFloat(document.getElementById('targetProbMoney').value);

    let winProb;
    if (preset !== 'custom') {
        winProb = calculatePityProbability(count, target, preset);
    } else {
        winProb = calculateMultipleWinProbability(rate, count, target);
    }

    displayResults(rate, count, winProb, targetProb, price, 'money', target, preset);
});

// ========================================
// シェア機能
// ========================================
function getShareText() {
    if (resultCard.style.display === 'none' || resultCard.style.display === '') {
        return "ガチャ期待値シミュレーター - 期待値と爆死確率を1秒でシミュレーション";
    }
    const winProb = winProbEl.textContent;
    const targetCountValue = probLabel.textContent.replace(/体以上取得する確率/, '');
    const resourceLabel = currentMode === 'stone' ? '石' : '予算';
    const resourceUnit = currentMode === 'stone' ? '個' : '円';
    const currentResource = currentMode === 'stone'
        ? (parseFloat(document.getElementById('stoneCount').value) || 0).toLocaleString()
        : (parseFloat(document.getElementById('budget').value.replace(/[^0-9.]/g, '')) || 0).toLocaleString();
    return `${resourceLabel}${currentResource}${resourceUnit}で${targetCountValue}体を狙うと、当たる確率は${winProb}でした！🎲 #ガチャ期待値シミュレーター`;
}

if (shareBtn) {
    shareBtn.addEventListener('click', () => {
        const text = getShareText();
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text + " " + window.location.href)}`, '_blank');
    });
}

// LINEシェアを修正（確実にメッセージが含まれる直接リンク形式に変更）
if (lineShareBtn) {
    lineShareBtn.addEventListener('click', function () {
        const text = getShareText();
        const url = window.location.href;
        const lineUrl = `https://line.me/R/share?text=${encodeURIComponent(text + " " + url)}`;
        window.open(lineUrl, '_blank');
    });
}
// ========================================
// 画像保存機能
// ========================================
const imageShareBtn = document.getElementById('imageShareBtn');
if (imageShareBtn) {
    imageShareBtn.addEventListener('click', () => {
        const target = document.getElementById('resultCard');
        if (!target) {
            alert('保存対象の要素（resultCard）が見つかりません。');
            return;
        }

        html2canvas(target, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            allowTaint: true,
            onclone: (clonedDoc) => {
                const clonedTarget = clonedDoc.getElementById('resultCard');
                if (!clonedTarget) return;

                // 1. 強力なスタイルシートを注入して、CSS変数やclamp、アニメーションを全て上書きする
                const style = clonedDoc.createElement('style');
                style.innerHTML = `
                    #resultCard {
                        background: #ffffff !important;
                        opacity: 1 !important;
                        visibility: visible !important;
                        animation: none !important;
                        transform: none !important;
                        box-shadow: none !important;
                        padding: 30px !important;
                        border: 2px solid #f0f0f0 !important;
                        border-radius: 20px !important;
                        display: block !important;
                    }
                    #resultCard * {
                        color: #333333 !important; /* 基本の文字を黒に */
                        opacity: 1 !important;
                        animation: none !important;
                        transition: none !important;
                        -webkit-text-fill-color: initial !important;
                        text-shadow: none !important;
                        visibility: visible !important;
                    }
                    /* タイトル */
                    #resultCard .card-title {
                        font-size: 24px !important;
                        color: #222222 !important;
                        margin-bottom: 20px !important;
                    }
                    /* メインメッセージのボックス */
                    #resultCard .result-main-message {
                        background: #fff5f7 !important; /* 薄いピンク背景 */
                        border: 3px solid #f687b3 !important; /* ピンクの枠線 */
                        border-radius: 20px !important;
                        padding: 20px !important;
                        margin-bottom: 20px !important;
                    }
                    /* 「確保するには...」などの文字 */
                    #resultCard .main-message-text {
                        font-size: 22px !important;
                        font-weight: 800 !important;
                        color: #333333 !important;
                        display: block !important;
                        margin-bottom: 10px !important;
                    }
                    /* 「あと20,000個必要！」などの数値 */
                    #resultCard .main-message-value, 
                    #resultCard .stat-value-compact {
                        font-size: 42px !important;
                        font-weight: 900 !important;
                        color: #e91e63 !important; /* はっきりしたピンク */
                        background: none !important;
                        -webkit-background-clip: initial !important;
                        -webkit-text-fill-color: #e91e63 !important;
                    }
                    /* ステータスボックス */
                    #resultCard .stat-box-compact {
                        background: #f8f9fa !important;
                        border: 1px solid #dee2e6 !important;
                        border-radius: 16px !important;
                        padding: 15px !important;
                    }
                    #resultCard .stat-label {
                        font-size: 16px !important;
                        color: #666666 !important;
                        margin-bottom: 5px !important;
                    }
                    #resultCard .stat-value-compact {
                        font-size: 28px !important;
                    }
                    /* 不要な要素を完全に消す */
                    #affiliateSection, #bankruptAlert, .stats-section, .share-buttons, #copyFeedback {
                        display: none !important;
                    }
                `;
                clonedDoc.head.appendChild(style);
            }
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'gacha-result.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(err => {
            console.error('html2canvas error:', err);
            alert('画像の生成に失敗しました: ' + err.message);
        });
    });
}
console.log('✨ ガチャ計算機 起動完了！');
