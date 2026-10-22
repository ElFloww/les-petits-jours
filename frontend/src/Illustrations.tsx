import { ForestLights, ForestTrees, type TreePlace } from './Forest';
export function ChristmasSprig({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 240 190" fill="none" aria-hidden="true">
    <g stroke="#567857" strokeWidth="2" strokeLinecap="round">
      <path d="M8 15Q90 42 210 158M25 10Q85 85 100 174M4 63Q83 65 173 124" />
      {[0, 1, 2, 3, 4, 5].map(index => <g key={index} transform={`translate(${30 + index * 26} ${24 + index * 21}) rotate(38)`}>
        <path d="M0 0 5-24M6 4 15-22M12 8 24-17M0 0-24 6M6 4-17 17M12 8-10 26" />
      </g>)}
      {[0, 1, 2, 3].map(index => <g key={index} transform={`translate(${55 + index * 10} ${69 + index * 25}) rotate(62)`}>
        <path d="M0 0 8-24M6 4 18-21M0 0-23 9M6 4-15 21" />
      </g>)}
    </g>
    <g fill="#a7293b"><circle cx="103" cy="82" r="8" /><circle cx="117" cy="91" r="7" /><circle cx="102" cy="98" r="6" /></g>
    <g fill="#e5b967"><circle cx="101" cy="79" r="2" /><circle cx="115" cy="89" r="1.5" /><circle cx="100" cy="96" r="1.5" /></g>
  </svg>;
}

export function Star({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="m16 0 4 12 12 4-12 4-4 12-4-12L0 16l12-4Z" fill="currentColor" />
  </svg>;
}

export function Lock() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="5" y="9" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.5" />
  </svg>;
}

export function Village() {
  return <svg className="village" viewBox="0 0 1200 220" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMax slice">
    <path d="M0 191c140-35 225 25 370-1s241-34 385-6 338-34 445 0v36H0Z" fill="#e4ebdc" />
    <ForestTrees places={[[64, 198, .27, 0, true], [150, 200, .2, 1], [1100, 198, .27, 1, true], [1004, 200, .21, 0]]} />
    <path d="M209 118h86v80h-86z" fill="#d57c67" /><path d="m195 122 57-58 58 58Z" fill="#174b40" />
    <path d="M255 198v-41h21v41M225 143h16v21h-16" fill="#ffe6aa" />
    <path d="M328 149h62v49h-62z" fill="#efbf63" /><path d="m321 150 38-42 39 42Z" fill="#c17360" />
    <path d="M351 170h16v28h-16" fill="#174b40" />
    <path d="M805 128h84v70h-84z" fill="#efbf63" /><path d="m792 131 55-54 55 54Z" fill="#174b40" />
    <path d="M821 149h15v19h-15M858 149h15v19h-15" fill="#fff9e9" />
    <path d="M907 152h43v46h-43z" fill="#d57c67" /><path d="m900 153 29-33 29 33Z" fill="#174b40" />
    <path d="M921 178h14v20h-14" fill="#ffe6aa" />
    <path d="M268 77V52h13v39" fill="#d57c67" /><path d="M872 91V68h11v35" fill="#efbf63" />
    <path d="M0 207c280-22 446 6 653-3s355-5 547-1v17H0Z" fill="#faf7ef" />
  </svg>;
}

export function Gingerbread() {
  return <svg className="ornament-art gingerbread" viewBox="0 0 40 50" aria-hidden="true">
    <g fill="#b9703d">
      <circle cx="20" cy="10" r="8.5" />
      <rect x="11" y="15" width="18" height="21" rx="7" />
      <rect x="3" y="18.5" width="34" height="8" rx="4" />
      <rect x="11.5" y="29" width="7.5" height="18" rx="3.7" transform="rotate(14 15 30)" />
      <rect x="21" y="29" width="7.5" height="18" rx="3.7" transform="rotate(-14 25 30)" />
    </g>
    <g fill="none" stroke="#fff6e6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 20.5l1.8 2.2 1.8-2.2M30.9 20.5l1.8 2.2 1.8-2.2M10 44.5l3 .8 3-.8M24 45.3l3-.8 3 .8" />
      <path className="ginger-smile" d="M16.6 12.6q3.4 2.8 6.8 0" />
    </g>
    <g fill="#3a2214"><circle cx="17" cy="8.6" r="1.3" /><circle cx="23" cy="8.6" r="1.3" /></g>
    <g fill="#f29aa0" opacity=".8"><circle cx="14.6" cy="12" r="1.5" /><circle cx="25.4" cy="12" r="1.5" /></g>
    <circle cx="20" cy="21.5" r="1.7" fill="#e3434f" /><circle cx="20" cy="27.5" r="1.7" fill="#3fae6b" />
    <path d="M15.5 4.2 20 1.6l4.5 2.6" stroke="#e3434f" strokeWidth="2.4" strokeLinecap="round" fill="none" />
  </svg>;
}

export function CandyCane() {
  return <svg className="ornament-art candy-cane" viewBox="0 0 30 58" fill="none" aria-hidden="true">
    <path d="M20 54V17a8 8 0 0 0-16 0v2" stroke="#fffaf2" strokeWidth="7.5" strokeLinecap="round" />
    <path d="M20 54V17a8 8 0 0 0-16 0v2" stroke="#e2364a" strokeWidth="7.5" strokeDasharray="4.5 5" />
    <path d="M18 50V18" stroke="#ffffff" strokeOpacity=".55" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M14 24c4 2 8 2 11 0" stroke="#2f8a57" strokeWidth="3" strokeLinecap="round" />
    <circle cx="20" cy="24" r="3" fill="#2f8a57" />
  </svg>;
}

export function Mitten() {
  return <svg className="ornament-art mitten" viewBox="0 0 34 46" aria-hidden="true">
    <path d="M8 34V15a10 10 0 0 1 20 0v19Z" fill="#c8323f" />
    <path d="M8 22c-5-2-8 2-6 6l6 6" fill="#c8323f" />
    <rect x="5.5" y="33" width="25" height="10" rx="4" fill="#fff8ef" />
    <g fill="#fff8ef"><circle cx="13" cy="16" r="1.5" /><circle cx="22" cy="14" r="1.5" /><circle cx="17.5" cy="24" r="1.5" /><circle cx="24" cy="27" r="1.2" /><circle cx="12" cy="28" r="1.2" /></g>
    <path d="M18 2v6" stroke="#e8c37a" strokeWidth="1.5" />
  </svg>;
}

export function SnowmanOrnament() {
  return <svg className="ornament-art snowman-ornament" viewBox="0 0 36 54" aria-hidden="true">
    <circle cx="18" cy="38" r="13" fill="#fbfdff" /><circle cx="18" cy="19" r="9.5" fill="#fbfdff" />
    <path d="M7 40a13 13 0 0 0 22 4" fill="none" stroke="#c9dbe6" strokeWidth="3" strokeLinecap="round" />
    <rect x="10" y="4" width="16" height="3" rx="1.5" fill="#21312e" /><rect x="12.5" y="-4" width="11" height="9" rx="2" fill="#21312e" />
    <rect x="12.5" y="2" width="11" height="2.4" fill="#d13a48" />
    <g fill="#21312e"><circle cx="14.8" cy="17.5" r="1.3" /><circle cx="21.2" cy="17.5" r="1.3" /><circle cx="18" cy="33" r="1.3" /><circle cx="18" cy="39" r="1.3" /></g>
    <path d="M18 20.5l6 1.6-6 1z" fill="#f08a2c" />
    <path d="M10 27q8 5 16 0" stroke="#d13a48" strokeWidth="4" strokeLinecap="round" fill="none" />
    <path d="M23 28l3 8" stroke="#d13a48" strokeWidth="3.5" strokeLinecap="round" />
    <g fill="#f6a8ae" opacity=".7"><circle cx="12.6" cy="21" r="1.4" /><circle cx="23.4" cy="21" r="1.4" /></g>
  </svg>;
}

export function StarOrnament() {
  return <svg className="ornament-art star-ornament" viewBox="0 0 44 44" aria-hidden="true">
    <path d="M22 2.5l5.6 12.2 13.3 1.5-9.9 9 2.8 13.1L22 31.6l-11.8 6.7 2.8-13.1-9.9-9 13.3-1.5Z" fill="#f6c955" stroke="#e7a93a" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M17 9.5l3-6" stroke="#fff4c8" strokeWidth="2" strokeLinecap="round" />
    <g fill="#5a3b16"><ellipse cx="18" cy="20" rx="1.4" ry="1.8" /><ellipse cx="26" cy="20" rx="1.4" ry="1.8" /></g>
    <path d="M19.5 24q2.5 2.2 5 0" stroke="#5a3b16" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    <g fill="#f19a7d" opacity=".75"><circle cx="15.5" cy="23.5" r="1.6" /><circle cx="28.5" cy="23.5" r="1.6" /></g>
  </svg>;
}

export function Robin() {
  return <svg className="robin" viewBox="0 0 52 44" aria-hidden="true">
    <path d="M6 22c-5 1-6 5-5 7 4-1 8-2 11-5Z" fill="#5b3a24" />
    <ellipse cx="24" cy="27" rx="15" ry="12" fill="#7a4f31" />
    <ellipse cx="28" cy="30" rx="10" ry="8.5" fill="#ec6a43" />
    <path d="M17 24q7-4 11 3-6 4-11-3Z" fill="#5f3c25" />
    <g className="robin-head">
      <circle cx="34" cy="17" r="9" fill="#7a4f31" />
      <path d="M33 20a6 6 0 0 0 7 4 7 7 0 0 1-9 2Z" fill="#ec6a43" />
      <path d="M42.5 16.5l7 2-7 2.2Z" fill="#f2b33d" />
      <circle className="robin-eye" cx="37.5" cy="15.5" r="2" fill="#1c140f" />
      <circle cx="38.2" cy="14.8" r=".7" fill="#fff" />
      <circle cx="38" cy="20" r="1.6" fill="#f59a88" opacity=".7" />
      <path d="M25 13c2-9 13-11 18-6-6-1-12 2-18 6Z" fill="#d9333f" />
      <path d="M25 12.5c5-3 12-4 18-5.5" stroke="#fff8ef" strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <circle cx="44" cy="6.5" r="3" fill="#fff8ef" />
    </g>
    <path d="M21 38.5v5M27 38.5v5" stroke="#8c5b2d" strokeWidth="1.6" strokeLinecap="round" />
  </svg>;
}

export function SleepyMoon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
    <circle cx="60" cy="60" r="44" fill="#fff1c1" />
    <circle cx="60" cy="60" r="44" fill="url(#moon-shade)" />
    <defs><radialGradient id="moon-shade" cx="35%" cy="30%" r="80%"><stop offset="55%" stopColor="#fff1c1" stopOpacity="0" /><stop offset="100%" stopColor="#e7c983" /></radialGradient></defs>
    <g fill="#f1dc9f"><circle cx="80" cy="40" r="7" /><circle cx="86" cy="70" r="4" /><circle cx="40" cy="84" r="5" /></g>
    <g fill="none" stroke="#6b5530" strokeWidth="2.6" strokeLinecap="round">
      <path d="M40 58q6 5 12 0M68 58q6 5 12 0" />
      <path d="M53 72q7 5 14 0" />
    </g>
    <g fill="#f4a993" opacity=".7"><ellipse cx="40" cy="68" rx="5" ry="3" /><ellipse cx="80" cy="68" rx="5" ry="3" /></g>
  </svg>;
}

