import { Camera } from "./camera.js";
import { InputHandler } from "./input.js";
import { Renderer } from "./renderer.js";
import { StrokeManager } from "./strokes.js";
import {
  DEFAULT_TEXT_BOX_HEIGHT,
  DEFAULT_TEXT_BOX_WIDTH,
  DEFAULT_TEXT_FONT_SIZE,
  getTextBounds,
  getTextFont,
  getTextMetrics,
  getTextStartY
} from "./text.js";
import { THEME } from "./theme.js";

const canvas = document.getElementById("canvas");
const zoomIndicator = document.getElementById("zoom-indicator");
const toolButtons = Array.from(document.querySelectorAll("[data-tool]"));
const colorMenuButton = document.getElementById("color-menu-button");
const colorMenu = document.getElementById("color-menu");
const foregroundChip = document.getElementById("foreground-chip");
const backgroundChip = document.getElementById("background-chip");
const fillChip = document.getElementById("fill-chip");
const foregroundCircle = document.getElementById("foreground-circle");
const backgroundCircle = document.getElementById("background-circle");
const fillCircle = document.getElementById("fill-circle");
const foregroundInput = document.getElementById("foreground-input");
const backgroundInput = document.getElementById("background-input");
const fillInput = document.getElementById("fill-input");
const fillEnabled = document.getElementById("fill-enabled");
const strokeWidth = document.getElementById("stroke-width");
const undoButton = document.getElementById("undo-button");
const redoButton = document.getElementById("redo-button");
const deleteButton = document.getElementById("delete-button");
const zoomOutButton = document.getElementById("zoom-out-button");
const zoomInButton = document.getElementById("zoom-in-button");
const zoomResetButton = document.getElementById("zoom-reset-button");
const focusContentButton = document.getElementById("focus-content-button");
const fitContentButton = document.getElementById("fit-content-button");
const gridToggleButton = document.getElementById("grid-toggle-button");
const menuButton = document.getElementById("menu-button");
const fileMenu = document.getElementById("file-menu");
const saveSceneButton = document.getElementById("save-scene-button");
const openSceneButton = document.getElementById("open-scene-button");
const exportPngButton = document.getElementById("export-png-button");
const exportSvgButton = document.getElementById("export-svg-button");
const copyPngButton = document.getElementById("copy-png-button");
const openSceneInput = document.getElementById("open-scene-input");
const textEditor = document.getElementById("text-editor");
const ctx = canvas.getContext("2d");

if (!ctx) {
  throw new Error("Could not create 2D rendering context.");
}

const camera = new Camera();
const strokeManager = new StrokeManager(THEME.stroke, 3);
const renderer = new Renderer(ctx, THEME);
let currentTool = "freehand";
let currentStyle = { color: THEME.stroke, width: 3, fill: null };
let currentBackgroundColor = THEME.background;
let gridVisible = true;
strokeManager.pushHistory();

let viewport = { width: 0, height: 0 };
let rafId = null;
let pixelRatio = 1;
let editingTextElementId = null;

function resizeCanvas() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  pixelRatio = dpr;
  renderer.setPixelRatio(pixelRatio);

  viewport = { width, height };
  requestRender();
}

function requestRender() {
  if (rafId !== null) {
    return;
  }

  rafId = window.requestAnimationFrame(() => {
    rafId = null;
    renderer.render(
      camera,
      strokeManager.elements,
      strokeManager.selectedElementIds,
      currentTool === "select",
      strokeManager.selectionRect,
      viewport
    );
    const zoomText = `${Math.round(camera.scale * 100)}%`;
    zoomIndicator.textContent = zoomText;
    zoomResetButton.textContent = zoomText;
  });
}

renderer.setBackgroundColor(currentBackgroundColor);
renderer.setGridVisible(gridVisible);
updateColorUi();

new InputHandler(canvas, camera, strokeManager, requestRender, {
  getTool: () => currentTool,
  getStyle: () => currentStyle,
  getCursorForTool,
  openTextEditor,
  openTextEditorForElement,
  isTextEditing: () => editingTextElementId !== null
});

