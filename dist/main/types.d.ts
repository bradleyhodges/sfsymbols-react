import type { IconDefinition, SFIconProps as LegacySFIconProps } from "@bradleyhodges/sfsymbols-types";
import type * as React from "react";
export type { IconDefinition, SFIconVariant, } from "@bradleyhodges/sfsymbols-types";
/** Original icon geometry and paint attributes, exposed read-only to path callbacks. */
export type SFIconPath = Readonly<IconDefinition["svgPathData"][number]>;
/** Validated keyword metadata. Legacy string dictionaries supply only text. */
export interface SFIconKeyword {
    readonly text: string;
    readonly generic?: boolean;
    readonly priority?: number;
}
/** Per-path presentation and event props; geometry and child ownership stay with SFIcon. */
export type SFIconPathProps = Omit<React.SVGProps<SVGPathElement>, "d" | "key" | "ref" | "children" | "dangerouslySetInnerHTML">;
/** Additive React API, retaining compatibility with the companion package's legacy props. */
export interface SFIconProps extends LegacySFIconProps {
    /** Sets both dimensions; falls back to a positive definition dimension, then 1em. */
    size?: LegacySFIconProps["size"];
    /** Native width overrides size and the definition's square fallback. */
    width?: React.SVGProps<SVGSVGElement>["width"];
    /** Native height overrides size and removes the styled entry's default height class. */
    height?: React.SVGProps<SVGSVGElement>["height"];
    /** Accessible description rendered as a linked SVG desc element. */
    description?: string;
    /** Overrides the generated title ID when a title is provided. */
    titleId?: string;
    /** Overrides the generated description ID when a description is provided. */
    descriptionId?: string;
    /** Additional SVG content rendered before paths; legacy children remain ignored. */
    svgChildren?: React.ReactNode;
    /** Preserve source path opacity with weight; explicit fillOpacity still takes precedence. */
    preservePathOpacity?: boolean;
    /** Explicit path overrides, applied after color and opacity. Original geometry is immutable. */
    pathProps?: SFIconPathProps | ((path: SFIconPath, index: number) => SFIconPathProps);
}
//# sourceMappingURL=types.d.ts.map