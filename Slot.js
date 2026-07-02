class Slot extends GameObject {
  constructor(x, y, expectedValue) {
    super(x, y, 60, 60);
    this.name = 'Slot';
    this.z = 1;
    this.expectedValue = expectedValue;
    this.block = null;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.roundRect(0, 0, this.width, this.height, 12);
    ctx.stroke();
    
    ctx.restore();
  }
}