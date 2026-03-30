export class InputHandler {
  constructor(canvas, camera, strokeManager, requestRender, options) {
    this.canvas = canvas;
    this.camera = camera;
    this.strokeManager = strokeManager;
    this.requestRender = requestRender;
    this.getTool = options.getTool;
    this.getStyle = options.getStyle;
    this.getCursorForTool = options.getCursorForTool;
    this.openTextEditor = options.openTextEditor;
    this.openTextEditorForElement = options.openTextEditorForElement;
    this.isTextEditing = options.isTextEditing;
    this.isSpacePressed = false;
    this.mode = "idle";
    this.pointerIsDown = false;
    this.lastPointerScreen = null;
    this.lastPointerWorld = null;
    this.movedWhileDown = false;
    this.erasedDuringGesture = false;
    this.selectionAnchor = null;

    this.bindEvents();
  }

  bindEvents() {
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  onPointerDown = (event) => {
    this.pointerIsDown = true;
    this.movedWhileDown = false;
    this.erasedDuringGesture = false;
    this.lastPointerScreen = pointFromEvent(event);
    this.lastPointerWorld = this.camera.screenToWorld(this.lastPointerScreen);
    this.canvas.setPointerCapture(event.pointerId);

    if (event.shiftKey || this.isSpacePressed) {
      this.mode = "pan";
      this.canvas.style.cursor = "grabbing";
      return;
    }

    const tool = this.getTool();
    if (tool === "hand") {
      this.mode = "pan";
      this.canvas.style.cursor = "grabbing";
      return;
    }
    if (tool === "select") {
      const hitElement = this.strokeManager.getElementAt(this.lastPointerWorld);
      if (hitElement?.type === "text" && event.detail >= 2) {
        this.strokeManager.selectedElementIds = [hitElement.id];
        this.openTextEditorForElement(hitElement.id);
        this.mode = "idle";
        this.requestRender();
        return;
      }
      if (this.strokeManager.isPointInSelection(this.lastPointerWorld)) {
        this.mode = "move";
        this.canvas.style.cursor = "move";
        this.requestRender();
        return;
      }
      const hit = this.strokeManager.selectAt(this.lastPointerWorld);
      if (hit) {
        this.mode = "move";
        this.canvas.style.cursor = "move";
      } else {
        this.mode = "marquee";
        this.strokeManager.clearSelection();
        this.selectionAnchor = this.lastPointerWorld;
        this.strokeManager.selectionRect = {
          x1: this.lastPointerWorld.x,
          y1: this.lastPointerWorld.y,
          x2: this.lastPointerWorld.x,
          y2: this.lastPointerWorld.y
        };
      }
      this.requestRender();
      return;
    }

    if (tool === "text") {
      if (this.isTextEditing?.()) {
        this.mode = "idle";
        return;
      }
      const hitElement = this.strokeManager.getElementAt(this.lastPointerWorld);
      if (hitElement?.type === "text") {
        this.strokeManager.selectedElementIds = [hitElement.id];
        this.openTextEditorForElement(hitElement.id);
        this.mode = "idle";
        this.requestRender();
        return;
      }
      this.openTextEditor(this.lastPointerWorld);
      this.mode = "idle";
      return;
    }

    if (tool === "eraser") {
      this.mode = "erase";
      this.canvas.style.cursor = this.getCursorForTool("eraser");
      this.erasedDuringGesture = this.strokeManager.eraseTopAt(this.lastPointerWorld);
      this.requestRender();
      return;
    }

    this.mode = "draw";
    this.strokeManager.beginElement(tool, this.lastPointerWorld, this.getStyle());
    this.requestRender();
  };

  onPointerMove = (event) => {
    if (!this.pointerIsDown) {
      return;
    }

    const current = pointFromEvent(event);
    const previous = this.lastPointerScreen ?? current;
    const currentWorld = this.camera.screenToWorld(current);
    const previousWorld = this.lastPointerWorld ?? currentWorld;
    this.movedWhileDown = this.movedWhileDown || Math.hypot(current.x - previous.x, current.y - previous.y) > 0.4;

    if (event.shiftKey || this.isSpacePressed || this.mode === "pan") {
      this.mode = "pan";
      this.canvas.style.cursor = "grabbing";
      this.camera.panBy(current.x - previous.x, current.y - previous.y);
      this.requestRender();
      this.lastPointerScreen = current;
      return;
    }

    if (this.mode === "marquee") {
      this.strokeManager.selectionRect = {
        x1: this.selectionAnchor?.x ?? currentWorld.x,
        y1: this.selectionAnchor?.y ?? currentWorld.y,
        x2: currentWorld.x,
        y2: currentWorld.y
      };
      this.requestRender();
    } else if (this.mode === "move") {
      this.strokeManager.moveSelectedBy(currentWorld.x - previousWorld.x, currentWorld.y - previousWorld.y);
      this.canvas.style.cursor = "move";
      this.requestRender();
    } else if (this.mode === "erase") {
      const erased = this.strokeManager.eraseTopAt(currentWorld);
      this.erasedDuringGesture = this.erasedDuringGesture || erased;
      if (erased) {
        this.requestRender();
      }
    } else if (this.mode === "draw") {
      this.strokeManager.updateActiveElement(currentWorld);
      this.requestRender();
    }

    this.lastPointerScreen = current;
    this.lastPointerWorld = currentWorld;
  };

  onPointerUp = (event) => {
    if (!this.pointerIsDown) {
      return;
    }

    this.pointerIsDown = false;
    this.lastPointerScreen = pointFromEvent(event);
    this.lastPointerWorld = this.camera.screenToWorld(this.lastPointerScreen);

    if (this.mode === "draw") {
      this.strokeManager.endElement();
    } else if (this.mode === "erase") {
      if (this.erasedDuringGesture) {
        this.strokeManager.pushHistory();
      }
    } else if (this.mode === "move") {
      if (this.movedWhileDown) {
        this.strokeManager.commitMove();
      } else {
        this.strokeManager.selectAt(this.lastPointerWorld);
      }
    } else if (this.mode === "marquee") {
      if (this.strokeManager.selectionRect) {
        this.strokeManager.selectInRect(this.strokeManager.selectionRect);
      }
      this.strokeManager.selectionRect = null;
      this.selectionAnchor = null;
    }

    this.mode = "idle";
    this.canvas.style.cursor = this.getCursorForTool(this.getTool());
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.requestRender();
  };

  onWheel = (event) => {
    event.preventDefault();
    const point = pointFromEvent(event);
    this.camera.zoomAt(point, event.deltaY);
    this.requestRender();
  };

  onKeyDown = (event) => {
    if (event.key === " ") {
      this.isSpacePressed = true;
      if (!this.pointerIsDown) {
        this.canvas.style.cursor = "grab";
      }
      return;
    }

    if (event.key !== "Shift") {
      return;
    }

    if (!this.pointerIsDown) {
      this.canvas.style.cursor = "grab";
      return;
    }

    if (this.mode === "draw") {
      this.strokeManager.endElement();
      this.mode = "pan";
      this.canvas.style.cursor = "grabbing";
      return;
    }
  };

  onKeyUp = (event) => {
    if (event.key === " ") {
      this.isSpacePressed = false;
      if (!this.pointerIsDown) {
        this.canvas.style.cursor = this.getCursorForTool(this.getTool());
      }
      return;
    }

    if (event.key !== "Shift") {
      return;
    }

    if (!this.pointerIsDown) {
      this.canvas.style.cursor = this.isSpacePressed ? "grab" : this.getCursorForTool(this.getTool());
      return;
    }

    if (this.mode === "pan" && !this.isSpacePressed) {
      if (this.getTool() === "hand") {
        this.canvas.style.cursor = "grabbing";
        return;
      }
      this.mode = "idle";
      this.canvas.style.cursor = this.getCursorForTool(this.getTool());
      this.requestRender();
    }
  };
}

function pointFromEvent(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
