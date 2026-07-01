const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const computedStyles = window.getComputedStyle(document.documentElement);
const bgColor = computedStyles.getPropertyValue('--bg-color').trim();
const gridColor = computedStyles.getPropertyValue('--grid-color').trim();

let isPanning = false;
let panStart = { x: 0, y: 0 };
let panOffset = { x: 0, y: 0 };

let zoomLevel = 1.0;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;

function drawCanvas() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoomLevel, zoomLevel);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1 + zoomLevel - MIN_ZOOM;

    const gridSize = 40;
    const visibleWidth = canvas.width / zoomLevel;
    const visibleHeight = canvas.height / zoomLevel;
    const offsetX = -panOffset.x / zoomLevel;
    const offsetY = -panOffset.y / zoomLevel;

    const startX = Math.floor(offsetX / gridSize) * gridSize;
    const endX = offsetX + visibleWidth;

    const startY = Math.floor(offsetY / gridSize) * gridSize;
    const endY = offsetY + visibleHeight;

    for (let x = startX; x <= endX + gridSize; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY + gridSize);
        ctx.stroke();
    }

    for (let y = startY; y <= endY + gridSize; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX + gridSize, y);
        ctx.stroke();
    }
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawCanvas();
}
window.addEventListener('resize', resizeCanvas);

canvas.addEventListener('mousedown', (e) => {
    // Left or middle mouse button can be used for panning.
    // Left mouse button will only pan if starting the drag on the background canvas,
    // middle mouse button will pan even if dragging over a node or connection.
    if (e.button === 0 || e.button === 1) {
        isPanning = true;
        panStart.x = e.clientX - panOffset.x;
        panStart.y = e.clientY - panOffset.y;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    panOffset.x = e.clientX - panStart.x;
    panOffset.y = e.clientY - panStart.y;
    drawCanvas();
});

window.addEventListener('mouseup', () => {
    isPanning = false;
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const oldZoom = zoomLevel;
    zoomLevel = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomLevel + delta));
    
    const zoomFactor = zoomLevel / oldZoom;
    panOffset.x = mouseX - (mouseX - panOffset.x) * zoomFactor;
    panOffset.y = mouseY - (mouseY - panOffset.y) * zoomFactor;
    
    drawCanvas();
});

resizeCanvas();
