"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SFIcon = exports.default = exports.getIconVariants = exports.getIconKeywords = void 0;
var metadata_js_1 = require("./metadata.js");
Object.defineProperty(exports, "getIconKeywords", { enumerable: true, get: function () { return metadata_js_1.getIconKeywords; } });
Object.defineProperty(exports, "getIconVariants", { enumerable: true, get: function () { return metadata_js_1.getIconVariants; } });
var styled_js_1 = require("./styled.js");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return __importDefault(styled_js_1).default; } });
Object.defineProperty(exports, "SFIcon", { enumerable: true, get: function () { return styled_js_1.SFIcon; } });
