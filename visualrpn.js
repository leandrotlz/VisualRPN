import { drawGrid, gridSize } from './canvasgrid.js';
import { VisualNode } from './visualnode.js';
import { UserInput } from './userinput.js';

const computedStyles = window.getComputedStyle(document.documentElement);
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let panOffset = { x: 0, y: 0 };

let zoomLevel = 1.0;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;

let nodeList = [];
let connections = [];
let selectedNode = null;

function drawCanvas() {
    drawGrid(canvas, ctx, panOffset, zoomLevel);
    drawConnections();
    nodeList.forEach(node => node.draw(ctx, selectedNode));
}

function drawConnections() {
    ctx.lineWidth = 2;
    ctx.strokeStyle = computedStyles.getPropertyValue('--node-body-color').trim();
    connections.forEach(c => {
        const fromPoint = c.from.node.getPinPosition(c.from.pin, true);
        const toPoint = c.to.node.getPinPosition(c.to.pin, false);
        // TODO: figure out Bezier curves.
        ctx.beginPath();
        ctx.moveTo(fromPoint.x, fromPoint.y);
        ctx.lineTo(toPoint.x, toPoint.y);
        ctx.stroke();
    });
}

function resetNodes() {
    const nodeWidth = 3;
    const nodeHeight = 2;

    const canvasGridWidth = Math.floor(window.innerWidth / gridSize);
    const targetGridX = canvasGridWidth - 1 - nodeWidth;

    const canvasGridHeight = Math.floor(window.innerHeight / gridSize);
    const targetGridY = Math.floor((canvasGridHeight - nodeHeight) / 2);

    nodeList = [];
    nodeList.push(new VisualNode("constant", ["2"], targetGridX - 10, targetGridY - 1.5, nodeWidth, nodeHeight, [], [2]));
    nodeList.push(new VisualNode("constant", ["5"], targetGridX - 10, targetGridY + 1.5, nodeWidth, nodeHeight, [], [5]));
    nodeList.push(new VisualNode("operator", ["Add", "+"], targetGridX - 5, targetGridY, nodeWidth, nodeHeight, [2, 5], [7]));
    nodeList.push(new VisualNode("output", ["Output"], targetGridX, targetGridY, nodeWidth, nodeHeight, [7], []));

    connections = [];
    connections.push( { from: { node: nodeList[0], pin: 0 }, to: { node: nodeList[2], pin: 0 } } )
    connections.push( { from: { node: nodeList[1], pin: 0 }, to: { node: nodeList[2], pin: 1 } } )
    connections.push( { from: { node: nodeList[2], pin: 0 }, to: { node: nodeList[3], pin: 0 } } )
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

    getNodeAtPoint: (x, y) => {
        for (let i = 0; i < nodeList.length; i++)
        {
            if (nodeList[i].hasPoint(x, y)) {
                return nodeList[i];
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
            nodeList = nodeList.filter(n => n !== node);
            nodeList.push(node);
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
