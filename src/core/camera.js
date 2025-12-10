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

    const rangeRaw = player.range || 1;
    const baseRange = rangeRaw > 0.0001 ? rangeRaw : 0.0001;
    const paddedRange = baseRange * 1.05;

    let targetZoom;

    if (this._isMobile) {
      const axisPixels = this._isLandscape ? w : h;
      targetZoom = axisPixels / (paddedRange * 2);
    } else {
      const aspect = this._aspect;

      let worldHalfX;
      let worldHalfY;

      if (aspect >= 1) {
        worldHalfX = paddedRange * 0.5;
        worldHalfY = worldHalfX / aspect;
      } else {
        worldHalfY = paddedRange * 0.5;
        worldHalfX = worldHalfY * aspect;
      }

      const zoomX = w / (worldHalfX * 2);
      const zoomY = h / (worldHalfY * 2);

      targetZoom = zoomX < zoomY ? zoomX : zoomY;
    }

    const MIN_ZOOM = 0.2;
    const MAX_ZOOM = 3.0;
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
