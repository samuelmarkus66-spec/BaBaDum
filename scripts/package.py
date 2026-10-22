"""Package the tested build and source separately, without local tools or models."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT.parent
pack = json.loads((ROOT / 'dist/content/spanish-1500/manifest.json').read_text())
assert len(pack['vocabulary']) == 1500
checksums = json.loads((ROOT / 'dist/content/spanish-1500/checksums.json').read_text())
for path, digest in checksums.items():
    data = (ROOT / 'dist/content/spanish-1500' / path).read_bytes()
    assert hashlib.sha256(data).hexdigest() == digest, path

def files_under(directory):
    return [p for p in (ROOT / directory).rglob('*') if p.is_file()]

common = [ROOT / p for p in ['README.md', 'Start-Windows.cmd', 'THIRD_PARTY_NOTICES.txt', 'package.json']]
provenance = [p for p in files_under('content') if p.name != 'es_50k.txt']
runtime = common + files_under('dist') + [ROOT / 'scripts/serve.mjs'] + provenance + files_under('docs')
source = [p for p in ROOT.iterdir() if p.is_file() and not p.name.endswith(('.log', '.tsbuildinfo')) and not p.name.startswith('.env')]
for directory in ['src', 'tests', 'scripts', 'public', 'docs']:
    source += files_under(directory)
source += provenance

for filename, files in [('BaBaDum-Spanisch-1500.zip', runtime), ('BaBaDum-Quellcode.zip', source)]:
    destination = OUTPUT / filename
    with ZipFile(destination, 'w', ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(set(files)):
            if '__pycache__' in path.parts: continue
            archive.write(path, Path('BaBaDum') / path.relative_to(ROOT))
    with ZipFile(destination) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        assert len([n for n in names if '/audio/' in n and n.endswith('.ogg')]) == 1500
        assert len([n for n in names if '/atlases/' in n and n.endswith('.png')]) == 60
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    destination.with_suffix('.zip.sha256').write_text(f'{digest}  {destination.name}\n')
    print(f'{destination}: {destination.stat().st_size / 1024**2:.1f} MiB, archive integrity verified')
