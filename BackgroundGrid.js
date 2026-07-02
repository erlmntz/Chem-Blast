class BackgroundGrid extends GameObject {
  constructor(width, height) {
    super(0, 0, width, height);
    this.name = 'BackgroundGrid';
    this.z = 0;
    this.cellSize = 80;
    this.cols = Math.ceil(width / this.cellSize);
    this.rows = Math.ceil(height / this.cellSize);
    
    this.litRows = [];
    this.litCols = [];
    this.litTimer = 0;
  }
  
  triggerClear() {
    this.litRows.push(Math.floor(Math.random() * this.rows));
    this.litCols.push(Math.floor(Math.random() * this.cols));
    this.litTimer = 1.0;
  }
  
  update(dt) {
    if (this.litTimer > 0) {
      this.litTimer -= dt;
      if (this.litTimer <= 0) {
        this.litRows = [];
        this.litCols = [];
      }
    }
  }
  
  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 2;
    
    for (let c = 0; c <= this.cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * this.cellSize, 0);
      ctx.lineTo(c * this.cellSize, this.height);
      ctx.stroke();
    }
    for (let r = 0; r <= this.rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * this.cellSize);
      ctx.lineTo(this.width, r * this.cellSize);
      ctx.stroke();
    }
    
    if (this.litTimer > 0) {
      const alpha = this.litTimer;
      ctx.fillStyle = `rgba(123, 237, 159, ${alpha * 0.3})`;
      
      for (const r of this.litRows) {
        ctx.fillRect(0, r * this.cellSize, this.width, this.cellSize);
      }
      for (const c of this.litCols) {
        ctx.fillRect(c * this.cellSize, 0, this.cellSize, this.height);
      }
    }
    
    ctx.restore();
  }
}