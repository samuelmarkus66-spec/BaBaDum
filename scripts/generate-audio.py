"""Generate local Spanish neural speech; no runtime API or credentials required."""
from pathlib import Path
import argparse, json, os, hashlib, subprocess, time
import numpy as np
import onnxruntime as ort
from kokoro_onnx import Kokoro
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--shard',type=int,default=0)
parser.add_argument('--shards',type=int,default=1)
parser.add_argument('--limit',type=int,default=0)
args=parser.parse_args()
words=[(word['id'],word['word']) for word in json.loads((ROOT/'content/catalog.json').read_text())['words']]
words=words[args.shard::args.shards]
if args.limit: words=words[:args.limit]
model=ROOT/'local-tools/kokoro/kokoro-v1.0.onnx'
voices=ROOT/'local-tools/kokoro/voices-v1.0.bin'
ort.disable_telemetry_events()
options=ort.SessionOptions(); options.intra_op_num_threads=2; options.inter_op_num_threads=1
session=ort.InferenceSession(str(model),sess_options=options,providers=['CPUExecutionProvider'])
k=Kokoro.from_session(session,str(voices))
output=ROOT/'public/content/spanish-1500/audio'; output.mkdir(parents=True,exist_ok=True)
cache=ROOT/'local-tools/audio-cache'; cache.mkdir(parents=True,exist_ok=True)
report=[]
for index,(id,text) in enumerate(words):
    path=output/f'{id}.ogg'; sidecar=cache/f'{id}.json'
    fingerprint=hashlib.sha256((text+'|kokoro-1.0|ef_dora|es|0.9').encode()).hexdigest()
    if path.exists() and sidecar.exists() and json.loads(sidecar.read_text()).get('fingerprint')==fingerprint:
        report.append(json.loads(sidecar.read_text())); continue
    samples,rate=k.create(text+'.',voice='ef_dora',speed=0.9,lang='es')
    rms=float(np.sqrt(np.mean(samples**2)))
    if not np.isfinite(samples).all() or len(samples)<rate*0.25 or rms<0.001:
        raise RuntimeError(f'Invalid audio: {id}, {text}')
    wav=cache/f'{id}.wav'; sf.write(str(wav),samples,rate,subtype='PCM_16')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-c:a','libopus','-b:a','48k',
                    '-metadata',f'title={text}','-metadata','comment=Synthetic Spanish speech: Kokoro-82M ef_dora',str(path)],check=True)
    info={'id':id,'text':text,'voice':'ef_dora','language':'es','synthetic':True,'duration':len(samples)/rate,
          'sampleRate':rate,'rms':rms,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'fingerprint':fingerprint}
    sidecar.write_text(json.dumps(info,ensure_ascii=False)); report.append(info); wav.unlink()
    if index%25==0: print(f'Audio shard {args.shard}: {index+1}/{len(words)} {text}',flush=True)
(ROOT/f'content/audio-report-{args.shard}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(f'Finished {len(report)} recordings.',flush=True)
