import importlib.util,json,tempfile,unittest,zipfile,subprocess,sys
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
 def test_root_directory_and_config_symlinks_refused(self):
  for location in ['root','dist','public','package.json']:
   with self.subTest(location=location),tempfile.TemporaryDirectory() as d:
    p=Path(d);root=p/'candidate';self.fixture(root)
    if location=='root':
     link=p/'linked';link.symlink_to(root,target_is_directory=True);root=link
    elif location=='dist':
     original=root/'dist';original.rename(root/'saved-dist');original.symlink_to(root/'saved-dist',target_is_directory=True)
    elif location=='public':(root/'public').symlink_to(root/'app',target_is_directory=True)
    else:(root/'package.json').symlink_to(root/'app/page.tsx')
    with self.assertRaises(ValueError):module.prepare({'live':root},p/'out','synthetic')
    self.assertFalse((p/'out').exists());self.assertEqual(list(p.glob('fire-device-review-*')),[])
 def test_single_candidate_cli_and_invalid_mode_guards(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);root=p/'candidate';self.fixture(root)
   command=[sys.executable,str(Path(__file__).with_name('prepare_device_review.py'))]
   result=subprocess.run(command+['--target','doomsday','--candidate',str(root),'--output',str(p/'review'),'--checkpoint','synthetic-ci-commit'],capture_output=True,text=True)
   self.assertEqual(result.returncode,0,result.stderr)
   receipt=json.loads((p/'review/DEVICE_REVIEW_RECEIPT.json').read_text())
   self.assertEqual(list(receipt['targets']),['doomsday']);self.assertIsNone(receipt['installableURL'])
   self.assertEqual(receipt['baseCheckpoint'],'synthetic-ci-commit')
   for args in [['--target','live'],['--candidate',str(root)],['--live',str(root)],['--target','live','--candidate',str(root),'--live',str(root)]]:
    rejected=subprocess.run(command+args+['--output',str(p/'rejected'),'--checkpoint','synthetic'],capture_output=True,text=True)
    self.assertNotEqual(rejected.returncode,0);self.assertFalse((p/'rejected').exists())
if __name__=='__main__':unittest.main(verbosity=2)
