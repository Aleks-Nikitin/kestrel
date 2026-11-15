import { FlaskConical } from "lucide-react";

/** Shown whenever any displayed layer is synthetic fixture data. */
export function SyntheticBanner() {
  return (
    <div
      role="note"
      data-testid="synthetic-banner"
      className="flex items-start gap-2.5 border-b border-dashed border-ochre-600 bg-ochre-50 px-4 py-2 text-[13px] leading-5 text-ochre-800 sm:px-6"
    >
      <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="mx-auto w-full max-w-[96rem]">
        <strong>Synthetic fixture data.</strong> This property, its addresses,
        figures and imagery are fictional and for development only. They are
        not real sponsor records and are not evidence about any real building.
      </p>
    </div>
  );
}
