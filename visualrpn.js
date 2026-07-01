import { drawGrid, gridSize } from './canvasgrid.js';
import { VisualNode } from './visualnode.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let isPanning = false;
let panStart = { x: 0, y: 0 };
let panOffset = { x: 0, y: 0 };

let zoomLevel = 1.0;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;

let nodeList = [];

function drawCanvas() {
    drawGrid(canvas, ctx, panOffset, zoomLevel);
    nodeList.forEach(node => node.draw(ctx));
}

function resetNodes() {
    const nodeWidth = 3;
    const nodeHeight = 2;

    const canvasGridWidth = Math.floor(window.innerWidth / gridSize);
    const targetGridX = canvasGridWidth - 1 - nodeWidth;

    const canvasGridHeight = Math.floor(window.innerHeight / gridSize);
    const targetGridY = Math.floor((canvasGridHeight - nodeHeight) / 2);

    nodeList = [];
    nodeList.push(new VisualNode("output", "Output", targetGridX, targetGridY, nodeWidth, nodeHeight, 1, 0));
    nodeList.push(new VisualNode("operator", "Operator", targetGridX - 4, targetGridY, nodeWidth, nodeHeight, 2, 1));
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    resetNodes();
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