for (const button of toolButtons) {
  button.addEventListener("click", () => {
    currentTool = button.dataset.tool;
    if (currentTool !== "select") {
      strokeManager.clearSelection();
    }
    updateActiveToolUi();
    canvas.style.cursor = getCursorForTool(currentTool);
    requestRender();
  });
}

strokeWidth.addEventListener("input", () => {
  currentStyle = { ...currentStyle, width: Number(strokeWidth.value) };
});

fillEnabled.addEventListener("change", () => {
  applyFillState();
  updateColorUi();
});

colorMenuButton.addEventListener("click", () => {
  if (colorMenu.classList.contains("hidden")) {
    openMenuNearAnchor(colorMenu, colorMenuButton);
  } else {
    colorMenu.classList.add("hidden");
  }
});

foregroundCircle.addEventListener("click", () => {
  foregroundInput.click();
});

backgroundCircle.addEventListener("click", () => {
  backgroundInput.click();
});

fillCircle.addEventListener("click", () => {
  fillInput.click();
});

foregroundInput.addEventListener("input", () => {
  currentStyle = { ...currentStyle, color: foregroundInput.value };
  updateColorUi();
});

backgroundInput.addEventListener("input", () => {
  currentBackgroundColor = backgroundInput.value;
  renderer.setBackgroundColor(currentBackgroundColor);
  updateColorUi();
  requestRender();
});

fillInput.addEventListener("input", () => {
  applyFillState();
  updateColorUi();
});

undoButton.addEventListener("click", () => {
  if (strokeManager.undo()) {
    requestRender();
  }
});

redoButton.addEventListener("click", () => {
  if (strokeManager.redo()) {
    requestRender();
  }
});

deleteButton.addEventListener("click", () => {
  strokeManager.removeSelected();
  requestRender();
});

zoomOutButton.addEventListener("click", () => {
  camera.zoomByFactorAt({ x: viewport.width / 2, y: viewport.height / 2 }, 1 / 1.15);
  requestRender();
});

zoomInButton.addEventListener("click", () => {
  camera.zoomByFactorAt({ x: viewport.width / 2, y: viewport.height / 2 }, 1.15);
  requestRender();
});

zoomResetButton.addEventListener("click", () => {
  const factor = 1 / camera.scale;
  camera.zoomByFactorAt({ x: viewport.width / 2, y: viewport.height / 2 }, factor);
  requestRender();
});

focusContentButton.addEventListener("click", () => {
  const bounds = getContentBounds(strokeManager.elements);
  const centerScreen = { x: viewport.width / 2, y: viewport.height / 2 };

  if (!bounds) {
    camera.centerWorldPointAt({ x: 0, y: 0 }, centerScreen);
    requestRender();
    return;
  }

  const worldCenter = {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2
  };

  camera.centerWorldPointAt(worldCenter, centerScreen);
  requestRender();
});

fitContentButton.addEventListener("click", () => {
  const bounds = getContentBounds(strokeManager.elements);
  const centerScreen = { x: viewport.width / 2, y: viewport.height / 2 };
  if (!bounds) {
    camera.centerWorldPointAt({ x: 0, y: 0 }, centerScreen);
    requestRender();
    return;
  }
  const padding = 80;
  const contentWidth = Math.max(1, bounds.right - bounds.left);
  const contentHeight = Math.max(1, bounds.bottom - bounds.top);
  const scaleX = (viewport.width - padding * 2) / contentWidth;
  const scaleY = (viewport.height - padding * 2) / contentHeight;
  camera.scale = Math.max(0.1, Math.min(10, Math.min(scaleX, scaleY)));
  camera.centerWorldPointAt(
    { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 },
    centerScreen
  );
  requestRender();
});

gridToggleButton.addEventListener("click", () => {
  gridVisible = !gridVisible;
  renderer.setGridVisible(gridVisible);
  gridToggleButton.classList.toggle("active", gridVisible);
  requestRender();
});

menuButton.addEventListener("click", () => {
  if (fileMenu.classList.contains("hidden")) {
    openMenuNearAnchor(fileMenu, menuButton);
  } else {
    fileMenu.classList.add("hidden");
  }
});

