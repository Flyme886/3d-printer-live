// 预渲染话术短片播放器：让一张静态人像"会动、会张嘴"。
//
// 原理：每个话术对应一段提前生成好的短片（AI 图生视频 / 对口型工具产出）。
// 短片预加载，切换话术只是换 src 或换贴图，没有等待、没有实时推理，
// 直播时不掉帧。没有短片时自动退回静态图，不影响原有功能。
//
// 素材清单：assets/talking/clips.json

export class TalkingAvatar {
  constructor({ url = './assets/talking/clips.json', charId = 'baby', onStatus = () => {}, THREE = null } = {}) {
    this.url = url;
    this.charId = charId;
    this.onStatus = onStatus;
    this.THREE = THREE;
    this.manifest = null;
    this.clips = new Map();     // 地址 -> {video, ready, failed}
    this.textures = new Map();  // 地址 -> VideoTexture（只有 3D 相框用得到）
    this.bindings = new Set();
    this.enabled = true;
    this.pendingPlay = false;
    this.loaded = this.load();
    this.watchAutoplay();
  }

  async load() {
    try {
      const res = await fetch(this.url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      this.manifest = await res.json();
      for (const ch of Object.values(this.manifest.characters || {})) {
        for (const list of Object.values(ch.clips || {})) {
          for (const file of list) this.ensure(this.resolve(file));
        }
      }
      const n = this.clips.size;
      this.onStatus(n ? '话术短片已就绪 · ' + n + ' 段' : '没有说话短片，先用静态图');
    } catch (err) {
      this.manifest = null;
      this.onStatus('没有说话短片清单（' + err.message + '）');
    }
    return this.manifest;
  }

  resolve(file) {
    return /^(https?:|data:|\/)/.test(file) ? file : './assets/talking/' + file;
  }

  character(charId = this.charId) {
    return this.manifest?.characters?.[charId] || null;
  }

  // 从某个话术的多段候选里随机取一段，避免每次都是同一个动作
  pick(intent, charId = this.charId) {
    const list = this.character(charId)?.clips?.[intent];
    if (!Array.isArray(list) || !list.length) return null;
    const file = list[Math.floor(Math.random() * list.length)];
    return this.ensure(this.resolve(file));
  }

  ensure(url) {
    if (this.clips.has(url)) return this.clips.get(url);
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;           // 声音一律走 TTS，短片只负责口型动作
    video.playsInline = true;
    video.loop = true;
    video.preload = 'auto';
    const entry = { url, video, ready: false, failed: false };
    video.addEventListener('loadeddata', () => { entry.ready = true; try { video.pause() } catch {} });
    video.addEventListener('error', () => { entry.failed = true });
    this.clips.set(url, entry);
    return entry;
  }

  textureFor(entry) {
    if (!this.THREE) return null;
    if (this.textures.has(entry.url)) return this.textures.get(entry.url);
    const T = this.THREE;
    const tex = new T.VideoTexture(entry.video);
    tex.colorSpace = T.SRGBColorSpace;
    tex.minFilter = tex.magFilter = T.LinearFilter;
    tex.generateMipmaps = false;
    tex.userData.sharedTalking = true;   // 共享贴图，销毁打印件时不要释放
    this.textures.set(entry.url, tex);
    return tex;
  }

  // 绑到一个 <video> 元素（2D 挂件）
  bindVideo(videoEl, { charId = this.charId, onActivate = null, onIdle = null } = {}) {
    const binding = { kind: 'video', videoEl, charId, current: null, timer: 0, onActivate, onIdle };
    this.bindings.add(binding);
    this.loaded.then(() => this.toIdle(binding));
    return binding;
  }

  // 绑到一个材质（3D 相框，可选）
  bindMaterial(material, { charId = this.charId, stillUrl = '' } = {}) {
    const binding = { kind: 'material', material, charId, current: null, timer: 0, still: null };
    this.bindings.add(binding);
    if (stillUrl && this.THREE) {
      new this.THREE.TextureLoader().load(stillUrl, tex => {
        tex.colorSpace = this.THREE.SRGBColorSpace;
        binding.still = tex;
        if (!binding.current) this.applyMap(binding, tex);
      });
    }
    this.loaded.then(() => this.toIdle(binding));
    return binding;
  }

  unbind(binding) {
    if (!binding) return;
    clearTimeout(binding.timer);
    this.bindings.delete(binding);
  }

  toIdle(binding) {
    binding.onIdle?.();
    const idle = this.pick('idle', binding.charId);
    if (idle) this.activate(binding, idle, true);
    else if (binding.kind === 'material' && binding.still) this.applyMap(binding, binding.still);
  }

  // 播一段话术；没有对应片段就保持原样（画面不跳、不报错）
  say(intent, charId = this.charId) {
    if (!this.enabled || !this.manifest) return false;
    const entry = this.pick(intent, charId) || this.pick('talk', charId);
    if (!entry) return false;
    let hit = false;
    for (const binding of this.bindings) {
      if (binding.charId !== charId) continue;
      this.activate(binding, entry, false);
      hit = true;
    }
    return hit;
  }

  activate(binding, entry, loop) {
    clearTimeout(binding.timer);
    binding.current = entry.url;
    binding.onActivate?.(entry, loop);
    if (binding.kind === 'material') {
      const tex = this.textureFor(entry);
      if (!tex) return;
      this.applyMap(binding, tex);
      this.playVideo(entry.video, loop);
    } else {
      const v = binding.videoEl;
      if (v.dataset.clip !== entry.url) {
        v.dataset.clip = entry.url;
        v.src = entry.url;
      } else {
        try { v.currentTime = 0 } catch {}
      }
      v.loop = !!loop;
      this.playVideo(v, loop);
    }
    if (loop) return;
    const dur = entry.video.duration;
    const ms = (isFinite(dur) && dur > 0.2 ? dur : 3) * 1000;
    binding.timer = setTimeout(() => this.toIdle(binding), ms);
  }

  playVideo(video, loop) {
    video.loop = !!loop;
    const p = video.play();
    if (p?.catch) p.catch(() => { this.pendingPlay = true });
  }

  applyMap(binding, texture) {
    const m = binding.material;
    m.map = texture;
    if (m.emissiveMap !== undefined) m.emissiveMap = texture;
    m.color?.set?.('#ffffff');
    m.needsUpdate = true;
  }

  // 有些浏览器会拦截静音自动播放，第一次点击/按键时补播
  watchAutoplay() {
    const resume = () => {
      if (!this.pendingPlay) return;
      this.pendingPlay = false;
      for (const binding of this.bindings) {
        const url = binding.current;
        if (!url) continue;
        const entry = this.clips.get(url);
        if (entry) entry.video.play().catch(() => {});
        if (binding.kind === 'video') binding.videoEl.play?.().catch?.(() => {});
      }
    };
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
      document.addEventListener(ev, resume, { passive: true });
    }
  }
}
