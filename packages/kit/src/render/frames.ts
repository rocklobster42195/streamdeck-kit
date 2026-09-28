import { FrameTicker } from "./animation.js";
import { MARQUEE_TICK_MS } from "./marquee.js";

/** One shared ticker for all animations of the plugin (marquees, glides, fades). Runs only while something moves. */
export const frames = new FrameTicker(MARQUEE_TICK_MS);
