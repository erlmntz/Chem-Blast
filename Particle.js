class Particle extends GameObject {
  constructor(x, y, color) {
    super(x, y, 8, 8);
    this.name = 'Particle';
    this.z = 4;
    this.color = color;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 250 + 50;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 1.0;
  }
  
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.destroy = true;
  }
  
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.width/2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}