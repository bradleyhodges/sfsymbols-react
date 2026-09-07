export { getIconKeywords, getIconVariants } from "./metadata.js";
export type { IconDefinition, SFIconKeyword, SFIconPath, SFIconPathProps, SFIconProps, SFIconVariant, } from "./types.js";
/** Renders an SF Symbol with merged utility classes and a forwarded SVG ref. */
export declare const SFIcon: import("react").NamedExoticComponent<import("./types.js").SFIconProps & import("react").RefAttributes<SVGSVGElement>>;
export default SFIcon;
