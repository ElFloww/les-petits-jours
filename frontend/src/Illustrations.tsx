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
    <g fill="#174b40">
      <path d="m64 64-29 60h15l-27 52h82l-27-52h15ZM155 118l-19 39h9l-19 37h56l-19-37h9ZM1100 71l-29 60h15l-27 52h82l-27-52h15ZM1004 112l-22 45h11l-22 42h66l-22-42h11Z" />
    </g>
    <path d="M209 118h86v80h-86z" fill="#d57c67" /><path d="m195 122 57-58 58 58Z" fill="#174b40" />
    <path d="M255 198v-41h21v41M225 143h16v21h-16" fill="#ffe6aa" />
    <path d="M328 149h62v49h-62z" fill="#efbf63" /><path d="m321 150 38-42 39 42Z" fill="#c17360" />
    <path d="M351 170h16v28h-16" fill="#174b40" />
    <path d="M805 128h84v70h-84z" fill="#efbf63" /><path d="m792 131 55-54 55 54Z" fill="#174b40" />
    <path d="M821 149h15v19h-15M858 149h15v19h-15" fill="#fff9e9" />
    <path d="M907 152h43v46h-43z" fill="#d57c67" /><path d="m900 153 29-33 29 33Z" fill="#174b40" />
    <path d="M921 178h14v20h-14" fill="#ffe6aa" />
    <path d="M268 77V52h13v39" fill="#d57c67" /><path d="M872 91V68h11v35" fill="#efbf63" />
    <g fill="#fffaf0"><circle cx="79" cy="94" r="3" /><circle cx="55" cy="143" r="3" /><circle cx="86" cy="159" r="3" /><circle cx="1099" cy="103" r="3" /><circle cx="1080" cy="150" r="3" /><circle cx="1112" cy="168" r="3" /></g>
    <path d="M0 207c280-22 446 6 653-3s355-5 547-1v17H0Z" fill="#faf7ef" />
  </svg>;
}
