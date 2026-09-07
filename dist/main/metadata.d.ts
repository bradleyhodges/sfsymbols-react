import type { SFIconKeyword, SFIconVariant } from "./types.js";
export type { SFIconKeyword, SFIconVariant } from "./types.js";
/**
 * Returns frozen keyword copies from catalogue arrays or legacy string dictionaries.
 * Invalid fields, inherited properties and accessors are ignored; missing metadata stays absent.
 */
export declare function getIconKeywords(icon: unknown): readonly SFIconKeyword[];
/**
 * Returns a frozen copy of own string-valued variants, preserving source order.
 * Specify extra variant names as the type parameter for custom catalogues.
 */
export declare function getIconVariants<CustomVariant extends string = never>(icon: unknown): Readonly<Partial<Record<SFIconVariant | CustomVariant, string>>>;
//# sourceMappingURL=metadata.d.ts.map