import { getTextBounds, getTextFont, getTextMetrics, getTextStartY } from "./text.js";

export class Renderer {
  constructor(ctx, theme) {
    this.ctx = ctx;
    this.theme = theme;
    this.pixelRatio = 1;
    this.backgroundColor = theme.background;
    this.gridVisible = true;
  }

  setPixelRatio(pixelRatio) {
    this.pixelRatio = Math.max(1, pixelRatio);
  }

  setBackgroundColor(color) {
    this.backgroundColor = color;
  }

  setGridVisible(isVisible) {
    this.gridVisible = isVisible;
  }

  render(camera, elements, selectedElementIds, showSelectionOutline, selectionRect, viewport) {
    const { ctx } = this;
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    if (this.gridVisible) {
      this.drawGrid(camera, viewport);
    }

    ctx.save();
    ctx.setTransform(
      camera.scale * this.pixelRatio,
      0,
      0,
      camera.scale * this.pixelRatio,
      camera.offsetX * this.pixelRatio,
      camera.offsetY * this.pixelRatio
    );
    for (const element of elements) {
      drawElement(ctx, element);
    }
    if (showSelectionOutline && Array.isArray(selectedElementIds)) {
      const groupBounds = getGroupBounds(elements, selectedElementIds);
      if (groupBounds) {
        drawGroupSelectionOutline(ctx, groupBounds, camera.scale);
      }
      for (const selectedId of selectedElementIds) {
        const selected = elements.find((element) => element.id === selectedId);
        if (selected) {
          drawSelectionOutline(ctx, selected, camera.scale);
        }
      }
    }
    if (showSelectionOutline && selectionRect) {
      drawSelectionRect(ctx, selectionRect, camera.scale);
    }
    ctx.restore();
  }

