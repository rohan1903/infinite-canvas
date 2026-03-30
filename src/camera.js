const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const ZOOM_INTENSITY = 0.0015;

export class Camera {
  constructor() {
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  worldToScreen(point) {
    return {
      x: point.x * this.scale + this.offsetX,
      y: point.y * this.scale + this.offsetY
    };
  }

  screenToWorld(point) {
    return {
      x: (point.x - this.offsetX) / this.scale,
      y: (point.y - this.offsetY) / this.scale
    };
  }

  panBy(screenDeltaX, screenDeltaY) {
    this.offsetX += screenDeltaX;
    this.offsetY += screenDeltaY;
  }

  zoomAt(screenPoint, deltaY) {
    const zoomFactor = Math.exp(-deltaY * ZOOM_INTENSITY);
    this.zoomByFactorAt(screenPoint, zoomFactor);
  }

  zoomByFactorAt(screenPoint, zoomFactor) {
    const targetScale = clamp(this.scale * zoomFactor, MIN_SCALE, MAX_SCALE);
    const worldBefore = this.screenToWorld(screenPoint);

    this.scale = targetScale;

    // Preserve cursor focus while zooming.
    this.offsetX = screenPoint.x - worldBefore.x * this.scale;
    this.offsetY = screenPoint.y - worldBefore.y * this.scale;
  }

  centerWorldPointAt(worldPoint, screenPoint) {
    this.offsetX = screenPoint.x - worldPoint.x * this.scale;
    this.offsetY = screenPoint.y - worldPoint.y * this.scale;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
