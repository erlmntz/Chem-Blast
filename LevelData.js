/**
 * LevelData — chemical equations organized by difficulty, plus level config generators.
 * 
 * Difficulties: easy, medium, hard, super_hard
 * Modes: learn (no fail), time (countdown), endless (lives)
 */

// ───── All Equations ─────

const LevelData_equations = [
  // ── EASY (small numbers, simple compounds) ──
  { id: "easy_1", diff: "easy", r: [{f:"H2",c:2},{f:"O2",c:1}], p: [{f:"H2O",c:2}] },
  { id: "easy_2", diff: "easy", r: [{f:"Na",c:2},{f:"Cl2",c:1}], p: [{f:"NaCl",c:2}] },
  { id: "easy_3", diff: "easy", r: [{f:"N2",c:1},{f:"H2",c:3}], p: [{f:"NH3",c:2}] },
  { id: "easy_4", diff: "easy", r: [{f:"Mg",c:1},{f:"O2",c:1}], p: [{f:"MgO",c:2}], note: "2 Mg + O2 → 2 MgO" },
  { id: "easy_5", diff: "easy", r: [{f:"H2",c:2},{f:"Cl2",c:1}], p: [{f:"HCl",c:2}], note: "H2 + Cl2 → 2 HCl" },
  { id: "easy_6", diff: "easy", r: [{f:"C",c:1},{f:"O2",c:1}], p: [{f:"CO2",c:1}] },

  // ── MEDIUM (2-3 reactants, larger numbers) ──
  { id: "med_1", diff: "medium", r: [{f:"CH4",c:1},{f:"O2",c:2}], p: [{f:"CO2",c:1},{f:"H2O",c:2}] },
  { id: "med_2", diff: "medium", r: [{f:"Al",c:4},{f:"O2",c:3}], p: [{f:"Al2O3",c:2}] },
  { id: "med_3", diff: "medium", r: [{f:"P4",c:1},{f:"O2",c:5}], p: [{f:"P4O10",c:1}] },
  { id: "med_4", diff: "medium", r: [{f:"Fe",c:2},{f:"O2",c:3}], p: [{f:"Fe2O3",c:2}] },
  { id: "med_5", diff: "medium", r: [{f:"C3H8",c:1},{f:"O2",c:5}], p: [{f:"CO2",c:3},{f:"H2O",c:4}] },
  { id: "med_6", diff: "medium", r: [{f:"Na",c:2},{f:"H2O",c:2}], p: [{f:"NaOH",c:2},{f:"H2",c:1}] },

  // ── HARD (3+ reactants, larger coefficients) ──
  { id: "hard_1", diff: "hard", r: [{f:"C2H6",c:2},{f:"O2",c:7}], p: [{f:"CO2",c:4},{f:"H2O",c:6}] },
  { id: "hard_2", diff: "hard", r: [{f:"Cu",c:2},{f:"O2",c:1}], p: [{f:"CuO",c:2}] },
  { id: "hard_3", diff: "hard", r: [{f:"NH3",c:4},{f:"O2",c:5}], p: [{f:"NO",c:4},{f:"H2O",c:6}] },
  { id: "hard_4", diff: "hard", r: [{f:"Fe2O3",c:2},{f:"C",c:3}], p: [{f:"Fe",c:4},{f:"CO2",c:3}] },
  { id: "hard_5", diff: "hard", r: [{f:"CaCO3",c:1}], p: [{f:"CaO",c:1},{f:"CO2",c:1}] },
  { id: "hard_6", diff: "hard", r: [{f:"KClO3",c:2}], p: [{f:"KCl",c:2},{f:"O2",c:3}] },

  // ── SUPER HARD (complex multi-reactant, high coefficients) ──
  { id: "super_1", diff: "super_hard", r: [{f:"C4H10",c:2},{f:"O2",c:13}], p: [{f:"CO2",c:8},{f:"H2O",c:10}] },
  { id: "super_2", diff: "super_hard", r: [{f:"Al",c:2},{f:"Fe2O3",c:1}], p: [{f:"Al2O3",c:1},{f:"Fe",c:2}] },
  { id: "super_3", diff: "super_hard", r: [{f:"MnO2",c:1},{f:"HCl",c:4}], p: [{f:"MnCl2",c:1},{f:"Cl2",c:1},{f:"H2O",c:2}] },
  { id: "super_4", diff: "super_hard", r: [{f:"Cu",c:1},{f:"HNO3",c:4}], p: [{f:"Cu(NO3)2",c:1},{f:"NO2",c:2},{f:"H2O",c:2}] },
  { id: "super_5", diff: "super_hard", r: [{f:"KMnO4",c:2},{f:"HCl",c:16}], p: [{f:"KCl",c:2},{f:"MnCl2",c:2},{f:"Cl2",c:5},{f:"H2O",c:8}] },
  { id: "super_6", diff: "super_hard", r: [{f:"C2H5OH",c:1},{f:"O2",c:3}], p: [{f:"CO2",c:2},{f:"H2O",c:3}] },
];

