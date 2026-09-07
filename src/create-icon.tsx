import * as React from "react";
import type { SFIconPathProps, SFIconProps } from "./types.js";

type ResolveClassName = (
    className: string | undefined,
    hasExplicitHeight: boolean,
) => string | undefined;

const RESERVED_PATH_PROPS = new Set([
    "d",
    "key",
    "ref",
    "children",
    "dangerouslySetInnerHTML",
    "__proto__",
    "constructor",
    "prototype",
]);

function safePathProps(props: SFIconPathProps): SFIconPathProps {
    return Object.fromEntries(
        Object.entries(props).filter(
            ([name]) => !RESERVED_PATH_PROPS.has(name),
        ),
    );
}

/** Creates the shared memoized SVG renderer; entries supply only their class policy. */
export function createSFIcon(resolveClassName: ResolveClassName) {
    const SFIconBase = React.forwardRef<SVGSVGElement, SFIconProps>(
        (
            {
                icon,
                color,
                className,
                weight = null,
                fillOpacity = null,
                size = null,
                width: nativeWidth,
                height: nativeHeight,
                title,
                description,
                titleId: customTitleId,
                descriptionId: customDescriptionId,
                svgChildren,
                children: _children,
                preservePathOpacity = false,
                pathProps,
                "aria-label": ariaLabel,
                ...rest
            },
            ref,
        ) => {
            const { width, height, svgPathData, viewBox } = icon;
            const definitionSize =
                typeof width === "number" && Number.isFinite(width) && width > 0
                    ? width
                    : typeof height === "number" &&
                        Number.isFinite(height) &&
                        height > 0
                      ? height
                      : "1em";
            const computedSize = size ?? definitionSize;
            const hasExplicitHeight = size != null || nativeHeight != null;
            const svgClassName = React.useMemo(
                () => resolveClassName(className, hasExplicitHeight),
                [className, hasExplicitHeight, resolveClassName],
            );
            const weightProps = React.useMemo<React.SVGProps<SVGSVGElement>>(
                () =>
                    weight
                        ? {
                              fill: color ?? "currentColor",
                              stroke: color ?? "currentColor",
                              strokeWidth: `${weight}px`,
                              strokeLinejoin: "round",
                          }
                        : {},
                [weight, color],
            );
            const effectiveFillOpacity =
                weight && fillOpacity === null && !preservePathOpacity
                    ? 1
                    : fillOpacity;
            const computedViewBox = React.useMemo(
                () => viewBox || `0 0 ${width} ${height}`,
                [viewBox, width, height],
            );

            // Always allocate the ID so changing accessibility props preserves hook order.
            const id = React.useId();
            const titleId = title
                ? (customTitleId ?? `${id}-title`)
                : undefined;
            const descriptionId = description
                ? (customDescriptionId ?? `${id}-description`)
                : undefined;
            const paths = React.useMemo(
                () =>
                    svgPathData?.map((path, index) => {
                        const overrides =
                            typeof pathProps === "function"
                                ? pathProps(path, index)
                                : pathProps;
                        return (
                            <path
                                key={`${index}-${path.d}`}
                                d={path.d}
                                fill={color ?? path.fill ?? "currentColor"}
                                fillOpacity={
                                    effectiveFillOpacity ?? path.fillOpacity
                                }
                                {...(overrides ? safePathProps(overrides) : {})}
                            />
                        );
                    }),
                [svgPathData, color, effectiveFillOpacity, pathProps],
            );

            return (
                <svg
                    ref={ref}
                    width={nativeWidth ?? computedSize}
                    height={nativeHeight ?? computedSize}
                    focusable={false}
                    xmlns="http://www.w3.org/2000/svg"
                    xmlnsXlink="http://www.w3.org/1999/xlink"
                    viewBox={computedViewBox}
                    preserveAspectRatio="xMidYMid meet"
                    className={svgClassName}
                    {...weightProps}
                    role="img"
                    aria-hidden={
                        !(title || ariaLabel || rest["aria-labelledby"])
                    }
                    aria-label={ariaLabel}
                    aria-labelledby={titleId}
                    aria-describedby={descriptionId}
                    {...rest}
                >
                    {title ? <title id={titleId}>{title}</title> : undefined}
                    {description ? (
                        <desc id={descriptionId}>{description}</desc>
                    ) : undefined}
                    {svgChildren}
                    {paths}
                </svg>
            );
        },
    );
    SFIconBase.displayName = "SFIcon";
    return React.memo(SFIconBase);
}
