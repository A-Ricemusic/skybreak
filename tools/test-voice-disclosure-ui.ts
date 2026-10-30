// Static UI wiring contract complements the compiled Jest session-state tests.
import { strict as assert } from "node:assert";
const settings = await Bun.file("src/client/HudControls.tsx").text();
const ui = await Bun.file("src/client/GameUI.tsx").text();
const voice = await Bun.file("src/client/VoicePlayer.ts").text();
const notice = await Bun.file("src/client/VoiceDisclosureNotice.tsx").text();
assert.match(settings, /key="VoiceDisclosure"[\s\S]*?Text=\{VOICE_DISCLOSURE/);
assert.match(settings, /SETTING_ORDER.size\(\) \* layout.rowHeight \+ 140/);
assert.match(ui, /<VoiceDisclosureNotice \/>/);
assert.match(voice, /disclosureSession.FirstVoice\(os.clock\(\)\)/);
assert.ok(voice.indexOf("disclosureSession.FirstVoice(os.clock())") < voice.indexOf("sound.Play();"));
assert.match(notice, /Text=\{VOICE_DISCLOSURE\}/);
assert.match(notice, /task.delay\(remaining/);
assert.match(notice, /Active=\{false\} Selectable=\{false\}/);
console.log("VOICE_DISCLOSURE_UI passed=8 failed=0");
