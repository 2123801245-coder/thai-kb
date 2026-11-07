/**
 * 百词斩式训练模块 v2.0
 * 整合：学习(四选一) + 练习(六种) + 刷卡(SM-2) + 错题本
 * 
 * 数据来源：allWords() = BUILTIN_WORDS + MY_WORDS（来自 core.js）
 */

// ==================== 百词斩式学习流程 ====================
class WordLearningFlow {
  constructor() {
    this.todayNewWords = [];
    this.reviewWords = [];
    this.currentQueue = [];
    this.currentIndex = 0;
    
    this.stats = { learned: 0, correct: 0, wrong: 0, skipped: 0 };
    
    this.dailyNewCount = 20;
    this.reviewLimit = 50;
    
    this.showCurrentWord = this.showCurrentWord.bind(this);
    this.nextWord = this.nextWord.bind(this);
  }

  /**
   * 获取所有单词（兼容不同数据源），过滤掉脏数据
   */
  getAllWords() {
    let words = [];
    // 优先使用 allWords() 函数
    if (typeof allWords === 'function') {
      try { words = allWords() || []; } catch(e) { words = []; }
    }
    // 其次尝试 KB_WORDS
    if ((!words || !words.length) && window.KB_WORDS && window.KB_WORDS.length) {
      words = KB_WORDS;
    }
    // 只保留结构完整的词对象（t 为字符串）
    return (words || []).filter(w => w && typeof w === 'object' && typeof w.t === 'string' && w.t.trim());
  }

  /**
   * 初始化今日学习
   */
  initToday() {
    const words = this.getAllWords();
    console.log('[WordLearning] 总词数:', words.length);
    
    // 获取未掌握的词
    const mastery = JSON.parse(localStorage.getItem('kb_mastery') || '{}');
    const unmastered = words.filter(w => {
      const m = mastery[w.t];
      return !m || m < 2;
    });
    console.log('[WordLearning] 未掌握词数:', unmastered.length);
    
    this.todayNewWords = this.pickRandomWords(unmastered, this.dailyNewCount);
    
    // 获取待复习词（SM-2）
    this.reviewWords = this.getDueReviewWords(this.reviewLimit);
    console.log('[WordLearning] 待复习词数:', this.reviewWords.length);
    
    // 合并队列：先复习，再学新
    this.currentQueue = [
      ...this.reviewWords.map(w => ({...w, type: 'review'})),
      ...this.todayNewWords.map(w => ({...w, type: 'new'}))
    ];
    
    this.currentIndex = 0;
    this.stats = { learned: 0, correct: 0, wrong: 0, skipped: 0 };
    
    return this.currentQueue.length;
  }

  /**
   * 只复习不学新词
   */
  startQuickReview() {
    const oldCount = this.dailyNewCount;
    this.dailyNewCount = 0;
    const count = this.initToday();
    this.dailyNewCount = oldCount;
    return count;
  }

  /**
   * 显示当前单词
   */
  showCurrentWord() {
    if (this.currentIndex >= this.currentQueue.length) {
      this.showSummary();
      return;
    }
    
    const word = this.currentQueue[this.currentIndex];
    this.renderWordDetail(word);
    this.showPane('wordDetail');
  }

  /**
   * 渲染单词详情页（百词斩风格）
   */
  renderWordDetail(word) {
    const container = document.getElementById('wordDetailBox');
    if (!container) return;
    
    const sentences = this.getSentences(word);
    const options = this.generateOptions(word);
    const progress = this.currentQueue.length > 0 
      ? ((this.currentIndex) / this.currentQueue.length * 100).toFixed(0) 
      : 0;
    
    container.innerHTML = `
      <div class="wd-progress">
        <div class="wd-progress-bar"><i style="width:${progress}%"></i></div>
        <span class="wd-progress-text">${this.esc(word.t)}: ${this.esc(word.z || '')} · ${this.currentIndex+1}/${this.currentQueue.length}</span>
      </div>
      
      <div class="wd-card">
        ${this.buildMainHTML(word)}
        ${sentences.length ? this.buildSentenceHTML(sentences[0]) : ''}
        ${this.buildOptionsHTML(options)}
        ${this.buildToolbarHTML(word)}
      </div>
      
      <div class="wd-nav">
        <button class="wd-btn wd-btn-exit" id="wdBtnExit" title="退出学习">✕ 退出</button>
        <button class="wd-btn wd-btn-left" id="wdBtnLeft">← 斩</button>
        <button class="wd-btn wd-btn-right" id="wdBtnRight" disabled>继续 →</button>
      </div>
      
      <div class="wd-explanation" id="wdExplanation" style="display:none;">
        ${this.buildExplanationHTML(word)}
      </div>
    `;
    
    this.bindEvents(word, options);
  }

