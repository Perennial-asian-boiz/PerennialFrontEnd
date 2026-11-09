import { publicFloatDate, type PublicFloat } from "../lib/publicFloat";

export default function PublicFloatMetric({ value }: { value: PublicFloat | null }) {
  return <div className="financial-metric-row public-float-metric">
    <span>Public float</span>
    <div>
      <strong>{value ? new Intl.NumberFormat("en-US", {
        style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2,
      }).format(value.value) : "Not available"}</strong>
      {value && <>
        <small>As of <time dateTime={value.asOf}>{publicFloatDate(value.asOf)}</time> · USD</small>
        {value.caution && <small className="public-float-caution">Older measurement</small>}
      </>}
    </div>
  </div>;
}
