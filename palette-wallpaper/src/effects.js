// The scenes this build can show, by id. One place, so the wallpaper and the settings page agree.
// The core weather scenes come from the pixelfx engine; nine of them are wrapped with critters
// (src/scenes/, see _lively.js); sandstorm and rift are our reworked copies; the rest are ours.

import snow from "./scenes/snow.js";
import rain from "./scenes/rain.js";
import storm from "./scenes/storm.js";
import * as blizzard from "../../src/fx/weather/blizzard.js";
import sandstorm from "./scenes/sandstorm.js";
import * as undersea from "../../src/fx/weather/undersea.js";
import * as hail from "../../src/fx/weather/hail.js";
import clouds from "./scenes/clouds.js";
import fog from "./scenes/fog.js";
import * as aurora from "../../src/fx/weather/aurora.js";
import fireflies from "./scenes/fireflies.js";
import * as shootingStars from "../../src/fx/weather/shooting-stars.js";

import * as blackHoleBase from "../../src/fx/weather/black-hole.js";
import * as gargantuaBase from "../../src/fx/weather/gargantua.js";
import { slow } from "./slow.js";

// both black holes spin 70% slower than the engine default (user preference)
const blackHole = slow(blackHoleBase, 0.3);
const gargantua = slow(gargantuaBase, 0.3);
import * as rift from "./fx/rift.js";
import * as otherworld from "./fx/otherworld-rift.js";
import * as gorgefall from "./fx/gorgefall.js";
import * as heaven from "./fx/heaven.js";
import * as savanna from "../../src/fx/weather/savanna-night.js";
import waterfall from "./scenes/waterfall.js";

// three tornado wallpapers + the sandstorm: our copies built on the engine's cyclone core
// (./fx/_tornado.js, cloud decks lifted, funnel optional), with particle swarms round the funnel
import * as fireTornado from "./fx/fire-tornado.js";
import * as blizzardVortex from "./fx/blizzard-vortex.js";
import * as tornado from "./fx/tornado.js";
import * as sandStormScene from "./fx/sandstorm.js";

// two more scene wallpapers (user-supplied files): falling code, and the richer fire tornado
// built on the second tornado function set (./fx/_tornado2.js)
import * as dataStream from "./fx/data-stream.js";

export const FX = {
  // the twelve core weather scenes (the engine's originals, unmodified)
  "weather/snow": snow,
  "weather/rain": rain,
  "weather/storm": storm,
  "weather/blizzard": blizzard,
  "weather/sandstorm": sandstorm,
  "weather/undersea": undersea,
  "weather/hail": hail,
  "weather/clouds": clouds,
  "weather/fog": fog,
  "weather/aurora": aurora,
  "weather/fireflies": fireflies,
  "weather/shooting-stars": shootingStars,
  // ours: made for the first wallpaper
  "weather/black-hole": blackHole,
  "weather/gargantua": gargantua,
  "weather/rift": rift,
  "weather/otherworld-rift": otherworld,
  "palette/gorgefall": gorgefall,
  "palette/heaven": heaven,
  "weather/savanna-night": savanna,
  "palette/waterfall": waterfall,
  // the tornado-framework wallpapers
  "palette/fire-tornado": fireTornado,
  "palette/blizzard-vortex": blizzardVortex,
  "palette/tornado": tornado,
  // user-supplied scenes
  "scifi/data-stream": dataStream,
};
