class Block extends GameObject {
  constructor(x, y, value, isTray = false) {
    super(x, y, 60, 60);
    this.name = 'Block';
    this.z = 3;
    this.value = value;
    this.isTray = isTray;
    this.isDragging = false;
    this.slot = null;
    this.fizzleTimer = 0;
    
    const colors = ["#ff4757", "#ffa502", "#eccc68", "#7bed9f", "#70a1ff", "#5352ed", "#3742fa", "#ff7f50", "#ffffff"];
    this.color = colors[(value - 1) % colors.length];
  }

  update(dt) {
    if (this.fizzleTimer > 0) {
      this.fizzleTimer -= dt;
      if (this.fizzleTimer <= 0) {
        if (!this.isTray && this.slot) {
          this.slot.block = null;
          this.destroy = true;
        }
      }
    }
  }

  draw(ctx) {
    let dx = this.x;
    let dy = this.y;
    
    if (this.fizzleTimer > 0) {
      dx += (Math.random() - 0.5) * 10;
      dy += (Math.random() - 0.5) * 10;
    }

    ctx.save();
    ctx.translate(dx, dy);
    
    ctx.fillStyle = (this.fizzleTimer > 0) ? "#ff0000" : this.color;
    ctx.beginPath();
    ctx.roundRect(0, 0, this.width, this.height, 12);
    ctx.fill();
    
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = (this.fizzleTimer > 0) ? "#fff" : "rgba(0,0,0,0.8)";
    if (this.color === "#ffffff" && this.fizzleTimer <= 0) ctx.fillStyle = "#000";
    else ctx.fillStyle = "#fff";

    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.value, this.width / 2, this.height / 2 + 2);
    
    ctx.restore();
  }
}