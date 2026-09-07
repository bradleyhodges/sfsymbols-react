import { createSFIcon } from "./create-icon.js";

export type {
    IconDefinition,
    SFIconKeyword,
    SFIconPath,
    SFIconPathProps,
    SFIconProps,
    SFIconVariant,
} from "./types.js";

/** Renders the same SF Symbol SVG contract with caller classes passed through unchanged. */
export const SFIcon = createSFIcon((className) => className);

export default SFIcon;
