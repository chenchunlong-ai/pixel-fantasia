// clouds scene with its critters: see _lively.js for how the cast is drawn.
import * as base from "../../../src/fx/weather/clouds.js";
import * as bird from "../../../src/fx/critters/bird.js";
import { enrich } from "./_lively.js";

// birds riding the wind between the clouds
export default enrich(base, [
  { mod: bird, x: 246, y: 58, seed: 2 },
  { mod: bird, x: 66, y: 96, seed: 8, speed: 0.75, phase: 1.6 },
]);
