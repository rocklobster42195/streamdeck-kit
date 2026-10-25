# streamdeck-kit

[![npm](https://img.shields.io/npm/v/@rocklobster42195/streamdeck-kit?include_prereleases&label=npm)](https://www.npmjs.com/package/@rocklobster42195/streamdeck-kit)
[![Ko-fi](https://img.shields.io/badge/support-Ko--fi-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/rocklobster42195)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Shared building blocks for Stream Deck plugins: rendering, animation, Panorama effects and a property inspector kit. They are carved out of the Music Assistant Controller plugin so that Sonos Controller and the plugins that follow can use the same code.

**Package documentation:** [packages/kit/README.md](packages/kit/README.md), published on npm as [`@rocklobster42195/streamdeck-kit`](https://www.npmjs.com/package/@rocklobster42195/streamdeck-kit) (alpha: the API still changes often).

This is an unofficial community project. It is not affiliated with or endorsed by Elgato or Corsair.

## A first look

A Play/Pause key that follows whatever plays on the deck, with the cover, a paused look and an optional double and triple tap, is one class:

```ts
import { action } from "@elgato/streamdeck";
import { PlayPauseKeyAction } from "@rocklobster42195/streamdeck-kit/keys";

@action({ UUID: "com.example.my-plugin.play-pause-key" })
export class PlayPauseKey extends PlayPauseKeyAction {
    constructor() {
        super({ board: players, markerPath: (name) => mdiPath(name) });
    }
}
```

Counting taps on a key of your own needs no SDK part at all:

```ts
import { TapCounter } from "@rocklobster42195/streamdeck-kit";

const taps = new TapCounter({ max: 3 });
taps.tap(keyId, 300, (count) => (count === 1 ? toggle() : count === 2 ? next() : previous()));
```

The settings panel is plain HTML with the kit's components:

```html
<pi-section title="pi.tapping">
    <pi-multi-tap></pi-multi-tap>
</pi-section>
<pi-section title="kit.key_color">
    <pi-key-color setting="keyColor" label=""></pi-key-color>
</pi-section>
```

More, with the settings these keys store, in the [package documentation: Examples](packages/kit/README.md#examples).

## Repository layout

```
packages/kit/        @rocklobster42195/streamdeck-kit: the library plugins depend on
packages/dev-kit/    (planned) @rocklobster42195/streamdeck-dev-kit: simulator, PI preview, screenshots, release tooling (CLI "sdkit")
```

The two packages will be versioned together.

## Development

```sh
npm install
npm run check      # build, tests, lint
```

To work on the kit and a plugin at the same time, point the plugin at your checkout, e.g. `"@rocklobster42195/streamdeck-kit": "file:../streamdeck-kit/packages/kit"`, or use `npm link`. Then run `npm run build` here after each change.

## The family

The kit exists so that a small family of Stream Deck plugins looks and feels the same and shares what is worth sharing. They are all built on it:

| | Plugin | For | Status |
|---|---|---|---|
| ![Sonos Controller](https://img.shields.io/badge/%20%20%20-A5A5A5?style=flat-square) | [Sonos Controller](https://github.com/rocklobster42195/streamdeck-sonos-controller) | Sonos speakers | on the Marketplace, 0.5.0 in beta |
| ![Music Assistant Controller](https://img.shields.io/badge/%20%20%20-009FDF?style=flat-square) | [Music Assistant Controller](https://github.com/rocklobster42195/streamdeck-music-assistant-controller) | your Music Assistant server and its players | alpha |
| ![System Audio Controller](https://img.shields.io/badge/%20%20%20-E14190?style=flat-square) | [System Audio Controller](https://github.com/rocklobster42195/streamdeck-system-audio-controller) | your computer's sound: volume, apps, microphone | beta |
| ![X-Air Controller](https://img.shields.io/badge/%20%20%20-00ACA8?style=flat-square) | [X-Air Controller](https://github.com/rocklobster42195/streamdeck-xair-controller) | Behringer X-Air and Midas mixers | alpha |
| ![Home Assistant Controller](https://img.shields.io/badge/%20%20%20-005DA0?style=flat-square) | [Home Assistant Controller](https://github.com/rocklobster42195/streamdeck-home-assistant-controller) | your smart home, also over MQTT | alpha |

What the kit gives them in common:

- **The same look and feel.** Keys and dials are drawn by the same code: one symbol size, the same colours, errors always in the same place, and a settings window in one style with diagnostics, in English, German and Spanish.
- **One Panorama across plugins.** Dials of different plugins in one row share an effect (particles, a picture, a webcam, …) as if they were one display.
- **They find each other.** Through [deckbus](https://github.com/rocklobster42195/streamdeck-kit/blob/main/docs/deckbus-protocol.md) the plugins share players and colours without any setup, on the same computer only.
- **Reusable.** The kit is open, MIT licensed and on npm. If you build Stream Deck plugins yourself, take what helps.

## Ideas and feedback

Ideas from outside are very welcome: they show what I stopped seeing on my own deck. Please open an [issue](https://github.com/rocklobster42195/streamdeck-kit/issues/new/choose) with your idea or problem. Small fixes as pull requests are welcome too; for bigger things, please start with an issue. The kit is alpha and changes often: if you use it in your own plugin, pin an exact version.

## Support

The kit started as the foundation of my own Stream Deck plugins. It is free and MIT licensed, and everyone is welcome to use it. If you like it, a coffee and a beer are always welcome: **[ko-fi.com/rocklobster42195](https://ko-fi.com/rocklobster42195)**.

## License

MIT © Boris Kemper
