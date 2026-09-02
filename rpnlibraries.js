export class RPNLibraryManager {
    constructor() {
        this.libraries = new Map();
        this.activeLibraries = new Set();
    }

    registerLibrary(name, config) {
        this.libraries.set(name, {
            name,
            operators: config.operators || {},
            alwaysOn: config.alwaysOn || false,
            nodeType: config.nodeType || "Operator",
            caseSensitive: config.caseSensitive !== false
        });

        if (config.alwaysOn) {
            this.activeLibraries.add(name);
        }
    }

    enableLibrary(name) {
        if (this.libraries.has(name)) {
            this.activeLibraries.add(name);
            return true;
        }
        return false;
    }

    disableLibrary(name, graph = null) {
        const lib = this.libraries.get(name);
        if (!lib) return false;
        if (lib.alwaysOn) return false;

        if (graph && this.isLibraryInUse(name, graph)) {
            return false;
        }

        this.activeLibraries.delete(name);
        return true;
    }

    isActive(name) {
        return this.activeLibraries.has(name);
    }

    getAllLibraries() {
        return Array.from(this.libraries.values());
    }

    getActiveLibraries() {
        return Array.from(this.activeLibraries).map(name => this.libraries.get(name)).filter(l => l);
    }

    getOperators() {
        const operators = {};
        for (const lib of this.getActiveLibraries()) {
            for (const [key, op] of Object.entries(lib.operators)) {
                operators[key] = {
                    ...op,
                    _library: lib.name,
                    _nodeType: lib.nodeType,
                    _caseSensitive: lib.caseSensitive,
                };
            }
        }
        return operators;
    }

    getOperator(token) {
        for (const lib of this.getActiveLibraries()) {
            if (lib.caseSensitive) {
                if (lib.operators[token]) {
                    return {
                        ...lib.operators[token],
                        _library: lib.name,
                        _nodeType: lib.nodeType,
                        _caseSensitive: lib.caseSensitive,
                        _canonicalKey: token
                    };
                }
            } else {
                for (const [key, op] of Object.entries(lib.operators)) {
                    if (key.toLowerCase() === token.toLowerCase()) {
                        return {
                            ...op,
                            _library: lib.name,
                            _nodeType: lib.nodeType,
                            _caseSensitive: lib.caseSensitive,
                            _canonicalKey: key
                        };
                    }
                }
            }
        }
        return null;
    }

    isLibraryInUse(libraryName, graph) {
        const lib = this.libraries.get(libraryName);
        if (!lib) return false;

        const operatorKeys = new Set(Object.keys(lib.operators));

        if (!lib.caseSensitive) {
            const lowerKeys = new Set(Object.keys(lib.operators).map(k => k.toLowerCase()));
            
            for (const node of graph.nodes) {
                if ((node.type === "operator" || node.type === "function") && node.title[0]) {
                    const token = node.title[0];
                    if (operatorKeys.has(token) || lowerKeys.has(token.toLowerCase())) {
                        return true;
                    }
                }
            }
            return false;
        }

        for (const node of graph.nodes) {
            if ((node.type === "operator" || node.type === "function") && node.title[0]) {
                if (operatorKeys.has(node.title[0])) {
                    return true;
                }
            }
        }
        return false;
    }

    getCanonicalKey(token) {
        const op = this.getOperator(token);
        return op ? op._canonicalKey : token;
    }

    getNodeType(token) {
        const op = this.getOperator(token);
        return op ? op._nodeType : "Operator";
    }

    isOperator(token) {
        return this.getOperator(token) !== null;
    }
}

export const libraryManager = new RPNLibraryManager();

// Generic library (always on)
libraryManager.registerLibrary("Generic", {
    alwaysOn: true,
    nodeType: "Operator",
    caseSensitive: true,
    operators: {
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
        '%':    { name: 'Modulo',           inputs: 2,  output: (v1, v2) => numberInput(v1) % numberInput(v2) },
        'minmax':       { name: '',         inputs: 3,  output: (v1, v2, v3) =>  NumericMinMax(v1, v2, v3) },
    }
});

// City of Heroes library (/playereval)
libraryManager.registerLibrary("COH General", {
    alwaysOn: false,
    nodeType: "Function",
    caseSensitive: false,
    operators: {
        'eq':           { name: 'String Equals',    inputs: 2,  output: (v1, v2) => String(v1) === String(v2) ? 1 : 0 },
        'char>':        { name: '',                 inputs: 1,  output: (v) => 0 },
        'owned?':       { name: '',                 inputs: 1,  output: (v) => 0 },
        'HasSouvenir?': { name: '',                 inputs: 1,  output: (v) => 0 },
        'Badge%':       { name: '',                 inputs: 2,  output: (v1, v2) => integerInput(integerInput(v1) / integerInput(v2) * 1000000) },
    }
});

function NumericMinMax(v1, v2, v3) {
    const num = numberInput(v1);
    const min = numberInput(v2);
    const max = numberInput(v3);
    if (num < min) return min;
    if (num > max) return max;
    return num;
}

function booleanInput(v) {
    if (v === false || v === "false" || v === null || v === undefined) return false;
    if (v === true || v === "true") return true;
    const n = parseFloat(v);
    if (!Number.isNaN(n)) return n !== 0;
    return false;
}

function numberInput(v) {
    if (v === false || v === "false" || v === null || v === undefined) return 0;
    if (v === true || v === "true") return 1;
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
}

function integerInput(v) {
    if (v === false || v === "false" || v === null || v === undefined) return 0;
    if (v === true || v === "true") return 1;
    const n = parseInt(v);
    return Number.isNaN(n) ? 0 : n;
}
