"""Measure transparent image atlases (without modifying them) and build the local pack."""
from pathlib import Path
import json, hashlib, argparse
from PIL import Image
import numpy as np
from scipy import ndimage
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/content/spanish-1500'
parser=argparse.ArgumentParser();parser.add_argument('--inspect-only',action='store_true');args=parser.parse_args()
catalog=json.loads((ROOT/'content/catalog.json').read_text())
def boundaries(projection, count=5):
    n=len(projection);result=[0]
    for i in range(1,count):
        center=n*i/count; radius=n/count*0.25
        lo=max(result[-1]+1,int(center-radius)); hi=min(n,int(center+radius))
        segment=projection[lo:hi]
        minimum=segment.min()
        candidates=np.flatnonzero(segment<=minimum+0.001*projection.max())+lo
        result.append(int(min(candidates,key=lambda value:abs(value-center))))
    return result+[n]
def measure(path):
    with Image.open(path) as image:
        rgba=np.array(image.convert('RGBA'));h,w=rgba.shape[:2]
    alpha=rgba[:,:,3]>32
    if np.mean(alpha)>0.93: raise ValueError(f'Background is not transparent: {path}')
    rows=boundaries(alpha.sum(axis=1))
    regions=[]
    for row in range(5):
        y0,y1=rows[row:row+2]
        columns=boundaries(alpha[y0:y1].sum(axis=0))
        for column in range(5):
            x0,x1=columns[column:column+2]
            ys,xs=np.nonzero(alpha[y0:y1,x0:x1])
            if len(xs)<150: raise ValueError(f'Empty cell {row},{column}: {path}')
            margin=max(3,int(min(w,h)/5*0.035))
            left=max(x0,x0+int(xs.min())-margin);right=min(x1,x0+int(xs.max())+1+margin)
            top=max(y0,y0+int(ys.min())-margin);bottom=min(y1,y0+int(ys.max())+1+margin)
            boundaryInk=int(alpha[y0:y1,x0].sum()+alpha[y0:y1,x1-1].sum()+alpha[y0,x0:x1].sum()+alpha[y1-1,x0:x1].sum())
            regions.append({'x':left,'y':top,'width':right-left,'height':bottom-top,'sourceWidth':w,'sourceHeight':h,'boundaryInk':boundaryInk})
    # Assign whole connected shapes to their cell; keep tails, limbs and arrows
    # that cross an imperfect generative grid seam. This only measures viewports.
    labels, total = ndimage.label(alpha)
    slices = ndimage.find_objects(labels)
    areas = np.bincount(labels.ravel())
    assigned = [[] for _ in regions]
    for label, box in enumerate(slices, 1):
        if box is None or areas[label] < 12: continue
        yy, xx = box; left,right,top,bottom = xx.start,xx.stop,yy.start,yy.stop
        overlaps=[]
        for region in regions:
            x0=max(left,region['x']);x1=min(right,region['x']+region['width'])
            y0=max(top,region['y']);y1=min(bottom,region['y']+region['height'])
            overlaps.append(max(0,x1-x0)*max(0,y1-y0))
        slot=int(np.argmax(overlaps))
        if max(overlaps)==0: continue
        if right-left>w/5*1.65 or bottom-top>h/5*1.65:
            continue # An accidentally connected adjacent scene must not swallow two cells.
        assigned[slot].append((left,top,right,bottom))
    for index, components in enumerate(assigned):
        if not components: continue
        margin=max(3,int(min(w,h)/5*0.025))
        x0=max(0,min(c[0] for c in components)-margin);y0=max(0,min(c[1] for c in components)-margin)
        x1=min(w,max(c[2] for c in components)+margin);y1=min(h,max(c[3] for c in components)+margin)
        original=regions[index]
        ox,oy=original['x'],original['y'];ox1=ox+original['width'];oy1=oy+original['height']
        # A shape may join the next row. If excluding that component would retain
        # only detached sparkles/arrows, keep the original measured cell instead.
        original_ink=int(alpha[oy:oy1,ox:ox1].sum())
        retained_ink=int(alpha[max(oy,y0):min(oy1,y1),max(ox,x0):min(ox1,x1)].sum())
        if retained_ink < original_ink*0.7: continue
        regions[index].update(x=x0,y=y0,width=x1-x0,height=y1-y0)
    return regions
