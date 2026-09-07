const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
const test = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

test("public types are additive and reject unsafe path props", () => {
    const {
        mkdirSync,
        mkdtempSync,
        writeFileSync,
        rmSync,
    } = require("node:fs");
    const { join, resolve } = require("node:path");
    const { spawnSync } = require("node:child_process");
    const buildDir = resolve(__dirname, "../build-out");
    mkdirSync(buildDir, { recursive: true });
    const fixtureDir = mkdtempSync(join(buildDir, "component-types-"));
    const file = join(fixtureDir, "consumer.tsx");
    writeFileSync(
        file,
        `
import * as React from "react";
import type { SFIconProps as LegacyProps } from "@bradleyhodges/sfsymbols-types";
import SFIcon, { getIconKeywords, getIconVariants } from "../../dist/main/index.js";
import type { SFIconProps, SFIconPathProps, SFIconPath, SFIconKeyword, SFIconVariant, IconDefinition } from "../../dist/main/index.js";
import Unstyled from "../../dist/main/unstyled.js";
declare const legacy: LegacyProps;
declare const icon: IconDefinition;
const compatible: SFIconProps = legacy;
const ref = React.createRef<SVGSVGElement>();
const element = <SFIcon {...compatible} width={24} height="2em" ref={ref} description="Details" titleId="title" descriptionId="description" preservePathOpacity svgChildren={<defs />} pathProps={(path: SFIconPath, index: number) => ({ fill: index ? path.fill : "blue" })} />;
const unstyled = <Unstyled icon={icon} ref={ref} pathProps={{ strokeWidth: 2, style: { fillOpacity: 0.5 } }} />;
const variant: SFIconVariant = "fill";
const keywords: readonly SFIconKeyword[] = getIconKeywords(icon);
const custom: string | undefined = getIconVariants<"custom">(icon).custom;
// @ts-expect-error geometry is immutable through pathProps
const geometry: SFIconPathProps = { d: "M0 0" };
// @ts-expect-error refs cannot be attached through pathProps
const pathRef: SFIconPathProps = { ref: React.createRef<SVGPathElement>() };
// @ts-expect-error React keys remain renderer-owned
const pathKey: SFIconPathProps = { key: "key" };
// @ts-expect-error children must use svgChildren
const children: SFIconPathProps = { children: "text" };
// @ts-expect-error raw markup cannot enter paths
const html: SFIconPathProps = { dangerouslySetInnerHTML: { __html: "" } };
// @ts-expect-error keyword views are readonly
keywords.push({ text: "mutation" });
// @ts-expect-error keyword entries are readonly
keywords[0].text = "mutation";
// @ts-expect-error variants are readonly
getIconVariants(icon).fill = "mutation";
`,
    );
    try {
        const result = spawnSync(
            process.execPath,
            [
                resolve(
                    require.resolve("typescript/package.json"),
                    "../bin/tsc",
                ),
                "--ignoreConfig",
                "--noEmit",
                "--strict",
                "--skipLibCheck",
                "--jsx",
                "react-jsx",
                "--module",
                "NodeNext",
                "--target",
                "es2022",
                file,
            ],
            { encoding: "utf8" },
        );
        assert.equal(result.status, 0, result.stdout + result.stderr);
    } finally {
        rmSync(fixtureDir, { recursive: true, force: true });
    }
});

const icon = Object.freeze({
    iconName: "sfTest",
    sourceName: "test",
    family: null,
    style: null,
    width: 0,
    height: 0,
    viewBox: "0 0 20 10",
    categories: [],
    svgPathData: Object.freeze([
        Object.freeze({ d: "M0 0h20v10z", fill: "red", fillOpacity: 0.35 }),
        Object.freeze({ d: "M0 0h20v10z", fillOpacity: 0.85 }),
    ]),
    variants: null,
    keywords: null,
});

