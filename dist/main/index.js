"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SFIcon = exports.getIconVariants = exports.getIconKeywords = void 0;
const cn_1 = require("cn");
const create_icon_js_1 = require("./create-icon.js");
var metadata_js_1 = require("./metadata.js");
Object.defineProperty(exports, "getIconKeywords", { enumerable: true, get: function () { return metadata_js_1.getIconKeywords; } });
Object.defineProperty(exports, "getIconVariants", { enumerable: true, get: function () { return metadata_js_1.getIconVariants; } });
const BASE_CLASS_NAME = "inline-block align-middle overflow-visible text-current box-content";
/** Renders an SF Symbol with merged utility classes and a forwarded SVG ref. */
exports.SFIcon = (0, create_icon_js_1.createSFIcon)((className, hasExplicitHeight) => (0, cn_1.cn)(BASE_CLASS_NAME, !hasExplicitHeight && "h-[1em]", "-leading-[0.125em]", className));
exports.default = exports.SFIcon;