  buildMainHTML(word) {
    // 词性只取第一个字符段（如 น. / ก. / ว.）
    const posShort = word.p ? word.p.split(/[\s·]/)[0] : '名词';
    // 来源课文标题截短
    let lessonShort = '';
    if (word.lesson) {
      lessonShort = word.lesson.length > 12 ? word.lesson.substring(0, 12) + '…' : word.lesson;
    }
    return `
      <div class="wd-main">
        <div class="wd-thai">${this.esc(word.t)}</div>
        ${word.r ? `<div class="wd-phonetic">${this.esc(word.r)}</div>` : ''}
        <div class="wd-pos">${this.esc(posShort)}${lessonShort ? ' · ' + this.esc(lessonShort) : ''}</div>
      </div>
    `;
  }

  buildSentenceHTML(sent) {
    return `
      <div class="wd-sentence">
        <div class="wd-sent-thai">🔊 ${this.esc(sent.t || '')}</div>
        ${sent.z ? `<div class="wd-sent-zh">${this.esc(sent.z)}</div>` : ''}
      </div>
    `;
  }

  buildOptionsHTML(options) {
    return `
      <div class="wd-opts">
        ${options.map((opt, i) => `
          <button class="wd-opt" data-index="${i}" data-correct="${opt.isCorrect}">
            ${this.esc(opt.text)}
          </button>
        `).join('')}
      </div>
    `;
  }

  buildToolbarHTML(word) {
    return `
      <div class="wd-toolbar">
        <button class="wd-tool" id="wdPlayAudio" title="播放发音">🔊</button>
        <button class="wd-tool" id="wdShowHint" title="显示提示">💡</button>
      </div>
    `;
  }

  buildExplanationHTML(word) {
    let html = `<h4>📝 详细解释</h4>`;
    html += `<p><strong>${this.esc(word.t)}</strong> = ${this.esc(word.z || '')}`;
    if (word.r) html += `（${this.esc(word.r)}）`;
    html += `</p>`;
    
    // 例句
    const sents = this.getSentences(word);
    if (sents.length > 0) {
      html += `<p><strong>例句：</strong></p><ul>`;
      sents.slice(0, 3).forEach(s => {
        html += `<li>${this.esc(s.t || '')}<br><small>${this.esc(s.z || '')}</small></li>`;
      });
      html += `</ul>`;
    }
    
    // 相关词
    const similar = this.getSimilarWords(word, 3);
    if (similar.length > 0) {
      html += `
        <div class="wd-similar">
          <h5>🔍 相关词汇</h5>
          ${similar.map(w => `
            <div class="wd-sim-item">
              <strong>${this.esc(w.t)}</strong>
              ${w.r ? ` /${this.esc(w.r)}/` : ''} - ${this.esc(w.z || '')}
            </div>
          `).join('')}
        </div>
      `;
    }
    
    return html;
  }

  generateOptions(correctWord) {
    const correctOpt = {
      text: `${correctWord.p || ''} ${correctWord.z || ''}`.trim(),
      isCorrect: true
    };
    
    const distractors = this.getDistractors(correctWord, 3);
    const options = [correctOpt, ...distractors.map(d => ({
      text: `${d.p || ''} ${d.z || ''}`.trim(),
      isCorrect: false
    }))];
    
    return this.shuffleArray(options);
  }

