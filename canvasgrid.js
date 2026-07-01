const computedStyles = window.getComputedStyle(document.documentElement);
const bgColor = computedStyles.getPropertyValue('--bg-color').trim();
const gridColor = computedStyles.getPropertyValue('--grid-color').trim();
export const gridSize = parseFloat(computedStyles.getPropertyValue('--grid-size')) || 40;

export function drawGrid(canvas, ctx, panOffset, zoomLevel) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoomLevel, zoomLevel);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.7 + zoomLevel;

    const visibleWidth = canvas.width / zoomLevel;
    const visibleHeight = canvas.height / zoomLevel;
    const offsetX = -panOffset.x / zoomLevel;
    const offsetY = -panOffset.y / zoomLevel;

    const startX = Math.floor(offsetX / gridSize) * gridSize;
    const endX = offsetX + visibleWidth;

    const startY = Math.floor(offsetY / gridSize) * gridSize;
    const endY = offsetY + visibleHeight;

    for (let x = startX; x <= endX + gridSize; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY + gridSize);
        ctx.stroke();
    }

    for (let y = startY; y <= endY + gridSize; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX + gridSize, y);
        ctx.stroke();
    }
}
