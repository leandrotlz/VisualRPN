import { drawGrid, gridSize } from './canvasgrid.js';
import { UserInput } from './userinput.js';

import { NodeGraph } from './nodegraph.js';
import { VisualNode } from './visualnode.js';
import { libraryManager } from './rpnlibraries.js';

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
const sidebarLibrariesView = document.getElementById('sidebar-libraries-view');
const rpnTextbox = document.getElementById('rpn-textbox');
const buttonCopyRpn = document.getElementById('button-copy-rpn');
const buttonParseRpn = document.getElementById('button-parse-rpn');

// Node editor elements.
const nodeValueInput = document.getElementById('node-value-input');
const nodeTypeDisplay = document.getElementById('node-type-display');
const buttonCancelEdit = document.getElementById('button-cancel-edit');
const buttonSaveEdit = document.getElementById('button-save-edit');

// RPN Libraries elements.
const librariesContainer = document.getElementById('libraries-container');

// Delete Node modal elements.
const confirmDeleteDialog = document.getElementById('confirm-delete-dialog');
const buttonConfirmDelete = document.getElementById('button-confirm-delete');
const buttonCancelDelete = document.getElementById('button-cancel-delete');

// LocalStorage keys.
const LS_SIDEBAR_STATE = 'visualrpn-sidebar-state';
const LS_RPN_CONTENTS = 'visualrpn-rpn-contents';
const LS_ACTIVE_LIBRARIES = 'visualrpn-active-libraries';

// Initialize app state from LocalStorage.
let sidebarOpen = localStorage.getItem(LS_SIDEBAR_STATE) !== 'false';
sidebar.classList.toggle('open', sidebarOpen);

// Load active libraries from LocalStorage.
const savedLibraries = localStorage.getItem(LS_ACTIVE_LIBRARIES);
if (savedLibraries) {
    try {
        const activeLibs = JSON.parse(savedLibraries);
        for (const libName of activeLibs) {
            libraryManager.enableLibrary(libName);
        }
    } catch (e) {
        console.warn('Failed to parse saved libraries:', e);
    }
}

// Load the initial graph from LocalStorage or use the placeholder graph.
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
    const nodeSelected = (selectedNode != null);
    sidebarNodeView.hidden = !nodeSelected;
    sidebarLibrariesView.hidden = nodeSelected;

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
    updateLibraries();
}

function getNodeType(nodeValue, nodeType) {
    if (nodeType === "output") return "Output";
    const operator = libraryManager.getOperator(nodeValue);
    if (operator) {
        return libraryManager.getNodeType(nodeValue);
    }
    return "Constant";
}

function updateNodeType(nodeValue) {
    const nodeType = getNodeType(nodeValue, selectedNode.type);

    if (nodeType === "Operator" || nodeType === "Function") {
        const operator = libraryManager.getOperator(nodeValue);
        if (operator && operator.name)
            nodeTypeDisplay.textContent = `${nodeType} (${operator.name})`;
        else
            nodeTypeDisplay.textContent = nodeType;
    } else {
        nodeTypeDisplay.textContent = nodeType;
    }

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

    // Apply canonical case for case-insensitive libraries on save
    const canonicalValue = libraryManager.getCanonicalKey(newValue);

    if (libraryManager.isOperator(canonicalValue)) {
        // Value is an operator; add the descriptive name if it exists.
        const operator = libraryManager.getOperator(canonicalValue);
        const visualNodeType = operator._nodeType && operator._nodeType.toLowerCase() !== "operator"
            ? operator._nodeType.toLowerCase()
            : "operator";
        selectedNode.type = visualNodeType;
        selectedNode.title = [canonicalValue, operator.name];
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
        selectedNode.title = [canonicalValue];
        selectedNode.inputPins = [];
        selectedNode.outputPins = [canonicalValue];
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

function updateLibraries() {
    if (!librariesContainer) return;
    
    librariesContainer.innerHTML = '';
    
    for (const lib of libraryManager.getAllLibraries()) {
        const label = document.createElement('label');
        label.className = 'library-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = libraryManager.isActive(lib.name);
        checkbox.disabled = lib.alwaysOn;
        
        const inUse = libraryManager.isLibraryInUse(lib.name, graph);
        if (inUse && !lib.alwaysOn) {
            checkbox.disabled = true;
            label.title = 'Library is in use.';
        }
        
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                libraryManager.enableLibrary(lib.name);
            } else {
                libraryManager.disableLibrary(lib.name, graph);
            }
            saveActiveLibraries();
            refreshGraph();
        });
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'library-name';
        nameSpan.textContent = lib.name;
        
        label.appendChild(checkbox);
        label.appendChild(nameSpan);
        
        librariesContainer.appendChild(label);
    }
}

function saveActiveLibraries() {
    const active = Array.from(libraryManager.activeLibraries);
    localStorage.setItem(LS_ACTIVE_LIBRARIES, JSON.stringify(active));
}

function refreshGraph() {
    const currentRpn = graph.toString();
    selectedNode = null;
    graph = new NodeGraph(currentRpn);
    lastGraphRpn = graph.toString();
    updateSidebar();
    drawCanvas();
}

buttonAddNode.addEventListener('click', () => {
    // Create a new node at the center of the visible canvas.
    const newNode = new VisualNode("constant", ["new"], 0, 0, 4, 2, [], ["new"]);
    const centerX = (canvas.width / 2 - panOffset.x) / zoomLevel;
    const centerY = (canvas.height / 2 - panOffset.y) / zoomLevel;
    newNode.x = centerX;
    newNode.y = centerY;
    graph.nodes.push(newNode);

    // Select the new node to trigger edit mode in the sidebar.
    selectedNode = newNode;
    updateSidebar();
    drawCanvas();

    // Clear the node value in the editor so the user doesn't need to manually delete "new".
    nodeValueInput.value = "";
    nodeValueInput.focus();
});

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
