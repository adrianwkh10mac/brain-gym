// ===== 启动：所有游戏注册完毕后初始化主页，并注册离线缓存 =====
if (typeof document !== 'undefined') {
  // 旧版安卓浏览器没有 roundRect，补一个（街机游戏画图用到）
  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      const rr = Math.min(typeof r === 'number' ? r : 8, w / 2, h / 2);
      this.moveTo(x + rr, y);
      this.arcTo(x + w, y, x + w, y + h, rr);
      this.arcTo(x + w, y + h, x, y + h, rr);
      this.arcTo(x, y + h, x, y, rr);
      this.arcTo(x, y, x + w, y, rr);
      this.closePath();
      return this;
    };
  }

  BrainGym.init();

  // PWA 离线支持（需要 https 或 localhost；本地双击 file:// 打开时自动跳过）
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* 注册失败不影响游戏 */ });
    });
  }
}
