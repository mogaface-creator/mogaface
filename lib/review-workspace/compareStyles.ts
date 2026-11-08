export const COMPARE_STYLES = `
.moga-compare{width:min(100%,520px);margin:0 auto}
.moga-compare__frame{--reveal:50%;position:relative;isolation:isolate;overflow:hidden;border-radius:10px;background:#f3f5f2}
.moga-compare__frame img{display:block;width:100%;max-height:min(65svh,560px);height:auto;object-fit:contain}
.moga-compare__frame .moga-compare__before{position:absolute;inset:0;width:100%;height:100%;clip-path:inset(0 calc(100% - var(--reveal)) 0 0)}
.moga-compare__frame .moga-compare__after{position:absolute;inset:0;width:100%;height:100%}
.moga-compare__frame .moga-compare__size{visibility:hidden}
.moga-compare__divider{position:absolute;inset-block:0;left:var(--reveal);width:2px;transform:translateX(-50%);background:white;box-shadow:0 0 5px #0008;pointer-events:none}
.moga-compare__handle{position:absolute;top:50%;left:clamp(23px,var(--reveal),calc(100% - 23px));transform:translate(-50%,-50%);display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:white;color:#30473d;font:bold 20px/1 Arial,sans-serif;box-shadow:0 2px 10px #0006;pointer-events:none}
.moga-compare__frame input[type=range]{position:absolute;inset:0;width:100%;height:100%;padding:0;margin:0;opacity:0;cursor:ew-resize;touch-action:pan-y pinch-zoom;appearance:none}
.moga-compare__frame input[type=range]::-webkit-slider-thumb{appearance:none;width:1px;height:44px}
.moga-compare__frame input[type=range]::-moz-range-thumb{width:1px;height:44px;border:0}
.moga-compare__frame:focus-within{outline:2px solid #476f60;outline-offset:3px}
.moga-compare__labels{display:flex;justify-content:space-between;gap:12px;font-size:13px;font-weight:600;color:#36483e;padding:10px 2px 4px}
.moga-compare__hint{font-size:13px;color:#59665f;text-align:center;padding:4px 0}
`;
