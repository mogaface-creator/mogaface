import type { CSSProperties } from "react";

// Source tiles retain the supplied illustrations, recolored to Moga's slate palette.
const TILES: Record<string,[number,number,number,number]>={
 jaw:[89,44,303,274],skin:[443,44,298,274],eyes:[795,44,299,274],cheeks:[1148,44,300,274],
 eyebrows:[89,366,303,274],nose:[443,366,298,274],lips:[795,366,299,274],chin:[1148,366,300,274],
 smile:[198,685,312,280],neck:[597,687,325,283],hair:[1010,688,325,282],
};
function IllustrationTile({name}:{name:string}){
 const [x,y,w,h]=TILES[name]??TILES.jaw;
 const style={width:`${1536/w*100}%`,height:`${1024/h*100}%`,left:`${-x/w*100}%`,top:`${-y/h*100}%`} as CSSProperties;
 return <span className="assessment-art-tile"><img src="/images/assessments/moga-slate-icon-grid.png" alt="" style={style} loading="lazy" decoding="async"/></span>;
}
export function AssessmentIcon({category}:{category:string}){
 return category==="general"?<span className="assessment-art-overview" aria-hidden="true">{["eyes","nose","jaw","skin"].map(name=><IllustrationTile key={name} name={name}/>)}</span>:<IllustrationTile name={category}/>;
}