all_regions={};missing=[]
for group in catalog['groups']:
    file=OUT/'atlases'/f'{group["id"]}.png'
    if not file.exists():missing.append(group['id']);continue
    all_regions[group['id']]=measure(file)
(ROOT/'content/regions.json').write_text(json.dumps(all_regions,indent=2))
print('Measured atlases:',len(all_regions),'Missing:',missing)
if args.inspect_only:raise SystemExit(0)
if missing:raise RuntimeError('Generate all atlases before building the pack')
colors=['#bf8824','#faf082','#d9ddbc','#9ccbd0','#e8a38d','#b9c79a','#edc478','#b4bcda']
# Conservative exclusions for visually or semantically overlapping meanings.
semantic_sets=[
 ['es-06-01','es-06-23'],['es-06-02','es-06-24'],['es-06-03','es-06-22'],['es-06-04','es-06-21'],['es-06-06','es-06-20'],
 ['es-42-15','es-44-07','es-59-18','es-60-14','es-60-15'],
 ['es-43-01','es-43-03','es-43-05','es-60-08'],['es-50-19','es-46-23'],
 ['es-54-01','es-54-10'],['es-54-07','es-54-12','es-54-20'],
 ['es-52-23','es-57-10'],['es-52-24','es-57-08'],['es-42-07','es-41-08'],
 ['es-59-15','es-60-20'],['es-59-10','es-59-23'],['es-60-10','es-60-13'],
 ['es-46-10','es-46-25'],['es-54-16','es-54-19'],['es-44-01','es-44-02'],
 ['es-45-04','es-45-03'],['es-42-03','es-42-01'],['es-49-08','es-41-21'],['es-49-09','es-41-22'],
]
vocabulary=[]
for word in catalog['words']:
    i=int(word['id'].split('-')[-1])-1;group=word['group']
    region=dict(all_regions[group][i]);region.pop('boundaryInk')
    groups=[f'overlap-{j}' for j,ids in enumerate(semantic_sets) if word['id'] in ids]
    # Families, anatomical parts, close animal types and subtle emotional states are not mutual distractors.
    if group in ['06','08','14','35']:groups.append(f'close-meanings-{group}')
    # Physical size comparisons and anatomical parts use explicit highlights rather than labels.
    answerFamily='colors' if group=='53' and i<15 else (f'adjectives-{group}' if word['partOfSpeech']=='adjective' else word['partOfSpeech'])
    vocabulary.append({'id':word['id'],'language':'es','conceptId':word['id'],'word':word['word'],
        'translation':word['translation'],'partOfSpeech':word['partOfSpeech'],'category':next(g['title'] for g in catalog['groups'] if g['id']==group),
        'image':f'atlases/{group}.png','imageRegion':region,'audio':f'audio/{word["id"]}.ogg',
        'background':'#e7e8d4' if answerFamily=='colors' else colors[(int(group)+i)%len(colors)],
        'ambiguityGroups':groups,'answerFamily':answerFamily,'frequencyRank':word['frequencyRank']})
pack={'format':'babadum-local-pack','version':1,'id':'spanish-1500-v1','title':'Spanisch · 1500 Bildvokabeln',
      'source':{'url':catalog['source']['url'],'rights':'Wortschatzauswahl mit Herkunftsnachweis: CC BY-SA 4.0. Eigene, mit OpenAI erzeugte Illustrationen; synthetische spanische Aussprache mit Kokoro-82M (Apache-2.0-Modell).',
                'note':'1000 Nomen, 300 Verben, 200 Adjektive. Eigene Lernsammlung, keine BaBaDum-Originalressourcen.'},
      'languages':[{'id':'es','name':'Español','flag':'🇪🇸'}], 'font':'fonts/LilitaOne-Regular.ttf','vocabulary':vocabulary}
paths=set([pack['font'],*[w[k] for w in vocabulary for k in ['image','audio']]])
checksums={}
for relative in sorted(paths):
    path=OUT/relative
    if not path.is_file() or path.stat().st_size==0:raise RuntimeError(f'Missing asset: {relative}')
    checksums[relative]=hashlib.sha256(path.read_bytes()).hexdigest()
(OUT/'manifest.json').write_text(json.dumps(pack,ensure_ascii=False,separators=(',',':')))
(OUT/'checksums.json').write_text(json.dumps(checksums,indent=2))
print('Pack ready:',len(vocabulary),'words;',len(checksums),'asset files')
