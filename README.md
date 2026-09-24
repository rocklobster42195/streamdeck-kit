# streamdeck-core

Stream Deck building blocks that do not depend on any particular device. They are shared by **MAC** and **[Sonos Controller](https://github.com/rocklobster42195/streamdeck-sonos-controller)**.

## Property inspector kit (`streamdeck-core/pi`)

This is a framework-free replacement for sdpi-components. It uses light DOM, so the theme can style everything.

- `sd`: the Stream Deck PI socket client. It handles action settings and global settings, `sendToPlugin`, `openUrl`, and messages from the plugin.
- `t()` / `translateDom()`: PI i18n based on `window.PI_LOCALES`, which the plugin build generates from its `<lang>.json` files.
- Components:
  - `<pi-section title="…">`: a section title plus a card
  - `<pi-toggle setting="…" [global] label="…" hint="…">`: a switch bound to a setting
  - `<pi-field setting="…" [global] [type="password"] label="…" placeholder="…" hint="…">`: a text field that saves on change
- `styles/pi-theme.css`: design tokens (`--pi-*`) and styles for cards, rows, switches, fields, buttons, status dots and custom selects

Reference design: https://claude.ai/artifact/GXxM839hLsUPztGs5Rfugz

## Roadmap

1. **Now:** the PI kit and theme
2. **Next:** panorama/ambient effects and rendering helpers (cover art, marquee, progress bar, volume pie, fonts/icons), plus the cover art cache, all extracted from Sonos Controller
3. **After the MAC MVP:** a shared player abstraction for actions

Sync rule: a change here is a change for both plugins. Check whether Sonos Controller needs it too.
