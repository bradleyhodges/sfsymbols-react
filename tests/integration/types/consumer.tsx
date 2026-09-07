import Root, {
    SFIcon,
    getIconKeywords,
    getIconVariants,
    type IconDefinition,
    type SFIconPath,
    type SFIconProps,
} from "@bradleyhodges/sfsymbols-react";
import { getIconVariants as getVariantsFromSubpath } from "@bradleyhodges/sfsymbols-react/metadata";
import type { SFIconKeyword } from "@bradleyhodges/sfsymbols-react/types";
import Unstyled from "@bradleyhodges/sfsymbols-react/unstyled";
import * as React from "react";

declare const icon: IconDefinition;
const ref = React.createRef<SVGSVGElement>();
const props: SFIconProps = {
    icon,
    description: "Description",
    pathProps: (path: SFIconPath) => ({ fill: path.fill }),
};
const styled = <SFIcon {...props} ref={ref} />;
const unstyled = <Unstyled {...props} />;
const sameComponent: typeof SFIcon = Root;
const keywords: readonly SFIconKeyword[] = getIconKeywords(icon);
const custom: string | undefined = getIconVariants<"custom">(icon).custom;
const fill: string | undefined = getVariantsFromSubpath(icon).fill;

export { custom, fill, keywords, sameComponent, styled, unstyled };
