import { DEFAULT_TEXT_BOX_HEIGHT, DEFAULT_TEXT_BOX_WIDTH, DEFAULT_TEXT_FONT_SIZE, getTextBounds } from "./text.js";

let nextElementId = 1;

export class StrokeManager {
  constructor(defaultColor, defaultWidth) {
    this.defaultColor = defaultColor;
    this.defaultWidth = defaultWidth;
    this.elements = [];
    this.activeElementId = null;
    this.selectedElementIds = [];
    this.selectionRect = null;
    this.undoStack = [];
    this.redoStack = [];
  }

  get activeElement() {
    return this.elements.find((element) => element.id === this.activeElementId) ?? null;
  }

  get selectedElementId() {
    return this.selectedElementIds.length > 0 ? this.selectedElementIds[this.selectedElementIds.length - 1] : null;
  }

  beginElement(tool, worldPoint, style) {
    const baseStyle = {
      color: style.color ?? this.defaultColor,
      width: style.width ?? this.defaultWidth,
      fill: style.fill ?? null
    };

    const element = createElement(tool, worldPoint, baseStyle);
    this.elements.push(element);
    this.activeElementId = element.id;
    this.clearSelection();
  }

  updateActiveElement(worldPoint) {
    const element = this.activeElement;
    if (!element) {
      return;
    }

    if (element.type === "freehand") {
      appendInterpolatedPoint(element, worldPoint);
      return;
    }

    element.x2 = worldPoint.x;
    element.y2 = worldPoint.y;
  }

  endElement() {
    const element = this.activeElement;
    if (!element) {
      return;
    }

    if (element.type !== "freehand" && nearlyZero(element.x1, element.x2) && nearlyZero(element.y1, element.y2)) {
      this.elements = this.elements.filter((item) => item.id !== element.id);
      this.activeElementId = null;
      this.clearSelection();
      return;
    }

    this.activeElementId = null;
    this.pushHistory();
  }

  clearSelection() {
    this.selectedElementIds = [];
    this.selectionRect = null;
  }

  selectAt(worldPoint) {
    const hit = findTopMostHit(this.elements, worldPoint);
    this.selectedElementIds = hit ? [hit.id] : [];
    return hit;
  }

  getElementAt(worldPoint) {
    return findTopMostHit(this.elements, worldPoint);
  }

  selectInRect(rect) {
    const normalized = normalizeRect(rect);
    const selected = [];
    for (const element of this.elements) {
      const bounds = getElementBounds(element);
      if (!bounds) {
        continue;
      }
      if (
        bounds.left <= normalized.right &&
        bounds.right >= normalized.left &&
        bounds.top <= normalized.bottom &&
        bounds.bottom >= normalized.top
      ) {
        selected.push(element.id);
      }
    }
    this.selectedElementIds = selected;
    return selected;
  }

  isPointInSelection(worldPoint) {
    if (this.selectedElementIds.length === 0) {
      return false;
    }
    const groupBounds = this.getSelectionBounds();
    if (
      groupBounds &&
      worldPoint.x >= groupBounds.left &&
      worldPoint.x <= groupBounds.right &&
      worldPoint.y >= groupBounds.top &&
      worldPoint.y <= groupBounds.bottom
    ) {
      return true;
    }
    for (const id of this.selectedElementIds) {
      const element = this.elements.find((item) => item.id === id);
      if (element && hitTest(element, worldPoint)) {
        return true;
      }
    }
    return false;
  }

  getSelectionBounds() {
    if (this.selectedElementIds.length === 0) {
      return null;
    }
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const id of this.selectedElementIds) {
      const element = this.elements.find((item) => item.id === id);
      if (!element) {
        continue;
      }
      const bounds = getElementBounds(element);
      if (!bounds) {
        continue;
      }
      left = Math.min(left, bounds.left);
      top = Math.min(top, bounds.top);
      right = Math.max(right, bounds.right);
      bottom = Math.max(bottom, bounds.bottom);
    }
    if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) {
      return null;
    }
    return { left, top, right, bottom };
  }

  moveSelectedBy(deltaX, deltaY) {
    for (const id of this.selectedElementIds) {
      const element = this.elements.find((item) => item.id === id);
      if (!element) {
        continue;
      }
      moveElementBy(element, deltaX, deltaY);
    }
  }

  commitMove() {
    this.pushHistory();
  }

  removeSelected() {
    if (this.selectedElementIds.length === 0) {
      return;
    }

    const selected = new Set(this.selectedElementIds);
    this.elements = this.elements.filter((item) => !selected.has(item.id));
    this.clearSelection();
    this.pushHistory();
  }

  eraseTopAt(worldPoint) {
    const hit = findTopMostHit(this.elements, worldPoint);
    if (!hit) {
      return false;
    }
    this.elements = this.elements.filter((item) => item.id !== hit.id);
    if (this.selectedElementIds.includes(hit.id)) {
      this.selectedElementIds = this.selectedElementIds.filter((id) => id !== hit.id);
    }
    if (this.activeElementId === hit.id) {
      this.activeElementId = null;
    }
    return true;
  }

  pushHistory() {
    this.undoStack.push(serializeElements(this.elements));
    this.redoStack = [];
  }

  loadElements(elements) {
    this.elements = deserializeElements(serializeElements(elements));
    this.activeElementId = null;
    this.clearSelection();
    this.pushHistory();
  }

  undo() {
    if (this.undoStack.length <= 1) {
      return false;
    }
    const current = this.undoStack.pop();
    this.redoStack.push(current);
    this.elements = deserializeElements(this.undoStack[this.undoStack.length - 1]);
    this.activeElementId = null;
    this.clearSelection();
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) {
      return false;
    }
    const next = this.redoStack.pop();
    this.undoStack.push(next);
    this.elements = deserializeElements(next);
    this.activeElementId = null;
    this.clearSelection();
    return true;
  }
}

