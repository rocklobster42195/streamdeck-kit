// Generic, device-agnostic PI components: light DOM custom elements bound to Stream Deck settings.
// One file per component.
//
//   <pi-section title="pi.display">…children…</pi-section>
//   <pi-toggle setting="showProgress" label="pi.show_progress" hint="pi.show_progress_hint" [data-default="true"]></pi-toggle>
//   <pi-field setting="maUrl" global label="pi.server_url" placeholder="pi.server_url_placeholder" hint="…"></pi-field>
//   <pi-field setting="maToken" global type="password" label="pi.token"></pi-field>
//   <pi-select setting="source" source="player-sources" with="player"></pi-select>   (list from the plugin)
//   <pi-icon-picker setting="icon" default-icon="mdiBullhorn"></pi-icon-picker>
//   <pi-thresholds setting="thresholds" base-setting="color" unit="°C" min-setting="min" max-setting="max"></pi-thresholds>
//
// Attribute values for label/hint/placeholder/title are i18n keys (literal text works as fallback).
import { PiChoice } from './choice.js';
import { PiColor } from './color.js';
import { PiField } from './field.js';
import { PiIconPicker } from './icon-picker.js';
import { PiRange } from './range.js';
import { PiSection } from './section.js';
import { PiSelect } from './select.js';
import { PiThresholds } from './thresholds.js';
import { PiToggle } from './toggle.js';

export { PiChoice, type PiChoiceOption } from './choice.js';
export { PiColor } from './color.js';
export { PiField } from './field.js';
export { PiIconPicker } from './icon-picker.js';
export { PiRange } from './range.js';
export { PiSection } from './section.js';
export { PiSelect, refreshPiSelects, registerSelectParams, reloadPiSelects } from './select.js';
export { PiThresholds, type Threshold } from './thresholds.js';
export { PiToggle } from './toggle.js';
export { initConditionalVisibility } from './visibility.js';

export function definePiComponents(): void {
    if (!customElements.get('pi-section')) customElements.define('pi-section', PiSection);
    if (!customElements.get('pi-toggle')) customElements.define('pi-toggle', PiToggle);
    if (!customElements.get('pi-field')) customElements.define('pi-field', PiField);
    if (!customElements.get('pi-choice')) customElements.define('pi-choice', PiChoice);
    if (!customElements.get('pi-range')) customElements.define('pi-range', PiRange);
    if (!customElements.get('pi-color')) customElements.define('pi-color', PiColor);
    if (!customElements.get('pi-select')) customElements.define('pi-select', PiSelect);
    if (!customElements.get('pi-icon-picker')) customElements.define('pi-icon-picker', PiIconPicker);
    if (!customElements.get('pi-thresholds')) customElements.define('pi-thresholds', PiThresholds);
}
