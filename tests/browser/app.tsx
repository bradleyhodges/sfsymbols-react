import { SFIcon as Styled } from "@bradleyhodges/sfsymbols-react";
import { SFIcon as Unstyled } from "@bradleyhodges/sfsymbols-react/unstyled";
import { sfArrowUpCircle as paletteIcon } from "@bradleyhodges/sfsymbols/sfArrowUpCircle";
import { sfArrowUpCircleFill as icon } from "@bradleyhodges/sfsymbols/sfArrowUpCircleFill";
import * as React from "react";

type Result = {
    id: string;
    width: number;
    height: number;
    ariaHidden: string | null;
    ownsTitle: boolean;
    ownsDescription: boolean;
    pathsMatchSource: boolean;
    fills: Array<string | null>;
    opacities: Array<string | null>;
    hasDefs: boolean;
};

function inspect(svg: SVGSVGElement): Result {
    const titleId = svg.getAttribute("aria-labelledby");
    const descriptionId = svg.getAttribute("aria-describedby");
    const paths = [...svg.querySelectorAll("path")];
    const sourceIcon = svg.dataset.source === "palette" ? paletteIcon : icon;
    const rectangle = svg.getBoundingClientRect();
    return {
        id: svg.id,
        width: rectangle.width,
        height: rectangle.height,
        ariaHidden: svg.getAttribute("aria-hidden"),
        ownsTitle:
            titleId === null ||
            svg.querySelector(`title[id="${titleId}"]`) !== null,
        ownsDescription:
            descriptionId === null ||
            svg.querySelector(`desc[id="${descriptionId}"]`) !== null,
        pathsMatchSource:
            paths.length === sourceIcon.svgPathData.length &&
            paths.every(
                (path, index) =>
                    path.getAttribute("d") === sourceIcon.svgPathData[index]?.d,
            ),
        fills: paths.map((path) => path.getAttribute("fill")),
        opacities: paths.map((path) => path.getAttribute("fill-opacity")),
        hasDefs: svg.querySelector("defs") !== null,
    };
}

export function App() {
    const [active, setActive] = React.useState(false);
    const [showTitle, setShowTitle] = React.useState(true);
    const [clicks, setClicks] = React.useState(0);
    const [keyEvents, setKeyEvents] = React.useState(0);
    const [results, setResults] = React.useState("Waiting for hydration");
    const styledRef = React.useRef<SVGSVGElement>(null);
    const unstyledRef = React.useRef<SVGSVGElement>(null);
    const generatedTitleIds = React.useRef<Record<string, string>>({});

    React.useEffect(() => {
        const frame = requestAnimationFrame(() => {
            const svgs = [
                ...document.querySelectorAll<SVGSVGElement>("main svg"),
            ];
            let stableGeneratedIds = true;
            for (const svg of svgs.filter((node) =>
                node.id.endsWith("-refs"),
            )) {
                const titleId = svg.getAttribute("aria-labelledby");
                if (!titleId) continue;
                const previous = generatedTitleIds.current[svg.id];
                if (previous && previous !== titleId)
                    stableGeneratedIds = false;
                generatedTitleIds.current[svg.id] = titleId;
            }
            const ownedIds = [
                ...document.querySelectorAll("title[id],desc[id]"),
            ].map((node) => node.id);
            setResults(
                JSON.stringify(
                    {
                        hydrated: true,
                        active,
                        showTitle,
                        clicks,
                        keyEvents,
                        refsAttached: [
                            styledRef.current,
                            unstyledRef.current,
                        ].every((node) => node instanceof SVGSVGElement),
                        uniqueIds: new Set(ownedIds).size === ownedIds.length,
                        stableGeneratedIds,
                        cases: svgs.length,
                        rows: svgs.map(inspect),
                    },
                    null,
                    2,
                ),
            );
        });
        return () => cancelAnimationFrame(frame);
    }, [active, clicks, keyEvents, showTitle]);

    const entries = [
        [Styled, "styled", styledRef],
        [Unstyled, "unstyled", unstyledRef],
    ] as const;
    return (
        <main>
            <h1>SFIcon packed browser verification</h1>
            <p>
                Exercise both installed package entries after server rendering
                and hydration.
            </p>
            <button
                type="button"
                onClick={() => setShowTitle((value) => !value)}
            >
                Toggle generated titles
            </button>
            {entries.map(([Icon, kind, ref]) => (
                <section key={kind}>
                    <h2>{kind}</h2>
                    <div>
                        Default <Icon id={`${kind}-default`} icon={icon} />
                    </div>
                    <div>
                        Size 24{" "}
                        <Icon id={`${kind}-size`} icon={icon} size={24} />
                    </div>
                    <div>
                        Size zero{" "}
                        <Icon id={`${kind}-zero`} icon={icon} size={0} />
                    </div>
                    <div>
                        Native dimensions{" "}
                        <Icon
                            id={`${kind}-native`}
                            icon={icon}
                            size={72}
                            width={40}
                            height={28}
                        />
                    </div>
                    <div>
                        Class overrides{" "}
                        <Icon
                            id={`${kind}-class`}
                            icon={icon}
                            size={72}
                            className="w-10 h-8"
                        />
                    </div>
                    <div>
                        Style overrides{" "}
                        <Icon
                            id={`${kind}-style`}
                            icon={icon}
                            size={72}
                            style={{ width: 42, height: 30 }}
                        />
                    </div>
                    <div>
                        <span id={`${kind}-external-label`}>External name</span>
                        <Icon
                            id={`${kind}-external`}
                            icon={icon}
                            aria-labelledby={`${kind}-external-label`}
                        />
                    </div>
                    <div>
                        Generated references{" "}
                        <Icon
                            id={`${kind}-refs`}
                            icon={icon}
                            size={24}
                            title={
                                showTitle
                                    ? active
                                        ? "Active up"
                                        : "Up"
                                    : undefined
                            }
                            description="Moves up"
                            ref={ref}
                            color={active ? "#b42318" : undefined}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                                setActive((value) => !value);
                                setClicks((value) => value + 1);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    setActive((value) => !value);
                                    setKeyEvents((value) => value + 1);
                                }
                            }}
                        />
                    </div>
                    <div>
                        Custom references{" "}
                        <Icon
                            id={`${kind}-custom`}
                            icon={icon}
                            size={24}
                            title="Custom up"
                            description="Custom description"
                            titleId={`${kind}-custom-title`}
                            descriptionId={`${kind}-custom-description`}
                        />
                    </div>
                    <div>
                        Palette and SVG defs{" "}
                        <Icon
                            id={`${kind}-defs`}
                            data-source="palette"
                            icon={paletteIcon}
                            size={24}
                            svgChildren={
                                <defs>
                                    <linearGradient id={`${kind}-gradient`}>
                                        <stop offset="0" stopColor="#b42318" />
                                        <stop offset="1" stopColor="#175cd3" />
                                    </linearGradient>
                                </defs>
                            }
                            pathProps={(_path, index) => ({
                                fill:
                                    index === 0
                                        ? `url(#${kind}-gradient)`
                                        : "#067647",
                            })}
                        />
                    </div>
                    <div>
                        Preserve source opacity{" "}
                        <Icon
                            id={`${kind}-opacity`}
                            icon={icon}
                            size={24}
                            weight={1}
                            preservePathOpacity
                        />
                    </div>
                </section>
            ))}
            <h2>DOM results</h2>
            <pre id="results">{results}</pre>
        </main>
    );
}
