import cv2
import numpy as np
from pathlib import Path
im=cv2.imread('/home/sarthaktripathy/Downloads/ChatGPT Image Oct 3, 2026, 11_33_03 AM.png')
out=Path('apps/web/public/brand')
def paths(mask):
 contours,_=cv2.findContours(mask,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
 ps=[]
 for c in contours:
  if cv2.contourArea(c)<1.2:continue
  pts=cv2.approxPolyDP(c,.32,True).reshape(-1,2)
  ps.append('M'+' L'.join(f'{x},{y}' for x,y in pts)+' Z')
 return ' '.join(ps)
def masks(crop):
 hsv=cv2.cvtColor(crop,cv2.COLOR_BGR2HSV)
 dark=((hsv[:,:,2]<130)&(hsv[:,:,1]<180)).astype('uint8')*255
 gold=((hsv[:,:,1]>45)&(hsv[:,:,2]>95)&(hsv[:,:,0]>9)&(hsv[:,:,0]<35)).astype('uint8')*255
 return dark,gold
crop=im[98:305,58:793];d,g=masks(crop)
def svg(body,w,h):return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img"><title>Velora — Smarter Booking. Smoother Flow.</title><defs><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#E6C994"/><stop offset=".55" stop-color="#C7A56A"/><stop offset="1" stop-color="#986B35"/></linearGradient></defs>{body}</svg>'
for name,color in [('wordmark','#1F1A17'),('wordmark-light','#F6F1E8')]:
 out.joinpath(name+'.svg').write_text(svg(f'<path fill="{color}" fill-rule="evenodd" d="{paths(d)}"/><path fill="url(#gold)" fill-rule="evenodd" d="{paths(g)}"/>',735,207))
_,symbol=masks(im[91:280,849:1127]);p=paths(symbol)
out.joinpath('symbol.svg').write_text(svg(f'<path fill="url(#gold)" fill-rule="evenodd" d="{p}"/>',278,189))
out.joinpath('app-icon.svg').write_text(svg(f'<rect width="320" height="320" rx="64" fill="#1F1A17"/><g transform="translate(24 65)"><path fill="url(#gold)" fill-rule="evenodd" d="{p}"/></g>',320,320))
