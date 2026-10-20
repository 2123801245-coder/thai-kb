/* motion.js —— 页面切换动效
   三件事：①标签页（Tab）交叉淡入（由 .pane.on 的 CSS 动画完成）
            ②层级前进/返回的方向过渡（kbLevel，写进 #readBox / #vokBox）
            ③点词浮层的弹出动效（kbPop）
   原则：只动 opacity 与 translate，不触发布局；时长 200–350ms；
         尊重 prefers-reduced-motion，开启时直接瞬时切换。 */
(function(){
  const RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const DUR = 260;                                    /* 与 CSS 里的 .26s 保持一致 */
  const reduced = () => !!(RM && RM.matches);

  /* 层级过渡：box.dataset.lvl 记住当前层级；
     变深 = 前进（内容从右侧 16px 滑入），变浅 = 返回（从左侧滑入）。 */
  window.kbLevel = function(box, level){
    if(!box) return;
    const prev = parseInt(box.dataset.lvl || '0', 10);
    box.dataset.lvl = String(level);
    if(!prev || prev === level || reduced()) return;
    const cls = level > prev ? 'lvl-fwd' : 'lvl-back';
    box.classList.remove('lvl-fwd', 'lvl-back');
    void box.offsetWidth;                             /* 强制回流，让动画能重播 */
    box.classList.add(cls);
  };

  /* 浮层弹出：只在新插入时跑一次（reduced-motion 下不跑） */
  window.kbPop = function(el){
    if(!el || reduced()) return;
    el.classList.add('kb-pop-in');
  };

  /* 动画结束就摘掉 class，避免元素长期带着 will-change / transform */
  document.addEventListener('animationend', e => {
    const n = e.animationName;
    if(n === 'kbLvlFwd' || n === 'kbLvlBack') e.target.classList.remove('lvl-fwd', 'lvl-back');
    else if(n === 'kbPopIn') e.target.classList.remove('kb-pop-in');
  });

  window.KB_MOTION = { dur: DUR, reduced: reduced };
})();
