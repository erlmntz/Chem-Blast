const LevelData_equations = [
  { id: "eq_1_1", r: [{f: "H2", c: 2}, {f: "O2", c: 1}], p: [{f: "H2O", c: 2}] },
  { id: "eq_1_2", r: [{f: "Na", c: 2}, {f: "Cl2", c: 1}], p: [{f: "NaCl", c: 2}] },
  { id: "eq_1_3", r: [{f: "N2", c: 1}, {f: "H2", c: 3}], p: [{f: "NH3", c: 2}] },
  { id: "eq_2_1", r: [{f: "CH4", c: 1}, {f: "O2", c: 2}], p: [{f: "CO2", c: 1}, {f: "H2O", c: 2}] },
  { id: "eq_2_2", r: [{f: "Al", c: 4}, {f: "O2", c: 3}], p: [{f: "Al2O3", c: 2}] },
  { id: "eq_2_3", r: [{f: "P4", c: 1}, {f: "O2", c: 5}], p: [{f: "P4O10", c: 1}] }
];

const LevelData_levels = [
  { id: 1, name: "1. Basics (Learn)", mode: "learn", eqs: ["eq_1_1", "eq_1_2", "eq_1_3"] },
  { id: 2, name: "2. Time Challenge", mode: "time", time: 60, eqs: ["eq_1_1", "eq_1_2", "eq_1_3", "eq_2_1", "eq_2_2", "eq_2_3"] },
  { id: 3, name: "3. Endless Survival", mode: "endless", eqs: ["eq_1_1", "eq_1_2", "eq_1_3", "eq_2_1", "eq_2_2", "eq_2_3"] }
];

function LevelData_getEquation(id) {
  return LevelData_equations.find(e => e.id === id);
}