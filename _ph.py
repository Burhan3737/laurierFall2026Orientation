import sys
from _probe import probe
S=r"""
var de=D.documentElement;
P('cw='+de.clientWidth+' scrollW='+de.scrollWidth);
var strips=D.querySelectorAll('.navstrip,.jumpbar,.contents,.jump,.strip');
strips.forEach(function(s){var cs=W.getComputedStyle(s);P('strip '+s.className+' ox='+cs.overflowX+' sw='+s.scrollWidth+' cw='+s.clientWidth);});
P('firstEvTop='+(function(){var n=D.querySelector('#board [data-id], #results [data-id], #pages .tick');return n?n.getBoundingClientRect().top.toFixed(0):'?';})());
"""
p=sys.argv[1]
open('_o.txt','w',encoding='utf-8').write(probe('orientation-%s.html'%p, sys.argv[2], S, delay=1800, w=405, h=844, hostw=520, hosth=900, shot="C:/Personal/Laurier/Grad Orientation/_p.png")[:1200])
