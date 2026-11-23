/** Ícones do protótipo (traço 2px, currentColor), mesmos caminhos. */
type P = { className?: string };
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const IconPlus = ({ className }: P) => (<svg {...base} strokeWidth={2} className={className} aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>);
export const IconMinus = ({ className }: P) => (<svg {...base} strokeWidth={2} className={className} aria-hidden="true"><path d="M5 12h14" /></svg>);
export const IconX = ({ className }: P) => (<svg {...base} strokeWidth={2} className={className} aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>);
export const IconLeft = ({ className }: P) => (<svg {...base} strokeWidth={2} className={className} aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>);
export const IconRight = ({ className }: P) => (<svg {...base} strokeWidth={2} className={className} aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>);
export const IconArrow = ({ className }: P) => (<svg {...base} strokeWidth={2} className={className} aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const IconCheck = ({ className }: P) => (<svg {...base} strokeWidth={2.2} className={className} aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7" /></svg>);
export const IconSearch = ({ className = "lead" }: P) => (<svg {...base} strokeWidth={2} className={className} aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const IconCopy = ({ className }: P) => (<svg {...base} strokeWidth={2} className={className} aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>);
export const IconHospital = ({ className }: P) => (<svg {...base} strokeWidth={1.5} className={className} aria-hidden="true"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" /></svg>);
export const IconLab = ({ className }: P) => (<svg {...base} strokeWidth={1.5} className={className} aria-hidden="true"><path d="M9 3h6M10 3v6.5L4.5 19a1.3 1.3 0 0 0 1.1 2h12.8a1.3 1.3 0 0 0 1.1-2L14 9.5V3M7.5 15h9" /></svg>);
