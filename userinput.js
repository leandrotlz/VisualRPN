export class UserInput {
    constructor(canvas, callbacks) {
        this.canvas = canvas;

        this.pan = { x: 0, y: 0, active: false }
        this.pinch = { x: 0, y: 0, initialDistance: 0, initialZoom: 0 }
        this.drag = { x: 0, y: 0, node: null, wire: null }
        this.wire = { drag: false };

        this.getViewport = callbacks.getViewport || (() => ({ panOffset: { x: 0, y: 0 }, zoomLevel: 1 }));
        this.getNodeAtPoint = callbacks.getNodeAtPoint || (() => null);
        this.getPinAtPoint = callbacks.getPinAtPoint || (() => null);

        this.onPan = callbacks.onPan || (() => {});
        this.onZoom = callbacks.onZoom || (() => {});
        this.onActiveWire = callbacks.onActiveWire || (() => {});
        this.onNodeSelected = callbacks.onNodeSelected || (() => {});
        this.onNodeMove = callbacks.onNodeMove || (() => {});

        this.addListeners();
    }

    setPanningState(isPanning, x, y) {
        this.pan.active = isPanning;
        if (!isPanning) return;

        this.pan.x = x;
        this.pan.y = y;
    }

    getCanvasPoint(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    getWorldPoint(x, y) {
        const { panOffset, zoomLevel } = this.getViewport();
        return {
            x: (x - panOffset.x) / zoomLevel,
            y: (y - panOffset.y) / zoomLevel
        };
    }

    selectNodeAtPoint(x, y) {
        const pos = this.getWorldPoint(x, y);
        const node = this.getNodeAtPoint(pos.x, pos.y);
        if (node) {
            this.onNodeSelected(node);
            this.drag.node = node;
            this.drag.x = pos.x - node.x;
            this.drag.y = pos.y - node.y;
            return true;
        }
        this.onNodeSelected(null);
        this.drag.node = null;
        return false;
    }

    interactStart(x, y) {
        const { panOffset } = this.getViewport();
        const pos = this.getWorldPoint(x, y);
        const wire = this.getPinAtPoint(pos.x, pos.y);

        if (wire) {
            wire.drag = true;
            if (wire.type === "in") {
                wire.from = { x: pos.x, y: pos.y };
            } else {
                wire.to = { x: pos.x, y: pos.y };
            }
            this.wire = wire;
            // We don't call onActiveWire here because we want to confirm it's a drag.
        }
        else if (!this.selectNodeAtPoint(x, y))
        {
            this.setPanningState(true, x - panOffset.x, y - panOffset.y);
        }
    }

    interactMove(x, y, shiftKey) {
        if (this.wire.drag) {
            if (this.wire.type === "in") {
                this.wire.from = this.getWorldPoint(x, y);
            } else {
                this.wire.to = this.getWorldPoint(x, y);
            }
            this.onActiveWire(this.wire);
        } else if (this.drag.node) {
            const pos = this.getWorldPoint(x, y);
            this.onNodeMove(this.drag.node, pos.x - this.drag.x, pos.y - this.drag.y, shiftKey);
        } else if (this.pan.active) {
            this.onPan(x - this.pan.x, y - this.pan.y);
        }
    }

    interactStop(x, y) {
        this.setPanningState(false);
        this.drag.node = null;

        if (this.wire.drag) {
            // Currently dragging a wire, trigger a wire drop.
            this.wire.drag = false;
            this.onActiveWire(this.wire);
        }
    }

    addListeners() {
        this.canvas.addEventListener('mousedown', (e) => {
            const { panOffset } = this.getViewport();
            const pos = this.getCanvasPoint(e.clientX, e.clientY);

            if (e.button === 0)
            {
                this.interactStart(pos.x, pos.y);
            }
            else if (e.button === 1) {
                // Middle button always pans and doesn't change node selection.
                this.setPanningState(true, pos.x - panOffset.x, pos.y - panOffset.y);
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const pos = this.getCanvasPoint(e.clientX, e.clientY);
            this.interactMove(pos.x, pos.y, e.shiftKey);
        });

        window.addEventListener('mouseup', (e) => {
            this.interactStop();
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const pos = this.getCanvasPoint(e.clientX, e.clientY);
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.onZoom(delta, pos.x, pos.y, true);
        });

        this.canvas.addEventListener('touchstart', (e) => {
            const { panOffset, zoomLevel } = this.getViewport();

            if (e.touches.length === 1) {
                const pos = this.getCanvasPoint(e.touches[0].clientX, e.touches[0].clientY);
                this.interactStart(pos.x, pos.y);
            } else if (e.touches.length === 2) {
                this.setPanningState(false);
                // Store the midpoint between the two touches to zoom around it.
                const t0 = this.getCanvasPoint(e.touches[0].clientX, e.touches[0].clientY);
                const t1 = this.getCanvasPoint(e.touches[1].clientX, e.touches[1].clientY);
                this.pinch.x = (t0.x + t1.x) / 2;
                this.pinch.y = (t0.y + t1.y) / 2;
                this.pinch.initialDistance = Math.hypot(t0.x - t1.x, t0.y - t1.y);
                this.pinch.initialZoom = zoomLevel;
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) =>{
            e.preventDefault();
            if (e.touches.length === 1) {
                const pos = this.getCanvasPoint(e.touches[0].clientX, e.touches[0].clientY);
                this.interactMove(pos.x, pos.y, e.shiftKey);
            } else if (e.touches.length === 2 && this.pinch.initialDistance > 0) {
                const t0 = this.getCanvasPoint(e.touches[0].clientX, e.touches[0].clientY);
                const t1 = this.getCanvasPoint(e.touches[1].clientX, e.touches[1].clientY);
                const distance = Math.hypot(t0.x - t1.x, t0.y - t1.y);
                const zoom = this.pinch.initialZoom * (distance / this.pinch.initialDistance);
                this.onZoom(zoom, this.pinch.x, this.pinch.y, false);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            this.interactStop();
        }, { passive: false });

        this.canvas.addEventListener('touchcancel', (e) => {
            this.interactStop();
        }, { passive: false });
    }
}
