import { SFIcon, getIconVariants } from "@bradleyhodges/sfsymbols-react";
import Unstyled from "@bradleyhodges/sfsymbols-react/unstyled";
import { sfArrowUpCircleFill } from "@bradleyhodges/sfsymbols/sfArrowUpCircleFill";

export default function Page() {
    return (
        <main>
            <h1>Server rendered SF Symbols</h1>
            <SFIcon
                id="server-styled"
                icon={sfArrowUpCircleFill}
                size={24}
                title="Server up"
                description="Styled server icon"
            />
            <Unstyled
                id="server-unstyled"
                icon={sfArrowUpCircleFill}
                title="Plain up"
                description="Unstyled server icon"
                width={32}
                height={32}
            />
            <p id="variant">{getIconVariants(sfArrowUpCircleFill)._}</p>
        </main>
    );
}
