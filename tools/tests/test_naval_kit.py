"""Review packet integrity and mobile export contracts; no uploads or credentials."""
import hashlib
import json
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]
class NavalKitTests(unittest.TestCase):
    def test_exact_exports_and_dependencies_remain_pending(self):
        records=json.loads((ROOT/'docs/qa/asset-reviews/naval-kit/pending-exports.json').read_text())
        self.assertEqual(len(records),12)
        for record in records:
            self.assertFalse(record['approved'])
            self.assertIsNone(record['reviewer'])
            self.assertIn('SKYBREAK build agent via tools/assets/naval_kit.py (this PR)',record['creator'])
            for name,digest in record['sha256'].items():
                self.assertEqual(hashlib.sha256((ROOT/name).read_bytes()).hexdigest(),digest,name)
    def test_mobile_mesh_and_atlas_budgets(self):
        folders=list((ROOT/'assets/roblox-upload').glob('naval-*/checklist.json'))
        self.assertEqual(len(folders),12)
        for path in folders:
            c=json.loads(path.read_text())
            self.assertLessEqual(c['triangleCount'],2400)
            self.assertEqual(len(c['objects']),1)
            self.assertEqual(len(c['textures']),4)
            for t in c['textures']:
                self.assertEqual((t['width'],t['height']),(256,256))
            for view in ['front','back','side','side-right','top','bottom','3q','3q-rear-left','3q-rear-right']:
                self.assertIn('preview-'+view+'.png',c['previews'])
