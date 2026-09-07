import { cn } from "cn";
import { createSFIcon } from "./create-icon.js";
const BASE_CLASS_NAME = "inline-block align-middle overflow-visible text-current box-content";
/** Renders an SF Symbol with merged utility classes and a forwarded SVG ref. */
export const SFIcon = /* @__PURE__ */ createSFIcon((className, hasExplicitHeight) => cn(BASE_CLASS_NAME, !hasExplicitHeight && "h-[1em]", "-leading-[0.125em]", className));
export default SFIcon;
