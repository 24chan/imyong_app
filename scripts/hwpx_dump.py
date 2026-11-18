import sys, re
import xml.etree.ElementTree as ET
p=sys.argv[1]
root=ET.parse(p).getroot()
def local(t): return t.split('}')[-1]
def text_of(el):
    return ''.join(t.text or '' for t in el.iter() if local(t.tag)=='t').strip()
# walk: print paragraphs outside tables, and tables as rows
def walk(el, depth=0):
    for ch in el:
        tag=local(ch.tag)
        if tag=='tbl':
            print('[TABLE]')
            for tr in ch.iter():
                if local(tr.tag)=='tr':
                    cells=[]
                    for tc in tr:
                        if local(tc.tag)=='tc':
                            span=''
                            for c in tc:
                                if local(c.tag)=='cellSpan':
                                    cs,rs=c.get('colSpan','1'),c.get('rowSpan','1')
                                    if cs!='1' or rs!='1': span=f'{{c{cs}r{rs}}}'
                            cells.append(text_of(tc).replace('\n',' ')+span)
                    print(' | '.join(cells))
            print('[/TABLE]')
        elif tag=='p' and not any(local(x.tag)=='tbl' for x in ch.iter()):
            t=text_of(ch)
            if t: print(t)
        else:
            walk(ch, depth+1)
walk(root)
