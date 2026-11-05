import type { HTMLAttributes } from "react";

export default function PageIntro({ children, className = "dashboard-intro", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={className}>
    <span className="hero-watermark" aria-hidden="true">95</span>
    {children}
  </div>;
}