window.addEventListener("pointerdown", (event) => {
  if (
    !fileMenu.classList.contains("hidden") &&
    !fileMenu.contains(event.target) &&
    !menuButton.contains(event.target)
  ) {
    fileMenu.classList.add("hidden");
  }
  if (
    !colorMenu.classList.contains("hidden") &&
    !colorMenu.contains(event.target) &&
    !colorMenuButton.contains(event.target)
  ) {
    colorMenu.classList.add("hidden");
  }
});

saveSceneButton.addEventListener("click", () => {
  const scene = {
    version: 1,
    camera: { scale: camera.scale, offsetX: camera.offsetX, offsetY: camera.offsetY },
    colors: {
      foreground: currentStyle.color,
      background: currentBackgroundColor,
      fill: fillInput.value,
      fillEnabled: fillEnabled.checked
    },
    view: {
      gridVisible
    },
    elements: strokeManager.elements
  };
  const blob = new Blob([JSON.stringify(scene, null, 2)], { type: "application/json" });
  downloadBlob(blob, `infinite-canvas-${Date.now()}.json`);
  fileMenu.classList.add("hidden");
});

openSceneButton.addEventListener("click", () => {
  openSceneInput.click();
});

openSceneInput.addEventListener("change", async () => {
  const file = openSceneInput.files?.[0];
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    const scene = JSON.parse(text);
    if (!Array.isArray(scene.elements)) {
      throw new Error("Invalid scene file");
    }
    strokeManager.loadElements(scene.elements);
    if (scene.camera) {
      camera.scale = Number(scene.camera.scale) || 1;
      camera.offsetX = Number(scene.camera.offsetX) || 0;
      camera.offsetY = Number(scene.camera.offsetY) || 0;
    }
    if (scene.colors) {
      if (typeof scene.colors.foreground === "string") {
        foregroundInput.value = scene.colors.foreground;
        currentStyle = { ...currentStyle, color: scene.colors.foreground };
      }
      if (typeof scene.colors.background === "string") {
        backgroundInput.value = scene.colors.background;
        currentBackgroundColor = scene.colors.background;
        renderer.setBackgroundColor(currentBackgroundColor);
      }
      if (typeof scene.colors.fill === "string") {
        fillInput.value = scene.colors.fill;
      }
      fillEnabled.checked = Boolean(scene.colors.fillEnabled);
      applyFillState();
      updateColorUi();
    }
    if (scene.view && typeof scene.view.gridVisible === "boolean") {
      gridVisible = scene.view.gridVisible;
      renderer.setGridVisible(gridVisible);
      gridToggleButton.classList.toggle("active", gridVisible);
    }
    requestRender();
  } catch {
    window.alert("Could not open scene file.");
  } finally {
    openSceneInput.value = "";
    fileMenu.classList.add("hidden");
  }
});

exportPngButton.addEventListener("click", () => {
  const exportData = createContentExportCanvas(strokeManager.elements);
  if (!exportData) {
    window.alert("No content to export.");
    return;
  }
  exportData.canvas.toBlob((blob) => {
    if (!blob) {
      return;
    }
    downloadBlob(blob, `infinite-canvas-${Date.now()}.png`);
  }, "image/png");
  fileMenu.classList.add("hidden");
});

copyPngButton.addEventListener("click", async () => {
  const exportData = createContentExportCanvas(strokeManager.elements);
  if (!exportData) {
    window.alert("No content to copy.");
    return;
  }
  try {
    const blob = await new Promise((resolve, reject) => {
      exportData.canvas.toBlob((result) => {
        if (result) {
          resolve(result);
          return;
        }
        reject(new Error("PNG encode failed"));
      }, "image/png");
    });
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  } catch {
    window.alert("Clipboard image copy is not available in this browser.");
  }
  fileMenu.classList.add("hidden");
});

exportSvgButton.addEventListener("click", () => {
  const svg = createContentSvg(strokeManager.elements);
  if (!svg) {
    window.alert("No content to export.");
    return;
  }
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, `infinite-canvas-${Date.now()}.svg`);
  fileMenu.classList.add("hidden");
});

