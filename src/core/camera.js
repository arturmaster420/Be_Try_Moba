export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;

    this.zoom = 1;

    this.positionLerp = 8;
    this.zoomLerp = 4;

    this._lastW = 0;
    this._lastH = 0;
    this._aspect = 1;
    this._isMobile = false;
    this._isLandscape = true;

    // Kept for backward-compat; no longer used (weapon stages removed).
    this._zoomLockRange = null;
  }

  _updateCanvasInfo() {
    const w = this.canvas.width || 1;
    const h = this.canvas.height || 1;

    if (w === this._lastW && h === this._lastH) {
      return;
    }

    this._lastW = w;
    this._lastH = h;

    this._aspect = w / h;
    const maxDim = w > h ? w : h;
    this._isMobile = maxDim < 1000;
    this._isLandscape = this._aspect >= 1;
  }

  update(player, dt) {
    this._updateCanvasInfo();

    const w = this._lastW;
    const h = this._lastH;

    const targetX = player.x;
    const targetY = player.y;

    const lerpPos = dt * this.positionLerp;
    const tPos = lerpPos > 1 ? 1 : lerpPos;

    this.x += (targetX - this.x) * tPos;
    this.y += (targetY - this.y) * tPos;

    // ===============================
    //  Visual readability tuning
    //  Goal: "Magic Survival"-like proportions:
    //   - stable readable baseline
    //   - camera only SLIGHTLY zooms out as power/range grows (max ~20%)
    //   - avoid extreme zoom-in on desktop (no MAX_ZOOM=3 clamp issues)
    // ===============================

    const rangeRaw = Number.isFinite(player.range) ? player.range : 220;
    const attackRange = rangeRaw > 1 ? rangeRaw : 220;

    // Base world span (in world units) visible on the *short* screen axis.
    // Mobile gets a bit more span to reduce "fat" look in portrait.
    const BASE_SPAN = this._isMobile ? 760 : 660;

    // Slight zoom-out from power: logarithmic per doubling of attack range.
    // Doubling range => +12% span; clamped to +20% max over the run.
    const REF_RANGE = 240;
    const norm = attackRange / REF_RANGE;
    const log2 = Math.log(norm) / Math.log(2);
    const grow = Math.max(-0.08, Math.min(0.20, log2 * 0.12));

    const targetSpan = BASE_SPAN * (1 + grow);
    const minAxis = w < h ? w : h;
    let targetZoom = minAxis / Math.max(1, targetSpan);

    // Conservative clamps (prevents giant sprites early & micro-world late)
    const MIN_ZOOM = this._isMobile ? 0.65 : 0.55;
    const MAX_ZOOM = this._isMobile ? 1.85 : 2.10;
    if (targetZoom < MIN_ZOOM) targetZoom = MIN_ZOOM;
    if (targetZoom > MAX_ZOOM) targetZoom = MAX_ZOOM;

    const lerpZoom = dt * this.zoomLerp;
    const tZoom = lerpZoom > 1 ? 1 : lerpZoom;

    this.zoom += (targetZoom - this.zoom) * tZoom;
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