  getDistractors(correctWord, count) {
    const allWords = this.getAllWords();
    const filtered = allWords.filter(w => 
      w.t !== correctWord.t && w.z && w.z !== correctWord.z
    );
    return this.pickRandomWords(filtered, Math.min(count, filtered.length));
  }

  getSimilarWords(word, limit = 3) {
    const words = this.getAllWords();
    const wt = String(word.t || '');
    if (!wt) return [];
    const target = wt.substring(0, 2);
    return words.filter(w => {
      const t = String(w.t || '');
      return t && t !== wt && t.startsWith(target);
    }).slice(0, limit);
  }

  bindEvents(word, options) {
    const opts = document.querySelectorAll('.wd-opt');
    const btnRight = document.getElementById('wdBtnRight');
    const explanation = document.getElementById('wdExplanation');
    
    opts.forEach(opt => {
      opt.addEventListener('click', () => {
        this.handleOptionClick(opt, opts, word, btnRight, explanation);
      });
    });
    
    document.getElementById('wdBtnLeft').addEventListener('click', () => {
      this.skipWord(word);
    });
    
    document.getElementById('wdBtnExit').addEventListener('click', () => {
      if (typeof goTrainHome === 'function') goTrainHome();
    });
    
    btnRight.addEventListener('click', () => {
      this.nextWord();
    });
    
    document.getElementById('wdPlayAudio').addEventListener('click', () => {
      this.playAudio(word.t);
    });
    
    document.getElementById('wdShowHint').addEventListener('click', () => {
      opts.forEach(o => {
        o.disabled = true;
        if (o.dataset.correct === 'true') o.classList.add('correct');
      });
      explanation.style.display = 'block';
      btnRight.disabled = false;
    });
  }

