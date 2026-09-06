"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SFIcon = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const cn_1 = require("cn");
const React = __importStar(require("react"));
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
const BASE_CLASS_NAME = "inline-block align-middle overflow-visible text-current box-content h-[1em] -leading-[0.125em]";
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
const SFIconBase = React.forwardRef(({ icon, color, className, weight = null, fillOpacity = null, size = null, title, "aria-label": ariaLabel, ...rest }, ref) => {
    // Extract icon definition data
    const { width, height, svgPathData, viewBox } = icon;
    // Compute the size of the icon
    const computedSize = size ?? width ?? height ?? "1em";
    // ────────────────────────────────────────────────
    // SVG props derived from the optional `weight` prop
    // Memoised so the object identity stays stable between renders.
    const weightProps = React.useMemo(() => {
        if (!weight)
            return {};
        return {
            fill: color ?? "currentColor",
            stroke: color ?? "currentColor",
            strokeWidth: `${weight}px`,
            strokeLinejoin: "round",
        };
    }, [weight, color]);
    // If weight is specified, but fillOpacity is not, default to 1
    const effectiveFillOpacity = weight && fillOpacity === null ? 1 : fillOpacity;
    // Compute the viewBox of the icon (memoised → stable string)
    const computedViewBox = React.useMemo(() => {
        return viewBox || `0 0 ${width} ${height}`;
    }, [viewBox, width, height]);
    // Unique ID enables multiple identical icons on the same page without ID collisions.
    const id = React.useId();
    const titleId = title ? `${id}-title` : undefined;
    // Determine final aria attributes
    const ariaProps = React.useMemo(() => {
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
    const paths = React.useMemo(() => svgPathData?.map((path, idx) => ((0, jsx_runtime_1.jsx)("path", { d: path.d, fill: color ?? path.fill ?? "currentColor", fillOpacity: effectiveFillOpacity ?? path.fillOpacity }, `${idx}-${path.d}`))), [svgPathData, color, effectiveFillOpacity]);
    // Render the icon
    return ((0, jsx_runtime_1.jsxs)("svg", { ref: ref, width: computedSize, height: computedSize, focusable: false, xmlns: "http://www.w3.org/2000/svg", xmlnsXlink: "http://www.w3.org/1999/xlink", viewBox: computedViewBox, preserveAspectRatio: "xMidYMid meet", className: React.useMemo(() => (0, cn_1.cn)(BASE_CLASS_NAME, className), [className]), ...weightProps, ...ariaProps, ...rest, children: [title ? (0, jsx_runtime_1.jsx)("title", { id: titleId, children: title }) : undefined, paths] }));
});
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
exports.SFIcon = React.memo(SFIconBase);
exports.default = exports.SFIcon;
