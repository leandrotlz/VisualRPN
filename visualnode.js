const computedStyles = window.getComputedStyle(document.documentElement);
const gridSize = parseFloat(computedStyles.getPropertyValue('--grid-size')) || 40;

const TITLE_HEIGHT = 30;
const PIN_LOCATION = TITLE_HEIGHT + 16;
const PIN_SEPARATION = 20;
const PIN_TEXT_OFFSET_X = 12;
const PIN_TEXT_OFFSET_Y = 4;

export class VisualNode {
    constructor(type, title, gridX, gridY, width, height, inputPins, outputPins) {
        this.type = type;
        this.title = title;

        this.x = gridX * gridSize;
        this.y = gridY * gridSize;
        this.width = width * gridSize;
        this.height = height * gridSize;

        this.inputPins = inputPins;
        this.outputPins = outputPins;
    }

    drawPin(ctx, displayText, x, y, side) {
        ctx.fillStyle = computedStyles.getPropertyValue(`--pin-${side}-color`).trim();
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = computedStyles.getPropertyValue('--node-body-font').trim();
        ctx.fillStyle = computedStyles.getPropertyValue('--node-body-color').trim();
        if (side === "out") {
            const textWidth = ctx.measureText(displayText).width;
            ctx.fillText(displayText, x - textWidth - PIN_TEXT_OFFSET_X, y + PIN_TEXT_OFFSET_Y);
        } else {
            ctx.fillText(displayText, x + PIN_TEXT_OFFSET_X, y + PIN_TEXT_OFFSET_Y);
        }
    }

    draw(ctx, selectedNode) {
        ctx.fillStyle = computedStyles.getPropertyValue(`--node-${this.type}-body`).trim();
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, 10);
        ctx.fill();

        ctx.fillStyle = computedStyles.getPropertyValue(`--node-${this.type}-bg`).trim();
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, TITLE_HEIGHT, 10);
        ctx.fill();

        ctx.font = computedStyles.getPropertyValue('--node-title-font').trim();
        ctx.fillStyle = computedStyles.getPropertyValue('--node-title-color').trim();
        ctx.fillText(this.title, this.x + 12, this.y + 19);

        if (this === selectedNode) {
            ctx.strokeStyle = computedStyles.getPropertyValue('--node-title-color').trim();
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(this.x, this.y, this.width, this.height, 10);
            ctx.stroke();
        }

        for (let i = 0; i < this.inputPins; i++) {
            this.drawPin(ctx, "0", this.x, this.y + PIN_LOCATION + (i * PIN_SEPARATION), "in");
        }

        for (let i = 0; i < this.outputPins; i++) {
            this.drawPin(ctx, "0", this.x + this.width, this.y + PIN_LOCATION + (i * PIN_SEPARATION), "out");
        }
    }

    hasPoint(x, y) {
        return (x >= this.x) && (x <= this.x + this.width) && (y >= this.y) && (y <= this.y + this.height);
    }
}