  handleOptionClick(clickedOpt, allOpts, word, btnRight, explanation) {
    allOpts.forEach(o => { o.disabled = true; });
    
    const isCorrect = clickedOpt.dataset.correct === 'true';
    
    if (isCorrect) {
      clickedOpt.classList.add('correct');
      this.stats.correct++;
      this.sm2Update(word, true);
    } else {
      clickedOpt.classList.add('wrong');
      allOpts.forEach(o => {
        if (o.dataset.correct === 'true') o.classList.add('correct');
      });
      this.stats.wrong++;
      this.addToWrongBook(word);
      this.sm2Update(word, false);
    }
    
    this.stats.learned++;
    
    setTimeout(() => {
      explanation.style.display = 'block';
      btnRight.disabled = false;
      explanation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, isCorrect ? 300 : 600);
  }

  nextWord() {
    this.currentIndex++;
    this.showCurrentWord();
  }

  skipWord(word) {
    this.stats.skipped++;
    this.setMastered(word.t || word.w, 1);
    this.nextWord();
  }

  showSummary() {
    const container = document.getElementById('wordDetailBox');
    if (!container) return;
    
    container.innerHTML = `
      <div class="wd-end-card">
        <h3>🎉 今日学习完成！</h3>
        <div class="wd-sub">继续保持，泰语水平会越来越棒！</div>
        
        <div class="wd-nums">
          <div><b>${this.stats.learned}</b><span>已学习</span></div>
          <div><b>${this.stats.correct}</b><span>答对</span></div>
          <div><b>${this.stats.wrong}</b><span>需巩固</span></div>
        </div>
        
        ${this.stats.skipped > 0 ? `<p style="color:#7a705d;margin-top:12px;">跳过 ${this.stats.skipped} 个（已标记掌握）</p>` : ''}
        
        <div class="wd-ends">
          <button class="wd-btn wd-btn-right" onclick="wordFlow.initToday(); wordFlow.showCurrentWord();">🔄 再来一轮</button>
          <button class="wd-btn wd-btn-left" onclick="wordFlow.startQuickReview(); wordFlow.showCurrentWord();">🔁 快速复习</button>
          <button class="wd-btn wd-btn-left" style="background:#fffdf6;" onclick="if(typeof goTrainHome==='function') goTrainHome(); else if(typeof KB!=='undefined'&&KB.nav) KB.nav.go('home');">🎯 回训练场</button>
        </div>
      </div>
    `;
  }

  // ==================== 数据方法 ====================

  getSentences(word) {
    // 从词汇讲解(vok)获取例句
    try {
      if (window.KB_VOK && KB_VOK.length) {
        const vok = KB_VOK.find(v => v.w === word.t);
        if (vok && vok.sents && vok.sents.length > 0) return vok.sents;
      }
    } catch(e) {}
    
    // 从句子数据获取
    try {
      if (window.KB_SENTS) {
        for (let key in KB_SENTS) {
          const paras = KB_SENTS[key];
          if (Array.isArray(paras)) {
            for (let para of paras) {
              if (Array.isArray(para)) {
                for (let sent of para) {
                  if (Array.isArray(sent) && sent[0] && sent[0].includes(word.t)) {
                    return [{ t: sent[0], z: sent[1] }];
                  }
                }
              }
            }
          }
        }
      }
    } catch(e) {}
    
    return [];
  }

  getDueReviewWords(limit) {
    try {
      const reviews = JSON.parse(localStorage.getItem('kb_sm2') || '[]');
      const now = Date.now();
      return reviews
        .filter(r => r && r.nextReview <= now && r.word && typeof r.word.t === 'string' && r.word.t.trim())
        .slice(0, limit)
        .map(r => ({
          t: String(r.word.t),
          r: typeof r.word.r === 'string' ? r.word.r : '',
          z: typeof r.word.z === 'string' ? r.word.z : '',
          p: typeof r.word.p === 'string' ? r.word.p : '',
          lesson: typeof r.word.lesson === 'string' ? r.word.lesson : '',
          type: 'review',
          sm2Data: r
        }));
    } catch(e) {
      return [];
    }
  }

  sm2Update(wordId, isCorrect) {
    try {
      const wid = String(wordId && wordId.t ? wordId.t : wordId || '');
      if (!wid) return;
      
      let sm2 = JSON.parse(localStorage.getItem('kb_sm2') || '[]');
      // 清理历史脏数据（wordId 不是字符串 / word.t 不是字符串的记录）
      sm2 = sm2.filter(r => r && typeof r.wordId === 'string' && (!r.word || typeof r.word.t === 'string'));
      
      let record = sm2.find(r => r.wordId === wid);
      
      if (!record) {
        record = { 
          wordId: wid, 
          interval: 1, 
          easeFactor: 2.5, 
          repetitions: 0, 
          nextReview: Date.now(),
          word: this.findWordById(wid)
        };
        sm2.push(record);
      }
      
      if (isCorrect) {
        record.repetitions++;
        if (record.repetitions === 1) record.interval = 1;
        else if (record.repetitions === 2) record.interval = 6;
        else record.interval = Math.round(record.interval * record.easeFactor);
        record.nextReview = Date.now() + record.interval * 24 * 60 * 60 * 1000;
      } else {
        record.repetitions = 0;
        record.interval = 1;
        record.easeFactor = Math.max(1.3, record.easeFactor - 0.2);
        record.nextReview = Date.now() + 10 * 60 * 1000; // 10分钟后重试
      }
      
      localStorage.setItem('kb_sm2', JSON.stringify(sm2));
    } catch(e) {
      console.warn('SM-2 update failed:', e);
    }
  }

  findWordById(wordId) {
    const words = this.getAllWords();
    const wid = String(wordId || '');
    return words.find(w => w.t === wid) || { t: wid };
  }

  addToWrongBook(word) {
    try {
      /* 与 wrongbook.js 同源：优先直接调它的 addWrong（写入 kb_wrongs，错题页立刻可见） */
      if (typeof addWrong === 'function') {
        addWrong({
          t: word.t || word.w,
          r: word.r,
          z: word.z,
          p: word.p,
          kind: '百词斩背单词',
          lesson: word.lesson
        });
        return;
      }
      /* 兜底：直接写 kb_wrongs */
      let wrongBook = JSON.parse(localStorage.getItem('kb_wrongs') || '[]');
      if (!wrongBook.find(w => w.t === (word.t || word.w))) {
        wrongBook.unshift({
          t: word.t || word.w,
          r: word.r,
          z: word.z,
          p: word.p,
          kind: '百词斩背单词',
          wrongAt: new Date().toISOString(),
          lesson: word.lesson,
          n: 1
        });
        localStorage.setItem('kb_wrongs', JSON.stringify(wrongBook));
      }
    } catch(e) {
      console.warn('Add to wrongbook failed:', e);
    }
  }

  setMastered(wordId, level) {
    try {
      let mastery = JSON.parse(localStorage.getItem('kb_mastery') || '{}');
      mastery[wordId] = level;
      localStorage.setItem('kb_mastery', JSON.stringify(mastery));
    } catch(e) {}
  }

  playAudio(text) {
    if (typeof KB !== 'undefined' && KB.audio && KB.audio.speak) {
      KB.audio.speak(text);
    } else if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'th-TH';
      utterance.rate = parseFloat(localStorage.getItem('kb_rate') || '0.9');
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    }
  }

