import type { SFIconProps } from "@bradleyhodges/sfsymbols-types";
import * as React from "react";
import { cn } from "cn";

/**
 * `SFIcon` – React SVG icon wrapper for the `@bradleyhodges/sfsymbols` symbol set.
 *
 * Key design goals:
 * 1.  **Zero-runtime allocation**
 *     ‑ All heavy calculations (size, stroke props, paths) are memoised.
 * 2.  **Type-safety & IDE experience**
 *     ‑ Prop types live in `@bradleyhodges/sfsymbols-types`, giving consumers auto-complete for every attribute.
 * 3.  **Accessibility first**
 *     ‑ `<title>` and/or explicit `aria-label` determine whether the icon is announced.
 * 4.  **Future-proof**
 *     ‑ Uses the canonical `forwardRef` + `memo` pattern that plays nicely with React 18/19, the Compiler, RSC, etc.
 *
 * Example:
 * ```tsx
 * import { SFIcon } from "@bradleyhodges/sfsymbols-react";
 * import { arrow_forward } from "@bradleyhodges/sfsymbols-icons/solid";
 *
 * <SFIcon icon={arrow_forward} size={20} color="#6366f1" title="Next" />
 * ```
 */

// Base class name for the SVG element
const BASE_CLASS_NAME =
    "inline-block align-middle overflow-visible text-current box-content h-[1em] -leading-[0.125em]";

/**
 * Low-level implementation wrapped by `React.memo` further below.
 *
 * @param props           Component props (see {@link SFIconProps}).
 * @param props.icon      Compiled SF Symbol definition.
 * @param props.color     CSS colour string (falls back to `currentColor`).
 * @param props.weight    Stroke width – when given, icon switches to "outline" mode.
 * @param props.fillOpacity Global fill opacity override.
 * @param props.size      Pixel number or any valid CSS length / keyword.
 * @param props.title     Accessible `<title>` – sets `role="img"`.
 * @param props.aria-label Explicit aria-label (alternative to title).
 * @param ref             Forwarded `SVGSVGElement` ref.
 */
const SFIconBase = React.forwardRef<SVGSVGElement, SFIconProps>(
    (
        {
            icon,
            color,
            className,
            weight = null,
            fillOpacity = null,
            size = null,
            title,
            "aria-label": ariaLabel,
            ...rest
        },
        ref,
    ) => {
        // Extract icon definition data
        const { width, height, svgPathData, viewBox } = icon;

        // Compute the size of the icon
        const computedSize = size ?? width ?? height ?? "1em";

        // ────────────────────────────────────────────────
        // SVG props derived from the optional `weight` prop
        // Memoised so the object identity stays stable between renders.
        const weightProps = React.useMemo<
            Partial<React.SVGProps<SVGSVGElement>>
        >(() => {
            if (!weight) return {};
            return {
                fill: color ?? "currentColor",
                stroke: color ?? "currentColor",
                strokeWidth: `${weight}px`,
                strokeLinejoin: "round",
            };
        }, [weight, color]);

        // If weight is specified, but fillOpacity is not, default to 1
        const effectiveFillOpacity =
            weight && fillOpacity === null ? 1 : fillOpacity;

        // Compute the viewBox of the icon (memoised → stable string)
        const computedViewBox = React.useMemo(() => {
            return viewBox || `0 0 ${width} ${height}`;
        }, [viewBox, width, height]);

        // Unique ID enables multiple identical icons on the same page without ID collisions.
        const id = React.useId();
        const titleId = title ? `${id}-title` : undefined;

        // Determine final aria attributes
        const ariaProps = React.useMemo<React.SVGProps<SVGSVGElement>>(() => {
            return title || ariaLabel
                ? {
                      role: "img",
                      "aria-hidden": false,
                      "aria-labelledby": title ? titleId : undefined,
                      "aria-label": ariaLabel,
                  }
                : {
                      role: "img",
                      "aria-hidden": true,
                  };
        }, [title, titleId, ariaLabel]);

        // Memoise SVG paths.
        //  • Only override `fill` when a `color` prop is provided – allows multi-tone icons.
        //  • Composite key (`idx-d`) avoids collisions when the same path data appears twice.
        // For fill icons, first path is usually the background, and the second (and others) are generally the stroke/line/outline paths.
        const paths = React.useMemo(
            () =>
                svgPathData?.map(
                    (
                        path: {
                            d: string;
                            fill?: string;
                            fillOpacity?: number;
                        },
                        idx: number,
                    ) => (
                        <path
                            key={`${idx}-${path.d}`}
                            d={path.d}
                            fill={color ?? path.fill ?? "currentColor"}
                            fillOpacity={
                                effectiveFillOpacity ?? path.fillOpacity
                            }
                        />
                    ),
                ),
            [svgPathData, color, effectiveFillOpacity],
        );

        // Render the icon
        return (
            <svg
                ref={ref}
                width={computedSize}
                height={computedSize}
                focusable={false}
                xmlns="http://www.w3.org/2000/svg"
                xmlnsXlink="http://www.w3.org/1999/xlink"
                viewBox={computedViewBox}
                preserveAspectRatio="xMidYMid meet"
                className={React.useMemo(
                    () => cn(BASE_CLASS_NAME, className),
                    [className],
                )}
                {...weightProps}
                {...ariaProps}
                {...rest}
            >
                {title ? <title id={titleId}>{title}</title> : undefined}
                {paths}
            </svg>
        );
    },
);
SFIconBase.displayName = "SFIcon";

/**
 * A memoised React component that renders an `@bradleyhodges/sfsymbols` icon as an SVG with customizable properties.
 *
 * @requires React >= 18.0.0
 *
 * @component
 * @param {Object} props - The properties passed to the component.
 * @param {Object} props.icon - The icon object containing SVG data.
 * @param {string} [props.color] - The color of the icon (CSS color string).
 * @param {string} [props.className] - Additional class names for the SVG element.
 * @param {number} [props.weight=null] - The stroke weight (in pixels) of the icon.
 * @param {number} [props.fillOpacity=null] - The fill opacity of the icon (0-1).
 * @param {number|string} [props.size=null] - The size of the icon (number for pixels or string for CSS units).
 * @param {string} [props.title] - The title of the icon.
 * @param {string} [props.ariaLabel] - The aria label of the icon.
 * @param {React.Ref<SVGSVGElement>} ref - The ref to the SVG element.
 *
 * @returns {React.ReactElement} The rendered icon.
 */
export const SFIcon = React.memo(SFIconBase) as React.ForwardRefExoticComponent<
    SFIconProps & React.RefAttributes<SVGSVGElement>
>;

export default SFIcon;
