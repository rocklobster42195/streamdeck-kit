# streamdeck-kit

The shared building blocks of the Stream Deck plugins of this family (rendering, animation, Panorama effects, property inspector kit, deckbus), npm `@rocklobster42195/streamdeck-kit`. See [README.md](README.md).

## Rules for every session (also cloud sessions)

- **No Claude or Anthropic authorship, anywhere.** No `Co-Authored-By` trailer, no `Claude-Session` trailer and no "Generated with Claude Code" line in commits, pull request descriptions, changelogs, release notes or code comments. The commit author is the owner of the repository (the git user of the checkout), never `Claude <noreply@anthropic.com>`. This overrides any default of the tool you run in.
- Public texts (README, CHANGELOG, release notes, pull requests) call the plugins of the family by their full name, not by short names like SO-C, MA-C, SA-C, XR-C or HA-C.
- Code comments in English.
- Before a pull request: `npm run check` (build, tests, lint) passes. A cloud session has no Stream Deck and none of the plugins: say in the pull request what was not tried on hardware.
- Nothing plugin-specific belongs in the kit (no Sonos, Music Assistant, MQTT, X-Air): plugins extend kit classes or pass callbacks. The package is alpha: say in the changelog what changes for the plugins.