// ───── Difficulty Config ─────

const LevelData_difficulties = {
  easy: {
    label: "Easy",
    icon: "🟢",
    color: "#7bed9f",
    scoreMultiplier: 1,
    learnTime: 0,       // no timer
    timeTime: 90,        // 90 seconds
    endlessLives: 5,
    eqPool: "easy"
  },
  medium: {
    label: "Medium",
    icon: "🟡",
    color: "#eccc68",
    scoreMultiplier: 1.5,
    learnTime: 0,
    timeTime: 70,
    endlessLives: 3,
    eqPool: "medium"
  },
  hard: {
    label: "Hard",
    icon: "🔴",
    color: "#ff6b6b",
    scoreMultiplier: 2,
    learnTime: 0,
    timeTime: 50,
    endlessLives: 2,
    eqPool: "hard"
  },
  super_hard: {
    label: "Super Hard",
    icon: "💀",
    color: "#ff4757",
    scoreMultiplier: 3,
    learnTime: 0,
    timeTime: 35,
    endlessLives: 1,
    eqPool: "super_hard"
  }
};

// ───── Level Generator ─────

const LevelData_modeDefs = {
  learn: { idSuffix: "_learn", name: "Learn", mode: "learn", desc: "No timer — practice freely" },
  time:  { idSuffix: "_time",  name: "Time Challenge", mode: "time", desc: "Race the clock!" },
  endless: { idSuffix: "_endless", name: "Endless Survival", mode: "endless", desc: "Don't lose all lives!" }
};

/**
 * Generate all level configs from difficulty × mode combinations
 */
function LevelData_generateLevels() {
  const levels = [];
  let idCounter = 1;

  const diffKeys = Object.keys(LevelData_difficulties);

  for (const dk of diffKeys) {
    const diff = LevelData_difficulties[dk];

    for (const mk of Object.keys(LevelData_modeDefs)) {
      const mdef = LevelData_modeDefs[mk];

      // Get all equation IDs for this difficulty
      const eqIds = LevelData_equations
        .filter(eq => eq.diff === dk)
        .map(eq => eq.id);

      if (eqIds.length === 0) continue;

      let time = 0;
      let lives = 1;

      if (mk === 'time') {
        time = diff.timeTime;
      } else if (mk === 'endless') {
        lives = diff.endlessLives;
      }

      levels.push({
        id: idCounter++,
        diffKey: dk,
        difficulty: diff,
        modeKey: mk,
        name: `${diff.icon} ${diff.label} — ${mdef.name}`,
        shortName: `${diff.label} ${mdef.name}`,
        mode: mdef.mode,
        time: time,
        lives: lives,
        eqs: eqIds,
        scoreMultiplier: diff.scoreMultiplier,
        color: diff.color,
        desc: mdef.desc
      });
    }
  }

  return levels;
}

// Pre-generate once
const LevelData_levels = LevelData_generateLevels();

// ───── Lookups ─────

function LevelData_getEquation(id) {
  return LevelData_equations.find(e => e.id === id);
}

function LevelData_getDiffConfig(diffKey) {
  return LevelData_difficulties[diffKey] || LevelData_difficulties.easy;
}

function LevelData_getLevelsByDifficulty(diffKey) {
  return LevelData_levels.filter(l => l.diffKey === diffKey);
}
