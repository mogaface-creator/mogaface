import "./anatomy-overview.css";

/** Stylized sculptural studies; all guide positions are illustrative. */
export function FacialStudy({ profile=false }: { profile?: boolean }) {
 const id=profile?"study-profile":"study-front";
 return <svg className="facial-study" viewBox="0 0 360 360" fill="none" role="img" aria-label={profile?"Sculptural profile with illustrative proportion guides":"Sculptural front view with illustrative symmetry guides"}>
  <defs>
   <linearGradient id={`${id}-surface`} x1="110" y1="90" x2="235" y2="280" gradientUnits="userSpaceOnUse"><stop stopColor="#ecf0ed"/><stop offset=".45" stopColor="#a9bdbe"/><stop offset="1" stopColor="#546f78"/></linearGradient>
   <linearGradient id={`${id}-shadow`} x1="145" y1="180" x2="225" y2="190" gradientUnits="userSpaceOnUse"><stop stopColor="#38535d" stopOpacity=".05"/><stop offset="1" stopColor="#314c57" stopOpacity=".7"/></linearGradient>
   <radialGradient id={`${id}-halo`}><stop stopColor="#d5e5df" stopOpacity=".18"/><stop offset="1" stopColor="#d5e5df" stopOpacity="0"/></radialGradient>
  </defs>
  <circle cx="180" cy="180" r="164" fill={`url(#${id}-halo)`}/>
  <g stroke="#d4e4e5" opacity=".13"><circle cx="180" cy="177" r="128"/><circle cx="180" cy="177" r="145" strokeDasharray="1 8"/><path d="M20 177h320M180 18v320"/></g>
  {profile?<>
   <path d="M108 318c12-23 22-42 28-70-23-25-37-64-35-103 1-55 28-92 71-93 43-2 70 32 67 72l-2 28 12 30 23 24c5 5 1 10-7 12l-22 4-3 13 11 9-12 10c8 14-5 28-28 30l-5 33 28 25Z" fill={`url(#${id}-surface)`}/>
   <path d="M172 91c33 15 42 40 40 74l13 37-15 27 8 27-17 28-5 33h48l-28-25 5-33c23-2 36-16 28-30l12-10-11-9 3-13 22-4c8-2 12-7 7-12l-23-24-12-30 2-28c2-16-2-31-9-43Z" fill={`url(#${id}-shadow)`}/>
   <path d="M207 159q14-8 28 0m-10 5h10m7 66h12m-32 49-42-4" stroke="#3d5861" strokeWidth="2" strokeLinecap="round"/><ellipse cx="153" cy="209" rx="13" ry="20" stroke="#dae5e2" strokeOpacity=".45"/>
  </>:<>
   <path d="m136 274-5 29-45 23h188l-45-23-5-29Z" fill={`url(#${id}-surface)`}/>
   <path d="M180 51c-51 0-76 34-73 91l6 63c5 41 32 77 67 89 35-12 62-48 67-89l6-63c3-57-22-91-73-91Z" fill={`url(#${id}-surface)`}/>
   <path d="M180 51c51 0 76 34 73 91l-6 63c-5 41-32 77-67 89l13-58-8-28 10-32-15-42Z" fill={`url(#${id}-shadow)`}/>
   <g stroke="#3a5660" strokeWidth="2" strokeLinecap="round"><path d="M125 153q20-12 39-1m32 0q19-11 39 1M127 168q17-10 34 0m38 0q17-10 34 0M177 172l-8 39q11 7 22 0M156 244q24-9 48 0-24 13-48 0Z"/><path d="M144 165v6m72-6v6" strokeWidth="4"/></g>
   <path d="M123 199q18 12 35 7m44 0q17 5 35-7" stroke="#e2e9e4" strokeOpacity=".4" strokeWidth="2"/>
  </>}
  <g stroke="#e7f2ef" strokeWidth=".8" opacity=".65" strokeDasharray="3 5"><path d="M55 124h250M55 202h250M55 280h250"/>{!profile&&<path d="M180 42v260"/>}</g>
  <g stroke="#e7f2ef" strokeWidth="1"><path d="M64 124v156m-4-156h8m-8 78h8m-8 78h8"/>{[124,202,280].map(y=><circle key={y} cx={profile?239:180} cy={y} r="3" fill="#e7f2ef"/>)}</g>
  <g fill="#e1eeeb" fontFamily="monospace" fontSize="9" letterSpacing="1"><text x="31" y="130">A</text><text x="31" y="208">B</text><text x="31" y="286">C</text><text x="246" y="332">{profile?"PROFILE / 01":"FRONTAL / 02"}</text></g>
 </svg>;
}

export function AnatomyOverview(){return <section id="facial-studies" className="anatomy-overview refined-anatomy"><div className="anatomy-panel"><FacialStudy profile/><div><span>01 / PROFILE</span><h3>Proportion.<br/>Perspective.</h3><p>Explore the relationship between the forehead, nose, lips and chin.</p></div></div><div className="anatomy-panel"><FacialStudy/><div><span>02 / FRONT VIEW</span><h3>Balance.<br/>Individuality.</h3><p>See facial thirds, symmetry and features as a connected whole.</p></div></div><p className="anatomy-footnote">Illustrative diagrams, not personal measurements.</p></section>}
