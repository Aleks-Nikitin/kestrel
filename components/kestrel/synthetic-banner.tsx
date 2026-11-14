import { FlaskConical } from "lucide-react";

/** Shown whenever any displayed layer is synthetic fixture data. */
export function SyntheticBanner() {
  return (
    <div
      role="note"
      data-testid="synthetic-banner"
      className="flex items-start gap-3 rounded-lg border border-fuchsia-300 bg-fuchsia-50 px-4 py-3 text-sm text-fuchsia-950"
    >
      <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        <strong>Synthetic fixture data.</strong> This property, its addresses,
        figures and imagery are fictional and for development only. They are
        not real sponsor records and are not evidence about any real building.
      </p>
    </div>
  );
}
