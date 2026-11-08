import { COMPARE_STYLES } from "./compareStyles.ts";

/** Repair only the known legacy display bug; original report data and images stay unchanged. */
export function repairLegacyReportDisplay(html:string):string{
 if(!html.includes('class="masked-portrait"')&&!html.includes('class="photo-crop"'))return html;
 return html.replace(/<div class="status-panel"><div class="label">Dimorphism range<\/div>[\s\S]*?(?=<div class="explanation">)/, '<div class="status-panel" style="min-height:0"><div class="label">Original evidence</div><h2 class="status-title">Your feature summary</h2><p class="status-description">Read the observations and individual feature breakdowns below.</p></div>').replace('</head>',`<style data-legacy-display-repair>.masked-portrait{clip-path:none!important}.portrait-panel{align-items:center!important}.portrait-panel>img{object-position:center!important}.photo-crop{background-size:contain!important;background-position:center!important;width:100%!important;aspect-ratio:4/3!important}.feature-art{height:200px!important}</style></head>`);
}

/** Move the comparison control in snapshots saved with the original overlay. */
export function moveLegacyComparisonControl(html: string): string {
 const overlay = '<span class="moga-compare__handle" aria-hidden="true">‹ ›</span>';
 if (!html.includes(overlay)) return html;

 return html
  .replace(/<span class="moga-compare__handle" aria-hidden="true">‹ ›<\/span>\s*(<input type="range"[^>]*data-compare-slider[^>]*)>\s*<\/div>/,
    '</div>$1 class="moga-compare__slider">')
  .replace(/\.moga-compare\{width:min\(100%,520px\)[\s\S]*?\.moga-compare__hint\{[^}]*\}/, () => COMPARE_STYLES.trim())
  .replace("slider.parentElement.style.setProperty('--reveal'", "slider.closest('.moga-compare').querySelector('.moga-compare__frame').style.setProperty('--reveal'")
  .replace("Drag or use the arrow keys to compare.", "Drag the slider below the photo or use the arrow keys to compare.");
}
