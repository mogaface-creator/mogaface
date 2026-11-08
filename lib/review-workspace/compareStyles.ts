export const COMPARE_STYLES = `
.moga-compare{width:min(100%,520px);margin:0 auto}
.moga-compare__frame{--reveal:50%;position:relative;isolation:isolate;overflow:hidden;border-radius:10px;background:#f3f5f2}
.moga-compare__frame img{display:block;width:100%;max-height:min(65svh,560px);height:auto;object-fit:contain}
.moga-compare__frame .moga-compare__before{position:absolute;inset:0;width:100%;height:100%;clip-path:inset(0 calc(100% - var(--reveal)) 0 0)}
.moga-compare__frame .moga-compare__after{position:absolute;inset:0;width:100%;height:100%}
.moga-compare__frame .moga-compare__size{visibility:hidden}
.moga-compare__divider{position:absolute;inset-block:0;left:var(--reveal);width:2px;transform:translateX(-50%);background:white;box-shadow:0 0 5px #0008;pointer-events:none}
.moga-compare .moga-compare__slider{display:block;width:100%;height:44px;margin:4px 0 0;padding:0;appearance:none;background:transparent;cursor:ew-resize;touch-action:pan-y pinch-zoom}
.moga-compare__slider::-webkit-slider-runnable-track{height:6px;border-radius:999px;background:#ccd8d0}
.moga-compare__slider::-moz-range-track{height:6px;border-radius:999px;background:#ccd8d0}
.moga-compare__slider::-webkit-slider-thumb{appearance:none;width:30px;height:30px;margin-top:-12px;border:3px solid white;border-radius:50%;background:#435b50;box-shadow:0 0 0 1px #435b50}
.moga-compare__slider::-moz-range-thumb{width:24px;height:24px;border:3px solid white;border-radius:50%;background:#435b50;box-shadow:0 0 0 1px #435b50}
.moga-compare__slider:focus-visible{outline:2px solid #476f60;outline-offset:2px;border-radius:8px}
.moga-compare__labels{display:flex;justify-content:space-between;gap:12px;font-size:13px;font-weight:600;color:#36483e;padding:10px 2px 4px}
.moga-compare__hint{font-size:13px;color:#59665f;text-align:center;padding:4px 0}
`;
