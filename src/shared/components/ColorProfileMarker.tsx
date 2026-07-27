import type { ColorProfile } from "../../features/settings/types";

interface ColorProfileMarkerProps {
  profile: Pick<ColorProfile, "background" | "foreground">;
  size?: "xs" | "sm" | "md";
  className?: string;
}

const MARKER_SIZE = {
  xs: { outer: 8, inner: 3 },
  sm: { outer: 10, inner: 4 },
  md: { outer: 12, inner: 5 },
} as const;

/**
 * Compact connection profile marker that always carries both profile colours.
 * The contrasting centre and border keep either colour visible on surrounding
 * light, dark, active, and inactive surfaces.
 */
export function ColorProfileMarker({
  profile,
  size = "sm",
  className = "",
}: ColorProfileMarkerProps) {
  const dimensions = MARKER_SIZE[size];

  return (
    <span
      aria-hidden="true"
      data-profile-marker="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full border ${className}`}
      style={{
        width: dimensions.outer,
        height: dimensions.outer,
        backgroundColor: profile.background,
        borderColor: profile.foreground,
      }}
    >
      <span
        className="rounded-full"
        style={{
          width: dimensions.inner,
          height: dimensions.inner,
          backgroundColor: profile.foreground,
        }}
      />
    </span>
  );
}
