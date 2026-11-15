// snow scene with its critters: see _lively.js for how the cast is drawn.
import * as base from "../../../src/fx/weather/snow.js";
import * as bird from "../../../src/fx/critters/bird.js";
import { enrich } from "./_lively.js";

// two winter songbirds holding station in the snowfall
export default enrich(base, [
  { mod: bird, x: 252, y: 52, seed: 2, speed: 0.9 },
  { mod: bird, x: 58, y: 84, seed: 7, speed: 0.7, phase: 1.3 },
]);
