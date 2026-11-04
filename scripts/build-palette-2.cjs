// Generate color-only, opt-in overrides. Palette 1's source CSS stays untouched.
const fs=require('fs');
const postcss=require('postcss');
const scope='html[data-moga-palette="2"]';
const tokens={'--ivory':'#060509','--paper':'#100c18','--ink':'#f4f0ff','--muted':'#b6adc6','--line':'#b99be52b','--panel':'#100c18','--panel-raised':'#191124','--teal':'#bb94ff','--copper':'#b68bff','--coral':'#c39bff','--gold':'#c8a4ff','--accent':'#a970ff','--link':'#c09aff','--highlight':'#caa8ff','--light-accent':'#211333','--background':'#060509','--surface':'#100c18','--surface-warm':'#100c18','--surface-cool':'#15101e','--surface-subtle':'#15101e','--foreground':'#f4f0ff','--body-text':'#d0c6df','--secondary-text':'#bdb2ce','--border':'#b99be52b','--action':'linear-gradient(110deg,#8b44eb,#6932bf)','--gradient-brand':'linear-gradient(110deg,#8b44eb,#6932bf)'};
function recolor(hex,prop){let h=hex.slice(1);if(h.length===3||h.length===4)h=h.split('').map(c=>c+c).join('');const alpha=h.length===8?h.slice(6):'';const rgb=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);const light=(Math.max(...rgb)+Math.min(...rgb))/2;const saturation=Math.max(...rgb)-Math.min(...rgb);let result;
if(/shadow|border|outline/.test(prop))result=light<.15?'55208f':'b99be5';
else if(/color|fill|stroke/.test(prop))result=light>.83?'f4f0ff':saturation>.16?'c19bff':light<.3?'f4f0ff':'b6adc6';
else result=light>.92?'060509':light>.72?'100c18':light>.45?'1c122b':saturation>.15?'251139':'0b0811';
return '#'+result+alpha;}
let output=postcss.root();for(const name of ['art-brand.css','moga-workflow.css']){const root=postcss.parse(fs.readFileSync('app/'+name,'utf8'));root.walkDecls(d=>{if(d.prop.startsWith('--')){d.value=tokens[d.prop]||d.value.replace(/#[\da-f]{3,8}\b/gi,h=>recolor(h,d.prop));return;}if(!/^(color|background(?:-color|-image)?|border(?:-(?:color|top|bottom|left|right)(?:-color)?)?|outline(?:-color)?|box-shadow|text-shadow|fill|stroke|color-scheme)$/.test(d.prop)){d.remove();return;}d.value=d.prop==='color-scheme'?'dark':d.value.replace(/#[\da-f]{3,8}\b/gi,h=>recolor(h,d.prop)).replace(/\bwhite\b/g,d.prop==='color'?'#f4f0ff':'#100c18');});root.walkRules(r=>{if(!r.nodes.length){r.remove();return;}r.selectors=r.selectors.map(s=>scope+' '+s)});root.walkAtRules(a=>{if(a.name.includes('keyframes')||!a.nodes?.length)a.remove()});root.walkComments(c=>c.remove());output.append(root.nodes)}
fs.writeFileSync('app/palette-2.css','/* Midnight Violet. Generated color overrides; see scripts/build-palette-2.cjs. */\n'+output.toString());

fs.appendFileSync('app/palette-2.css','\n'+fs.readFileSync('config/palette-2-accents.css','utf8'));