window.addEventListener("keydown", (event) => {
  const target = event.target;
  const isTypingContext =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable;
  if (isTypingContext) {
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveSceneButton.click();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
    event.preventDefault();
    openSceneButton.click();
    return;
  }

  if (!event.ctrlKey && !event.metaKey) {
    const key = event.key.toLowerCase();
    const toolByKey = {
      v: "select",
      h: "hand",
      p: "freehand",
      l: "line",
      a: "arrow",
      r: "rectangle",
      c: "ellipse",
      t: "text",
      e: "eraser"
    };
    const mappedTool = toolByKey[key];
    if (mappedTool) {
      currentTool = mappedTool;
      if (currentTool !== "select") {
        strokeManager.clearSelection();
      }
      updateActiveToolUi();
      canvas.style.cursor = getCursorForTool(currentTool);
      requestRender();
      return;
    }
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
    event.preventDefault();
    if (strokeManager.undo()) {
      requestRender();
    }
    return;
  }

  if (
    (event.ctrlKey || event.metaKey) &&
    (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"))
  ) {
    event.preventDefault();
    if (strokeManager.redo()) {
      requestRender();
    }
    return;
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    strokeManager.removeSelected();
    requestRender();
  }
});

function updateActiveToolUi() {
  for (const button of toolButtons) {
    button.classList.toggle("active", button.dataset.tool === currentTool);
  }
}

function getCursorForTool(tool) {
  if (tool === "select") {
    return "default";
  }
  if (tool === "hand") {
    return "grab";
  }

  if (tool === "eraser") {
    return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='%231f2933' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M19 20h-10.5l-4.21-4.3a1 1 0 0 1 0-1.41l10-10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-9.2 9.3'/%3E%3Cpath d='M18 13.3l-6.3-6.3'/%3E%3C/g%3E%3C/svg%3E") 5 19, crosshair`;
  }
  if (tool === "text") {
    return "text";
  }

  return "crosshair";
}

function applyFillState() {
  currentStyle = {
    ...currentStyle,
    fill: fillEnabled.checked ? fillInput.value : null
  };
}

function getContentBounds(elements) {
  if (elements.length === 0) {
    return null;
  }

  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  for (const element of elements) {
    if (element.type === "text") {
      const bounds = getTextBounds(element, (value) => estimateTextWidthForFallback(value, element.fontSize));
      left = Math.min(left, bounds.left);
      top = Math.min(top, bounds.top);
      right = Math.max(right, bounds.right);
      bottom = Math.max(bottom, bounds.bottom);
      continue;
    }
    if (element.type === "freehand") {
      for (const point of element.points) {
        left = Math.min(left, point.x);
        top = Math.min(top, point.y);
        right = Math.max(right, point.x);
        bottom = Math.max(bottom, point.y);
      }
      continue;
    }

    left = Math.min(left, element.x1, element.x2);
    top = Math.min(top, element.y1, element.y2);
    right = Math.max(right, element.x1, element.x2);
    bottom = Math.max(bottom, element.y1, element.y2);
  }

  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) {
    return null;
  }

  return { left, top, right, bottom };
}

function createContentExportCanvas(elements) {
  const bounds = getContentBounds(elements);
  if (!bounds) {
    return null;
  }

  const padding = 32;
  const width = Math.max(1, Math.ceil(bounds.right - bounds.left + padding * 2));
  const height = Math.max(1, Math.ceil(bounds.bottom - bounds.top + padding * 2));
  const exportCanvas = document.createElement("canvas");
  const exportCtx = exportCanvas.getContext("2d");
  if (!exportCtx) {
    return null;
  }

  exportCanvas.width = width;
  exportCanvas.height = height;
  exportCtx.fillStyle = currentBackgroundColor;
  exportCtx.fillRect(0, 0, width, height);
  exportCtx.translate(padding - bounds.left, padding - bounds.top);

  for (const element of elements) {
    drawElementForExport(exportCtx, element);
  }

  return { canvas: exportCanvas, bounds };
}

