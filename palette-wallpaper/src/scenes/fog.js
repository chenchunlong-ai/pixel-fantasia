// fog scene with its critters: see _lively.js for how the cast is drawn.
import * as base from "../../../src/fx/weather/fog.js";
import * as wisp from "../../../src/fx/critters/wisp.js";
import { enrich } from "./_lively.js";

// a will-o'-the-wisp wandering the fog
export default enrich(base, [
  { mod: wisp, x: 222, y: 170, seed: 3, speed: 0.9 },
]);
