export default function RouteLoading({ label = "Loading Board95", auth = false }: { label?: string; auth?: boolean }) {
  return <section className={"route-loading" + (auth ? " route-loading-auth" : "")} role="status" aria-label={label}>
    <span className="route-loading-spinner" aria-hidden="true"/>
    <span className="route-loading-label">{label}...</span>
    {auth ? <div className="route-loading-card"><span/><span/><span/><b/></div> : <div className="route-loading-skeleton"><i/><i/><i/></div>}
  </section>;
}
