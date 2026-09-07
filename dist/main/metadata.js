"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIconKeywords = getIconKeywords;
exports.getIconVariants = getIconVariants;
const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function ownValue(value, key) {
    if (typeof value !== "object" || value === null)
        return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
}
/**
 * Returns frozen keyword copies from catalogue arrays or legacy string dictionaries.
 * Invalid fields, inherited properties and accessors are ignored; missing metadata stays absent.
 */
function getIconKeywords(icon) {
    const keywords = ownValue(icon, "keywords");
    const result = [];
    if (Array.isArray(keywords)) {
        for (let index = 0; index < keywords.length; index++) {
            const keyword = ownValue(keywords, String(index));
            if (!isRecord(keyword))
                continue;
            const text = ownValue(keyword, "text");
            if (typeof text !== "string")
                continue;
            const generic = ownValue(keyword, "generic");
            const priority = ownValue(keyword, "priority");
            result.push(Object.freeze({
                text,
                ...(typeof generic === "boolean" ? { generic } : {}),
                ...(typeof priority === "number" &&
                    Number.isFinite(priority)
                    ? { priority }
                    : {}),
            }));
        }
    }
    else if (isRecord(keywords)) {
        for (const key of Object.keys(keywords)) {
            if (RESERVED_KEYS.has(key))
                continue;
            const text = ownValue(keywords, key);
            if (typeof text === "string")
                result.push(Object.freeze({ text }));
        }
    }
    return Object.freeze(result);
}
/**
 * Returns a frozen, null-prototype copy of own string-valued variants, preserving source order.
 * Specify extra variant names as the type parameter for custom catalogues.
 */
function getIconVariants(icon) {
    const variants = ownValue(icon, "variants");
    const result = Object.create(null);
    if (isRecord(variants)) {
        for (const key of Object.keys(variants)) {
            if (RESERVED_KEYS.has(key))
                continue;
            const value = ownValue(variants, key);
            if (typeof value === "string")
                result[key] = value;
        }
    }
    // Every retained value is validated; arbitrary catalogue names remain optional.
    return Object.freeze(result);
}
