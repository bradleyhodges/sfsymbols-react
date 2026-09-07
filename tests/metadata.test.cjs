const assert = require("node:assert/strict");
const test = require("node:test");
const api = require("../dist/main/index.js");

test("metadata helpers are exported from root and the metadata entry", () => {
    assert.equal(typeof api.getIconKeywords, "function");
    assert.equal(typeof api.getIconVariants, "function");
    const metadata = require("../dist/main/metadata.js");
    assert.equal(api.getIconKeywords, metadata.getIconKeywords);
    assert.equal(api.getIconVariants, metadata.getIconVariants);
});
test("keyword arrays validate fields and retain order without mutating caller data", () => {
    assert.equal(typeof api.getIconKeywords, "function");
    const source = Object.freeze([
        Object.freeze({ text: "number", generic: true, priority: 0 }),
        Object.freeze({ text: "digit" }),
        null,
        2,
        { text: 3 },
        { text: "bad optional", generic: "yes", priority: Number.NaN },
    ]);
    const result = api.getIconKeywords({ keywords: source });
    assert.deepEqual(result, [
        { text: "number", generic: true, priority: 0 },
        { text: "digit" },
        { text: "bad optional" },
    ]);
    assert.notEqual(result, source);
    assert.notEqual(result[0], source[0]);
    assert.ok(Object.isFrozen(result));
    assert.ok(result.every(Object.isFrozen));
});
test("legacy dictionaries use string values as text with no invented metadata", () => {
    assert.equal(typeof api.getIconKeywords, "function");
    assert.deepEqual(
        api.getIconKeywords({
            keywords: { first: "number", second: "digit", invalid: 2 },
        }),
        [{ text: "number" }, { text: "digit" }],
    );
});
test("null, primitives and malformed metadata produce empty safe results", () => {
    assert.equal(typeof api.getIconKeywords, "function");
    assert.equal(typeof api.getIconVariants, "function");
    for (const value of [null, undefined, false, true, 42, "text", () => {}]) {
        assert.deepEqual(api.getIconKeywords(value), []);
        assert.deepEqual(api.getIconVariants(value), {});
        assert.deepEqual(api.getIconKeywords({ keywords: value }), []);
        assert.deepEqual(api.getIconVariants({ variants: value }), {});
    }
    assert.deepEqual(api.getIconVariants({ variants: ["sfCircle"] }), {});
});
test("variant views preserve known and custom names and reject invalid values", () => {
    assert.equal(typeof api.getIconVariants, "function");
    const source = Object.freeze({
        fill: "sfCircleFill",
        custom: "sfCustom",
        bad: 2,
    });
    const result = api.getIconVariants({ variants: source });
    assert.deepEqual(result, { fill: "sfCircleFill", custom: "sfCustom" });
    assert.notEqual(result, source);
    assert.ok(Object.isFrozen(result));
});
test("inherited properties, getters and prototype keys are never trusted", () => {
    assert.equal(typeof api.getIconKeywords, "function");
    assert.equal(typeof api.getIconVariants, "function");
    const source = Object.create({ inherited: "sfInherited" });
    source.fill = "sfCircleFill";
    Object.defineProperty(source, "getter", {
        enumerable: true,
        get() {
            throw Error("must not execute getters");
        },
    });
    Object.defineProperty(source, "__proto__", {
        enumerable: true,
        value: "sfUnsafe",
    });
    assert.deepEqual(api.getIconVariants({ variants: source }), {
        fill: "sfCircleFill",
    });
    assert.deepEqual(api.getIconKeywords({ keywords: source }), [
        { text: "sfCircleFill" },
    ]);
    assert.deepEqual(
        api.getIconVariants(Object.create({ variants: source })),
        {},
    );
    assert.deepEqual(
        api.getIconKeywords(Object.create({ keywords: source })),
        [],
    );
    assert.deepEqual(
        api.getIconKeywords({
            keywords: [Object.create({ text: "inherited" }), { text: "own" }],
        }),
        [{ text: "own" }],
    );
    const getterIcon = Object.defineProperty({}, "keywords", {
        get() {
            throw Error("must not execute getters");
        },
    });
    assert.deepEqual(api.getIconKeywords(getterIcon), []);
});
