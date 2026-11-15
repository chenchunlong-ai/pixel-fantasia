// waterfall scene with its critters: see _lively.js for how the cast is drawn.
import * as base from "../fx/waterfall.js";
import * as butterfly from "../../../src/fx/critters/butterfly.js";
import { enrich } from "./_lively.js";

// butterflies fluttering around the falls (full size, as they were originally)
export default enrich(base, [
  { mod: butterfly, x: 64, y: 118, seed: 2, speed: 0.9 },
  { mod: butterfly, x: 256, y: 84, seed: 6, speed: 0.8, phase: 1.4 },
]);
