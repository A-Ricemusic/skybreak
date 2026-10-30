"""Cutscene desk prop wiring guard: exact approved exports and their uploaded IDs. No Studio, network or uploads."""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
ASSETS = {
    'cinematic-radio-console': ('CinematicRadioConsole', 107763051422036),
    'cinematic-field-recorder': ('CinematicFieldRecorder', 87111261775563),
    'cinematic-status-board': ('CinematicStatusBoard', 105938775214679),
    'cinematic-tape-tin': ('CinematicTapeTin', 86951943477271),
}


class CinematicPropWiring(unittest.TestCase):
    def test_ids_point_at_the_exact_approved_exports(self):
        ids = (ROOT / 'src/shared/RobloxAssetIds.ts').read_text()
        manifest = {a['folder']: a for a in json.loads((ROOT / 'assets/roblox-upload/manifest.json').read_text())['assets']}
        for folder, (key, asset_id) in ASSETS.items():
            with self.subTest(folder=folder):
                approval = json.loads((ROOT / f'docs/qa/asset-reviews/approvals/{folder}.json').read_text())
                self.assertTrue(approval['approved'])
                self.assertEqual(approval['score'], '10/10')
                self.assertIn(f'{key}: {asset_id},', ids)
                self.assertEqual(manifest[folder]['robloxAssetIdsKey'], key)
                folder_path = ROOT / 'assets/roblox-upload' / folder
                for name, digest in {**approval['uploadSet'], **approval['embeddedTextures']}.items():
                    self.assertEqual(hashlib.sha256((folder_path / name).read_bytes()).hexdigest(), digest, name)
                self.assertEqual(hashlib.sha256((folder_path / 'checklist.json').read_bytes()).hexdigest(), approval['checklistSha256'])

    def test_live_missions_do_not_consume_cutscene_props(self):
        paths = [p for p in (ROOT / 'src/shared/missions').glob('*.ts')] + [ROOT / 'src/server/M01World.ts']
        for path in paths:
            source = path.read_text()
            for key, _ in ASSETS.values():
                self.assertNotIn(key, source, str(path))


if __name__ == '__main__':
    unittest.main()
