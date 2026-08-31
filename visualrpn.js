import { drawGrid, gridSize } from './canvasgrid.js';
import { UserInput } from './userinput.js';

import { NodeGraph, OPERATORS } from './nodegraph.js';
import { VisualNode } from './visualnode.js';

const computedStyles = window.getComputedStyle(document.documentElement);
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let panOffset = { x: 0, y: 0 };

let zoomLevel = 1.0;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;

// Header buttons.
const buttonMenu = document.getElementById('button-menu');
const buttonAddNode = document.getElementById('button-add-node');
const buttonDeleteNode = document.getElementById('button-delete-node');

// Sidebar elements.
const sidebar = document.getElementById('sidebar');
const sidebarRpnView = document.getElementById('sidebar-rpn-view');
const sidebarNodeView = document.getElementById('sidebar-node-view');
const rpnTextbox = document.getElementById('rpn-textbox');
const buttonCopyRpn = document.getElementById('button-copy-rpn');
const buttonParseRpn = document.getElementById('button-parse-rpn');

// Node editor elements.
const nodeValueInput = document.getElementById('node-value-input');
const nodeTypeDisplay = document.getElementById('node-type-display');
const buttonCancelEdit = document.getElementById('button-cancel-edit');
const buttonSaveEdit = document.getElementById('button-save-edit');

// Delete Node modal elements.
const confirmDeleteDialog = document.getElementById('confirm-delete-dialog');
const buttonConfirmDelete = document.getElementById('button-confirm-delete');
const buttonCancelDelete = document.getElementById('button-cancel-delete');

// LocalStorage keys.
const LS_SIDEBAR_STATE = 'visualrpn-sidebar-state';
const LS_RPN_CONTENTS = 'visualrpn-rpn-contents';

// Initialize app state from LocalStorage.
let sidebarOpen = localStorage.getItem(LS_SIDEBAR_STATE) !== 'false';
sidebar.classList.toggle('open', sidebarOpen);
let graph = new NodeGraph(localStorage.getItem(LS_RPN_CONTENTS) || rpnTextbox.placeholder);
let selectedNode = null;
let activeWire = null;  // Holds the pin where a user started a drag, and the current coordinates it's being dragged to.

// Initialize the textbox with current RPN and keep track of it to detect changes.
let lastGraphRpn = graph.toString();
rpnTextbox.value = lastGraphRpn;