  showPane(paneName) {
    if (typeof KB !== 'undefined' && KB.nav && KB.nav.go) {
      KB.nav.go(paneName);
    } else {
      document.querySelectorAll('.pane').forEach(p => p.classList.remove('on'));
      const pane = document.getElementById('pane-' + paneName);
      if (pane) pane.classList.add('on');
    }
  }

  pickRandomWords(arr, count) {
    if (!arr || arr.length === 0) return [];
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, arr.length));
  }

  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// ==================== 全局实例 ====================
const wordFlow = new WordLearningFlow();

// ==================== 全局函数 ====================
function startTodayLearning() {
  const count = wordFlow.initToday();
  console.log('[WordLearning] 初始化完成，队列长度:', count);
  
  if (count > 0) {
    wordFlow.showCurrentWord();
  } else {
    // 尝试只获取复习词
    const reviewCount = wordFlow.startQuickReview();
    if (reviewCount > 0) {
      wordFlow.showCurrentWord();
    } else {
      alert('🎉 太棒了！\n\n所有单词都已掌握！\n\n可以尝试：\n• 复习已学过的词\n• 学习更多课文生词\n• 或者点击"练一组"做练习巩固');
    }
  }
}

function startQuickReview() {
  const count = wordFlow.startQuickReview();
  if (count > 0) {
    wordFlow.showCurrentWord();
  } else {
    alert('目前没有需要复习的单词。\n\n继续学习新词吧！');
  }
}


// ==================== 训练场首页（参考百词斩布局） ====================

/* 从训练场直接启动某种练习模式：切到练习面板并立即开考 */
function startExMode(mode) {
  try {
    if (typeof exMode !== 'undefined') {
      exMode = mode;
      try { localStorage.setItem('exMode', exMode); } catch(e) {}
    }
    // 切换面板
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('on'));
    const pane = document.getElementById('pane-ex');
    if (pane) pane.classList.add('on');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // 直接开考
    if (typeof exBegin === 'function') exBegin();
  } catch(e) { console.warn('startExMode failed:', e); }
}

/* 切换到某个已存在的面板（练习页 / 刷卡页 / 错题本等） */
function goPane(paneName) {
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('on'));
  const pane = document.getElementById('pane-' + paneName);
  if (pane) pane.classList.add('on');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // 这些页面有各自的渲染函数，进入时刷新一次
  try {
    if (paneName === 'ex' && typeof exHome === 'function') exHome();
    if (paneName === 'flash' && typeof fcEnsure === 'function') fcEnsure();
    if (paneName === 'wrongbook' && typeof renderWrongBook === 'function') renderWrongBook();
  } catch(e) {}
}

