const computedStyles = window.getComputedStyle(document.documentElement);
const gridSize = parseFloat(computedStyles.getPropertyValue('--grid-size')) || 40;

const TITLE_HEIGHT = 30;
const PIN_SIZE = 5;
const PIN_HITBOX = PIN_SIZE + 3;
const PIN_LOCATION = TITLE_HEIGHT + 16;
const PIN_SEPARATION = 20;
const PIN_TEXT_OFFSET_X = 12;
const PIN_TEXT_OFFSET_Y = 4;

export class VisualNode {
    constructor(type, title, gridX, gridY, width, height, inputPins, outputPins) {
        this.type = type;
        this.title = title;
        this.valid = false;

        this.x = gridX * gridSize;
        this.y = gridY * gridSize;
        this.width = width * gridSize;
        this.height = height * gridSize;

        this.inputPins = inputPins;
        this.outputPins = outputPins;
    }

    getPinPosition(i, output)
    {
        return {
            x: output ? this.x + this.width : this.x,
            y: this.y + PIN_LOCATION + (i * PIN_SEPARATION)
        }
    }

    getPinAtPoint(x, y) {
        for (let i = 0; i < this.inputPins.length; i++ ) {
            const pos = this.getPinPosition(i, false);
            if (Math.hypot(x - pos.x, y - pos.y) < PIN_HITBOX) {
                return { node: this, type: "in", pin: i, to: { x: pos.x, y: pos.y } }
            }
        }
        for (let i = 0; i < this.outputPins.length; i++ ) {
            const pos = this.getPinPosition(i, true);
            if (Math.hypot(x - pos.x, y - pos.y) < PIN_HITBOX) {
                return { node: this, type: "out", pin: i, from: { x: pos.x, y: pos.y } }
            }
        }
        return null;
    }

    drawPin(ctx, i, displayText, output) {
        const pos = this.getPinPosition(i, output);
        const side = output ? "out" : "in";
        ctx.fillStyle = computedStyles.getPropertyValue(`--pin-${side}-color`).trim();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, PIN_SIZE, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = computedStyles.getPropertyValue('--node-body-font').trim();
        ctx.fillStyle = computedStyles.getPropertyValue('--node-body-color').trim();
        if (output) {
            const textWidth = ctx.measureText(displayText).width;
            ctx.fillText(displayText, pos.x - textWidth - PIN_TEXT_OFFSET_X, pos.y + PIN_TEXT_OFFSET_Y);
        } else {
            ctx.fillText(displayText, pos.x + PIN_TEXT_OFFSET_X, pos.y + PIN_TEXT_OFFSET_Y);
        }
    }

    draw(ctx, selectedNode) {
        const invalidColor = computedStyles.getPropertyValue(`--node-error`).trim();
        const fillBody = computedStyles.getPropertyValue(`--node-${this.type}-body`).trim();
        ctx.fillStyle = this.valid ? fillBody : `color-mix(in srgb, ${fillBody}, ${invalidColor} 20%)`;
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, 10);
        ctx.fill();

        const fillBg = computedStyles.getPropertyValue(`--node-${this.type}-bg`).trim();
        ctx.fillStyle = this.valid ? fillBg : `color-mix(in srgb, ${fillBg}, ${invalidColor} 5%)`;
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, TITLE_HEIGHT, 10);
        ctx.fill();

        if (this.title.length > 0) {
            ctx.font = computedStyles.getPropertyValue('--node-title-font').trim();
            ctx.fillStyle = computedStyles.getPropertyValue('--node-title-color').trim();
            ctx.fillText(this.title[0], this.x + 12, this.y + 19);
            if (this.title.length > 1) {
                const textWidth = ctx.measureText(this.title[1]).width;
                ctx.fillText(this.title[1], this.x - textWidth + this.width - 12, this.y + 19);
            }
        }

        if (this === selectedNode) {
            ctx.strokeStyle = computedStyles.getPropertyValue('--node-title-color').trim();
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(this.x, this.y, this.width, this.height, 10);
            ctx.stroke();
        }

        for (let i = 0; i < this.inputPins.length; i++) {
            this.drawPin(ctx, i, this.inputPins[i], false);
        }

        for (let i = 0; i < this.outputPins.length; i++) {
            this.drawPin(ctx, i, this.outputPins[i], true);
        }
    }

    hasPoint(x, y) {
        return (x >= this.x) && (x <= this.x + this.width) && (y >= this.y) && (y <= this.y + this.height);
    }
}
