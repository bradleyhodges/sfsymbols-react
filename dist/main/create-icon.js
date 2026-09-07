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
exports.createSFIcon = createSFIcon;
const jsx_runtime_1 = require("react/jsx-runtime");
const React = __importStar(require("react"));
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
function safePathProps(props) {
    return Object.fromEntries(Object.entries(props).filter(([name]) => !RESERVED_PATH_PROPS.has(name)));
}
/** Creates the shared memoized SVG renderer; entries supply only their class policy. */
function createSFIcon(resolveClassName) {
    const SFIconBase = React.forwardRef(({ icon, color, className, weight = null, fillOpacity = null, size = null, width: nativeWidth, height: nativeHeight, title, description, titleId: customTitleId, descriptionId: customDescriptionId, svgChildren, children: _children, preservePathOpacity = false, pathProps, "aria-label": ariaLabel, ...rest }, ref) => {
        const { width, height, svgPathData, viewBox } = icon;
        const definitionSize = typeof width === "number" && Number.isFinite(width) && width > 0
            ? width
            : typeof height === "number" &&
                Number.isFinite(height) &&
                height > 0
                ? height
                : "1em";
        const computedSize = size ?? definitionSize;
        const hasExplicitHeight = size != null || nativeHeight != null;
        const svgClassName = React.useMemo(() => resolveClassName(className, hasExplicitHeight), [className, hasExplicitHeight, resolveClassName]);
        const weightProps = React.useMemo(() => weight
            ? {
                fill: color ?? "currentColor",
                stroke: color ?? "currentColor",
                strokeWidth: `${weight}px`,
                strokeLinejoin: "round",
            }
            : {}, [weight, color]);
        const effectiveFillOpacity = weight && fillOpacity === null && !preservePathOpacity
            ? 1
            : fillOpacity;
        const computedViewBox = React.useMemo(() => viewBox || `0 0 ${width} ${height}`, [viewBox, width, height]);
        // Always allocate the ID so changing accessibility props preserves hook order.
        const id = React.useId();
        const titleId = title
            ? (customTitleId ?? `${id}-title`)
            : undefined;
        const descriptionId = description
            ? (customDescriptionId ?? `${id}-description`)
            : undefined;
        const paths = React.useMemo(() => svgPathData?.map((path, index) => {
            const overrides = typeof pathProps === "function"
                ? pathProps(path, index)
                : pathProps;
            return ((0, jsx_runtime_1.jsx)("path", { d: path.d, fill: color ?? path.fill ?? "currentColor", fillOpacity: effectiveFillOpacity ?? path.fillOpacity, ...(overrides ? safePathProps(overrides) : {}) }, `${index}-${path.d}`));
        }), [svgPathData, color, effectiveFillOpacity, pathProps]);
        return ((0, jsx_runtime_1.jsxs)("svg", { ref: ref, width: nativeWidth ?? computedSize, height: nativeHeight ?? computedSize, focusable: false, xmlns: "http://www.w3.org/2000/svg", xmlnsXlink: "http://www.w3.org/1999/xlink", viewBox: computedViewBox, preserveAspectRatio: "xMidYMid meet", className: svgClassName, ...weightProps, role: "img", "aria-hidden": !(title || ariaLabel || rest["aria-labelledby"]), "aria-label": ariaLabel, "aria-labelledby": titleId, "aria-describedby": descriptionId, ...rest, children: [title ? (0, jsx_runtime_1.jsx)("title", { id: titleId, children: title }) : undefined, description ? ((0, jsx_runtime_1.jsx)("desc", { id: descriptionId, children: description })) : undefined, svgChildren, paths] }));
    });
    SFIconBase.displayName = "SFIcon";
    return React.memo(SFIconBase);
}
