"""Compile the curated vocabulary and retain its frequency-list provenance."""
from pathlib import Path
from collections import Counter
import json, re, hashlib
ROOT=Path(__file__).resolve().parents[1]
sources=[ROOT/'content/vocabulary.tsv',*sorted((ROOT/'content/sections').glob('*.tsv'))]
frequency={}
for rank,line in enumerate((ROOT/'content/sources/es_50k.txt').read_text().splitlines(),1):
    word,count=line.rsplit(' ',1); frequency[word]=(rank,int(count))
groups=[]; group=None
for source in sources:
    for raw in source.read_text().splitlines():
        if raw.startswith('#'):
            id,title,pos=raw[1:].split('|')
            group={'id':id,'title':title,'partOfSpeech':pos,'words':[]};groups.append(group)
        elif raw.strip():
            word,translation,prompt=[s.strip() for s in raw.split('|')]
            lemma=re.sub(r'^(el|la|los|las) ','',word)
            rank,count=frequency.get(lemma,(None,None))
            i=len(group['words'])
            group['words'].append({'id':f'es-{group["id"]}-{i+1:02d}','word':word,'translation':translation,
                'prompt':prompt,'group':group['id'],'row':i//5,'column':i%5,
                'partOfSpeech':group['partOfSpeech'],'frequencyRank':rank,'corpusOccurrences':count})
assert len(groups)==60,len(groups)
for group in groups: assert len(group['words'])==25,(group['id'],len(group['words']))
words=[w for g in groups for w in g['words']]
duplicates=[w for w,n in Counter(w['word'].casefold() for w in words).items() if n>1]
if duplicates: raise ValueError(f'Duplicate written words: {duplicates}')
assert len(words)==1500
result={'version':1,'language':'es','title':'Spanisch – 1500 Bildvokabeln','source':{
    'url':'https://github.com/hermitdave/FrequencyWords/blob/master/content/2018/es/es_50k.txt',
    'license':'CC BY-SA 4.0','author':'Hermit Dave; OpenSubtitles2018 / OPUS',
    'accessed':'2026-10-20','sha256':hashlib.sha256((ROOT/'content/sources/es_50k.txt').read_bytes()).hexdigest(),
    'method':'Manually curated, pictureable vocabulary checked against the frequency list; not the top 1500 tokens. German glosses and image briefs authored for this project.'},
    'groups':groups,'words':words}
(ROOT/'content/catalog.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print('Entries:',len(words),'Parts of speech:',dict(Counter(w['partOfSpeech'] for w in words)))
print('Exact lemma matches in frequency list:',sum(w['frequencyRank'] is not None for w in words))
