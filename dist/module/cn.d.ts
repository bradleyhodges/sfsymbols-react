import { type ClassValue } from "clsx";
/**
 * Combines multiple class names into a single string, merging Tailwind CSS classes intelligently.
 *
 * @param {...ClassValue[]} inputs - An array of class values to be combined.
 * @returns {string} - A single string containing the combined class names.
 */
export declare const cn: (...inputs: ClassValue[]) => string;
