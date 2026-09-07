import * as React from "react";
import type { SFIconProps } from "./types.js";
type ResolveClassName = (className: string | undefined, hasExplicitHeight: boolean) => string | undefined;
/** Creates the shared memoized SVG renderer; entries supply only their class policy. */
export declare function createSFIcon(resolveClassName: ResolveClassName): React.NamedExoticComponent<SFIconProps & React.RefAttributes<SVGSVGElement>>;
export {};
//# sourceMappingURL=create-icon.d.ts.map