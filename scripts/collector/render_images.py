"""공고 첨부 PDF 앞쪽 몇 쪽을 그림(JPG)으로 → 앱 '임용 소식'에서 바로 보기
사용: python render_images.py <raw 폴더>   (이미 만든 그림은 건너뜀)
결과: raw/<지역>/img/<sha1>_p1.jpg ...
"""
import glob
import json
import os
import subprocess
import sys

PAGES = 3


def main(raw):
    made = 0
    for mf in sorted(glob.glob(os.path.join(raw, '*', 'manifest.json'))):
        region_dir = os.path.dirname(mf)
        img_dir = os.path.join(region_dir, 'img')
        os.makedirs(img_dir, exist_ok=True)
        for m in json.load(open(mf)):
            if m['path'].endswith('.pdf'):
                src = os.path.join(raw, m['path'])
            elif m['path'].lower().endswith(('.hwp', '.hwpx')):  # docs_to_pdf.py가 만든 PDF
                src = os.path.join(region_dir, 'pdf', m['sha1'] + '.pdf')
            else:
                continue
            out = os.path.join(img_dir, m['sha1'])
            if glob.glob(out + '_p*.jpg') or not os.path.exists(src):
                continue
            try:
                subprocess.run(['pdftoppm', '-jpeg', '-jpegopt', 'quality=70', '-r', '80', '-f', '1', '-l', str(PAGES),
                                src, out + '_p'], check=True, timeout=120, capture_output=True)
                made += 1
            except Exception as e:  # noqa: BLE001
                print('그림 실패', m['path'], e)
    print('그림 만든 PDF', made)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'raw')
