import { VisualNode } from './visualnode.js';

const booleanInput = (v) => {
    // Any other ways for JavaScript to mess up data types? Yes. Most definitely.
    if (v === false || v === "false" || v === null || v === undefined) return false;
    if (v === true || v === "true") return true;

    const n = parseFloat(v);
    // Any non-zero value is true (C standard)
    if (!Number.isNaN(n)) return n !== 0;

    // If we got here it's a non-boolean string.
    return false;
}

const numberInput = (v) => {
    // If we are about to perform arithmetic with a boolean, assume true equals 1.
    if (v === false || v === "false" || v === null || v === undefined) return 0;
    if (v === true || v === "true") return 1;

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
                for (let i = 0; i < numInputs; i++) {
                    // Take the LAST node from the stack and put it at the START of the inputs array.
                    inputs.unshift(stack.pop());
                }

                inputs.forEach((input, i) => {
                    // Do not create a wire if the input node is null.
                    if (input.node.type !== "null") {
                        this.connections.push({
                            from: { node: input.node, pin: input.pin },
                            to: { node: node, pin: i }
                        });
                    }
                });

                stack.push({ node: node, pin: 0 });
            } else if (t === "null") {
                // The "null" tokens are special; they represent disconnected inputs.
                const node = new VisualNode("null", [], 0, 0, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT, [], []);
                this.nodes.push(node);
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
            if (result.node.type !== "null") {
                this.connections.push({
                    from: { node: result.node, pin: result.pin },
                    to: { node: output, pin: 0 }
                });
            }
        }

        // Get rid of the null nodes. TODO: "drop" notes will eventually represent disconnected _outputs_.
        this.nodes = this.nodes.filter(n => n.type !== "null");

        this.resetLayout(output);
        this.validate();
    }

    toString() {
        const tokens = [];

        const recurse = (node) => {
            if (!node) {
                tokens.push("null");
                return;
            }

            // This is so simple it's funny, we just walk up the pins recursively and the RPN builds itself.
            for (let i = 0; i < node.inputPins.length; i++) {
                // Find the node that is connected to this input pin; output null if there isn't one.
                const conn = this.connections.find(c => c.to.node === node && c.to.pin === i);
                recurse(conn ? conn.from.node : null);
            }

            // The actual RPN token is always in title[0]; the output node shouldn't be written into the string.
            if (node.type !== "output") {
                tokens.push(node.title[0]);
            }
        };

        recurse(this.nodes.find(n => n.type === "output"));
        return tokens.join(" ");
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

    getPinAtPoint(x, y) {
        for (let i = this.nodes.length - 1; i >= 0; i--)
        {
            const pin = this.nodes[i].getPinAtPoint(x, y);
            if (pin) return pin;
        }
        return null;
    }

    connectWire(wire) {
        if (!wire) return;
    
        const pos = wire.type === "in" ? wire.from : wire.to;
        const pin = this.getPinAtPoint(pos.x, pos.y);
    
        if (!pin) return;
        if (wire.type === pin.type) return;
        if (wire.node === pin.node) return;
    
        let input = {};
        let output = {};
    
        // Figure out who's the input and who's the output in order to make the connection.
        if (wire.type === "in") {
            input = { node: wire.node, pin: wire.pin };
            output = { node: pin.node, pin: pin.pin };
        } else  {
            input = { node: pin.node, pin: pin.pin };
            output = { node: wire.node, pin: wire.pin };
        }
    
        // The wire is trying to connect to a pin of the correct type in a different node,
        // destroy the old connections and create the new one.
        this.connections = this.connections.filter(c => !(c.to.node === input.node && c.to.pin === input.pin));    
        this.connections = this.connections.filter(c => !(c.from.node === output.node && c.from.pin === output.pin));

        this.connections.push({
            from: { node: output.node, pin: output.pin },
            to: { node: input.node, pin: input.pin }
        });

        this.validate();
    }

    validate() {
        const recurse = (node) => {
            if (!node) return null;

            // Constants are always valid, and this node has an output connected, so presume it's valid.
            node.valid = true;

            if (node.type === "constant") {
                return node.outputPins[0];
            }

            // Operators need to recursively evaluate inputs.
            if (node.type === "operator") {
                const operator = OPERATORS[node.title[0]];
                const args = Array(operator.inputs).fill(null);

                for (let i = 0; i < node.inputPins.length; i++) {
                    const conn = this.connections.find(c => c.to.node === node && c.to.pin === i);

                    if (conn) {
                        node.inputPins[i] = recurse(conn.from.node);
                        args[i] = node.inputPins[i];
                    } else {
                        node.inputPins[i] = "";
                        args[i] = null;
                        // An input pin is disconnnected, mark this node as invalid.
                        node.valid = false;
                    }
                }

                node.outputPins[0] = operator.output(...args);
                // If any input pins are disconnected, the node is invalid.
                // Disconnected output pins will never be visited and invalid by default.
                return node.outputPins[0];
            }

            // After everything else is evaluated, update the output node.
            if (node.type === "output") {
                const conn = this.connections.find(c => c.to.node === node && c.to.pin === 0);
                node.inputPins[0] = conn ? recurse(conn.from.node) : "";
                node.valid = true;
                return null;
            }
        };

        // Mark every node as invalid by default; nodes with all pins connected will be marked as valid.
        this.nodes.forEach(node => node.valid = false);
        const outputNode = this.nodes.find(n => n.type === "output");
        recurse(outputNode);
    }
}
