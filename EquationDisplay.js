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

  /**
   * Parse formula string to extract atoms and their counts
   * e.g., "H2O" → {H: 2, O: 1}, "Ca(OH)2" → {Ca: 1, O: 2, H: 2}
   */
  parseFormula(formula) {
    const atoms = {};
    
    // Handle simple cases: replace common patterns
    let processed = formula
      .replace(/(\([^)]+\))(\d+)/g, (match, group, count) => {
        // Handle groups like (OH)2
        const groupContent = group.slice(1, -1);
        let result = '';
        for (let i = 0; i < parseInt(count); i++) {
          result += groupContent;
        }
        return result;
      });

    // Extract individual atoms with their counts
    const regex = /([A-Z][a-z]?)(\d*)/g;
    let match;
    while ((match = regex.exec(processed)) !== null) {
      const atom = match[1];
      const count = match[2] ? parseInt(match[2]) : 1;
      atoms[atom] = (atoms[atom] || 0) + count;
    }

    return atoms;
  }

  /**
   * Calculate total atoms on left (reactants) or right (products) side
   */
  calculateAtoms(side) {
    const atoms = {};
    
    for (const compound of side) {
      // Find the slot for this compound to get the coefficient
      const slot = this.slots.find(s => s.compoundFormula === compound.f);
      const coefficient = slot && slot.block ? slot.block.value : 0;
      
      if (coefficient === 0) continue;
      
      const compoundAtoms = this.parseFormula(compound.f);
      for (const [atom, count] of Object.entries(compoundAtoms)) {
        atoms[atom] = (atoms[atom] || 0) + (coefficient * count);
      }
    }
    
    return atoms;
  }

  /**
   * Check if equation is balanced
   */
  isBalanced() {
    const leftAtoms = this.calculateAtoms(this.equationData.r);
    const rightAtoms = this.calculateAtoms(this.equationData.p);
    
    const allAtoms = new Set([...Object.keys(leftAtoms), ...Object.keys(rightAtoms)]);
    
    for (const atom of allAtoms) {
      if ((leftAtoms[atom] || 0) !== (rightAtoms[atom] || 0)) {
        return false;
      }
    }
    return true;
  }

  build() {
    const slotWidth = 60;
    const padding = 10;
    const charWidth = 20;
    
    this.elements = [];
    this.reactantElements = [];
    this.productElements = [];
    
    const addPart = (partList, isReactant) => {
      for (let i = 0; i < partList.length; i++) {
        const part = partList[i];
        this.elements.push({ type: 'slot', expected: part.c, formula: part.f });
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
        slot.compoundFormula = el.formula;
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
    
    // Draw main equation
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

    // Draw atom counters
    const leftAtoms = this.calculateAtoms(this.equationData.r);
    const rightAtoms = this.calculateAtoms(this.equationData.p);
    const isBalanced = this.isBalanced();
    
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    
    const counterY = this.y + 80;
    const leftX = this.x - 120;
    const rightX = this.x + 120;
    
    // Determine color
    const color = isBalanced && Object.keys(leftAtoms).length > 0 ? "#7bed9f" : "#eccc68";
    ctx.fillStyle = color;
    
    // Draw "ATOMS" label
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("LEFT", leftX, counterY - 25);
    ctx.fillText("RIGHT", rightX, counterY - 25);
    
    ctx.font = "bold 11px sans-serif";
    ctx.fillStyle = color;
    
    // Get all unique atoms
    const allAtoms = [...new Set([...Object.keys(leftAtoms), ...Object.keys(rightAtoms)])].sort();
    
    // Draw left side atoms
    let yOffset = counterY;
    for (const atom of allAtoms) {
      const count = leftAtoms[atom] || 0;
      ctx.fillText(`${atom}: ${count}`, leftX, yOffset);
      yOffset += 18;
    }
    
    // Draw right side atoms
    yOffset = counterY;
    for (const atom of allAtoms) {
      const count = rightAtoms[atom] || 0;
      ctx.fillText(`${atom}: ${count}`, rightX, yOffset);
      yOffset += 18;
    }
    
    // Draw balance status
    if (Object.keys(leftAtoms).length > 0) {
      ctx.font = "bold 13px sans-serif";
      ctx.fillStyle = isBalanced ? "#7bed9f" : "#ff6b6b";
      ctx.textAlign = "center";
      const statusText = isBalanced ? "✓ BALANCED" : "✗ NOT BALANCED";
      ctx.fillText(statusText, this.x, counterY + (allAtoms.length * 18) + 10);
    }
    
    ctx.restore();
  }
}
