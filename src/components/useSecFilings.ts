import { useEffect, useState } from "react";
import { loadSecFilingsUrl } from "../api/secFilings";

export function useSecFilings(symbol: string): string | null {
  const [result, setResult] = useState<{ symbol: string; url: string | null }>({ symbol: "", url: null });
  useEffect(() => {
    let active = true;
    loadSecFilingsUrl(symbol).then((url) => {
      if (active) setResult({ symbol, url });
    }).catch(() => { if (active) setResult({ symbol, url: null }); });
    return () => { active = false; };
  }, [symbol]);
  return result.symbol === symbol ? result.url : null;
}
