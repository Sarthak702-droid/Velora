from PIL import Image
from pathlib import Path
root=Path('apps/web/public/photos')
base=Path('/home/sarthaktripathy/Downloads')
home=Image.open(base/'ChatGPT Image Oct 3, 2026, 11_45_09 AM-1.png')
book=Image.open(base/'ChatGPT Image Oct 3, 2026, 11_45_13 AM-3.png')
brand=Image.open(base/'ChatGPT Image Oct 3, 2026, 11_33_03 AM.png')
assets={'salon':(home,(605,73,1448,441)),'hair':(home,(394,537,619,636)),'grooming':(home,(647,537,872,636)),'beauty':(home,(902,537,1126,636)),'spa':(home,(1155,537,1380,636)),'ava':(home,(403,740,511,887)),'rohan':(home,(636,740,744,887)),'elena':(home,(869,740,976,887)),'hair-spa':(book,(535,398,725,496)),'facial':(book,(756,398,948,496)),'salon-tall':(brand,(971,679,1243,1031))}
for name,(img,box) in assets.items():img.crop(box).save(root/(name+'.webp'),quality=95)
