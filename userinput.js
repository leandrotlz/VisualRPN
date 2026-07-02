export class UserInput {
    constructor(canvas, callbacks) {
        this.canvas = canvas;

        this.pan = { x: 0, y: 0, active: false }
        this.pinch = { x: 0, y: 0, initialDistance: 0, initialZoom: 0 }

        this.getViewport = callbacks.getViewport || (() => ({ panOffset: { x: 0, y: 0 }, zoomLevel: 1 }));
        this.getNodeAtPoint = callbacks.getNodeAtPoint || (() => null);

        this.onPan = callbacks.onPan || (() => {});
        this.onZoom = callbacks.onZoom || (() => {});
        this.onNodeSelected = callbacks.onNodeSelected || (() => {});

        this.addListeners();
    }

    setPanningState(isPanning, x, y) {
        this.pan.active = isPanning;
        if (!isPanning) return;

        this.pan.x = x;
        this.pan.y = y;
    }

    addListeners() {
        this.canvas.addEventListener('mousedown', (e) => {
            const { panOffset, zoomLevel } = this.getViewport();

            if (e.button === 0)
            {
                const node = this.getNodeAtPoint((e.clientX - panOffset.x) / zoomLevel, (e.clientY - panOffset.y) / zoomLevel);
                if (node) {
                    this.onNodeSelected(node);
                } else {
                    this.onNodeSelected(null);
                    this.setPanningState(true, e.clientX - panOffset.x, e.clientY - panOffset.y);
                }
            }
            else if (e.button === 1) {
                // Middle button always pans and doesn't change node selection.
                this.setPanningState(true, e.clientX - panOffset.x, e.clientY - panOffset.y);
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.pan.active) {
                this.onPan(e.clientX - this.pan.x, e.clientY - this.pan.y);
            }
        });

        window.addEventListener('mouseup', (e) => {
            this.setPanningState(false);
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.onZoom(delta, e.clientX, e.clientY, true);
        });

        this.canvas.addEventListener('touchstart', (e) => {
            const { panOffset, zoomLevel } = this.getViewport();

            if (e.touches.length === 1) {
                const touch = e.touches[0];
                this.setPanningState(true, touch.clientX - panOffset.x, touch.clientY - panOffset.y);
            } else if (e.touches.length === 2) {
                this.setPanningState(false);
                // Store the midpoint between the two touches to zoom around it.
                this.pinch.x = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                this.pinch.y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                this.pinch.initialDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                this.pinch.initialZoom = zoomLevel;
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) =>{
            if (e.touches.length === 1 && this.pan.active) {
                e.preventDefault();
                const touch = e.touches[0];
                this.onPan(touch.clientX - this.pan.x, touch.clientY - this.pan.y);
            } else if (e.touches.length === 2 && this.pinch.initialDistance > 0) {
                const distance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                const zoom = this.pinch.initialZoom * (distance / this.pinch.initialDistance);
                this.onZoom(zoom, this.pinch.x, this.pinch.y, false);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            this.setPanningState(false);
        }, { passive: false });

        this.canvas.addEventListener('touchcancel', (e) => {
            this.setPanningState(false);
        }, { passive: false });
    }
}
