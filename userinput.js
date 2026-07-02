export class UserInput {
    constructor(canvas, callbacks) {
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };

        this.canvas = canvas;

        this.getViewport = callbacks.getViewport || (() => ({ panOffset: { x: 0, y: 0 }, zoomLevel: 1 }));
        this.onPan = callbacks.onPan || (() => {});
        this.onZoom = callbacks.onZoom || (() => {});

        this.addListeners();
    }

    addListeners() {
        this.canvas.addEventListener('mousedown', (e) => {
            const { panOffset } = this.getViewport();

            // Left or middle mouse button can be used for panning.
            // Left mouse button will only pan if starting the drag on the background canvas,
            // middle mouse button will pan even if dragging over a node or connection.
            if (e.button === 0 || e.button === 1) {
                this.isPanning = true;
                this.panStart.x = e.clientX - panOffset.x;
                this.panStart.y = e.clientY - panOffset.y;
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                this.onPan(e.clientX - this.panStart.x, e.clientY - this.panStart.y);
            }
        });

        window.addEventListener('mouseup', (e) => {
            this.isPanning = false;
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.onZoom(delta, e.clientX, e.clientY, true);
        });

        this.canvas.addEventListener('touchstart', (e) => {
            const { panOffset } = this.getViewport();

            // Assume one touch for now, figure out pinch-to-zoom later.
            const touch = e.touches[0];
            this.isPanning = true;
            this.panStart.x = touch.clientX - panOffset.x;
            this.panStart.y = touch.clientY - panOffset.y;
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) =>{
            if (this.isPanning) {
                e.preventDefault();
                const touch = e.touches[0];
                this.onPan(touch.clientX - this.panStart.x, touch.clientY - this.panStart.y);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            this.isPanning = false;
        }, { passive: false });

        this.canvas.addEventListener('touchcancel', (e) => {
            this.isPanning = false;
        }, { passive: false });
    }
}