function createElement(tool, point, style) {
  if (tool === "freehand") {
    return {
      id: nextElementId++,
      type: "freehand",
      points: [{ x: point.x, y: point.y }],
      color: style.color,
      width: style.width
    };
  }

  if (tool === "text") {
    return {
      id: nextElementId++,
      type: "text",
      x: point.x,
      y: point.y,
      text: "",
      fontSize: style.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
      color: style.color,
      boxWidth: DEFAULT_TEXT_BOX_WIDTH,
      boxHeight: DEFAULT_TEXT_BOX_HEIGHT
    };
  }

  return {
    id: nextElementId++,
    type: tool,
    x1: point.x,
    y1: point.y,
    x2: point.x,
    y2: point.y,
    color: style.color,
    width: style.width,
    fill: style.fill
  };
}

function appendInterpolatedPoint(element, worldPoint) {
  const points = element.points;
  const lastPoint = points[points.length - 1];
  const distance = Math.hypot(worldPoint.x - lastPoint.x, worldPoint.y - lastPoint.y);
  if (distance < 0.01) {
    return;
  }

  const step = Math.max(0.5, element.width * 0.55);
  const segments = Math.max(1, Math.ceil(distance / step));
  for (let i = 1; i <= segments; i += 1) {
    const t = i / segments;
    points.push({
      x: lastPoint.x + (worldPoint.x - lastPoint.x) * t,
      y: lastPoint.y + (worldPoint.y - lastPoint.y) * t
    });
  }
}

function findTopMostHit(elements, point) {
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    if (hitTest(elements[i], point)) {
      return elements[i];
    }
  }
  return null;
}

function hitTest(element, point) {
  const tolerance = Math.max(6, element.width * 2);
  if (element.type === "text") {
    const bounds = getElementBounds(element);
    return bounds
      ? point.x >= bounds.left - 4 && point.x <= bounds.right + 4 && point.y >= bounds.top - 4 && point.y <= bounds.bottom + 4
      : false;
  }
  if (element.type === "freehand") {
    return element.points.some((p) => Math.hypot(point.x - p.x, point.y - p.y) <= tolerance);
  }

  const left = Math.min(element.x1, element.x2);
  const right = Math.max(element.x1, element.x2);
  const top = Math.min(element.y1, element.y2);
  const bottom = Math.max(element.y1, element.y2);

  if (element.type === "rectangle") {
    return point.x >= left - tolerance && point.x <= right + tolerance && point.y >= top - tolerance && point.y <= bottom + tolerance;
  }

  if (element.type === "ellipse") {
    const rx = (right - left) / 2;
    const ry = (bottom - top) / 2;
    if (rx < 1 || ry < 1) {
      return false;
    }
    const cx = left + rx;
    const cy = top + ry;
    const normalized = ((point.x - cx) * (point.x - cx)) / (rx * rx) + ((point.y - cy) * (point.y - cy)) / (ry * ry);
    return normalized <= 1.2;
  }

  const segmentDistance = distanceToSegment(point, { x: element.x1, y: element.y1 }, { x: element.x2, y: element.y2 });
  return segmentDistance <= tolerance;
}

function moveElementBy(element, deltaX, deltaY) {
  if (element.type === "freehand") {
    for (const point of element.points) {
      point.x += deltaX;
      point.y += deltaY;
    }
    return;
  }
  if (element.type === "text") {
    element.x += deltaX;
    element.y += deltaY;
    return;
  }
  element.x1 += deltaX;
  element.y1 += deltaY;
  element.x2 += deltaX;
  element.y2 += deltaY;
}

function getElementBounds(element) {
  if (element.type === "freehand") {
    if (!element.points?.length) {
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
  if (element.type === "text") {
    return getTextBounds(element, (value) => Math.max(1, String(value).length * ((element.fontSize ?? DEFAULT_TEXT_FONT_SIZE) * 0.62)));
  }
  return {
    left: Math.min(element.x1, element.x2),
    top: Math.min(element.y1, element.y2),
    right: Math.max(element.x1, element.x2),
    bottom: Math.max(element.y1, element.y2)
  };
}

function normalizeRect(rect) {
  return {
    left: Math.min(rect.x1, rect.x2),
    top: Math.min(rect.y1, rect.y2),
    right: Math.max(rect.x1, rect.x2),
    bottom: Math.max(rect.y1, rect.y2)
  };
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  const projection = { x: start.x + t * dx, y: start.y + t * dy };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

function nearlyZero(a, b) {
  return Math.abs(a - b) < 0.001;
}

function serializeElements(elements) {
  return JSON.stringify(elements);
}

function deserializeElements(serialized) {
  return JSON.parse(serialized);
}
