export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.minZoom = 0.35;
    this.maxZoom = 1.3;
  }

  update(player, dt) {
    const targetX = player.x;
    const targetY = player.y;

    const lerpPos = Math.min(1, dt * 8);
    this.x += (targetX - this.x) * lerpPos;
    this.y += (targetY - this.y) * lerpPos;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const range = player.range || 700;
    const margin = 80;

    const maxZoomByWidth = w / (2 * (range + margin));
    const maxZoomByHeight = h / (2 * (range + margin));
    let desiredZoom = Math.min(this.maxZoom, maxZoomByWidth, maxZoomByHeight);
    desiredZoom = Math.max(this.minZoom, desiredZoom);

    const lerpZoom = Math.min(1, dt * 5);
    this.zoom += (desiredZoom - this.zoom) * lerpZoom;
  }

  applyTransform(ctx) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  resetTransform(ctx) {
    ctx.restore();
  }
}
