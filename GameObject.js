class GameObject {
  constructor(x, y, width, height) {
    this.name = this.constructor.name;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.z = 0;
    this.destroy = false;
  }

  update(dt) { }
  draw(ctx) { }

  getBounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }
}