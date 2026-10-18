#!/usr/bin/env python3
"""tools/sents-add.py —— 把逐句草稿合并进 data/sents.json（按课文 label + 段落下标覆盖）
用法：python3 tools/sents-add.py /tmp/batch1.json [/tmp/batch2.json ...]"""
import json,sys,os
base=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','data','sents.json')
db=json.load(open(base,encoding='utf-8')) if os.path.exists(base) else {}
for f in sys.argv[1:]:
    add=json.load(open(f,encoding='utf-8'))
    for label,bypara in add.items():
        db.setdefault(label,{})
        for pi,rows in bypara.items():
            db[label][str(pi)]=rows
    print('merging',f,'->',sum(len(v) for v in add.values()),'段')
json.dump(db,open(base,'w',encoding='utf-8'),ensure_ascii=False,indent=0)
print('总共',sum(len(v) for v in db.values()),'段 /',len(db),'篇')
