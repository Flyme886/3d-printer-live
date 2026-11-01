/* ============================================================
   画面叠加层：品牌牌 / 祝福卡 / 送福跑马灯
   纯 DOM + CSS，不依赖任何图片资源。
   只负责"长什么样"，不参与打印/队列逻辑——由 index.html 调用。
   ============================================================ */

const BLESSINGS = [
  '岁岁平安 · 万事顺遂',
  '身体硬朗 · 吃嘛嘛香',
  '日子红火 · 心里亮堂',
  '儿孙绕膝 · 家和人兴旺',
  '一顺百顺 · 事事都顺心',
  '平安喜乐 · 福气相随',
  '处处有人帮 · 年年有盼头',
  '福如东海 · 寿比南山',
  '笑口常开 · 无病无灾',
  '所求皆如愿 · 所行化坦途',
  '添福添寿 · 添个好彩头',
  '一年到头 · 都有好光景',
];

const PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">' +
      '<rect width="100" height="100" fill="#e8d3b0"/>' +
      '<circle cx="50" cy="38" r="19" fill="#fffaf0"/>' +
      '<path d="M15 100c3-40 67-40 70 0" fill="#fffaf0"/></svg>'
  );

export class BlessingOverlay {
  constructor(stage, opts = {}) {
    this.stage = stage;
    this.title = opts.title || '长辈祝福屋';
    this.sub = opts.sub || 'BLESSING STUDIO';
    this.last = -1;
    this.count = 0;
    this.records = [];
    this.mount();
  }

  mount() {
    const el = document.createElement('div');
    el.id = 'blessing-layer';
    el.innerHTML = `
      <div class="bl-veil"></div>
      <div class="bl-grain"></div>
      <div class="bl-brand">
        <div class="bl-seal">福</div>
        <div>
          <div class="bl-title">${this.title}</div>
          <div class="bl-sub">${this.sub}</div>
        </div>
        <div class="bl-online"><i></i>直播中</div>
      </div>
      <div class="bl-count"><b>0</b><span>本场已送福</span></div>
      <div style="display:flex;flex-direction:column;align-items:center;width:100%;">
        <div class="bl-card is-idle">
          <img class="bl-avatar" alt="" src="${PLACEHOLDER}">
          <div class="bl-body">
            <div class="bl-who"><span class="bl-name">等你来取福</span><em class="bl-score">福气 —</em></div>
            <div class="bl-line">第一位观众进来，就给他写一张</div>
            <div class="bl-bar"><i></i></div>
          </div>
        </div>
        <div class="bl-ticker">
          <div class="bl-tk-label">刚送出</div>
          <div class="bl-tk-list"></div>
        </div>
      </div>`;
    this.stage.append(el);

    this.el = el;
    this.$card = el.querySelector('.bl-card');
    this.$avatar = el.querySelector('.bl-avatar');
    this.$name = el.querySelector('.bl-name');
    this.$score = el.querySelector('.bl-score');
    this.$line = el.querySelector('.bl-line');
    this.$bar = el.querySelector('.bl-bar i');
    this.$count = el.querySelector('.bl-count b');
    this.$tk = el.querySelector('.bl-tk-list');

    // 阶段一：先用占位卡，等真实事件进来
    this.idle();

    // 叠加层贴合 3D 画布的实际显示区域（竖屏输出时画布会居中留白）
    this.fit();
    addEventListener('resize', () => this.fit());
    setInterval(() => this.fit(), 600);
  }

  /** 让叠加层和 canvas 的显示矩形完全重合 */
  fit() {
    const c = this.stage.querySelector('canvas');
    if (!c) return;
    const sr = this.stage.getBoundingClientRect();
    const cr = c.getBoundingClientRect();
    if (!cr.width || !cr.height) return;
    const box = {
      inset: 'auto',
      left: cr.left - sr.left + 'px',
      top: cr.top - sr.top + 'px',
      width: cr.width + 'px',
      height: cr.height + 'px',
      right: 'auto',
      bottom: 'auto',
    };
    const sig = box.left + box.top + box.width + box.height;
    if (this._sig === sig) return;
    this._sig = sig;
    Object.assign(this.el.style, box);
  }

  /** 卡片正面：昵称 + 福气值 + 一句祝福 */
  setJob(job, { score = null, line = null, pct = 0 } = {}) {
    if (!job) return this.idle();
    this.$card.classList.remove('is-idle', 'is-done');
    const avatar = job.avatar || PLACEHOLDER;
    if (this.$avatar.getAttribute('src') !== avatar) this.$avatar.src = avatar;
    this.$name.textContent = job.name || '这位朋友';
    this.$score.textContent = score == null ? '正在写福' : `福气 ${score}`;
    this.$line.textContent = line || '正在铺纸研墨…';
    this.$bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    this.$line.style.opacity = score == null ? '.62' : '1';
  }

  begin(job) {
    this.setJob(job, { pct: 0 });
  }

  progress(pct) {
    if (this.$card.classList.contains('is-done')) return;
    this.$bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    this.$score.textContent = `正在写福 ${Math.round(pct)}%`;
  }

  done(job) {
    const line = this.pickLine();
    this.setJob(job, { score: job.score, line, pct: 100 });
    this.$card.classList.add('is-done');
    this.count += 1;
    this.$count.textContent = String(this.count);
    this.push(job);
  }

  tick(job) {
    if (!job) return;
    this.setJob(job, { score: job.score });
    this.push(job);
  }

  reset() {
    this.count = 0;
    this.$count.textContent = '0';
    this.records = [];
    this.$tk.innerHTML = '';
    this.idle();
  }

  idle() {
    this.$card.classList.add('is-idle');
    this.$card.classList.remove('is-done');
    this.$avatar.src = PLACEHOLDER;
    this.$name.textContent = '等你来取福';
    this.$score.textContent = '福气 —';
    this.$line.textContent = '第一位观众进来，就给他写一张';
    this.$line.style.opacity = '1';
    this.$bar.style.width = '0%';
  }

  pickLine() {
    let n = Math.floor(Math.random() * BLESSINGS.length);
    if (n === this.last) n = (n + 1) % BLESSINGS.length;
    this.last = n;
    return BLESSINGS[n];
  }

  push(job) {
    this.records.unshift({ name: job.name, avatar: job.avatar });
    if (this.records.length > 24) this.records.pop();
    this.$tk.innerHTML = '';
    for (const r of this.records.slice(0, 5)) {
      const pill = document.createElement('div');
      pill.className = 'bl-tk-pill';
      const img = document.createElement('img');
      img.src = r.avatar || PLACEHOLDER;
      img.onerror = () => { img.src = PLACEHOLDER; };
      const span = document.createElement('span');
      span.textContent = r.name;
      pill.append(img, span);
      this.$tk.append(pill);
    }
  }
}
