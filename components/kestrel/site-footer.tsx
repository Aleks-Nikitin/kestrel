import { KestrelMark } from "./kestrel-mark";
import { OverviewLink } from "./overview-link";

/** Every link targets a workspace stage that exists; a stage that needs a property simply stays put. */
const LINKS = [
  { id: "overview", label: "Property overview" },
  { id: "building", label: "Building and 3D tour" },
  { id: "underwriting", label: "Investment scenarios" },
  { id: "investigation", label: "AI investigation" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-ink-950 text-ink-200">
      <div className="mx-auto grid max-w-[96rem] gap-x-10 gap-y-6 px-4 py-8 sm:px-6 md:grid-cols-[auto_1fr_minmax(0,24rem)] md:items-start">
        <OverviewLink className="flex items-center gap-3 self-start rounded-md focus-visible:outline-buff-200">
          <KestrelMark tone="light" className="size-9 shrink-0" />
          <span>
            <span className="block text-sm font-bold tracking-[0.2em] text-white [font-stretch:112%]">KESTREL</span>
            <span className="block text-xs text-ink-300">Commercial property intelligence</span>
          </span>
        </OverviewLink>
        <nav aria-label="Footer sections">
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm md:justify-center">
            {LINKS.map((l) => (
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  className="inline-flex min-h-8 items-center text-ink-200 underline-offset-4 hover:text-white hover:underline focus-visible:outline-buff-200"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-[13px] leading-5 text-ink-300">
          Evidence-backed property analysis. Financial scenarios use disclosed assumptions; independent due
          diligence is required.
        </p>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[96rem] flex-wrap justify-between gap-x-6 gap-y-1 px-4 py-3 text-xs text-ink-400 sm:px-6">
          <p>Kestrel · HackPrinceton 2026</p>
          <p>Preliminary investment screening only. Not an appraisal, zoning determination or structural inspection.</p>
        </div>
      </div>
    </footer>
  );
}
