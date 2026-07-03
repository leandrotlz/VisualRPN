import { VisualNode } from './visualnode.js';

const OPERATORS = {
    '&&':   { name: 'AND',              inputs: 2,  output: (v1, v2) => v1 && v2 ? 1 : 0 },
    '||':   { name: 'OR',               inputs: 2,  output: (v1, v2) => v1 || v2 ? 1 : 0 },
    '!':    { name: 'NOT',              inputs: 1,  output: (v) => v ? 0 : 1 },
    '==':   { name: 'Equals',           inputs: 2,  output: (v1, v2) => v1 == v2 ? 1 : 0 },
    '>':    { name: 'Greater',          inputs: 2,  output: (v1, v2) => v1 > v2 ? 1 : 0 },
    '>=':   { name: 'Greater/Equal',    inputs: 2,  output: (v1, v2) => v1 >= v2 ? 1 : 0 },
    '<':    { name: 'Less',             inputs: 2,  output: (v1, v2) => v1 < v2 ? 1 : 0 },
    '<=':   { name: 'Less/Equal',       inputs: 2,  output: (v1, v2) => v1 <= v2 ? 1 : 0 },
    '+':    { name: 'Add',              inputs: 2,  output: (v1, v2) => Number(v1) + Number(v2) },
    '-':    { name: 'Subtract',         inputs: 2,  output: (v1, v2) => Number(v1) - Number(v2) },
    '*':    { name: 'Multiply',         inputs: 2,  output: (v1, v2) => Number(v1) * Number(v2) },
    '/':    { name: 'Divide',           inputs: 2,  output: (v1, v2) => Number(v1) / Number(v2) },
};

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
                const args = [];
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
                    args.push(node.inputPins[i]);
                });

                // TODO: assumes correct data types and number of arguments, needs hardening.
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
    }
}