  drawGrid(camera, viewport) {
    const { ctx } = this;
    const baseSpacing = 40;
    const scaledSpacing = baseSpacing * camera.scale;

    if (scaledSpacing < 8) {
      return;
    }

    const worldTopLeft = camera.screenToWorld({ x: 0, y: 0 });
    const worldBottomRight = camera.screenToWorld({
      x: viewport.width,
      y: viewport.height
    });

    const worldStartX = Math.floor(worldTopLeft.x / baseSpacing) * baseSpacing;
    const worldStartY = Math.floor(worldTopLeft.y / baseSpacing) * baseSpacing;

    ctx.save();
    ctx.lineWidth = 1;

    for (let x = worldStartX; x <= worldBottomRight.x; x += baseSpacing) {
      const screen = camera.worldToScreen({ x, y: 0 });
      const isMajor = Math.round(x / baseSpacing) % 5 === 0;
      ctx.strokeStyle = isMajor ? this.theme.gridMajor : this.theme.gridMinor;
      ctx.beginPath();
      ctx.moveTo(Math.round(screen.x) + 0.5, 0);
      ctx.lineTo(Math.round(screen.x) + 0.5, viewport.height);
      ctx.stroke();
    }

    for (let y = worldStartY; y <= worldBottomRight.y; y += baseSpacing) {
      const screen = camera.worldToScreen({ x: 0, y });
      const isMajor = Math.round(y / baseSpacing) % 5 === 0;
      ctx.strokeStyle = isMajor ? this.theme.gridMajor : this.theme.gridMinor;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(screen.y) + 0.5);
      ctx.lineTo(viewport.width, Math.round(screen.y) + 0.5);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawElement(ctx, element) {
  if (element.type === "text") {
    drawTextElement(ctx, element);
    return;
  }
  if (element.type === "freehand") {
    drawFreehand(ctx, element);
    return;
  }

  ctx.strokeStyle = element.color;
  ctx.lineWidth = element.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const left = Math.min(element.x1, element.x2);
  const right = Math.max(element.x1, element.x2);
  const top = Math.min(element.y1, element.y2);
  const bottom = Math.max(element.y1, element.y2);

  if (element.type === "rectangle") {
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    if (element.fill) {
      ctx.fillStyle = element.fill;
      ctx.fill();
    }
    ctx.stroke();
    return;
  }

  if (element.type === "ellipse") {
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    const radiusX = Math.max(1, (right - left) / 2);
    const radiusY = Math.max(1, (bottom - top) / 2);
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    if (element.fill) {
      ctx.fillStyle = element.fill;
      ctx.fill();
    }
    ctx.stroke();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(element.x1, element.y1);
  ctx.lineTo(element.x2, element.y2);
  ctx.stroke();

  if (element.type === "arrow") {
    const angle = Math.atan2(element.y2 - element.y1, element.x2 - element.x1);
    const headLength = Math.max(10, element.width * 4);
    ctx.beginPath();
    ctx.moveTo(element.x2, element.y2);
    ctx.lineTo(
      element.x2 - headLength * Math.cos(angle - Math.PI / 8),
      element.y2 - headLength * Math.sin(angle - Math.PI / 8)
    );
    ctx.moveTo(element.x2, element.y2);
    ctx.lineTo(
      element.x2 - headLength * Math.cos(angle + Math.PI / 8),
      element.y2 - headLength * Math.sin(angle + Math.PI / 8)
    );
    ctx.stroke();
  }
}

function drawTextElement(ctx, element) {
  ctx.fillStyle = element.color;
  const fallbackMeasure = (value) => Math.max(1, String(value).length * ((element.fontSize ?? 20) * 0.62));
  const fontSize = element.fontSize ?? 20;
  ctx.font = getTextFont(fontSize);
  ctx.textBaseline = "alphabetic";
  const metrics = getTextMetrics(element, (value) => ctx.measureText(value).width || fallbackMeasure(value));
  const startY = getTextStartY(element, metrics);
  for (let i = 0; i < metrics.lines.length; i += 1) {
    ctx.fillText(metrics.lines[i], element.x, startY + i * metrics.lineHeight);
  }
}

function drawFreehand(ctx, element) {
  if (element.points.length === 0) {
    return;
  }
  ctx.strokeStyle = element.color;
  ctx.lineWidth = element.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (element.points.length === 1) {
    const only = element.points[0];
    ctx.beginPath();
    ctx.arc(only.x, only.y, element.width / 2, 0, Math.PI * 2);
    ctx.fillStyle = element.color;
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(element.points[0].x, element.points[0].y);
  for (let i = 1; i < element.points.length; i += 1) {
    const point = element.points[i];
    ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
}

function drawSelectionOutline(ctx, element, scale) {
  const bounds = getBounds(element);
  if (!bounds) {
    return;
  }
  ctx.save();
  ctx.strokeStyle = "#0e7490";
  ctx.lineWidth = 1.5 / Math.max(0.1, scale);
  ctx.setLineDash([6 / Math.max(0.1, scale), 4 / Math.max(0.1, scale)]);
  ctx.strokeRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  ctx.restore();
}

function getBounds(element) {
  if (element.type === "text") {
    return getTextBounds(element, (value) => Math.max(1, String(value).length * ((element.fontSize ?? 20) * 0.62)));
  }
  if (element.type === "freehand") {
    if (element.points.length === 0) {
      return null;
    }
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const point of element.points) {
      left = Math.min(left, point.x);
      top = Math.min(top, point.y);
      right = Math.max(right, point.x);
      bottom = Math.max(bottom, point.y);
    }
    return { left, top, right, bottom };
  }
  return {
    left: Math.min(element.x1, element.x2),
    top: Math.min(element.y1, element.y2),
    right: Math.max(element.x1, element.x2),
    bottom: Math.max(element.y1, element.y2)
  };
}

function drawSelectionRect(ctx, rect, scale) {
  const left = Math.min(rect.x1, rect.x2);
  const top = Math.min(rect.y1, rect.y2);
  const width = Math.abs(rect.x2 - rect.x1);
  const height = Math.abs(rect.y2 - rect.y1);
  ctx.save();
  ctx.strokeStyle = "#0891b2";
  ctx.fillStyle = "rgba(8, 145, 178, 0.08)";
  ctx.lineWidth = 1.5 / Math.max(0.1, scale);
  ctx.setLineDash([4 / Math.max(0.1, scale), 3 / Math.max(0.1, scale)]);
  ctx.fillRect(left, top, width, height);
  ctx.strokeRect(left, top, width, height);
  ctx.restore();
}

function getGroupBounds(elements, selectedElementIds) {
  if (!selectedElementIds || selectedElementIds.length <= 1) {
    return null;
  }
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const id of selectedElementIds) {
    const element = elements.find((item) => item.id === id);
    if (!element) {
      continue;
    }
    const b = getBounds(element);
    if (!b) {
      continue;
    }
    left = Math.min(left, b.left);
    top = Math.min(top, b.top);
    right = Math.max(right, b.right);
    bottom = Math.max(bottom, b.bottom);
  }
  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) {
    return null;
  }
  return { left, top, right, bottom };
}

function drawGroupSelectionOutline(ctx, bounds, scale) {
  ctx.save();
  ctx.strokeStyle = "#0f766e";
  ctx.lineWidth = 2 / Math.max(0.1, scale);
  ctx.setLineDash([]);
  ctx.strokeRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  ctx.restore();
}

