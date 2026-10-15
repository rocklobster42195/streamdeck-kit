# streamdeck-kit

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

## License

MIT © Boris Kemper