function drawCanvas() {
    if (activeWire && !activeWire.drag) {
        // A dragged wire was just dropped, resolve it before drawing anything.
        graph.connectWire(activeWire);
        activeWire = null;
    }

    drawGrid(canvas, ctx, panOffset, zoomLevel);
    drawConnections();
    graph.nodes.forEach(node => node.draw(ctx, selectedNode));
    drawActiveWire();
    updateSidebar();
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

function drawActiveWire() {
    if (!activeWire) return;

    ctx.lineWidth = 2;
    ctx.strokeStyle = computedStyles.getPropertyValue(`--pin-${activeWire.type}-color`).trim();
    ctx.beginPath();
    ctx.moveTo(activeWire.from.x, activeWire.from.y);
    ctx.bezierCurveTo(activeWire.from.x + gridSize, activeWire.from.y, activeWire.to.x - gridSize, activeWire.to.y, activeWire.to.x, activeWire.to.y);
    ctx.stroke();
}

function updateSidebar() {
    sidebarNodeView.hidden = (selectedNode == null);

    // Enable the Delete button only if a node is selected and it's NOT the output node.
    buttonDeleteNode.disabled = (selectedNode == null) || (selectedNode.type === "output");

    // If this was an update triggered by anything other than the player editing
    // the RPN manually, update the textbox and LocalStorage.
    if (document.activeElement !== rpnTextbox) {
        lastGraphRpn = graph.toString();
        localStorage.setItem(LS_RPN_CONTENTS, lastGraphRpn);
        rpnTextbox.value = lastGraphRpn;
    }

    updateParseButton();
    updateNodeEditor();
}

function getNodeType(nodeValue, nodeType) {
    if (nodeType === "output") return "Output";
    if (nodeValue in OPERATORS) return "Operator";
    // TODO: optional libraries will use the type "Function".
    return "Constant";
}

function updateNodeType(nodeValue) {
    const nodeType = getNodeType(nodeValue, selectedNode.type);

    if (nodeType == "Operator" && OPERATORS[nodeValue].name)
        nodeTypeDisplay.textContent = `${nodeType} (${OPERATORS[nodeValue].name})`;
    else
        nodeTypeDisplay.textContent = nodeType;

    nodeTypeDisplay.classList.remove("type-operator", "type-constant", "type-function", "type-output");
    nodeTypeDisplay.classList.add(`type-${nodeType.toLowerCase()}`);

    buttonSaveEdit.disabled = (selectedNode.type === "output") || (nodeValue === "");
}

function updateNodeEditor() {
    if (!selectedNode) return;

    const nodeValue = selectedNode.title[0];
    nodeValueInput.value = nodeValue;
    nodeValueInput.disabled = (selectedNode.type === "output");

    updateNodeType(nodeValue);
}

function applyNodeEdit() {
    if (!selectedNode) return;
    if (selectedNode.type === "output") return;

    const newValue = nodeValueInput.value.trim();
    if (!newValue) return;

    if (newValue in OPERATORS) {
        // Value is an operator; add the descriptive name if it exists.
        const operator = OPERATORS[newValue];
        selectedNode.type = "operator";
        selectedNode.title = [newValue, operator.name];
        const oldInputPins = selectedNode.inputPins;
        selectedNode.inputPins = Array(operator.inputs).fill("");
        selectedNode.outputPins = [""];

        // If the new operator has less inputs than the new one, drop the excess.
        const newPinCount = operator.inputs;
        graph.connections = graph.connections.filter(c => {
            if (c.to.node === selectedNode && c.to.pin >= newPinCount) return false;
            return true;
        });
    } else {
        // Value is a constant; drop all incoming connections.
        graph.connections = graph.connections.filter(c => c.to.node !== selectedNode);

        selectedNode.type = "constant";
        selectedNode.title = [newValue];
        selectedNode.inputPins = [];
        selectedNode.outputPins = [newValue];
    }

    graph.validate();
    drawCanvas();
}

function cancelNodeEdit() {
    if (!selectedNode) return;
    selectedNode = null;
    updateNodeEditor();
    drawCanvas();
}

function updateParseButton() {
    // The Parse button is only enabled if the RPN doesn't match the graph.
    buttonParseRpn.disabled = (rpnTextbox.value.trim() === lastGraphRpn.trim());
}

buttonMenu.addEventListener('click', () => {
    sidebarOpen = !sidebarOpen;
    sidebar.classList.toggle('open', sidebarOpen);
    localStorage.setItem(LS_SIDEBAR_STATE, sidebarOpen);
});

buttonCopyRpn.addEventListener('click', async () => {
    navigator.clipboard.writeText(rpnTextbox.value);
});

buttonParseRpn.addEventListener('click', () => {
    selectedNode = null;
    graph = new NodeGraph(rpnTextbox.value.trim());
    lastGraphRpn = graph.toString();
    updateSidebar();
    drawCanvas();
});

buttonDeleteNode.addEventListener('click', () => {
    if (!selectedNode || selectedNode.type === "output") return;
    confirmDeleteDialog.showModal();
});

buttonCancelDelete.addEventListener('click', (e) => {
    e.preventDefault();
    confirmDeleteDialog.close();
});

buttonConfirmDelete.addEventListener('click', (e) => {
    e.preventDefault();
    if (selectedNode && graph.removeNode(selectedNode)) {
        selectedNode = null;
    }
    confirmDeleteDialog.close();
    updateSidebar();
    drawCanvas();
});

confirmDeleteDialog.addEventListener('click', (e) => {
    if (e.target === confirmDeleteDialog) {
        confirmDeleteDialog.close();
    }
});

rpnTextbox.addEventListener('input', () => {
    updateParseButton();
});

nodeValueInput.addEventListener('input', () => {
    if (!selectedNode) return;
    updateNodeType(nodeValueInput.value.trim());
});

buttonSaveEdit.addEventListener('click', () => {
    applyNodeEdit();
});

buttonCancelEdit.addEventListener('click', () => {
    cancelNodeEdit();
});

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;

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

    getPinAtPoint: (x, y) => {
        return graph.getPinAtPoint(x, y);
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

    onActiveWire: (wire) => {
        activeWire = wire;
        drawCanvas();
    },

    onNodeSelected: (node) => {
        selectedNode = node;
        if (node) {
            // Move the node to the end of the array so it renders on top of all others.
            graph.nodes = graph.nodes.filter(n => n !== node);
            graph.nodes.push(node);
        }
        updateSidebar();
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

updateSidebar();
resizeCanvas();