export function Sleigh() {
  return <svg className="sleigh" viewBox="0 0 220 60" aria-hidden="true">
    <g fill="none" stroke="#f4dba0" strokeWidth="1.6" strokeLinecap="round"><path d="M128 36 92 30M128 38 46 33" /></g>
    {[0, 46].map(offset => <g key={offset} className="reindeer" transform={`translate(${offset} 0)`} fill="#f4dba0">
      <ellipse cx="22" cy="32" rx="13" ry="6.5" />
      <path d="M31 29l6-10 5 2-5 10Z" />
      <ellipse cx="41" cy="18" rx="5.5" ry="4" />
      <path d="M38 14l-3-7M36 10l-4 0M41 14l1-8M41.5 9l3-2" stroke="#f4dba0" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path className="reindeer-legs" d="M13 36l-4 9M17 37l-1 9M27 37l3 9M31 35l6 8" stroke="#f4dba0" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M9 30l-6-3" stroke="#f4dba0" strokeWidth="2.6" strokeLinecap="round" />
    </g>)}
    <circle className="red-nose" cx="92" cy="19" r="2.8" fill="#ff4b55" />
    <path d="M128 26h46c8 0 12-8 12-15h6c0 14-6 27-20 27h-40c-4 0-6-5-4-12Z" fill="#c93443" />
    <path d="M122 46h62c8 0 12-4 14-9" stroke="#f4dba0" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    <path d="M135 38v8M170 38v8" stroke="#f4dba0" strokeWidth="2" />
    <circle cx="160" cy="16" r="9" fill="#d73a49" /><circle cx="160" cy="7" r="6" fill="#ffe1c4" />
    <path d="M154 5q6-12 14-4l4 6" fill="#d73a49" /><circle cx="172" cy="7.5" r="2.4" fill="#fff" />
    <path d="M155 9q5 6 10 0" fill="#fff" />
    <rect x="140" y="12" width="12" height="14" rx="2" fill="#2d7d55" /><path d="M146 12v14M140 19h12" stroke="#f4dba0" strokeWidth="1.6" />
  </svg>;
}

