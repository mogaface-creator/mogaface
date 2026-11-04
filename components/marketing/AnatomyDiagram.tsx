/** Original vector illustrations inspired by the supplied reference. Not measured anatomy. */
export function AnatomyDiagram({view="front"}:{view?:"front"|"profile"}) {
 const front=view==="front";
 const dots=front?[[75,65],[125,65],[100,83],[66,104],[134,104],[100,125],[72,151],[128,151],[100,169],[100,190],[100,218],[63,178],[137,178]]:[[78,53],[113,81],[125,104],[145,130],[121,151],[128,175],[113,195],[80,217],[63,177]];
 return <svg className="anatomy-diagram" viewBox="0 0 200 270" fill="none" role="img" aria-label={`Illustrative ${front?'front-view facial proportions':'profile facial proportions'}`}>
 <g className="anatomy-guides" stroke="currentColor" strokeWidth=".45" opacity=".4"><path d="M15 65H185M15 104H185M15 151H185M15 190H185M15 218H185M35 25V245M100 15V250M165 25V245" strokeDasharray="2 3"/><ellipse cx="100" cy="134" rx="77" ry="110"/><path d="M20 35l160 200M20 235L180 35M15 134h170" strokeDasharray="1 4"/></g>
 <g stroke="currentColor" strokeWidth=".9" strokeLinecap="round" strokeLinejoin="round">
 {front?<><path d="M43 108C36 74 52 32 99 29C147 30 163 73 157 108L151 158C147 184 128 212 100 223C72 213 53 184 49 158Z"/><path d="M47 113C34 100 34 132 47 144M153 113C166 100 166 132 153 144M57 95Q74 83 88 96M112 96Q128 83 143 95M57 105Q73 93 88 106Q73 115 57 105ZM112 106Q128 93 144 105Q128 115 112 106ZM96 105L88 143Q100 151 112 143L104 105M78 176Q100 165 122 176Q100 191 78 176ZM80 176Q100 180 120 176M68 203L66 237M132 203L134 237M66 237L37 252M134 237L163 252"/><path d="M50 69Q100 93 150 69M49 151Q100 174 151 151M63 178L100 218L137 178M57 105L100 151L144 105M75 65L100 83L125 65M100 29V223" opacity=".45"/><circle cx="73" cy="105" r="5"/><circle cx="128" cy="105" r="5"/></>:<><path d="M61 226Q68 210 73 193C64 184 58 170 55 153C32 117 42 61 70 39C95 21 126 43 129 72L127 97L134 114L153 132Q158 137 151 141L134 145L131 156L140 165L132 173Q142 182 129 192L115 198Q109 214 119 238"/><path d="M79 53Q103 55 125 79L117 100L129 115M112 98Q123 93 128 104L113 106M128 151L120 152M130 166L139 165M85 145C65 127 60 150 75 163C89 176 94 151 85 145ZM61 226L28 252M119 238L157 252M73 193L115 198"/><path d="M70 39L78 53L113 81L125 104L145 130L121 151L128 175L113 195L80 217M78 53L63 177L113 195M55 153L121 151M73 193L145 130M50 98L125 104" opacity=".45"/></>}
 </g><g fill="currentColor">{dots.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="1.7"/>)}</g><g stroke="currentColor" strokeWidth=".65"><path d="M18 65V218M14 65h8M14 151h8M14 218h8M176 65V218M172 65h8M172 151h8M172 218h8"/></g>
 </svg>
}

export { AnatomyOverview } from "./FacialStudy";
