// rain scene with its critters: see _lively.js for how the cast is drawn.
import * as base from "../../../src/fx/weather/rain.js";
import * as frog from "../../../src/fx/critters/frog.js";
import { enrich } from "./_lively.js";

// frogs on the wet ground, out in the rain
export default enrich(base, [
  { mod: frog, x: 78, y: 172, seed: 3 },
  { mod: frog, x: 248, y: 171, seed: 5, speed: 0.85, phase: 1.1 },
]);
