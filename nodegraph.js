import { VisualNode } from './visualnode.js';

const booleanInput = (v) => {
    // Any other ways for JavaScript to mess up data types? Yes. Most definitely.
    if (v === true || v === "true") return true;
    if (v === false || v === "false") return false;

    const n = parseFloat(v);
    // Any non-zero value is true (C standard)
    if (!Number.isNaN(n)) return n !== 0;

    // If we got here it's a non-boolean string.
    return false;
}

const numberInput = (v) => {
    // If we are about to perform arithmetic with a boolean, assume true equals 1.
    if (v === true || v === "true") return 1;
    if (v === false || v === "false") return 0;

    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
}

const OPERATORS = {
    '&&':   { name: 'AND',              inputs: 2,  output: (v1, v2) => booleanInput(v1) && booleanInput(v2) ? 1 : 0 },
    '||':   { name: 'OR',               inputs: 2,  output: (v1, v2) => booleanInput(v1) || booleanInput(v2) ? 1 : 0 },
    '!':    { name: 'NOT',              inputs: 1,  output: (v) => booleanInput(v) ? 0 : 1 },
    '==':   { name: 'Equals',           inputs: 2,  output: (v1, v2) => numberInput(v1) === numberInput(v2) ? 1 : 0 },
    '>':    { name: 'Greater',          inputs: 2,  output: (v1, v2) => numberInput(v1) > numberInput(v2) ? 1 : 0 },
    '>=':   { name: 'Greater/Equal',    inputs: 2,  output: (v1, v2) => numberInput(v1) >= numberInput(v2) ? 1 : 0 },
    '<':    { name: 'Less',             inputs: 2,  output: (v1, v2) => numberInput(v1) < numberInput(v2) ? 1 : 0 },
    '<=':   { name: 'Less/Equal',       inputs: 2,  output: (v1, v2) => numberInput(v1) <= numberInput(v2) ? 1 : 0 },
    '+':    { name: 'Add',              inputs: 2,  output: (v1, v2) => numberInput(v1) + numberInput(v2) },
    '-':    { name: 'Subtract',         inputs: 2,  output: (v1, v2) => numberInput(v1) - numberInput(v2) },
    '*':    { name: 'Multiply',         inputs: 2,  output: (v1, v2) => numberInput(v1) * numberInput(v2) },
    '/':    { name: 'Divide',           inputs: 2,  output: (v1, v2) => numberInput(v1) / numberInput(v2) },
};

const computedStyles = window.getComputedStyle(document.documentElement);
const gridSize = parseFloat(computedStyles.getPropertyValue('--grid-size')) || 40;

const DEFAULT_NODE_WIDTH = 4;
const DEFAULT_NODE_HEIGHT = 2;

export class NodeGraph {
    constructor(rpn = "") {
        this.fromString(rpn);
    }

    fromString(rpn) {
        this.nodes = [];
        this.connections = [];

        const stack = [];
        const tokens = rpn.trim().split(/\s+/);

        for (const t of tokens) {
            if (!t) continue;

            if (t in OPERATORS) {
                const operator = OPERATORS[t];

                // The RPN string given may not contain enough inputs, so cap at the stack length.
                const numInputs = Math.min(stack.length, operator.inputs);
                const node = new VisualNode("operator", [t, operator.name], 0, 0, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT, Array(operator.inputs).fill(""), [""]);
                this.nodes.push(node);

                const inputs = [];
                const args = Array(operator.inputs).fill(0);
                for (let i = 0; i < numInputs; i++) {
                    // Take the LAST node from the stack and put it at the START of the inputs array.
                    inputs.unshift(stack.pop());
                }

                inputs.forEach((input, i) => {
                    this.connections.push({
                        from: { node: input.node, pin: input.pin },
                        to: { node: node, pin: i }
                    });
                    // TODO: check for data types that this node supports and convert if needed.
                    node.inputPins[i] = input.node.outputPins[input.pin];
                    args[i] = node.inputPins[i];
                });

                node.outputPins[0] = operator.output(...args)
                stack.push({ node: node, pin: 0 });
            } else {
                const node = new VisualNode("constant", [t], 0, 0, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT, [], [t]);
                this.nodes.push(node);
                stack.push({ node: node, pin: 0 });
            }
        }

        const output = new VisualNode("output", ["Output"], 0, 0, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT, [""], []);
        this.nodes.push(output);

        // On a well-formed RPN string, there should be exactly one node left in the stack to send to the output.
        if (stack.length > 0) {
            const result = stack.pop();
            this.connections.push({
                from: { node: result.node, pin: result.pin },
                to: { node: output, pin: 0 }
            });
            output.inputPins[0] = result.node.outputPins[result.pin];
        }

        this.resetLayout(output);
    }

    graphSize(output) {
        // Recursive function to get the actual height of the graph in pixels, and its maximum depth.
        const recurse = (node, depth) => {
            const inputs = this.connections.filter(conn => conn.to.node === node);

            // No inputs? Just the current node.
            if (inputs.length === 0) {
                return { height: node.height + (gridSize / 2), depth: depth };
            }

            // One or more inputs? Sum up their height recursively.
            let result = { height: 0, depth: 0 };
            inputs.forEach((input, i) => {
                const branchSize = recurse(input.from.node, depth + 1);
                result.height += branchSize.height;
                result.depth = branchSize.depth > result.depth ? branchSize.depth : result.depth;
            });
            return result;
        }

        // Return the actual height, and calculate the width based on the maximum depth.
        const result = recurse(output, 1);
        return { x: result.depth * (DEFAULT_NODE_WIDTH + 1) * gridSize, y: result.height }
    }

    resetLayout(output) {
        const recurse = (node, x, y) => {
            const inputs = this.connections.filter(conn => conn.to.node === node);

            // Place the nodes vertically centered on the given coordinates.
            node.x = x - node.width;
            node.y = y - (node.height / 2);

            // No inputs? We're done here.
            if (inputs.length === 0) return;

            // More than one input? Find the height of my branch and stack the inputs using that.
            const dims = this.graphSize(node);
            let nodeY = y - (dims.y / 2)
            inputs.forEach((input, i) => {
                const iDims = this.graphSize(input.from.node);
                recurse(input.from.node, x - (DEFAULT_NODE_WIDTH + 1) * gridSize, nodeY + (iDims.y / 2));
                nodeY += iDims.y;
            });
        }

        const dims = this.graphSize(output);
        recurse(output, dims.x, dims.y / 2);
    }
}
