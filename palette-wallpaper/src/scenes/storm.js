// storm scene with its critters: see _lively.js for how the cast is drawn.
import * as base from "../../../src/fx/weather/storm.js";
import * as bat from "../../../src/fx/critters/bat.js";
import { enrich } from "./_lively.js";

// bats out in the lightning, low against the sky
export default enrich(base, [
  { mod: bat, x: 64, y: 44, seed: 2 },
  { mod: bat, x: 258, y: 66, seed: 6, speed: 0.8, phase: 0.9 },
]);
