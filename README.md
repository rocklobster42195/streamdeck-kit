# streamdeck-kit

Shared building blocks for Stream Deck plugins: rendering, animation, Panorama effects and a property inspector kit. They are carved out of [MA-C (Music Assistant Controller)](https://github.com/rocklobster42195/streamdeck-music-assistant-controller) so that Sonos Controller and the plugins that follow can use the same code.

**Package documentation:** [packages/kit/README.md](packages/kit/README.md), published on npm as [`@rocklobster42195/streamdeck-kit`](https://www.npmjs.com/package/@rocklobster42195/streamdeck-kit).

This is an unofficial community project. It is not affiliated with or endorsed by Elgato or Corsair.

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