function drawElementForExport(ctx2d, element) {
  if (element.type === "text") {
    const fontSize = element.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
    ctx2d.fillStyle = element.color;
    ctx2d.font = getTextFont(fontSize);
    ctx2d.textBaseline = "alphabetic";
    const metrics = getTextMetrics(element, (value) => ctx2d.measureText(value).width || estimateTextWidthForFallback(value, fontSize));
    const startY = getTextStartY(element, metrics);
    for (let i = 0; i < metrics.lines.length; i += 1) {
      ctx2d.fillText(metrics.lines[i], element.x, startY + i * metrics.lineHeight);
    }
    return;
  }
  if (element.type === "freehand") {
    if (element.points.length === 0) {
      return;
    }
    ctx2d.strokeStyle = element.color;
    ctx2d.lineWidth = element.width;
    ctx2d.lineCap = "round";
    ctx2d.lineJoin = "round";
    if (element.points.length === 1) {
      const point = element.points[0];
      ctx2d.beginPath();
      ctx2d.arc(point.x, point.y, element.width / 2, 0, Math.PI * 2);
      ctx2d.fillStyle = element.color;
      ctx2d.fill();
      return;
    }
    ctx2d.beginPath();
    ctx2d.moveTo(element.points[0].x, element.points[0].y);
    for (let i = 1; i < element.points.length; i += 1) {
      ctx2d.lineTo(element.points[i].x, element.points[i].y);
    }
    ctx2d.stroke();
    return;
  }

  const left = Math.min(element.x1, element.x2);
  const right = Math.max(element.x1, element.x2);
  const top = Math.min(element.y1, element.y2);
  const bottom = Math.max(element.y1, element.y2);

  ctx2d.strokeStyle = element.color;
  ctx2d.lineWidth = element.width;
  ctx2d.lineCap = "round";
  ctx2d.lineJoin = "round";

  if (element.type === "rectangle") {
    ctx2d.beginPath();
    ctx2d.rect(left, top, right - left, bottom - top);
    if (element.fill) {
      ctx2d.fillStyle = element.fill;
      ctx2d.fill();
    }
    ctx2d.stroke();
    return;
  }

  if (element.type === "ellipse") {
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    const rx = Math.max(1, (right - left) / 2);
    const ry = Math.max(1, (bottom - top) / 2);
    ctx2d.beginPath();
    ctx2d.ellipse(centerX, centerY, rx, ry, 0, 0, Math.PI * 2);
    if (element.fill) {
      ctx2d.fillStyle = element.fill;
      ctx2d.fill();
    }
    ctx2d.stroke();
    return;
  }

  ctx2d.beginPath();
  ctx2d.moveTo(element.x1, element.y1);
  ctx2d.lineTo(element.x2, element.y2);
  ctx2d.stroke();

  if (element.type === "arrow") {
    const angle = Math.atan2(element.y2 - element.y1, element.x2 - element.x1);
    const headLength = Math.max(10, element.width * 4);
    ctx2d.beginPath();
    ctx2d.moveTo(element.x2, element.y2);
    ctx2d.lineTo(
      element.x2 - headLength * Math.cos(angle - Math.PI / 8),
      element.y2 - headLength * Math.sin(angle - Math.PI / 8)
    );
    ctx2d.moveTo(element.x2, element.y2);
    ctx2d.lineTo(
      element.x2 - headLength * Math.cos(angle + Math.PI / 8),
      element.y2 - headLength * Math.sin(angle + Math.PI / 8)
    );
    ctx2d.stroke();
  }
}

function createContentSvg(elements) {
  const bounds = getContentBounds(elements);
  if (!bounds) {
    return null;
  }

  const padding = 32;
  const width = Math.max(1, Math.ceil(bounds.right - bounds.left + padding * 2));
  const height = Math.max(1, Math.ceil(bounds.bottom - bounds.top + padding * 2));
  const offsetX = padding - bounds.left;
  const offsetY = padding - bounds.top;
  const parts = [];

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  parts.push(`<rect width="${width}" height="${height}" fill="${escapeXml(currentBackgroundColor)}" />`);
  parts.push(`<g transform="translate(${offsetX} ${offsetY})">`);
  for (const element of elements) {
    parts.push(elementToSvg(element));
  }
  parts.push("</g></svg>");
  return parts.join("");
}

