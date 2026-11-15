// sandstorm scene with its critter: see _lively.js for how the cast is drawn. The base is our
// reworked sandstorm (src/fx/sandstorm.js, the tornado framework with no funnel).
import * as base from "../fx/sandstorm.js";
import * as snake from "../../../src/fx/critters/snake.js";
import { enrich } from "./_lively.js";

// a snake hunkered down, slithering through the dust
export default enrich(base, [
  { mod: snake, x: 208, y: 170, seed: 4, speed: 0.8 },
]);