for (const entry of ["index", "unstyled"]) {
    const entryPath = `../dist/main/${entry}.js`;
    const modulePath = require("node:path").resolve(__dirname, entryPath);
    const api = existsSync(modulePath) ? require(modulePath) : {};
    const render = (props = {}) => {
        assert.equal(typeof api.SFIcon, "object", `${entry} exports SFIcon`);
        return renderToStaticMarkup(
            React.createElement(api.SFIcon, { icon, ...props }),
        );
    };

    test(`${entry}: preserves named/default memoized ref-forwarding exports`, () => {
        assert.ok(api.SFIcon);
        assert.equal(api.default, api.SFIcon);
        assert.equal(api.SFIcon.$$typeof, Symbol.for("react.memo"));
        assert.equal(api.SFIcon.type.$$typeof, Symbol.for("react.forward_ref"));
    });
    test(`${entry}: zero definition dimensions use 1em, explicit size zero survives`, () => {
        assert.match(render(), /width="1em" height="1em"/);
        assert.match(render({ size: 0 }), /width="0" height="0"/);
        assert.match(render({ size: "2rem" }), /width="2rem" height="2rem"/);
    });
    test(`${entry}: keeps square fallback and native dimension precedence`, () => {
        assert.match(
            render({ icon: { ...icon, width: 20, height: 10 } }),
            /width="20" height="20"/,
        );
        assert.match(
            render({ icon: { ...icon, width: 0, height: 10 } }),
            /width="10" height="10"/,
        );
        assert.match(
            render({ size: 24, width: 36, height: 18 }),
            /width="36" height="18"/,
        );
        assert.match(
            render({ size: 24, style: { height: 40 } }),
            /style="height:40px"/,
        );
    });
    test(`${entry}: external accessible names and explicit ARIA retain precedence`, () => {
        assert.match(render(), /aria-hidden="true"/);
        assert.match(
            render({ "aria-labelledby": "external" }),
            /aria-hidden="false"/,
        );
        const html = render({
            title: "Title",
            "aria-label": "Label",
            "aria-labelledby": "external",
            "aria-describedby": "external-desc",
            "aria-hidden": true,
            role: "presentation",
        });
        assert.match(html, /aria-labelledby="external"/);
        assert.match(html, /aria-describedby="external-desc"/);
        assert.match(html, /aria-label="Label"/);
        assert.match(html, /aria-hidden="true"/);
        assert.match(html, /role="presentation"/);
    });
    test(`${entry}: explicitly undefined ARIA references suppress generated links`, () => {
        const html = render({
            title: "Fallback title",
            description: "Fallback description",
            titleId: "fallback-title",
            descriptionId: "fallback-description",
            "aria-label": "Caller name",
            "aria-labelledby": undefined,
            "aria-describedby": undefined,
        });
        assert.doesNotMatch(html, /aria-labelledby=|aria-describedby=/);
        assert.match(html, /aria-label="Caller name"/);
        assert.match(html, /aria-hidden="false"/);
        assert.match(
            html,
            /<title id="fallback-title">Fallback title<\/title>/,
        );
        assert.match(
            html,
            /<desc id="fallback-description">Fallback description<\/desc>/,
        );
    });
    test(`${entry}: custom title/description IDs link escaped content`, () => {
        const html = render({
            title: "A < B",
            description: "Details & more",
            titleId: "title-1",
            descriptionId: "desc-1",
        });
        assert.match(html, /aria-labelledby="title-1"/);
        assert.match(html, /aria-describedby="desc-1"/);
        assert.match(
            html,
            /<title id="title-1">A &lt; B<\/title><desc id="desc-1">Details &amp; more<\/desc>/,
        );
        assert.doesNotMatch(html, /titleId=|descriptionId=|description=/);
    });
    test(`${entry}: generated IDs are unique for multiple icons`, () => {
        assert.ok(api.SFIcon);
        const html = renderToStaticMarkup(
            React.createElement(
                "div",
                null,
                React.createElement(api.SFIcon, {
                    icon,
                    title: "One",
                    description: "First",
                }),
                React.createElement(api.SFIcon, {
                    icon,
                    title: "Two",
                    description: "Second",
                }),
            ),
        );
        const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(
            (match) => match[1],
        );
        assert.equal(ids.length, 4);
        assert.equal(new Set(ids).size, 4);
        for (const id of ids) assert.ok(html.includes(`="${id}"`));
    });
    test(`${entry}: legacy children ignored, svgChildren compose before paths`, () => {
        assert.doesNotMatch(
            render({ children: React.createElement("text", null, "legacy") }),
            /legacy/,
        );
        const html = render({
            svgChildren: React.createElement(
                "defs",
                null,
                React.createElement("linearGradient", { id: "gradient" }),
            ),
        });
        assert.match(
            html,
            /<defs><linearGradient id="gradient"><\/linearGradient><\/defs><path/,
        );
        assert.doesNotMatch(html, /svgChildren=/);
    });
    test(`${entry}: source geometry, fill and opacity survive; legacy overrides work`, () => {
        const html = render();
        assert.equal([...html.matchAll(/d="M0 0h20v10z"/g)].length, 2);
        assert.match(html, /fill="red" fill-opacity="0.35"/);
        assert.match(html, /fill="currentColor" fill-opacity="0.85"/);
        const weighted = render({ color: "blue", weight: 2 });
        assert.match(
            weighted,
            /stroke="blue" stroke-width="2px" stroke-linejoin="round"/,
        );
        assert.equal([...weighted.matchAll(/fill-opacity="1"/g)].length, 2);
        assert.match(
            render({ weight: 2, preservePathOpacity: true }),
            /fill-opacity="0.35"/,
        );
        assert.equal(
            [
                ...render({
                    weight: 2,
                    preservePathOpacity: true,
                    fillOpacity: 0,
                }).matchAll(/fill-opacity="0"/g),
            ].length,
            2,
        );
    });
    test(`${entry}: explicit pathProps styles override generated styles`, () => {
        const seen = [];
        const html = render({
            color: "blue",
            fillOpacity: 1,
            pathProps: (path, index) => {
                seen.push([path, index]);
                return {
                    fill: index ? "yellow" : "url(#gradient)",
                    fillOpacity: 0.2,
                    style: { stroke: "green" },
                    className: "path-style",
                };
            },
        });
        assert.equal(seen[0][0], icon.svgPathData[0]);
        assert.equal(seen[1][1], 1);
        assert.match(html, /fill="url\(#gradient\)" fill-opacity="0.2"/);
        assert.match(html, /style="stroke:green" class="path-style"/);
        assert.match(html, /fill="yellow"/);
        assert.match(
            render({ pathProps: { fill: "purple" } }),
            /fill="purple"/,
        );
    });
    test(`${entry}: pathProps cannot replace geometry or inject children/inner HTML`, () => {
        const html = render({
            pathProps: {
                d: "M999 999",
                key: "bad",
                ref: () => {
                    throw Error("invalid ref");
                },
                children: "injected",
                dangerouslySetInnerHTML: {
                    __html: "<script>injected</script>",
                },
                fill: "green",
            },
        });
        assert.doesNotMatch(
            html,
            /M999|injected|key="bad"|dangerouslySetInnerHTML/,
        );
        assert.equal([...html.matchAll(/d="M0 0h20v10z"/g)].length, 2);
        assert.match(html, /fill="green"/);
    });
    test(`${entry}: sizing classes follow entry contract`, () => {
        if (entry === "unstyled") {
            assert.doesNotMatch(render(), /class=/);
            assert.match(
                render({ className: " h-8 h-10  custom " }),
                /class=" h-8 h-10 {2}custom "/,
            );
        } else {
            assert.match(render(), /h-\[1em\]/);
            assert.doesNotMatch(render({ size: 24 }), /h-\[1em\]/);
            assert.doesNotMatch(render({ height: 18 }), /h-\[1em\]/);
            assert.match(render({ width: 18 }), /h-\[1em\]/);
            assert.match(
                render({ size: 24, className: "h-8 h-10 custom" }),
                /h-10 custom/,
            );
            assert.doesNotMatch(
                render({ className: "h-8 h-10 custom" }),
                /h-8|h-\[1em\]/,
            );
        }
    });
}
