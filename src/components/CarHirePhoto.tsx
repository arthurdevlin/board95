"use client";

import { useState } from "react";
import Image from "next/image";
import { CarFront } from "lucide-react";

export default function CarHirePhoto({ src, model, type, sizes = "(max-width: 360px) 96px, 112px", loading = "lazy" }: { src: string | null; model: string; type: string; sizes?: string; loading?: "lazy" | "eager" }) {
  const [failure, setFailure] = useState<{ src: string; stage: "original" | "missing" } | null>(null);
  const stage = failure?.src === src ? failure.stage : "optimized";
  return src && stage !== "missing"
    ? <Image key={`${src}-${stage}`} src={src} alt={model} fill sizes={sizes} loading={loading} quality={60} unoptimized={stage === "original"} onError={() => setFailure({ src, stage: stage === "optimized" ? "original" : "missing" })}/>
    : <span className="hire-card-placeholder" role="img" aria-label={`${model}: no vehicle photo`}><CarFront size={38} strokeWidth={1.3} aria-hidden="true"/><span>{type}</span></span>;
}
