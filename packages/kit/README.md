# @rocklobster42195/streamdeck-kit

Building blocks for [Elgato Stream Deck](https://www.elgato.com/stream-deck) plugins written against the official [`@elgato/streamdeck`](https://www.npmjs.com/package/@elgato/streamdeck) SDK:

- **Rendering helpers** for keys and Stream Deck + touch strips: exact Arial text widths, truncation and wrapping by measured width, a marquee, a title fader and a PNG encoder.
- **Animation:** a shared frame ticker that runs only while something moves, plus eased values.
- **Panorama effects:** animated backgrounds that span several neighbouring dials.
- **A property inspector kit:** a framework-free replacement for `sdpi-components`, with a Stream Deck socket client, i18n, light-DOM components and a dark theme.

It is used by [MA-C (Music Assistant Controller)](https://github.com/rocklobster42195/streamdeck-music-assistant-controller) and will be used by [Sonos Controller](https://github.com/rocklobster42195/streamdeck-sonos-controller) and the plugins that follow them.

> **Status: early (0.x).** The API follows what these plugins need and may still change between minor versions.

This is an unofficial community package. It is not affiliated with or endorsed by Elgato or Corsair.

## Install

```sh
npm install @rocklobster42195/streamdeck-kit
```

Node 20 or later (the Stream Deck plugin runtime). The package is ESM only.

## Entry points

| Import | Runs in | Contents |
|---|---|---|
| `@rocklobster42195/streamdeck-kit` | Plugin (Node) | Rendering helpers, animation, Panorama effects. Safe to import in the plugin backend. |
| `@rocklobster42195/streamdeck-kit/pi` | Property inspector (browser) | Socket client, i18n, components. Bundle it into your PI script (e.g. with Rollup). |
| `@rocklobster42195/streamdeck-kit/styles/pi-theme.css` | Property inspector | The theme. Copy it next to your PI pages at build time. |

## Rendering and animation

```ts
import { FrameTicker, MARQUEE_TICK_MS, truncateToWidth, wrapToWidth } from "@rocklobster42195/streamdeck-kit";

const frames = new FrameTicker(MARQUEE_TICK_MS); // one ticker for all animations of the plugin
const title = truncateToWidth("A rather long track title", 13, 180);
const lines = wrapToWidth("Two lines that fit the touch strip", 13, 180, 2);
```

- `measureArialWidth`, `truncateToWidth`, `wrapToWidth`, `balanceLines`: real Arial (regular and bold) glyph widths, because Stream Deck renders SVG text in Arial reliably.
- `marqueeSvg`, `marqueeNeeded`, `marqueeOffset`: time-based scrolling text.
- `TitleFader`: a title band that fades in, scrolls and fades out.
- `AnimatedValue`, `FrameTicker`: eased values and a frame loop that stops when nothing moves.
- `encodePngDataUri`: raw RGBA into a PNG data URI, for raster images that must be built synchronously.

## Panorama effects

A Panorama effect is one animated picture that spans several dials of a Stream Deck +. Each dial renders its own slice, and all dials move in sync.

- `PanoramaEngine` runs the effects, and `PanoramaOrchestrator` groups neighbouring dials.
- `effectRegistry`, `listEffects()` and `withEffectDefaults()` cover the built-in effects: particles, matrix rain, boing ball, boing globe and blank.
- `EffectDefinition` is the interface for writing your own effect.

## Property inspector kit

```ts
import { definePiComponents, initConditionalVisibility, sd, translateDom } from "@rocklobster42195/streamdeck-kit/pi";

sd.onReady(() => {
    translateDom();
    definePiComponents();
    initConditionalVisibility();
});
```

```html
<pi-section title="pi.display">
    <pi-toggle setting="showProgress" label="pi.show_progress" hint="pi.show_progress_hint"></pi-toggle>
    <pi-range setting="preset" min="0" max="100" step="1" default="20" label="pi.preset" unit="%"></pi-range>
    <pi-color setting="color" default="#87AE73" label="pi.color"></pi-color>
    <pi-field setting="serverUrl" global label="pi.server_url" placeholder="pi.server_url_placeholder"></pi-field>
    <div data-show-when="command=up,down">Shown only for these commands</div>
</pi-section>
```

- `sd`: the PI socket client. It covers action settings and global settings (`setSetting`, `setGlobalSetting`), `sendToPlugin`, `onMessage` and `openUrl`.
- Components:
  - `<pi-section>`: a titled card
  - `<pi-toggle>`: a switch
  - `<pi-field>`: a text or password field
  - `<pi-range>`: a slider
  - `<pi-choice>`: tiles for choosing one option
  - `<pi-color>`: a color picker

  Add `global` to bind a component to global settings instead of the action's settings.
- `data-show-when="setting=a,b"` shows an element only for those values. Prefix the key with `global:` to check a global setting.
- `t(key, vars)` and `translateDom()` handle i18n. Components treat `label`, `hint` and `placeholder` as translation keys. Translations come from `window.PI_LOCALES` (`{ en: {...}, de: {...} }`), which your build generates from the `Localization` blocks of your plugin's `<lang>.json` files. Nested groups work the same way as in the plugin SDK: `pi.player` looks up `Localization.pi.player`.
- The kit itself needs one key in your locale files: `pi.show_token`, the label of the password field's show button.

## License

MIT © Boris Kemper
