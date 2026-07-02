class EquationDisplay extends GameObject {
  constructor(x, y, equationData, game) {
    super(x, y, 0, 0);
    this.name = 'EquationDisplay';
    this.z = 2;
    this.equationData = equationData;
    this.game = game;
    this.slots = [];
    this.build();
  }

  build() {
    const slotWidth = 60;
    const padding = 10;
    const charWidth = 20;
    
    this.elements = [];
    
    const addPart = (partList, isReactant) => {
      for (let i = 0; i < partList.length; i++) {
        const part = partList[i];
        this.elements.push({ type: 'slot', expected: part.c });
        this.elements.push({ type: 'text', text: part.f });
        if (i < partList.length - 1) {
          this.elements.push({ type: 'text', text: '+' });
        }
      }
    };
    
    addPart(this.equationData.r, true);
    this.elements.push({ type: 'text', text: '->' });
    addPart(this.equationData.p, false);
    
    let totalWidth = 0;
    for (const el of this.elements) {
      if (el.type === 'slot') totalWidth += slotWidth + padding * 2;
      else if (el.type === 'text') totalWidth += el.text.length * charWidth + padding * 2;
    }
    
    let currentX = this.x - totalWidth / 2;
    const startY = this.y;
    
    for (const el of this.elements) {
      if (el.type === 'slot') {
        currentX += padding;
        const slot = new Slot(currentX, startY - slotWidth / 2, el.expected);
        this.slots.push(slot);
        this.game.entities.push(slot);
        currentX += slotWidth + padding;
      } else if (el.type === 'text') {
        currentX += padding;
        el.x = currentX;
        el.y = startY;
        currentX += el.text.length * charWidth + padding;
      }
    }
  }

  cleanup() {
    this.slots.forEach(s => s.destroy = true);
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    
    for (const el of this.elements) {
      if (el.type === 'text') {
        let cx = el.x;
        for (let i = 0; i < el.text.length; i++) {
          const char = el.text[i];
          if (/[0-9]/.test(char)) {
            ctx.font = "bold 18px sans-serif";
            ctx.fillText(char, cx, el.y + 12);
            cx += ctx.measureText(char).width + 2;
          } else {
            ctx.font = "bold 36px sans-serif";
            ctx.fillText(char, cx, el.y);
            cx += ctx.measureText(char).width + 2;
          }
        }
      }
    }
    ctx.restore();
  }
}