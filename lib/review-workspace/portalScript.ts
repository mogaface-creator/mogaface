/** No network calls: the complete report, assets and navigation travel together. */
export const PORTAL_SCRIPT=String.raw`
(()=>{
'use strict';
const assets=JSON.parse(document.getElementById('portal-assets').textContent||'{}');
const pageOrder=JSON.parse(document.getElementById('portal-pages').textContent||'[]');
document.querySelectorAll('img[data-photo]').forEach(img=>{const source=assets[img.dataset.photo];if(source)img.src=source;});
const modal=document.getElementById('mobile-nav');
const mobileBody=document.getElementById('mobile-nav-body');
mobileBody.innerHTML=document.getElementById('desktop-rails').innerHTML;
let current='introduction';
function openGroup(name){document.querySelectorAll('.nav-group').forEach(group=>{const on=group.dataset.group===name;group.dataset.open=String(on);const control=group.querySelector('.nav-heading');if(control)control.setAttribute('aria-expanded',String(on));const links=group.querySelector('.nav-links');if(links)links.hidden=!on;});}
function showPage(key,push){
 const target=document.getElementById('page-'+key);if(!target)return;
 current=key;document.querySelectorAll('[data-report-page]').forEach(page=>page.hidden=page!==target);
 document.querySelectorAll('[data-page]').forEach(link=>{if(link.dataset.page===key)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
 const active=document.querySelector('.rails [data-page="'+key+'"]');
 openGroup(active?.closest('.nav-group')?.dataset.group||'introduction');
 const title=target.dataset.title||'Report';document.getElementById('mobile-current').textContent=title;
 document.title=title+' — Moga report';
 document.querySelectorAll('[data-service]').forEach(button=>button.classList.toggle('active',button.dataset.service===(key==='hairstyles'?'hairstyles':key==='surgical'?'surgical':'report')));
 if(push){history.replaceState(null,'','#'+key);window.scrollTo({top:0,behavior:'instant'});const heading=target.querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
 const index=pageOrder.indexOf(key);document.querySelectorAll('[data-step="previous"]').forEach(b=>b.disabled=index<=0);document.querySelectorAll('[data-step="next"]').forEach(b=>b.disabled=index<0||index===pageOrder.length-1);
 document.getElementById('page-position').textContent=index>=0?(index+1)+' / '+pageOrder.length:'';
 if(modal.open)modal.close();
}
document.addEventListener('click',event=>{
 const link=event.target.closest('[data-page]');if(link){event.preventDefault();showPage(link.dataset.page,true);return;}
 const group=event.target.closest('[data-toggle-group]');if(group){const name=group.dataset.toggleGroup;const parent=group.closest('.nav-group');const shouldOpen=parent.dataset.open!=='true';if(shouldOpen)openGroup(name);else{document.querySelectorAll('.nav-group[data-group="'+name+'"]').forEach(n=>{n.dataset.open='false';n.querySelector('.nav-heading').setAttribute('aria-expanded','false');n.querySelector('.nav-links').hidden=true;});}return;}
 const toggle=event.target.closest('[data-collapse-rail]');if(toggle){const collapsed=document.body.classList.toggle('collapse-rail');document.querySelectorAll('[data-collapse-rail]').forEach(b=>b.setAttribute('aria-expanded',String(!collapsed)));return;}
 if(event.target.closest('[data-open-mobile]')){if(!modal.open)modal.showModal();return;}
 if(event.target.closest('[data-close-mobile]')){modal.close();return;}
 const ratio=event.target.closest('[data-ratio]');if(ratio){const key=ratio.dataset.ratio;document.querySelectorAll('[data-ratio]').forEach(b=>{b.setAttribute('aria-selected',String(b===ratio));b.tabIndex=b===ratio?0:-1;});document.querySelectorAll('[data-ratio-panel]').forEach(p=>p.hidden=p.dataset.ratioPanel!==key);return;}
 const view=event.target.closest('[data-feature-view]');if(view){const root=view.closest('[data-feature-root]'),mode=view.dataset.featureView;root.querySelectorAll('[data-feature-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===view)));root.querySelectorAll('[data-overview-photo]').forEach(img=>{const key=mode==='concept'?img.dataset.conceptKey:(img.dataset.originalKey||'original');if(assets[key])img.src=assets[key];});root.querySelectorAll('[data-overview-label]').forEach(n=>n.textContent=mode==='concept'?'AI concept — original findings remain below':(assets['isolation-portrait']?'Original-based display cutout — not measurement evidence':'Original photograph — assessment evidence'));return;}
 const step=event.target.closest('[data-step]');if(step){const index=pageOrder.indexOf(current),next=pageOrder[index+(step.dataset.step==='next'?1:-1)];if(next)showPage(next,true);return;}
 if(event.target.closest('[data-help]')){const panel=document.getElementById('report-help');panel.hidden=!panel.hidden;document.querySelector('[data-help]').setAttribute('aria-expanded',String(!panel.hidden));return;}
});
modal.addEventListener('click',e=>{if(e.target===modal){const bounds=modal.getBoundingClientRect();if(e.clientX<bounds.left||e.clientX>bounds.right||e.clientY<bounds.top||e.clientY>bounds.bottom)modal.close();}});
document.querySelectorAll('[role="tablist"]').forEach(list=>list.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const tabs=[...list.querySelectorAll('[role="tab"]')],index=tabs.indexOf(document.activeElement);if(index<0)return;event.preventDefault();let next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].focus();tabs[next].click();}));
const search=document.getElementById('catalog-search'),confidence=document.getElementById('catalog-confidence');
function filter(){const query=search.value.trim().toLowerCase(),level=confidence.value;let count=0;document.querySelectorAll('[data-catalog-row]').forEach(row=>{const shown=(!query||row.textContent.toLowerCase().includes(query))&&(!level||row.dataset.confidence===level);row.hidden=!shown;if(shown)count++;});document.getElementById('catalog-count').textContent=count+' of 169 assessments';}
search.addEventListener('input',filter);confidence.addEventListener('change',filter);
window.addEventListener('hashchange',()=>{const key=location.hash.slice(1);if(pageOrder.includes(key)||['hairstyles','surgical'].includes(key))showPage(key,false);});
const initial=location.hash.slice(1);showPage(pageOrder.includes(initial)||['hairstyles','surgical'].includes(initial)?initial:'introduction',false);
})();
`;