/* 返回训练场首页（各训练页的"退出/返回"统一走这里） */
function goTrainHome() {
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('on'));
  const pane = document.getElementById('pane-trainHome');
  if (pane) pane.classList.add('on');
  // 同步手机底栏 / 标签条选中态
  try {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.v === 'trainHome'));
  } catch(e) {}
  renderTrainHome();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderTrainHome() {
  const box = document.getElementById('trainHomeBox');
  if (!box) return;

  // 统计数据
  const words = (typeof allWords === 'function') ? allWords() : [];
  const mastery = JSON.parse(localStorage.getItem('kb_mastery') || '{}');
  const wrongBook = JSON.parse(localStorage.getItem('kb_wrongs') || '[]');
  const total = words.length;
  const mastered = Object.values(mastery).filter(m => m >= 2).length;

  const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  box.innerHTML = ''
    // ── 顶部标题区 ──
    + '<div class="tr-hero">'
    +   '<h2>训练场</h2>'
    +   '<p>碎片时间来一把，强化记忆</p>'
    +   '<span class="tr-deco">🎮</span>'
    + '</div>'

    // ── 背单词（2x2 大卡片） ──
    + '<div class="tr-sect"><b>背单词</b><span>已掌握 ' + mastered + ' / ' + total + ' 词</span></div>'
    + '<div class="tr-big">'
    +   '<button class="tr-bigcard" id="trLearn">'
    +     '<span class="l"><span class="n">百词斩背单词</span><span class="t">四选一测试 + SM-2 智能复习</span></span>'
    +     '<span class="ico">📘</span></button>'
    +   '<button class="tr-bigcard" id="trFlash">'
    +     '<span class="l"><span class="n">刷卡背单词</span><span class="t">翻面选意思 · 简化 SM-2</span></span>'
    +     '<span class="ico">🃏</span></button>'
    +   '<button class="tr-bigcard hot" id="trWrong">'
    +     '<span class="l"><span class="n">错题本 <span style="font-size:13px;color:#c04234;">' + wrongBook.length + ' 道待清</span></span>'
    +     '<span class="t">答错的词自动收进来</span></span>'
    +     '<span class="ico">📕</span></button>'
    +   '<button class="tr-bigcard" id="trReview">'
    +     '<span class="l"><span class="n">快速复习</span><span class="t">只复习，不学新词</span></span>'
    +     '<span class="ico">🔁</span></button>'
    + '</div>'

    // ── 巩固练习 ──
    + '<div class="tr-sect"><b>巩固练习</b></div>'
    + '<div class="tr-group">'
    +   '<div class="tr-sub"><span class="bar"></span><b>专项训练</b><span>六种斩词方式，答错自动进错题本</span></div>'
    +   '<div class="tr-grid4">'
    +     '<button class="tr-tile" data-exm="listen">听音选义</button>'
    +     '<button class="tr-tile" data-exm="zhth">中文选词</button>'
    +     '<button class="tr-tile" data-exm="tile">点选拼写</button>'
    +     '<button class="tr-tile" data-exm="type">键盘拼写</button>'
    +     '<button class="tr-tile" data-exm="mix">混合出题</button>'
    +     '<button class="tr-tile" data-exm="random">每轮随机</button>'
    +   '</div>'
    +   '<div class="tr-sub" style="margin-top:16px;"><span class="bar"></span><b>快速训练</b></div>'
    +   '<div class="tr-grid2">'
    +     '<button class="tr-wide" id="trQuiz">📝 课文小测</button>'
    +     '<button class="tr-wide" id="trDisc">📐 辨析测验</button>'
    +   '</div>'
    + '</div>'

    // ── 主按钮 ──
    + '<div class="tr-main-cta">'
    +   '<button class="tr-cta pri" id="trStartLearn">🚀 开始学习<small>新词 20 + 到期复习</small></button>'
    +   '<button class="tr-cta sec" id="trGoEx">🎯 去练习页<small>选范围 · 选词量</small></button>'
    + '</div>';

  // ── 绑定事件 ──
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on('trLearn',   () => startTodayLearning());
  on('trReview',  () => startQuickReview());
  on('trStartLearn', () => startTodayLearning());
  on('trFlash',   () => goPane('flash'));
  on('trWrong',   () => goPane('wrongbook'));
  on('trGoEx',    () => goPane('ex'));
  on('trQuiz',    () => goPane('read'));
  on('trDisc',    () => goPane('disc'));
  box.querySelectorAll('[data-exm]').forEach(b => {
    b.onclick = () => startExMode(b.dataset.exm);
  });
}

// 页面加载完成后渲染训练首页
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderTrainHome);
} else {
  renderTrainHome();
}