const nightTrees: TreePlace[] = [
  [70, 198, .3, 0, true], [132, 202, .22, 1], [1085, 198, .3, 1, true], [1155, 203, .21, 0],
  [708, 192, .2, 1], [485, 195, .18, 0], [28, 206, .17, 1], [1190, 207, .16, 0],
];

export function NightVillage() {
  const frame = { viewBox: '0 0 1200 250', fill: 'none', preserveAspectRatio: 'xMidYMax slice' } as const;
  return <div className="night-village" aria-hidden="true">
    <svg className="night-layer" {...frame}>
    <path d="M0 150c120-40 260-30 380 5s250-50 420-20 300 10 400-15v130H0Z" fill="#163f3c" opacity=".9" />
    <path d="M0 188c150-30 260 18 400-4s260-30 420-6 280-18 380 2v70H0Z" fill="#dde9ee" />
      <ForestTrees places={nightTrees} />
    </svg>
    <svg className="night-layer" {...frame}>
      <ForestLights places={nightTrees} />
    <g className="houses">
      <path d="M190 128h110v80H190z" fill="#7d3d3f" /><path d="m176 132 69-62 69 62Z" fill="#2a3e4a" />
      <path d="m176 132 69-62 69 62-8 2-61-55-61 55Z" fill="#f3f8fb" />
      <rect x="270" y="72" width="16" height="34" fill="#5b2f31" /><rect x="267" y="68" width="22" height="8" rx="3" fill="#f3f8fb" />
      <g className="smoke"><circle cx="278" cy="58" r="7" /><circle cx="284" cy="44" r="9" /><circle cx="276" cy="28" r="11" /></g>
      <rect className="window w1" x="205" y="148" width="22" height="22" rx="3" /><rect className="window w2" x="262" y="148" width="22" height="22" rx="3" />
      <path d="M216 148v22M205 159h22M273 148v22M262 159h22" stroke="#7d3d3f" strokeWidth="2.5" />
      <path d="M233 208v-30a12 12 0 0 1 24 0v30Z" fill="#3b2226" /><circle cx="252" cy="194" r="1.8" fill="#ffd772" />
      <path d="M210 128q6 10 12 0q6 10 12 0q6 10 12 0q6 10 12 0q6 10 12 0q6 10 12 0q6 10 12 0" stroke="#ff5c6c" strokeWidth="1.2" />

      <path d="M326 156h70v52h-70z" fill="#c88b3e" /><path d="m316 158 45-40 45 40Z" fill="#2a3e4a" />
      <path d="m316 158 45-40 45 40-7 2-38-33-38 33Z" fill="#f3f8fb" />
      <rect className="window w3" x="349" y="170" width="24" height="18" rx="9" />

      <path d="M800 120h100v88H800z" fill="#2f5d6e" /><path d="m786 124 64-58 64 58Z" fill="#7d3d3f" />
      <path d="m786 124 64-58 64 58-8 2-56-50-56 50Z" fill="#f3f8fb" />
      <rect className="window w4" x="814" y="140" width="20" height="24" rx="3" /><rect className="window w1" x="866" y="140" width="20" height="24" rx="3" />
      <rect className="window w2" x="838" y="76" width="24" height="20" rx="10" />
      <path d="M838 208v-28h24v28Z" fill="#1f3a44" />
      <path d="M806 120q6 9 11 0q6 9 11 0q6 9 11 0q6 9 11 0q6 9 11 0q6 9 11 0q6 9 11 0q6 9 11 0" stroke="#ffd772" strokeWidth="1.2" />
      <rect x="874" y="70" width="14" height="30" fill="#5b2f31" /><rect x="871" y="66" width="20" height="7" rx="3" fill="#f3f8fb" />
      <g className="smoke smoke-late"><circle cx="881" cy="56" r="6" /><circle cx="887" cy="42" r="8" /><circle cx="879" cy="27" r="10" /></g>

      <path d="M920 160h56v48h-56z" fill="#8f4b3c" /><path d="m912 161 36-32 36 32Z" fill="#2a3e4a" />
      <path d="m912 161 36-32 36 32-6 2-30-26-30 26Z" fill="#f3f8fb" />
      <rect className="window w3" x="938" y="174" width="20" height="16" rx="3" />
    </g>
    <g className="lamp">
      <path d="M560 210v-78" stroke="#1b2b2c" strokeWidth="4" />
      <path d="M548 130h24l-4-16h-16Z" fill="#1b2b2c" />
      <circle className="lamp-glow" cx="560" cy="122" r="26" fill="url(#lamp-light)" />
      <rect x="553" y="116" width="14" height="12" rx="2" fill="#ffe7a3" />
      <path d="M545 112l15-8 15 8" stroke="#f3f8fb" strokeWidth="4" strokeLinecap="round" />
      <defs><radialGradient id="lamp-light"><stop offset="0%" stopColor="#ffe08a" stopOpacity=".9" /><stop offset="100%" stopColor="#ffe08a" stopOpacity="0" /></radialGradient></defs>
    </g>
    <g className="village-snowman" transform="translate(640 140)">
      <ellipse cx="0" cy="66" rx="30" ry="6" fill="#bcd0d9" />
      <circle cx="0" cy="46" r="22" fill="#fbfdff" /><circle cx="0" cy="16" r="15" fill="#fbfdff" />
      <path d="M-14 50a22 22 0 0 0 30 8" stroke="#cddde5" strokeWidth="4" strokeLinecap="round" />
      <g className="snowman-arm"><path d="M18 34l20-16M31 23l4-9M33 22l8-2" stroke="#5a3a26" strokeWidth="2.6" strokeLinecap="round" /></g>
      <path d="M-18 36l-20-6M-30 32l-6-7" stroke="#5a3a26" strokeWidth="2.6" strokeLinecap="round" />
      <rect x="-13" y="-1" width="26" height="4" rx="2" fill="#1c2928" /><rect x="-9" y="-16" width="18" height="16" rx="2" fill="#1c2928" /><rect x="-9" y="-5" width="18" height="3.5" fill="#d13a48" />
      <g fill="#1c2928"><circle cx="-5" cy="13" r="1.9" /><circle cx="5" cy="13" r="1.9" /><circle cx="0" cy="40" r="2" /><circle cx="0" cy="49" r="2" /></g>
      <path d="M0 17l11 3-11 2Z" fill="#f08a2c" />
      <path d="M-14 27q14 8 28 0" stroke="#d13a48" strokeWidth="6" strokeLinecap="round" />
      <path d="M8 30l4 14" stroke="#d13a48" strokeWidth="5" strokeLinecap="round" />
      <g fill="#f6a8ae" opacity=".75"><circle cx="-9" cy="18" r="2" /><circle cx="9" cy="18" r="2" /></g>
    </g>
    <path d="M0 222c260-16 450 10 650 2s360-10 550-2v28H0Z" fill="#f5fafc" />
    </svg>
  </div>;
}
