"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cn = void 0;
const clsx_1 = require("clsx");
const tailwind_merge_1 = require("tailwind-merge");
/**
 * Combines multiple class names into a single string, merging Tailwind CSS classes intelligently.
 *
 * @param {...ClassValue[]} inputs - An array of class values to be combined.
 * @returns {string} - A single string containing the combined class names.
 */
const cn = (...inputs) => (0, tailwind_merge_1.twMerge)((0, clsx_1.clsx)(inputs));
exports.cn = cn;