function elementToSvg(element) {
  if (element.type === "text") {
    const fontSize = element.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
    const metrics = getTextMetrics(element, (value) => estimateTextWidthForFallback(value, fontSize));
    const startY = getTextStartY(element, metrics);
    return metrics.lines
      .map(
        (line, index) =>
          `<text x="${element.x}" y="${startY + index * metrics.lineHeight}" fill="${escapeXml(element.color)}" font-size="${fontSize}" font-family="Inter, Segoe UI, Roboto, sans-serif">${escapeXml(line)}</text>`
      )
      .join("");
  }
  if (element.type === "freehand") {
    if (element.points.length === 0) {
      return "";
    }
    if (element.points.length === 1) {
      const p = element.points[0];
      return `<circle cx="${p.x}" cy="${p.y}" r="${element.width / 2}" fill="${escapeXml(element.color)}" />`;
    }
    const d = element.points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
    return `<path d="${d}" fill="none" stroke="${escapeXml(element.color)}" stroke-width="${element.width}" stroke-linecap="round" stroke-linejoin="round" />`;
  }

  const left = Math.min(element.x1, element.x2);
  const right = Math.max(element.x1, element.x2);
  const top = Math.min(element.y1, element.y2);
  const bottom = Math.max(element.y1, element.y2);
  const fill = element.fill ? escapeXml(element.fill) : "none";
  const stroke = escapeXml(element.color);

  if (element.type === "rectangle") {
    return `<rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" fill="${fill}" stroke="${stroke}" stroke-width="${element.width}" />`;
  }
  if (element.type === "ellipse") {
    return `<ellipse cx="${(left + right) / 2}" cy="${(top + bottom) / 2}" rx="${Math.max(1, (right - left) / 2)}" ry="${Math.max(1, (bottom - top) / 2)}" fill="${fill}" stroke="${stroke}" stroke-width="${element.width}" />`;
  }
  let out = `<line x1="${element.x1}" y1="${element.y1}" x2="${element.x2}" y2="${element.y2}" stroke="${stroke}" stroke-width="${element.width}" stroke-linecap="round" />`;
  if (element.type === "arrow") {
    const angle = Math.atan2(element.y2 - element.y1, element.x2 - element.x1);
    const headLength = Math.max(10, element.width * 4);
    const ax1 = element.x2 - headLength * Math.cos(angle - Math.PI / 8);
    const ay1 = element.y2 - headLength * Math.sin(angle - Math.PI / 8);
    const ax2 = element.x2 - headLength * Math.cos(angle + Math.PI / 8);
    const ay2 = element.y2 - headLength * Math.sin(angle + Math.PI / 8);
    out += `<line x1="${element.x2}" y1="${element.y2}" x2="${ax1}" y2="${ay1}" stroke="${stroke}" stroke-width="${element.width}" stroke-linecap="round" />`;
    out += `<line x1="${element.x2}" y1="${element.y2}" x2="${ax2}" y2="${ay2}" stroke="${stroke}" stroke-width="${element.width}" stroke-linecap="round" />`;
  }
  return out;
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openTextEditor(worldPoint) {
  const textElement = {
    id: Date.now() + Math.random(),
    type: "text",
    x: worldPoint.x,
    y: worldPoint.y,
    text: "",
    fontSize: DEFAULT_TEXT_FONT_SIZE,
    color: currentStyle.color,
    boxWidth: DEFAULT_TEXT_BOX_WIDTH,
    boxHeight: DEFAULT_TEXT_BOX_HEIGHT
  };
  strokeManager.elements.push(textElement);
  editingTextElementId = textElement.id;
  showTextEditorForElement(textElement, true);
}

function openTextEditorForElement(elementId) {
  const element = strokeManager.elements.find((item) => item.id === elementId && item.type === "text");
  if (!element) {
    return;
  }
  editingTextElementId = element.id;
  showTextEditorForElement(element, false);
}

function showTextEditorForElement(element, isNew) {
  const screen = camera.worldToScreen({ x: element.x, y: element.y });
  textEditor.classList.remove("hidden");
  textEditor.style.left = `${Math.round(screen.x)}px`;
  textEditor.style.top = `${Math.round(screen.y - (element.boxHeight ?? DEFAULT_TEXT_BOX_HEIGHT))}px`;
  textEditor.value = isNew ? "" : element.text || "";
  textEditor.style.width = `${Math.max(120, (element.boxWidth ?? DEFAULT_TEXT_BOX_WIDTH) * camera.scale)}px`;
  textEditor.style.height = `${Math.max(28, (element.boxHeight ?? DEFAULT_TEXT_BOX_HEIGHT) * camera.scale)}px`;
  textEditor.style.color = element.color || currentStyle.color;
  textEditor.style.fontSize = `${(element.fontSize ?? DEFAULT_TEXT_FONT_SIZE) * camera.scale}px`;
  textEditor.style.lineHeight = "1.25";
  window.setTimeout(() => {
    textEditor.focus();
    textEditor.selectionStart = textEditor.value.length;
    textEditor.selectionEnd = textEditor.value.length;
  }, 0);
}

textEditor.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    commitTextEditor();
  } else if (event.key === "Escape") {
    event.preventDefault();
    cancelTextEditor();
  }
});

