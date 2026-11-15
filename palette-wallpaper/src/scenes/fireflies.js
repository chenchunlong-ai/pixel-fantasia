// fireflies scene with its critters: see _lively.js for how the cast is drawn.
import * as base from "../../../src/fx/weather/fireflies.js";
import * as frog from "../../../src/fx/critters/frog.js";
import { enrich } from "./_lively.js";

// a frog hunting fireflies on a summer night
export default enrich(base, [
  { mod: frog, x: 236, y: 172, seed: 4, speed: 0.9 },
]);
