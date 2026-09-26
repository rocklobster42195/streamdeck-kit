// No visuals at all. Lets Panorama dials that only show text (title or lyrics on black) still form
// one run across neighbouring displays, which needs a running group. Hidden from effect pickers:
// hosts offer it as "no effect".
import type { EffectDefinition } from '../../types.js';

const blank: EffectDefinition<Record<string, never>> = {
    id: 'blank',
    displayName: 'None',
    hidden: true,
    defaultSettings: {},
    settingsSchema: [],
    createInstance: () => ({
        initPanorama() {},
        tickPanorama() {},
        renderSlice: () => '',
    }),
};

export default blank;
