import { drawGrid, gridSize } from './canvasgrid.js';
import { UserInput } from './userinput.js';

import { NodeGraph } from './nodegraph.js';
import { VisualNode } from './visualnode.js';

const computedStyles = window.getComputedStyle(document.documentElement);
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let panOffset = { x: 0, y: 0 };

let zoomLevel = 1.0;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;

let graph = new NodeGraph("2 5 + 3 * 10 >= ! null null + 2 3 + null + + 9 > ||");
let selectedNode = null;

function drawCanvas() {
    drawGrid(canvas, ctx, panOffset, zoomLevel);
    drawConnections();
    graph.nodes.forEach(node => node.draw(ctx, selectedNode));
    // DEBUG: Log the RPN after every change.
    console.log(graph.toString());
}

function drawConnections() {
    ctx.lineWidth = 2;
    ctx.strokeStyle = computedStyles.getPropertyValue('--node-body-color').trim();
    graph.connections.forEach(c => {
        const fromPoint = c.from.node.getPinPosition(c.from.pin, true);
        const toPoint = c.to.node.getPinPosition(c.to.pin, false);
        ctx.beginPath();
        ctx.moveTo(fromPoint.x, fromPoint.y);
        ctx.bezierCurveTo(fromPoint.x + gridSize, fromPoint.y, toPoint.x - gridSize, toPoint.y, toPoint.x, toPoint.y);
        ctx.stroke();
    });
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    drawCanvas();
}
window.addEventListener('resize', resizeCanvas);

new UserInput(canvas, {
    getViewport: () => ({ panOffset, zoomLevel }),

    getNodeAtPoint: (x, y) => {
        for (let i = graph.nodes.length - 1; i >= 0; i--)
        {
            if (graph.nodes[i].hasPoint(x, y)) {
                return graph.nodes[i];
            }
        }
        return null;
    },

    onPan: (x, y) => {
        panOffset.x = x;
        panOffset.y = y;
        drawCanvas();
    },

    onZoom: (zoom, x, y, isDelta) => {
        const oldZoom = zoomLevel;

        zoomLevel = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, isDelta ? zoomLevel + zoom : zoom));

        const zoomFactor = zoomLevel / oldZoom;
        panOffset.x = x - (x - panOffset.x) * zoomFactor;
        panOffset.y = y - (y - panOffset.y) * zoomFactor;
        drawCanvas();
    },

    onNodeSelected: (node) => {
        selectedNode = node;
        if (node) {
            // Move the node to the end of the array so it renders on top of all others.
            graph.nodes = graph.nodes.filter(n => n !== node);
            graph.nodes.push(node);
        }
        drawCanvas();
    },

    onNodeMove: (node, x, y, snap) => {
        if (snap)
        {
            node.x = Math.round(x / gridSize) * gridSize;
            node.y = Math.round(y / gridSize) * gridSize;
            drawCanvas();
        } else {
            node.x = x;
            node.y = y;
        }
        drawCanvas();
    }
});

resizeCanvas();