textEditor.addEventListener("input", () => {
  textEditor.style.height = "0px";
  textEditor.style.height = `${Math.max(28, textEditor.scrollHeight + 2)}px`;
});

textEditor.addEventListener("blur", () => {
  if (editingTextElementId !== null) {
    commitTextEditor();
  }
});

function commitTextEditor() {
  if (editingTextElementId === null) {
    return;
  }
  const value = textEditor.value;
  const elementIndex = strokeManager.elements.findIndex((element) => element.id === editingTextElementId);
  if (elementIndex === -1) {
    closeTextEditor();
    return;
  }
  if (!value.trim()) {
    strokeManager.elements.splice(elementIndex, 1);
    closeTextEditor();
    requestRender();
    return;
  }
  strokeManager.elements[elementIndex].text = value;
  strokeManager.elements[elementIndex].boxWidth = Math.max(24, textEditor.clientWidth / Math.max(0.1, camera.scale));
  strokeManager.elements[elementIndex].boxHeight = Math.max(24, textEditor.clientHeight / Math.max(0.1, camera.scale));
  strokeManager.pushHistory();
  closeTextEditor();
  requestRender();
}

function cancelTextEditor() {
  if (editingTextElementId === null) {
    return;
  }
  const index = strokeManager.elements.findIndex((element) => element.id === editingTextElementId);
  if (index >= 0 && !strokeManager.elements[index].text) {
    strokeManager.elements.splice(index, 1);
  }
  closeTextEditor();
  requestRender();
}

function closeTextEditor() {
  editingTextElementId = null;
  textEditor.classList.add("hidden");
  textEditor.value = "";
}

function updateColorUi() {
  foregroundChip.style.background = foregroundInput.value;
  backgroundChip.style.background = backgroundInput.value;
  fillChip.style.background = fillInput.value;
  fillChip.style.opacity = fillEnabled.checked ? "1" : "0.35";
  foregroundCircle.style.background = foregroundInput.value;
  backgroundCircle.style.background = backgroundInput.value;
  fillCircle.style.background = fillInput.value;
}

function openMenuNearAnchor(menuElement, anchorElement) {
  const menus = [fileMenu, colorMenu];
  for (const menu of menus) {
    if (menu !== menuElement) {
      menu.classList.add("hidden");
    }
  }

  menuElement.classList.remove("hidden");
  const anchorRect = anchorElement.getBoundingClientRect();
  const menuRect = menuElement.getBoundingClientRect();
  const gap = 8;

  let left = anchorRect.left;
  let top = anchorRect.bottom + gap;

  if (left + menuRect.width > window.innerWidth - gap) {
    left = window.innerWidth - menuRect.width - gap;
  }
  if (left < gap) {
    left = gap;
  }

  if (top + menuRect.height > window.innerHeight - gap) {
    top = anchorRect.top - menuRect.height - gap;
  }
  if (top < gap) {
    top = gap;
  }

  menuElement.style.left = `${Math.round(left)}px`;
  menuElement.style.top = `${Math.round(top)}px`;
}

function estimateTextWidthForFallback(value, fontSize) {
  const size = fontSize ?? DEFAULT_TEXT_FONT_SIZE;
  return Math.max(1, String(value).length * (size * 0.62));
}

updateActiveToolUi();
window.addEventListener("resize", resizeCanvas);
resizeCanvas();
