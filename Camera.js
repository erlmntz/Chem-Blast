/**
 * Camera — transforms canvas to maintain a virtual design resolution
 * and provides screen-to-world coordinate conversion.
 */
class Camera {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.designWidth = opts.width || 800;
    this.designHeight = opts.height || 600;
    this.bg = opts.background || '#1a1a2e';

    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeTimer = 0;

    this._handleResize();
  }

  static create(canvas, opts) {
    return new Camera(canvas, opts);
  }

  /** Recalculate scale + offset so the design res fits the canvas */
  _handleResize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);

    const sx = rect.width / this.designWidth;
    const sy = rect.height / this.designHeight;
    this.scale = Math.min(sx, sy);
    this.offsetX = (rect.width - this.designWidth * this.scale) / 2;
    this.offsetY = (rect.height - this.designHeight * this.scale) / 2;
  }

  /** Convert screen coordinates → world coordinates */
  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const px = (clientX - rect.left - this.offsetX) / this.scale;
    const py = (clientY - rect.top - this.offsetY) / this.scale;
    return { x: px, y: py };
  }

  /** Apply camera transform and clear */
  begin(ctx) {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    let shakeX = 0, shakeY = 0;
    if (this.shakeTimer > 0) {
      shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      shakeY = (Math.random() - 0.5) * this.shakeIntensity;
    }

    ctx.translate(this.offsetX + shakeX, this.offsetY + shakeY);
    ctx.scale(this.scale, this.scale);
  }

  /** Restore canvas state after drawing */
  end(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Trigger a screen shake */
  shake(intensity, duration) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  }

  /** Call every frame from game update */
  update(dt) {
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      if (this.shakeTimer < 0) this.shakeTimer = 0;
    }
  }

  /** Call on window/container resize */
  resize() {
    this._handleResize();
  }
}
