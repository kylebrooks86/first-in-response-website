import importlib.util,json,tempfile,unittest,zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('prepare',Path(__file__).with_name('prepare_device_review.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class DevicePacket(unittest.TestCase):
 def fixture(self,root):
  for name in ['app/page.tsx','app/dashboard.tsx','app/globals.css','lib/photo-storage-archive.ts','app/api/backup/photos/storage/route.ts','dist/server/index.js','dist/server/BUILD_ID','dist/server/wrangler.json']:
   p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('synthetic-only '+name)
 def test_packet_seals_bytes_and_omits_provider_config(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);root=p/'candidate';self.fixture(root);out=p/'review';r=module.prepare({'live':root},out,'synthetic-checkpoint')
   self.assertFalse(r['publicationAuthorized']);self.assertIsNone(r['installableURL']);self.assertFalse(r['physicalDeviceAcceptance'])
   with zipfile.ZipFile(out/r['targets']['live']['archive']) as z:
    self.assertNotIn('build/server/wrangler.json',z.namelist());self.assertEqual(z.read('build/server/index.js'),(root/'dist/server/index.js').read_bytes())
   with self.assertRaises(ValueError):module.prepare({'live':root},out,'synthetic')
 def test_missing_build_or_source_refused(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);root=p/'candidate';self.fixture(root);(root/'app/dashboard.tsx').unlink()
   with self.assertRaises(ValueError):module.prepare({'live':root},p/'out','synthetic')
   self.assertFalse((p/'out').exists());self.assertEqual(list(p.glob('fire-device-review-*')),[])
 def test_records_or_environment_refused(self):
  for name in ['app/.env.local','lib/customer.sqlite','public/backup.zip']:
   with self.subTest(name=name),tempfile.TemporaryDirectory() as d:
    p=Path(d);root=p/'candidate';self.fixture(root);f=root/name;f.parent.mkdir(exist_ok=True,parents=True);f.write_text('synthetic-forbidden')
    with self.assertRaises(ValueError):module.prepare({'live':root},p/'out','synthetic')
    self.assertFalse((p/'out').exists());self.assertEqual(list(p.glob('fire-device-review-*')),[])
 def test_source_symlink_and_fixture_refused(self):
  for link in [False,True]:
   with self.subTest(link=link),tempfile.TemporaryDirectory() as d:
    p=Path(d);root=p/'candidate';self.fixture(root)
    if link:(root/'app/link.ts').symlink_to(root/'app/page.tsx')
    else:(root/'app/api/development/photo-fixture').mkdir(parents=True)
    with self.assertRaises(ValueError):module.prepare({'live':root},p/'out','synthetic')
    self.assertFalse((p/'out').exists());self.assertEqual(list(p.glob('fire-device-review-*')),[])
if __name__=='__main__':unittest.main(verbosity=2)
