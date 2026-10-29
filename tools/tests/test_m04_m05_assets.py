"""Dormant asset wiring guard: no Studio, network, or uploads."""
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
ASSETS = {
    'heavy-transport': ('HeavyTransport', 135095912449793, 'b6ec50634826a176b57de4c7a84208fe0e3931d783a589fd8cd01f505ee06408'),
    'radar-jammer': ('RadarJammer', 80069408823339, '83d228d5fb081fbb00d8620aca9d4034e511739d2c9bddf6560da172af59b556'),
    'fuel-tanker': ('FuelTanker', 83861380699092, '2a7797171ed3d9e0889ba292faa87189b44ff9862a2d011f56e0f8dff0d3f965'),
    'attack-helicopter': ('AttackHelicopter', 80747426523090, 'd31e015e7959c55ec534d48454e27cbb668d87ec6a3f6bf111edb9acdb74dd29'),
    'vanta-v2-elite': ('VantaV2Elite', 139083376207373, '2fdcf40547df8f11dfd13d15b6b08535c87add64a6db5363c79da3dc2a2b8ada'),
}

class DormantAssetWiring(unittest.TestCase):
    def test_registered_exact_approved_exports(self):
        manifest = json.loads((ROOT / 'assets/roblox-upload/manifest.json').read_text())
        entries = {a['folder']: a for a in manifest['assets']}
        ids = (ROOT / 'src/shared/RobloxAssetIds.ts').read_text()
        for folder, (key, asset_id, digest) in ASSETS.items():
            with self.subTest(folder=folder):
                self.assertIn(f'{key}: {asset_id},', ids)
                self.assertEqual(entries[folder]['robloxAssetIdsKey'], key)
                self.assertEqual(hashlib.sha256((ROOT / f'assets/roblox-upload/{folder}/{folder}.fbx').read_bytes()).hexdigest(), digest)
                self.assertEqual(entries[folder]['gameSizeStuds'], entries[folder]['robloxSizeStuds'])

    def test_elite_in_generator_livery_sets(self):
        spec = importlib.util.spec_from_file_location('manifest_writer', ROOT / 'tools/assets/write_manifest.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertEqual(module.PROCEDURAL['vanta-v2-elite'], 'vanta')
        self.assertIn('vanta-v2-elite', module.V2_AIRCRAFT)

    def test_no_m01_practice_consumers_or_preloads(self):
        # Later mission integration may opt in; live practice/M01 stay frozen.
        paths = [ROOT / f'src/shared/missions/{name}.ts' for name in ('m01', 'practice')]
        paths += list((ROOT / 'src/shared').glob('M01*.ts'))
        paths += [ROOT / 'src/server/M01World.ts']
        for path in paths:
            source = path.read_text()
            for folder, (key, asset_id, _) in ASSETS.items():
                with self.subTest(path=str(path.relative_to(ROOT)), asset=folder):
                    for token in (key, str(asset_id), folder):
                        self.assertNotIn(token, source)
