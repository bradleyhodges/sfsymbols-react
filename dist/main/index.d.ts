import type { SFIconProps } from "@bradleyhodges/sfsymbols-types";
import * as React from "react";
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
export declare const SFIcon: React.ForwardRefExoticComponent<SFIconProps & React.RefAttributes<SVGSVGElement>>;
export default SFIcon;
