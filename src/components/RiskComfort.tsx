type RiskLevel = "Conservative" | "Moderate" | "High";

type RiskComfortProps = {
  value: RiskLevel | "";
  onChange: (value: RiskLevel) => void;
};

const levels: RiskLevel[] = ["Conservative", "Moderate", "High"];

export default function RiskComfort({ value, onChange }: RiskComfortProps) {
  return <div className="risk-comfort" role="radiogroup" aria-label="Risk comfort"><svg className="risk-gauge" viewBox="0 0 320 178" aria-hidden="true"><path d="M10 164a150 150 0 0 1 300 0Z" fill="#e8f6e6" /><path className="risk-segment" d="M160 164 10 164a150 150 0 0 1 75-130Z" fill={value === "Conservative" ? "#08a044" : "#e8f6e6"} onClick={() => onChange("Conservative")} /><path className="risk-segment" d="M160 164 85 34a150 150 0 0 1 150 0Z" fill={value === "Moderate" ? "#f6b267" : "#e8f6e6"} onClick={() => onChange("Moderate")} /><path className="risk-segment" d="M160 164 235 34a150 150 0 0 1 75 130Z" fill={value === "High" ? "#ef4444" : "#e8f6e6"} onClick={() => onChange("High")} /><path d="M10 164a150 150 0 0 1 300 0" fill="none" stroke="#c7c7c7" strokeWidth="2" /><path d="M10 164h300" fill="none" stroke="#187b46" strokeWidth="2" /><path d="M85 34 160 164 235 34" fill="none" stroke="#fff" strokeWidth="3" /></svg><div className="risk-labels">{levels.map((level) => <button key={level} className={value === level ? `risk-label selected risk-label-${level.toLowerCase()}` : "risk-label"} type="button" role="radio" aria-checked={value === level} onClick={() => onChange(level)}>{level}</button>)}</div></div>;
}
