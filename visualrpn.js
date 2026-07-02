import { drawGrid, gridSize } from './canvasgrid.js';
import { VisualNode } from './visualnode.js';
import { UserInput } from './userinput.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

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

new UserInput(canvas, {
    getViewport: () => ({ panOffset, zoomLevel }),

    onPan: (x, y) => {
        panOffset.x = x;
        panOffset.y = y;
        drawCanvas();
    },

    onZoom: (zoom, x, y, isDelta) => {
        const oldZoom = zoomLevel;

        zoomLevel = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, isDelta ? zoomLevel + zoom : zoom));

        const zoomFactor = zoomLevel / oldZoom;
        panOffset.x = x - (y - panOffset.x) * zoomFactor;
        panOffset.y = x - (y - panOffset.y) * zoomFactor;
        drawCanvas();
    }
});

resizeCanvas();
