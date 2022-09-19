// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/**
 * CLI flag parser.
 *
 * This module is browser compatible.
 *
 * @module
 */ import { assert } from "../_util/assert.ts";
const { hasOwn  } = Object;
function get(obj, key) {
    if (hasOwn(obj, key)) {
        return obj[key];
    }
}
function getForce(obj, key) {
    const v = get(obj, key);
    assert(v != null);
    return v;
}
function isNumber(x) {
    if (typeof x === "number") return true;
    if (/^0x[0-9a-f]+$/i.test(String(x))) return true;
    return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(String(x));
}
function hasKey(obj, keys) {
    let o = obj;
    keys.slice(0, -1).forEach((key)=>{
        o = get(o, key) ?? {};
    });
    const key = keys[keys.length - 1];
    return hasOwn(o, key);
}
/** Take a set of command line arguments, optionally with a set of options, and
 * return an object representing the flags found in the passed arguments.
 *
 * By default, any arguments starting with `-` or `--` are considered boolean
 * flags. If the argument name is followed by an equal sign (`=`) it is
 * considered a key-value pair. Any arguments which could not be parsed are
 * available in the `_` property of the returned object.
 *
 * ```ts
 * import { parse } from "./mod.ts";
 * const parsedArgs = parse(Deno.args);
 * ```
 *
 * ```ts
 * import { parse } from "./mod.ts";
 * const parsedArgs = parse(["--foo", "--bar=baz", "--no-qux", "./quux.txt"]);
 * // parsedArgs: { foo: true, bar: "baz", qux: false, _: ["./quux.txt"] }
 * ```
 */ export function parse(args, { "--": doubleDash = false , alias ={} , boolean =false , default: defaults = {} , stopEarly =false , string =[] , collect =[] , negatable =[] , unknown =(i)=>i  } = {}) {
    const flags = {
        bools: {},
        strings: {},
        unknownFn: unknown,
        allBools: false,
        collect: {},
        negatable: {}
    };
    if (boolean !== undefined) {
        if (typeof boolean === "boolean") {
            flags.allBools = !!boolean;
        } else {
            const booleanArgs = typeof boolean === "string" ? [
                boolean
            ] : boolean;
            for (const key of booleanArgs.filter(Boolean)){
                flags.bools[key] = true;
            }
        }
    }
    const aliases = {};
    if (alias !== undefined) {
        for(const key1 in alias){
            const val = getForce(alias, key1);
            if (typeof val === "string") {
                aliases[key1] = [
                    val
                ];
            } else {
                aliases[key1] = val;
            }
            for (const alias1 of getForce(aliases, key1)){
                aliases[alias1] = [
                    key1
                ].concat(aliases[key1].filter((y)=>alias1 !== y));
            }
        }
    }
    if (string !== undefined) {
        const stringArgs = typeof string === "string" ? [
            string
        ] : string;
        for (const key2 of stringArgs.filter(Boolean)){
            flags.strings[key2] = true;
            const alias2 = get(aliases, key2);
            if (alias2) {
                for (const al of alias2){
                    flags.strings[al] = true;
                }
            }
        }
    }
    if (collect !== undefined) {
        const collectArgs = typeof collect === "string" ? [
            collect
        ] : collect;
        for (const key3 of collectArgs.filter(Boolean)){
            flags.collect[key3] = true;
            const alias3 = get(aliases, key3);
            if (alias3) {
                for (const al1 of alias3){
                    flags.collect[al1] = true;
                }
            }
        }
    }
    if (negatable !== undefined) {
        const negatableArgs = typeof negatable === "string" ? [
            negatable
        ] : negatable;
        for (const key4 of negatableArgs.filter(Boolean)){
            flags.negatable[key4] = true;
            const alias4 = get(aliases, key4);
            if (alias4) {
                for (const al2 of alias4){
                    flags.negatable[al2] = true;
                }
            }
        }
    }
    const argv = {
        _: []
    };
    function argDefined(key, arg) {
        return flags.allBools && /^--[^=]+$/.test(arg) || get(flags.bools, key) || !!get(flags.strings, key) || !!get(aliases, key);
    }
    function setKey(obj, name, value, collect = true) {
        let o = obj;
        const keys = name.split(".");
        keys.slice(0, -1).forEach(function(key) {
            if (get(o, key) === undefined) {
                o[key] = {};
            }
            o = get(o, key);
        });
        const key = keys[keys.length - 1];
        const collectable = collect && !!get(flags.collect, name);
        if (!collectable) {
            o[key] = value;
        } else if (get(o, key) === undefined) {
            o[key] = [
                value
            ];
        } else if (Array.isArray(get(o, key))) {
            o[key].push(value);
        } else {
            o[key] = [
                get(o, key),
                value
            ];
        }
    }
    function setArg(key, val, arg = undefined, collect) {
        if (arg && flags.unknownFn && !argDefined(key, arg)) {
            if (flags.unknownFn(arg, key, val) === false) return;
        }
        const value = !get(flags.strings, key) && isNumber(val) ? Number(val) : val;
        setKey(argv, key, value, collect);
        const alias = get(aliases, key);
        if (alias) {
            for (const x of alias){
                setKey(argv, x, value, collect);
            }
        }
    }
    function aliasIsBoolean(key) {
        return getForce(aliases, key).some((x)=>typeof get(flags.bools, x) === "boolean");
    }
    let notFlags = [];
    // all args after "--" are not parsed
    if (args.includes("--")) {
        notFlags = args.slice(args.indexOf("--") + 1);
        args = args.slice(0, args.indexOf("--"));
    }
    for(let i = 0; i < args.length; i++){
        const arg = args[i];
        if (/^--.+=/.test(arg)) {
            const m = arg.match(/^--([^=]+)=(.*)$/s);
            assert(m != null);
            const [, key5, value] = m;
            if (flags.bools[key5]) {
                const booleanValue = value !== "false";
                setArg(key5, booleanValue, arg);
            } else {
                setArg(key5, value, arg);
            }
        } else if (/^--no-.+/.test(arg) && get(flags.negatable, arg.replace(/^--no-/, ""))) {
            const m1 = arg.match(/^--no-(.+)/);
            assert(m1 != null);
            setArg(m1[1], false, arg, false);
        } else if (/^--.+/.test(arg)) {
            const m2 = arg.match(/^--(.+)/);
            assert(m2 != null);
            const [, key6] = m2;
            const next = args[i + 1];
            if (next !== undefined && !/^-/.test(next) && !get(flags.bools, key6) && !flags.allBools && (get(aliases, key6) ? !aliasIsBoolean(key6) : true)) {
                setArg(key6, next, arg);
                i++;
            } else if (/^(true|false)$/.test(next)) {
                setArg(key6, next === "true", arg);
                i++;
            } else {
                setArg(key6, get(flags.strings, key6) ? "" : true, arg);
            }
        } else if (/^-[^-]+/.test(arg)) {
            const letters = arg.slice(1, -1).split("");
            let broken = false;
            for(let j = 0; j < letters.length; j++){
                const next1 = arg.slice(j + 2);
                if (next1 === "-") {
                    setArg(letters[j], next1, arg);
                    continue;
                }
                if (/[A-Za-z]/.test(letters[j]) && /=/.test(next1)) {
                    setArg(letters[j], next1.split(/=(.+)/)[1], arg);
                    broken = true;
                    break;
                }
                if (/[A-Za-z]/.test(letters[j]) && /-?\d+(\.\d*)?(e-?\d+)?$/.test(next1)) {
                    setArg(letters[j], next1, arg);
                    broken = true;
                    break;
                }
                if (letters[j + 1] && letters[j + 1].match(/\W/)) {
                    setArg(letters[j], arg.slice(j + 2), arg);
                    broken = true;
                    break;
                } else {
                    setArg(letters[j], get(flags.strings, letters[j]) ? "" : true, arg);
                }
            }
            const [key7] = arg.slice(-1);
            if (!broken && key7 !== "-") {
                if (args[i + 1] && !/^(-|--)[^-]/.test(args[i + 1]) && !get(flags.bools, key7) && (get(aliases, key7) ? !aliasIsBoolean(key7) : true)) {
                    setArg(key7, args[i + 1], arg);
                    i++;
                } else if (args[i + 1] && /^(true|false)$/.test(args[i + 1])) {
                    setArg(key7, args[i + 1] === "true", arg);
                    i++;
                } else {
                    setArg(key7, get(flags.strings, key7) ? "" : true, arg);
                }
            }
        } else {
            if (!flags.unknownFn || flags.unknownFn(arg) !== false) {
                argv._.push(flags.strings["_"] ?? !isNumber(arg) ? arg : Number(arg));
            }
            if (stopEarly) {
                argv._.push(...args.slice(i + 1));
                break;
            }
        }
    }
    for (const [key8, value1] of Object.entries(defaults)){
        if (!hasKey(argv, key8.split("."))) {
            setKey(argv, key8, value1);
            if (aliases[key8]) {
                for (const x of aliases[key8]){
                    setKey(argv, x, value1);
                }
            }
        }
    }
    for (const key9 of Object.keys(flags.bools)){
        if (!hasKey(argv, key9.split("."))) {
            const value2 = get(flags.collect, key9) ? [] : false;
            setKey(argv, key9, value2, false);
        }
    }
    for (const key10 of Object.keys(flags.strings)){
        if (!hasKey(argv, key10.split(".")) && get(flags.collect, key10)) {
            setKey(argv, key10, [], false);
        }
    }
    if (doubleDash) {
        argv["--"] = [];
        for (const key11 of notFlags){
            argv["--"].push(key11);
        }
    } else {
        for (const key12 of notFlags){
            argv._.push(key12);
        }
    }
    return argv;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE1MC4wL2ZsYWdzL21vZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLyoqXG4gKiBDTEkgZmxhZyBwYXJzZXIuXG4gKlxuICogVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuICpcbiAqIEBtb2R1bGVcbiAqL1xuaW1wb3J0IHsgYXNzZXJ0IH0gZnJvbSBcIi4uL191dGlsL2Fzc2VydC50c1wiO1xuXG4vKiogQ29tYmluZXMgcmVjdXJzaXZseSBhbGwgaW50ZXJzYWN0aW9uIHR5cGVzIGFuZCByZXR1cm5zIGEgbmV3IHNpbmdsZSB0eXBlLiAqL1xudHlwZSBJZDxUPiA9IFQgZXh0ZW5kcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPlxuICA/IFQgZXh0ZW5kcyBpbmZlciBVID8geyBbSyBpbiBrZXlvZiBVXTogSWQ8VVtLXT4gfSA6IG5ldmVyXG4gIDogVDtcblxuLyoqIENvbnZlcnRzIGFuIHVuaW9uIHR5cGUgYEEgfCBCIHwgQ2AgaW50byBhbiBpbnRlcnNlY3Rpb24gdHlwZSBgQSAmIEIgJiBDYC4gKi9cbnR5cGUgVW5pb25Ub0ludGVyc2VjdGlvbjxUPiA9XG4gIChUIGV4dGVuZHMgdW5rbm93biA/IChhcmdzOiBUKSA9PiB1bmtub3duIDogbmV2ZXIpIGV4dGVuZHNcbiAgICAoYXJnczogaW5mZXIgUikgPT4gdW5rbm93biA/IFIgZXh0ZW5kcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA/IFIgOiBuZXZlclxuICAgIDogbmV2ZXI7XG5cbnR5cGUgQm9vbGVhblR5cGUgPSBib29sZWFuIHwgc3RyaW5nIHwgdW5kZWZpbmVkO1xudHlwZSBTdHJpbmdUeXBlID0gc3RyaW5nIHwgdW5kZWZpbmVkO1xudHlwZSBBcmdUeXBlID0gU3RyaW5nVHlwZSB8IEJvb2xlYW5UeXBlO1xuXG50eXBlIENvbGxlY3RhYmxlID0gc3RyaW5nIHwgdW5kZWZpbmVkO1xudHlwZSBOZWdhdGFibGUgPSBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbnR5cGUgVXNlVHlwZXM8XG4gIEIgZXh0ZW5kcyBCb29sZWFuVHlwZSxcbiAgUyBleHRlbmRzIFN0cmluZ1R5cGUsXG4gIEMgZXh0ZW5kcyBDb2xsZWN0YWJsZSxcbj4gPSB1bmRlZmluZWQgZXh0ZW5kcyAoXG4gICYgKGZhbHNlIGV4dGVuZHMgQiA/IHVuZGVmaW5lZCA6IEIpXG4gICYgQ1xuICAmIFNcbikgPyBmYWxzZVxuICA6IHRydWU7XG5cbi8qKlxuICogQ3JlYXRlcyBhIHJlY29yZCB3aXRoIGFsbCBhdmFpbGFibGUgZmxhZ3Mgd2l0aCB0aGUgY29ycmVzcG9uZGluZyB0eXBlIGFuZFxuICogZGVmYXVsdCB0eXBlLlxuICovXG50eXBlIFZhbHVlczxcbiAgQiBleHRlbmRzIEJvb2xlYW5UeXBlLFxuICBTIGV4dGVuZHMgU3RyaW5nVHlwZSxcbiAgQyBleHRlbmRzIENvbGxlY3RhYmxlLFxuICBOIGV4dGVuZHMgTmVnYXRhYmxlLFxuICBEIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCB1bmRlZmluZWQsXG4gIEEgZXh0ZW5kcyBBbGlhc2VzIHwgdW5kZWZpbmVkLFxuPiA9IFVzZVR5cGVzPEIsIFMsIEM+IGV4dGVuZHMgdHJ1ZSA/IFxuICAgICYgUmVjb3JkPHN0cmluZywgdW5rbm93bj5cbiAgICAmIEFkZEFsaWFzZXM8XG4gICAgICBTcHJlYWREZWZhdWx0czxcbiAgICAgICAgJiBDb2xsZWN0VmFsdWVzPFMsIHN0cmluZywgQywgTj5cbiAgICAgICAgJiBSZWN1cnNpdmVSZXF1aXJlZDxDb2xsZWN0VmFsdWVzPEIsIGJvb2xlYW4sIEM+PlxuICAgICAgICAmIENvbGxlY3RVbmtub3duVmFsdWVzPEIsIFMsIEMsIE4+LFxuICAgICAgICBEZWRvdFJlY29yZDxEPlxuICAgICAgPixcbiAgICAgIEFcbiAgICA+XG4gIDogLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgUmVjb3JkPHN0cmluZywgYW55PjtcblxudHlwZSBBbGlhc2VzPFQgPSBzdHJpbmcsIFYgZXh0ZW5kcyBzdHJpbmcgPSBzdHJpbmc+ID0gUGFydGlhbDxcbiAgUmVjb3JkPEV4dHJhY3Q8VCwgc3RyaW5nPiwgViB8IFJlYWRvbmx5QXJyYXk8Vj4+XG4+O1xuXG50eXBlIEFkZEFsaWFzZXM8XG4gIFQsXG4gIEEgZXh0ZW5kcyBBbGlhc2VzIHwgdW5kZWZpbmVkLFxuPiA9IHsgW0sgaW4ga2V5b2YgVCBhcyBBbGlhc05hbWU8SywgQT5dOiBUW0tdIH07XG5cbnR5cGUgQWxpYXNOYW1lPFxuICBLLFxuICBBIGV4dGVuZHMgQWxpYXNlcyB8IHVuZGVmaW5lZCxcbj4gPSBLIGV4dGVuZHMga2V5b2YgQVxuICA/IHN0cmluZyBleHRlbmRzIEFbS10gPyBLIDogQVtLXSBleHRlbmRzIHN0cmluZyA/IEsgfCBBW0tdIDogS1xuICA6IEs7XG5cbi8qKlxuICogU3ByZWFkcyBhbGwgZGVmYXVsdCB2YWx1ZXMgb2YgUmVjb3JkIGBEYCBpbnRvIFJlY29yZCBgQWBcbiAqIGFuZCBtYWtlcyBkZWZhdWx0IHZhbHVlcyByZXF1aXJlZC5cbiAqXG4gKiAqKkV4YW1wbGU6KipcbiAqIGBTcHJlYWRWYWx1ZXM8eyBmb28/OiBib29sZWFuLCBiYXI/OiBudW1iZXIgfSwgeyBmb286IG51bWJlciB9PmBcbiAqXG4gKiAqKlJlc3VsdDoqKiBgeyBmb286IGJvb2xhbiB8IG51bWJlciwgYmFyPzogbnVtYmVyIH1gXG4gKi9cbnR5cGUgU3ByZWFkRGVmYXVsdHM8QSwgRD4gPSBEIGV4dGVuZHMgdW5kZWZpbmVkID8gQVxuICA6IEEgZXh0ZW5kcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA/IFxuICAgICAgJiBPbWl0PEEsIGtleW9mIEQ+XG4gICAgICAmIHtcbiAgICAgICAgW0sgaW4ga2V5b2YgRF06IEsgZXh0ZW5kcyBrZXlvZiBBXG4gICAgICAgICAgPyAoQVtLXSAmIERbS10gfCBEW0tdKSBleHRlbmRzIFJlY29yZDxzdHJpbmcsIHVua25vd24+XG4gICAgICAgICAgICA/IE5vbk51bGxhYmxlPFNwcmVhZERlZmF1bHRzPEFbS10sIERbS10+PlxuICAgICAgICAgIDogRFtLXSB8IE5vbk51bGxhYmxlPEFbS10+XG4gICAgICAgICAgOiB1bmtub3duO1xuICAgICAgfVxuICA6IG5ldmVyO1xuXG4vKipcbiAqIERlZmluZXMgdGhlIFJlY29yZCBmb3IgdGhlIGBkZWZhdWx0YCBvcHRpb24gdG8gYWRkXG4gKiBhdXRvIHN1Z2dlc3Rpb24gc3VwcG9ydCBmb3IgSURFJ3MuXG4gKi9cbnR5cGUgRGVmYXVsdHM8QiBleHRlbmRzIEJvb2xlYW5UeXBlLCBTIGV4dGVuZHMgU3RyaW5nVHlwZT4gPSBJZDxcbiAgVW5pb25Ub0ludGVyc2VjdGlvbjxcbiAgICAmIFJlY29yZDxzdHJpbmcsIHVua25vd24+XG4gICAgLy8gRGVkb3R0ZWQgYXV0byBzdWdnZXN0aW9uczogeyBmb286IHsgYmFyOiB1bmtub3duIH0gfVxuICAgICYgTWFwVHlwZXM8UywgdW5rbm93bj5cbiAgICAmIE1hcFR5cGVzPEIsIHVua25vd24+XG4gICAgLy8gRmxhdCBhdXRvIHN1Z2dlc3Rpb25zOiB7IFwiZm9vLmJhclwiOiB1bmtub3duIH1cbiAgICAmIE1hcERlZmF1bHRzPEI+XG4gICAgJiBNYXBEZWZhdWx0czxTPlxuICA+XG4+O1xuXG50eXBlIE1hcERlZmF1bHRzPFQgZXh0ZW5kcyBBcmdUeXBlPiA9IFBhcnRpYWw8XG4gIFJlY29yZDxUIGV4dGVuZHMgc3RyaW5nID8gVCA6IHN0cmluZywgdW5rbm93bj5cbj47XG5cbnR5cGUgUmVjdXJzaXZlUmVxdWlyZWQ8VD4gPSBUIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPyB7XG4gICAgW0sgaW4ga2V5b2YgVF0tPzogUmVjdXJzaXZlUmVxdWlyZWQ8VFtLXT47XG4gIH1cbiAgOiBUO1xuXG4vKiogU2FtZSBhcyBgTWFwVHlwZXNgIGJ1dCBhbHNvIHN1cHBvcnRzIGNvbGxlY3RhYmxlIG9wdGlvbnMuICovXG50eXBlIENvbGxlY3RWYWx1ZXM8XG4gIFQgZXh0ZW5kcyBBcmdUeXBlLFxuICBWLFxuICBDIGV4dGVuZHMgQ29sbGVjdGFibGUsXG4gIE4gZXh0ZW5kcyBOZWdhdGFibGUgPSB1bmRlZmluZWQsXG4+ID0gVW5pb25Ub0ludGVyc2VjdGlvbjxcbiAgQyBleHRlbmRzIHN0cmluZyA/IFxuICAgICAgJiBNYXBUeXBlczxFeGNsdWRlPFQsIEM+LCBWLCBOPlxuICAgICAgJiAoVCBleHRlbmRzIHVuZGVmaW5lZCA/IFJlY29yZDxuZXZlciwgbmV2ZXI+IDogUmVjdXJzaXZlUmVxdWlyZWQ8XG4gICAgICAgIE1hcFR5cGVzPEV4dHJhY3Q8QywgVD4sIEFycmF5PFY+LCBOPlxuICAgICAgPilcbiAgICA6IE1hcFR5cGVzPFQsIFYsIE4+XG4+O1xuXG4vKiogU2FtZSBhcyBgUmVjb3JkYCBidXQgYWxzbyBzdXBwb3J0cyBkb3R0ZWQgYW5kIG5lZ2F0YWJsZSBvcHRpb25zLiAqL1xudHlwZSBNYXBUeXBlczxUIGV4dGVuZHMgQXJnVHlwZSwgViwgTiBleHRlbmRzIE5lZ2F0YWJsZSA9IHVuZGVmaW5lZD4gPVxuICB1bmRlZmluZWQgZXh0ZW5kcyBUID8gUmVjb3JkPG5ldmVyLCBuZXZlcj5cbiAgICA6IFQgZXh0ZW5kcyBgJHtpbmZlciBOYW1lfS4ke2luZmVyIFJlc3R9YCA/IHtcbiAgICAgICAgW0sgaW4gTmFtZV0/OiBNYXBUeXBlczxcbiAgICAgICAgICBSZXN0LFxuICAgICAgICAgIFYsXG4gICAgICAgICAgTiBleHRlbmRzIGAke05hbWV9LiR7aW5mZXIgTmVnYXRlfWAgPyBOZWdhdGUgOiB1bmRlZmluZWRcbiAgICAgICAgPjtcbiAgICAgIH1cbiAgICA6IFQgZXh0ZW5kcyBzdHJpbmcgPyBQYXJ0aWFsPFJlY29yZDxULCBOIGV4dGVuZHMgVCA/IFYgfCBmYWxzZSA6IFY+PlxuICAgIDogUmVjb3JkPG5ldmVyLCBuZXZlcj47XG5cbnR5cGUgQ29sbGVjdFVua25vd25WYWx1ZXM8XG4gIEIgZXh0ZW5kcyBCb29sZWFuVHlwZSxcbiAgUyBleHRlbmRzIFN0cmluZ1R5cGUsXG4gIEMgZXh0ZW5kcyBDb2xsZWN0YWJsZSxcbiAgTiBleHRlbmRzIE5lZ2F0YWJsZSxcbj4gPSBCICYgUyBleHRlbmRzIEMgPyBSZWNvcmQ8bmV2ZXIsIG5ldmVyPlxuICA6IERlZG90UmVjb3JkPFxuICAgIC8vIFVua25vd24gY29sbGVjdGFibGUgJiBub24tbmVnYXRhYmxlIGFyZ3MuXG4gICAgJiBSZWNvcmQ8XG4gICAgICBFeGNsdWRlPFxuICAgICAgICBFeHRyYWN0PEV4Y2x1ZGU8QywgTj4sIHN0cmluZz4sXG4gICAgICAgIEV4dHJhY3Q8UyB8IEIsIHN0cmluZz5cbiAgICAgID4sXG4gICAgICBBcnJheTx1bmtub3duPlxuICAgID5cbiAgICAvLyBVbmtub3duIGNvbGxlY3RhYmxlICYgbmVnYXRhYmxlIGFyZ3MuXG4gICAgJiBSZWNvcmQ8XG4gICAgICBFeGNsdWRlPFxuICAgICAgICBFeHRyYWN0PEV4dHJhY3Q8QywgTj4sIHN0cmluZz4sXG4gICAgICAgIEV4dHJhY3Q8UyB8IEIsIHN0cmluZz5cbiAgICAgID4sXG4gICAgICBBcnJheTx1bmtub3duPiB8IGZhbHNlXG4gICAgPlxuICA+O1xuXG4vKiogQ29udmVydHMgYHsgXCJmb28uYmFyLmJhelwiOiB1bmtub3duIH1gIGludG8gYHsgZm9vOiB7IGJhcjogeyBiYXo6IHVua25vd24gfSB9IH1gLiAqL1xudHlwZSBEZWRvdFJlY29yZDxUPiA9IFJlY29yZDxzdHJpbmcsIHVua25vd24+IGV4dGVuZHMgVCA/IFRcbiAgOiBUIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPyBVbmlvblRvSW50ZXJzZWN0aW9uPFxuICAgICAgVmFsdWVPZjxcbiAgICAgICAgeyBbSyBpbiBrZXlvZiBUXTogSyBleHRlbmRzIHN0cmluZyA/IERlZG90PEssIFRbS10+IDogbmV2ZXIgfVxuICAgICAgPlxuICAgID5cbiAgOiBUO1xuXG50eXBlIERlZG90PFQgZXh0ZW5kcyBzdHJpbmcsIFY+ID0gVCBleHRlbmRzIGAke2luZmVyIE5hbWV9LiR7aW5mZXIgUmVzdH1gXG4gID8geyBbSyBpbiBOYW1lXTogRGVkb3Q8UmVzdCwgVj4gfVxuICA6IHsgW0sgaW4gVF06IFYgfTtcblxudHlwZSBWYWx1ZU9mPFQ+ID0gVFtrZXlvZiBUXTtcblxuLyoqIFRoZSB2YWx1ZSByZXR1cm5lZCBmcm9tIGBwYXJzZWAuICovXG5leHBvcnQgdHlwZSBBcmdzPFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBBIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSBSZWNvcmQ8c3RyaW5nLCBhbnk+LFxuICBERCBleHRlbmRzIGJvb2xlYW4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQsXG4+ID0gSWQ8XG4gICYgQVxuICAmIHtcbiAgICAvKiogQ29udGFpbnMgYWxsIHRoZSBhcmd1bWVudHMgdGhhdCBkaWRuJ3QgaGF2ZSBhbiBvcHRpb24gYXNzb2NpYXRlZCB3aXRoXG4gICAgICogdGhlbS4gKi9cbiAgICBfOiBBcnJheTxzdHJpbmcgfCBudW1iZXI+O1xuICB9XG4gICYgKGJvb2xlYW4gZXh0ZW5kcyBERCA/IERvdWJsZURhc2hcbiAgICA6IHRydWUgZXh0ZW5kcyBERCA/IFJlcXVpcmVkPERvdWJsZURhc2g+XG4gICAgOiBSZWNvcmQ8bmV2ZXIsIG5ldmVyPilcbj47XG5cbnR5cGUgRG91YmxlRGFzaCA9IHtcbiAgLyoqIENvbnRhaW5zIGFsbCB0aGUgYXJndW1lbnRzIHRoYXQgYXBwZWFyIGFmdGVyIHRoZSBkb3VibGUgZGFzaDogXCItLVwiLiAqL1xuICBcIi0tXCI/OiBBcnJheTxzdHJpbmc+O1xufTtcblxuLyoqIFRoZSBvcHRpb25zIGZvciB0aGUgYHBhcnNlYCBjYWxsLiAqL1xuZXhwb3J0IGludGVyZmFjZSBQYXJzZU9wdGlvbnM8XG4gIEIgZXh0ZW5kcyBCb29sZWFuVHlwZSA9IEJvb2xlYW5UeXBlLFxuICBTIGV4dGVuZHMgU3RyaW5nVHlwZSA9IFN0cmluZ1R5cGUsXG4gIEMgZXh0ZW5kcyBDb2xsZWN0YWJsZSA9IENvbGxlY3RhYmxlLFxuICBOIGV4dGVuZHMgTmVnYXRhYmxlID0gTmVnYXRhYmxlLFxuICBEIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCB1bmRlZmluZWQgPVxuICAgIHwgUmVjb3JkPHN0cmluZywgdW5rbm93bj5cbiAgICB8IHVuZGVmaW5lZCxcbiAgQSBleHRlbmRzIEFsaWFzZXM8c3RyaW5nLCBzdHJpbmc+IHwgdW5kZWZpbmVkID1cbiAgICB8IEFsaWFzZXM8c3RyaW5nLCBzdHJpbmc+XG4gICAgfCB1bmRlZmluZWQsXG4gIEREIGV4dGVuZHMgYm9vbGVhbiB8IHVuZGVmaW5lZCA9IGJvb2xlYW4gfCB1bmRlZmluZWQsXG4+IHtcbiAgLyoqIFdoZW4gYHRydWVgLCBwb3B1bGF0ZSB0aGUgcmVzdWx0IGBfYCB3aXRoIGV2ZXJ5dGhpbmcgYmVmb3JlIHRoZSBgLS1gIGFuZFxuICAgKiB0aGUgcmVzdWx0IGBbJy0tJ11gIHdpdGggZXZlcnl0aGluZyBhZnRlciB0aGUgYC0tYC4gSGVyZSdzIGFuIGV4YW1wbGU6XG4gICAqXG4gICAqIGBgYHRzXG4gICAqIC8vICQgZGVubyBydW4gZXhhbXBsZS50cyAtLSBhIGFyZzFcbiAgICogaW1wb3J0IHsgcGFyc2UgfSBmcm9tIFwiLi9tb2QudHNcIjtcbiAgICogY29uc29sZS5kaXIocGFyc2UoRGVuby5hcmdzLCB7IFwiLS1cIjogZmFsc2UgfSkpO1xuICAgKiAvLyBvdXRwdXQ6IHsgXzogWyBcImFcIiwgXCJhcmcxXCIgXSB9XG4gICAqIGNvbnNvbGUuZGlyKHBhcnNlKERlbm8uYXJncywgeyBcIi0tXCI6IHRydWUgfSkpO1xuICAgKiAvLyBvdXRwdXQ6IHsgXzogW10sIC0tOiBbIFwiYVwiLCBcImFyZzFcIiBdIH1cbiAgICogYGBgXG4gICAqXG4gICAqIERlZmF1bHRzIHRvIGBmYWxzZWAuXG4gICAqL1xuICBcIi0tXCI/OiBERDtcblxuICAvKiogQW4gb2JqZWN0IG1hcHBpbmcgc3RyaW5nIG5hbWVzIHRvIHN0cmluZ3Mgb3IgYXJyYXlzIG9mIHN0cmluZyBhcmd1bWVudFxuICAgKiBuYW1lcyB0byB1c2UgYXMgYWxpYXNlcy4gKi9cbiAgYWxpYXM/OiBBO1xuXG4gIC8qKiBBIGJvb2xlYW4sIHN0cmluZyBvciBhcnJheSBvZiBzdHJpbmdzIHRvIGFsd2F5cyB0cmVhdCBhcyBib29sZWFucy4gSWZcbiAgICogYHRydWVgIHdpbGwgdHJlYXQgYWxsIGRvdWJsZSBoeXBoZW5hdGVkIGFyZ3VtZW50cyB3aXRob3V0IGVxdWFsIHNpZ25zIGFzXG4gICAqIGBib29sZWFuYCAoZS5nLiBhZmZlY3RzIGAtLWZvb2AsIG5vdCBgLWZgIG9yIGAtLWZvbz1iYXJgKSAqL1xuICBib29sZWFuPzogQiB8IFJlYWRvbmx5QXJyYXk8RXh0cmFjdDxCLCBzdHJpbmc+PjtcblxuICAvKiogQW4gb2JqZWN0IG1hcHBpbmcgc3RyaW5nIGFyZ3VtZW50IG5hbWVzIHRvIGRlZmF1bHQgdmFsdWVzLiAqL1xuICBkZWZhdWx0PzogRCAmIERlZmF1bHRzPEIsIFM+O1xuXG4gIC8qKiBXaGVuIGB0cnVlYCwgcG9wdWxhdGUgdGhlIHJlc3VsdCBgX2Agd2l0aCBldmVyeXRoaW5nIGFmdGVyIHRoZSBmaXJzdFxuICAgKiBub24tb3B0aW9uLiAqL1xuICBzdG9wRWFybHk/OiBib29sZWFuO1xuXG4gIC8qKiBBIHN0cmluZyBvciBhcnJheSBvZiBzdHJpbmdzIGFyZ3VtZW50IG5hbWVzIHRvIGFsd2F5cyB0cmVhdCBhcyBzdHJpbmdzLiAqL1xuICBzdHJpbmc/OiBTIHwgUmVhZG9ubHlBcnJheTxFeHRyYWN0PFMsIHN0cmluZz4+O1xuXG4gIC8qKiBBIHN0cmluZyBvciBhcnJheSBvZiBzdHJpbmdzIGFyZ3VtZW50IG5hbWVzIHRvIGFsd2F5cyB0cmVhdCBhcyBhcnJheXMuXG4gICAqIENvbGxlY3RhYmxlIG9wdGlvbnMgY2FuIGJlIHVzZWQgbXVsdGlwbGUgdGltZXMuIEFsbCB2YWx1ZXMgd2lsbCBiZVxuICAgKiBjb2xsZWN0ZWQgaW50byBvbmUgYXJyYXkuIElmIGEgbm9uLWNvbGxlY3RhYmxlIG9wdGlvbiBpcyB1c2VkIG11bHRpcGxlXG4gICAqIHRpbWVzLCB0aGUgbGFzdCB2YWx1ZSBpcyB1c2VkLiAqL1xuICBjb2xsZWN0PzogQyB8IFJlYWRvbmx5QXJyYXk8RXh0cmFjdDxDLCBzdHJpbmc+PjtcblxuICAvKiogQSBzdHJpbmcgb3IgYXJyYXkgb2Ygc3RyaW5ncyBhcmd1bWVudCBuYW1lcyB3aGljaCBjYW4gYmUgbmVnYXRlZFxuICAgKiBieSBwcmVmaXhpbmcgdGhlbSB3aXRoIGAtLW5vLWAsIGxpa2UgYC0tbm8tY29uZmlnYC4gKi9cbiAgbmVnYXRhYmxlPzogTiB8IFJlYWRvbmx5QXJyYXk8RXh0cmFjdDxOLCBzdHJpbmc+PjtcblxuICAvKiogQSBmdW5jdGlvbiB3aGljaCBpcyBpbnZva2VkIHdpdGggYSBjb21tYW5kIGxpbmUgcGFyYW1ldGVyIG5vdCBkZWZpbmVkIGluXG4gICAqIHRoZSBgb3B0aW9uc2AgY29uZmlndXJhdGlvbiBvYmplY3QuIElmIHRoZSBmdW5jdGlvbiByZXR1cm5zIGBmYWxzZWAsIHRoZVxuICAgKiB1bmtub3duIG9wdGlvbiBpcyBub3QgYWRkZWQgdG8gYHBhcnNlZEFyZ3NgLiAqL1xuICB1bmtub3duPzogKGFyZzogc3RyaW5nLCBrZXk/OiBzdHJpbmcsIHZhbHVlPzogdW5rbm93bikgPT4gdW5rbm93bjtcbn1cblxuaW50ZXJmYWNlIEZsYWdzIHtcbiAgYm9vbHM6IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+O1xuICBzdHJpbmdzOiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPjtcbiAgY29sbGVjdDogUmVjb3JkPHN0cmluZywgYm9vbGVhbj47XG4gIG5lZ2F0YWJsZTogUmVjb3JkPHN0cmluZywgYm9vbGVhbj47XG4gIHVua25vd25GbjogKGFyZzogc3RyaW5nLCBrZXk/OiBzdHJpbmcsIHZhbHVlPzogdW5rbm93bikgPT4gdW5rbm93bjtcbiAgYWxsQm9vbHM6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBOZXN0ZWRNYXBwaW5nIHtcbiAgW2tleTogc3RyaW5nXTogTmVzdGVkTWFwcGluZyB8IHVua25vd247XG59XG5cbmNvbnN0IHsgaGFzT3duIH0gPSBPYmplY3Q7XG5cbmZ1bmN0aW9uIGdldDxUPihvYmo6IFJlY29yZDxzdHJpbmcsIFQ+LCBrZXk6IHN0cmluZyk6IFQgfCB1bmRlZmluZWQge1xuICBpZiAoaGFzT3duKG9iaiwga2V5KSkge1xuICAgIHJldHVybiBvYmpba2V5XTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRGb3JjZTxUPihvYmo6IFJlY29yZDxzdHJpbmcsIFQ+LCBrZXk6IHN0cmluZyk6IFQge1xuICBjb25zdCB2ID0gZ2V0KG9iaiwga2V5KTtcbiAgYXNzZXJ0KHYgIT0gbnVsbCk7XG4gIHJldHVybiB2O1xufVxuXG5mdW5jdGlvbiBpc051bWJlcih4OiB1bmtub3duKTogYm9vbGVhbiB7XG4gIGlmICh0eXBlb2YgeCA9PT0gXCJudW1iZXJcIikgcmV0dXJuIHRydWU7XG4gIGlmICgvXjB4WzAtOWEtZl0rJC9pLnRlc3QoU3RyaW5nKHgpKSkgcmV0dXJuIHRydWU7XG4gIHJldHVybiAvXlstK10/KD86XFxkKyg/OlxcLlxcZCopP3xcXC5cXGQrKShlWy0rXT9cXGQrKT8kLy50ZXN0KFN0cmluZyh4KSk7XG59XG5cbmZ1bmN0aW9uIGhhc0tleShvYmo6IE5lc3RlZE1hcHBpbmcsIGtleXM6IHN0cmluZ1tdKTogYm9vbGVhbiB7XG4gIGxldCBvID0gb2JqO1xuICBrZXlzLnNsaWNlKDAsIC0xKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICBvID0gKGdldChvLCBrZXkpID8/IHt9KSBhcyBOZXN0ZWRNYXBwaW5nO1xuICB9KTtcblxuICBjb25zdCBrZXkgPSBrZXlzW2tleXMubGVuZ3RoIC0gMV07XG4gIHJldHVybiBoYXNPd24obywga2V5KTtcbn1cblxuLyoqIFRha2UgYSBzZXQgb2YgY29tbWFuZCBsaW5lIGFyZ3VtZW50cywgb3B0aW9uYWxseSB3aXRoIGEgc2V0IG9mIG9wdGlvbnMsIGFuZFxuICogcmV0dXJuIGFuIG9iamVjdCByZXByZXNlbnRpbmcgdGhlIGZsYWdzIGZvdW5kIGluIHRoZSBwYXNzZWQgYXJndW1lbnRzLlxuICpcbiAqIEJ5IGRlZmF1bHQsIGFueSBhcmd1bWVudHMgc3RhcnRpbmcgd2l0aCBgLWAgb3IgYC0tYCBhcmUgY29uc2lkZXJlZCBib29sZWFuXG4gKiBmbGFncy4gSWYgdGhlIGFyZ3VtZW50IG5hbWUgaXMgZm9sbG93ZWQgYnkgYW4gZXF1YWwgc2lnbiAoYD1gKSBpdCBpc1xuICogY29uc2lkZXJlZCBhIGtleS12YWx1ZSBwYWlyLiBBbnkgYXJndW1lbnRzIHdoaWNoIGNvdWxkIG5vdCBiZSBwYXJzZWQgYXJlXG4gKiBhdmFpbGFibGUgaW4gdGhlIGBfYCBwcm9wZXJ0eSBvZiB0aGUgcmV0dXJuZWQgb2JqZWN0LlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBwYXJzZSB9IGZyb20gXCIuL21vZC50c1wiO1xuICogY29uc3QgcGFyc2VkQXJncyA9IHBhcnNlKERlbm8uYXJncyk7XG4gKiBgYGBcbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgcGFyc2UgfSBmcm9tIFwiLi9tb2QudHNcIjtcbiAqIGNvbnN0IHBhcnNlZEFyZ3MgPSBwYXJzZShbXCItLWZvb1wiLCBcIi0tYmFyPWJhelwiLCBcIi0tbm8tcXV4XCIsIFwiLi9xdXV4LnR4dFwiXSk7XG4gKiAvLyBwYXJzZWRBcmdzOiB7IGZvbzogdHJ1ZSwgYmFyOiBcImJhelwiLCBxdXg6IGZhbHNlLCBfOiBbXCIuL3F1dXgudHh0XCJdIH1cbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2U8XG4gIFYgZXh0ZW5kcyBWYWx1ZXM8QiwgUywgQywgTiwgRCwgQT4sXG4gIEREIGV4dGVuZHMgYm9vbGVhbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZCxcbiAgQiBleHRlbmRzIEJvb2xlYW5UeXBlID0gdW5kZWZpbmVkLFxuICBTIGV4dGVuZHMgU3RyaW5nVHlwZSA9IHVuZGVmaW5lZCxcbiAgQyBleHRlbmRzIENvbGxlY3RhYmxlID0gdW5kZWZpbmVkLFxuICBOIGV4dGVuZHMgTmVnYXRhYmxlID0gdW5kZWZpbmVkLFxuICBEIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQsXG4gIEEgZXh0ZW5kcyBBbGlhc2VzPEFLLCBBVj4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQsXG4gIEFLIGV4dGVuZHMgc3RyaW5nID0gc3RyaW5nLFxuICBBViBleHRlbmRzIHN0cmluZyA9IHN0cmluZyxcbj4oXG4gIGFyZ3M6IHN0cmluZ1tdLFxuICB7XG4gICAgXCItLVwiOiBkb3VibGVEYXNoID0gZmFsc2UsXG4gICAgYWxpYXMgPSB7fSBhcyBOb25OdWxsYWJsZTxBPixcbiAgICBib29sZWFuID0gZmFsc2UsXG4gICAgZGVmYXVsdDogZGVmYXVsdHMgPSB7fSBhcyBEICYgRGVmYXVsdHM8QiwgUz4sXG4gICAgc3RvcEVhcmx5ID0gZmFsc2UsXG4gICAgc3RyaW5nID0gW10sXG4gICAgY29sbGVjdCA9IFtdLFxuICAgIG5lZ2F0YWJsZSA9IFtdLFxuICAgIHVua25vd24gPSAoaTogc3RyaW5nKTogdW5rbm93biA9PiBpLFxuICB9OiBQYXJzZU9wdGlvbnM8QiwgUywgQywgTiwgRCwgQSwgREQ+ID0ge30sXG4pOiBBcmdzPFYsIEREPiB7XG4gIGNvbnN0IGZsYWdzOiBGbGFncyA9IHtcbiAgICBib29sczoge30sXG4gICAgc3RyaW5nczoge30sXG4gICAgdW5rbm93bkZuOiB1bmtub3duLFxuICAgIGFsbEJvb2xzOiBmYWxzZSxcbiAgICBjb2xsZWN0OiB7fSxcbiAgICBuZWdhdGFibGU6IHt9LFxuICB9O1xuXG4gIGlmIChib29sZWFuICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAodHlwZW9mIGJvb2xlYW4gPT09IFwiYm9vbGVhblwiKSB7XG4gICAgICBmbGFncy5hbGxCb29scyA9ICEhYm9vbGVhbjtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgYm9vbGVhbkFyZ3M6IFJlYWRvbmx5QXJyYXk8c3RyaW5nPiA9IHR5cGVvZiBib29sZWFuID09PSBcInN0cmluZ1wiXG4gICAgICAgID8gW2Jvb2xlYW5dXG4gICAgICAgIDogYm9vbGVhbjtcblxuICAgICAgZm9yIChjb25zdCBrZXkgb2YgYm9vbGVhbkFyZ3MuZmlsdGVyKEJvb2xlYW4pKSB7XG4gICAgICAgIGZsYWdzLmJvb2xzW2tleV0gPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGFsaWFzZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZ1tdPiA9IHt9O1xuICBpZiAoYWxpYXMgIT09IHVuZGVmaW5lZCkge1xuICAgIGZvciAoY29uc3Qga2V5IGluIGFsaWFzKSB7XG4gICAgICBjb25zdCB2YWwgPSBnZXRGb3JjZShhbGlhcywga2V5KTtcbiAgICAgIGlmICh0eXBlb2YgdmFsID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIGFsaWFzZXNba2V5XSA9IFt2YWxdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWxpYXNlc1trZXldID0gdmFsIGFzIEFycmF5PHN0cmluZz47XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGFsaWFzIG9mIGdldEZvcmNlKGFsaWFzZXMsIGtleSkpIHtcbiAgICAgICAgYWxpYXNlc1thbGlhc10gPSBba2V5XS5jb25jYXQoYWxpYXNlc1trZXldLmZpbHRlcigoeSkgPT4gYWxpYXMgIT09IHkpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoc3RyaW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBzdHJpbmdBcmdzOiBSZWFkb25seUFycmF5PHN0cmluZz4gPSB0eXBlb2Ygc3RyaW5nID09PSBcInN0cmluZ1wiXG4gICAgICA/IFtzdHJpbmddXG4gICAgICA6IHN0cmluZztcblxuICAgIGZvciAoY29uc3Qga2V5IG9mIHN0cmluZ0FyZ3MuZmlsdGVyKEJvb2xlYW4pKSB7XG4gICAgICBmbGFncy5zdHJpbmdzW2tleV0gPSB0cnVlO1xuICAgICAgY29uc3QgYWxpYXMgPSBnZXQoYWxpYXNlcywga2V5KTtcbiAgICAgIGlmIChhbGlhcykge1xuICAgICAgICBmb3IgKGNvbnN0IGFsIG9mIGFsaWFzKSB7XG4gICAgICAgICAgZmxhZ3Muc3RyaW5nc1thbF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKGNvbGxlY3QgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IGNvbGxlY3RBcmdzOiBSZWFkb25seUFycmF5PHN0cmluZz4gPSB0eXBlb2YgY29sbGVjdCA9PT0gXCJzdHJpbmdcIlxuICAgICAgPyBbY29sbGVjdF1cbiAgICAgIDogY29sbGVjdDtcblxuICAgIGZvciAoY29uc3Qga2V5IG9mIGNvbGxlY3RBcmdzLmZpbHRlcihCb29sZWFuKSkge1xuICAgICAgZmxhZ3MuY29sbGVjdFtrZXldID0gdHJ1ZTtcbiAgICAgIGNvbnN0IGFsaWFzID0gZ2V0KGFsaWFzZXMsIGtleSk7XG4gICAgICBpZiAoYWxpYXMpIHtcbiAgICAgICAgZm9yIChjb25zdCBhbCBvZiBhbGlhcykge1xuICAgICAgICAgIGZsYWdzLmNvbGxlY3RbYWxdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmIChuZWdhdGFibGUgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IG5lZ2F0YWJsZUFyZ3M6IFJlYWRvbmx5QXJyYXk8c3RyaW5nPiA9IHR5cGVvZiBuZWdhdGFibGUgPT09IFwic3RyaW5nXCJcbiAgICAgID8gW25lZ2F0YWJsZV1cbiAgICAgIDogbmVnYXRhYmxlO1xuXG4gICAgZm9yIChjb25zdCBrZXkgb2YgbmVnYXRhYmxlQXJncy5maWx0ZXIoQm9vbGVhbikpIHtcbiAgICAgIGZsYWdzLm5lZ2F0YWJsZVtrZXldID0gdHJ1ZTtcbiAgICAgIGNvbnN0IGFsaWFzID0gZ2V0KGFsaWFzZXMsIGtleSk7XG4gICAgICBpZiAoYWxpYXMpIHtcbiAgICAgICAgZm9yIChjb25zdCBhbCBvZiBhbGlhcykge1xuICAgICAgICAgIGZsYWdzLm5lZ2F0YWJsZVthbF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY29uc3QgYXJndjogQXJncyA9IHsgXzogW10gfTtcblxuICBmdW5jdGlvbiBhcmdEZWZpbmVkKGtleTogc3RyaW5nLCBhcmc6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAoXG4gICAgICAoZmxhZ3MuYWxsQm9vbHMgJiYgL14tLVtePV0rJC8udGVzdChhcmcpKSB8fFxuICAgICAgZ2V0KGZsYWdzLmJvb2xzLCBrZXkpIHx8XG4gICAgICAhIWdldChmbGFncy5zdHJpbmdzLCBrZXkpIHx8XG4gICAgICAhIWdldChhbGlhc2VzLCBrZXkpXG4gICAgKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldEtleShcbiAgICBvYmo6IE5lc3RlZE1hcHBpbmcsXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHZhbHVlOiB1bmtub3duLFxuICAgIGNvbGxlY3QgPSB0cnVlLFxuICApOiB2b2lkIHtcbiAgICBsZXQgbyA9IG9iajtcbiAgICBjb25zdCBrZXlzID0gbmFtZS5zcGxpdChcIi5cIik7XG4gICAga2V5cy5zbGljZSgwLCAtMSkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KTogdm9pZCB7XG4gICAgICBpZiAoZ2V0KG8sIGtleSkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBvW2tleV0gPSB7fTtcbiAgICAgIH1cbiAgICAgIG8gPSBnZXQobywga2V5KSBhcyBOZXN0ZWRNYXBwaW5nO1xuICAgIH0pO1xuXG4gICAgY29uc3Qga2V5ID0ga2V5c1trZXlzLmxlbmd0aCAtIDFdO1xuICAgIGNvbnN0IGNvbGxlY3RhYmxlID0gY29sbGVjdCAmJiAhIWdldChmbGFncy5jb2xsZWN0LCBuYW1lKTtcblxuICAgIGlmICghY29sbGVjdGFibGUpIHtcbiAgICAgIG9ba2V5XSA9IHZhbHVlO1xuICAgIH0gZWxzZSBpZiAoZ2V0KG8sIGtleSkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgb1trZXldID0gW3ZhbHVlXTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZ2V0KG8sIGtleSkpKSB7XG4gICAgICAob1trZXldIGFzIHVua25vd25bXSkucHVzaCh2YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9ba2V5XSA9IFtnZXQobywga2V5KSwgdmFsdWVdO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHNldEFyZyhcbiAgICBrZXk6IHN0cmluZyxcbiAgICB2YWw6IHVua25vd24sXG4gICAgYXJnOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQsXG4gICAgY29sbGVjdD86IGJvb2xlYW4sXG4gICk6IHZvaWQge1xuICAgIGlmIChhcmcgJiYgZmxhZ3MudW5rbm93bkZuICYmICFhcmdEZWZpbmVkKGtleSwgYXJnKSkge1xuICAgICAgaWYgKGZsYWdzLnVua25vd25GbihhcmcsIGtleSwgdmFsKSA9PT0gZmFsc2UpIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB2YWx1ZSA9ICFnZXQoZmxhZ3Muc3RyaW5ncywga2V5KSAmJiBpc051bWJlcih2YWwpID8gTnVtYmVyKHZhbCkgOiB2YWw7XG4gICAgc2V0S2V5KGFyZ3YsIGtleSwgdmFsdWUsIGNvbGxlY3QpO1xuXG4gICAgY29uc3QgYWxpYXMgPSBnZXQoYWxpYXNlcywga2V5KTtcbiAgICBpZiAoYWxpYXMpIHtcbiAgICAgIGZvciAoY29uc3QgeCBvZiBhbGlhcykge1xuICAgICAgICBzZXRLZXkoYXJndiwgeCwgdmFsdWUsIGNvbGxlY3QpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGFsaWFzSXNCb29sZWFuKGtleTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGdldEZvcmNlKGFsaWFzZXMsIGtleSkuc29tZShcbiAgICAgICh4KSA9PiB0eXBlb2YgZ2V0KGZsYWdzLmJvb2xzLCB4KSA9PT0gXCJib29sZWFuXCIsXG4gICAgKTtcbiAgfVxuXG4gIGxldCBub3RGbGFnczogc3RyaW5nW10gPSBbXTtcblxuICAvLyBhbGwgYXJncyBhZnRlciBcIi0tXCIgYXJlIG5vdCBwYXJzZWRcbiAgaWYgKGFyZ3MuaW5jbHVkZXMoXCItLVwiKSkge1xuICAgIG5vdEZsYWdzID0gYXJncy5zbGljZShhcmdzLmluZGV4T2YoXCItLVwiKSArIDEpO1xuICAgIGFyZ3MgPSBhcmdzLnNsaWNlKDAsIGFyZ3MuaW5kZXhPZihcIi0tXCIpKTtcbiAgfVxuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGFyZyA9IGFyZ3NbaV07XG5cbiAgICBpZiAoL14tLS4rPS8udGVzdChhcmcpKSB7XG4gICAgICBjb25zdCBtID0gYXJnLm1hdGNoKC9eLS0oW149XSspPSguKikkL3MpO1xuICAgICAgYXNzZXJ0KG0gIT0gbnVsbCk7XG4gICAgICBjb25zdCBbLCBrZXksIHZhbHVlXSA9IG07XG5cbiAgICAgIGlmIChmbGFncy5ib29sc1trZXldKSB7XG4gICAgICAgIGNvbnN0IGJvb2xlYW5WYWx1ZSA9IHZhbHVlICE9PSBcImZhbHNlXCI7XG4gICAgICAgIHNldEFyZyhrZXksIGJvb2xlYW5WYWx1ZSwgYXJnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldEFyZyhrZXksIHZhbHVlLCBhcmcpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoXG4gICAgICAvXi0tbm8tLisvLnRlc3QoYXJnKSAmJiBnZXQoZmxhZ3MubmVnYXRhYmxlLCBhcmcucmVwbGFjZSgvXi0tbm8tLywgXCJcIikpXG4gICAgKSB7XG4gICAgICBjb25zdCBtID0gYXJnLm1hdGNoKC9eLS1uby0oLispLyk7XG4gICAgICBhc3NlcnQobSAhPSBudWxsKTtcbiAgICAgIHNldEFyZyhtWzFdLCBmYWxzZSwgYXJnLCBmYWxzZSk7XG4gICAgfSBlbHNlIGlmICgvXi0tLisvLnRlc3QoYXJnKSkge1xuICAgICAgY29uc3QgbSA9IGFyZy5tYXRjaCgvXi0tKC4rKS8pO1xuICAgICAgYXNzZXJ0KG0gIT0gbnVsbCk7XG4gICAgICBjb25zdCBbLCBrZXldID0gbTtcbiAgICAgIGNvbnN0IG5leHQgPSBhcmdzW2kgKyAxXTtcbiAgICAgIGlmIChcbiAgICAgICAgbmV4dCAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICEvXi0vLnRlc3QobmV4dCkgJiZcbiAgICAgICAgIWdldChmbGFncy5ib29scywga2V5KSAmJlxuICAgICAgICAhZmxhZ3MuYWxsQm9vbHMgJiZcbiAgICAgICAgKGdldChhbGlhc2VzLCBrZXkpID8gIWFsaWFzSXNCb29sZWFuKGtleSkgOiB0cnVlKVxuICAgICAgKSB7XG4gICAgICAgIHNldEFyZyhrZXksIG5leHQsIGFyZyk7XG4gICAgICAgIGkrKztcbiAgICAgIH0gZWxzZSBpZiAoL14odHJ1ZXxmYWxzZSkkLy50ZXN0KG5leHQpKSB7XG4gICAgICAgIHNldEFyZyhrZXksIG5leHQgPT09IFwidHJ1ZVwiLCBhcmcpO1xuICAgICAgICBpKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZXRBcmcoa2V5LCBnZXQoZmxhZ3Muc3RyaW5ncywga2V5KSA/IFwiXCIgOiB0cnVlLCBhcmcpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoL14tW14tXSsvLnRlc3QoYXJnKSkge1xuICAgICAgY29uc3QgbGV0dGVycyA9IGFyZy5zbGljZSgxLCAtMSkuc3BsaXQoXCJcIik7XG5cbiAgICAgIGxldCBicm9rZW4gPSBmYWxzZTtcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGV0dGVycy5sZW5ndGg7IGorKykge1xuICAgICAgICBjb25zdCBuZXh0ID0gYXJnLnNsaWNlKGogKyAyKTtcblxuICAgICAgICBpZiAobmV4dCA9PT0gXCItXCIpIHtcbiAgICAgICAgICBzZXRBcmcobGV0dGVyc1tqXSwgbmV4dCwgYXJnKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgvW0EtWmEtel0vLnRlc3QobGV0dGVyc1tqXSkgJiYgLz0vLnRlc3QobmV4dCkpIHtcbiAgICAgICAgICBzZXRBcmcobGV0dGVyc1tqXSwgbmV4dC5zcGxpdCgvPSguKykvKVsxXSwgYXJnKTtcbiAgICAgICAgICBicm9rZW4gPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgIC9bQS1aYS16XS8udGVzdChsZXR0ZXJzW2pdKSAmJlxuICAgICAgICAgIC8tP1xcZCsoXFwuXFxkKik/KGUtP1xcZCspPyQvLnRlc3QobmV4dClcbiAgICAgICAgKSB7XG4gICAgICAgICAgc2V0QXJnKGxldHRlcnNbal0sIG5leHQsIGFyZyk7XG4gICAgICAgICAgYnJva2VuID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsZXR0ZXJzW2ogKyAxXSAmJiBsZXR0ZXJzW2ogKyAxXS5tYXRjaCgvXFxXLykpIHtcbiAgICAgICAgICBzZXRBcmcobGV0dGVyc1tqXSwgYXJnLnNsaWNlKGogKyAyKSwgYXJnKTtcbiAgICAgICAgICBicm9rZW4gPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNldEFyZyhsZXR0ZXJzW2pdLCBnZXQoZmxhZ3Muc3RyaW5ncywgbGV0dGVyc1tqXSkgPyBcIlwiIDogdHJ1ZSwgYXJnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBba2V5XSA9IGFyZy5zbGljZSgtMSk7XG4gICAgICBpZiAoIWJyb2tlbiAmJiBrZXkgIT09IFwiLVwiKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBhcmdzW2kgKyAxXSAmJlxuICAgICAgICAgICEvXigtfC0tKVteLV0vLnRlc3QoYXJnc1tpICsgMV0pICYmXG4gICAgICAgICAgIWdldChmbGFncy5ib29scywga2V5KSAmJlxuICAgICAgICAgIChnZXQoYWxpYXNlcywga2V5KSA/ICFhbGlhc0lzQm9vbGVhbihrZXkpIDogdHJ1ZSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgc2V0QXJnKGtleSwgYXJnc1tpICsgMV0sIGFyZyk7XG4gICAgICAgICAgaSsrO1xuICAgICAgICB9IGVsc2UgaWYgKGFyZ3NbaSArIDFdICYmIC9eKHRydWV8ZmFsc2UpJC8udGVzdChhcmdzW2kgKyAxXSkpIHtcbiAgICAgICAgICBzZXRBcmcoa2V5LCBhcmdzW2kgKyAxXSA9PT0gXCJ0cnVlXCIsIGFyZyk7XG4gICAgICAgICAgaSsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNldEFyZyhrZXksIGdldChmbGFncy5zdHJpbmdzLCBrZXkpID8gXCJcIiA6IHRydWUsIGFyZyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFmbGFncy51bmtub3duRm4gfHwgZmxhZ3MudW5rbm93bkZuKGFyZykgIT09IGZhbHNlKSB7XG4gICAgICAgIGFyZ3YuXy5wdXNoKGZsYWdzLnN0cmluZ3NbXCJfXCJdID8/ICFpc051bWJlcihhcmcpID8gYXJnIDogTnVtYmVyKGFyZykpO1xuICAgICAgfVxuICAgICAgaWYgKHN0b3BFYXJseSkge1xuICAgICAgICBhcmd2Ll8ucHVzaCguLi5hcmdzLnNsaWNlKGkgKyAxKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGRlZmF1bHRzKSkge1xuICAgIGlmICghaGFzS2V5KGFyZ3YsIGtleS5zcGxpdChcIi5cIikpKSB7XG4gICAgICBzZXRLZXkoYXJndiwga2V5LCB2YWx1ZSk7XG5cbiAgICAgIGlmIChhbGlhc2VzW2tleV0pIHtcbiAgICAgICAgZm9yIChjb25zdCB4IG9mIGFsaWFzZXNba2V5XSkge1xuICAgICAgICAgIHNldEtleShhcmd2LCB4LCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhmbGFncy5ib29scykpIHtcbiAgICBpZiAoIWhhc0tleShhcmd2LCBrZXkuc3BsaXQoXCIuXCIpKSkge1xuICAgICAgY29uc3QgdmFsdWUgPSBnZXQoZmxhZ3MuY29sbGVjdCwga2V5KSA/IFtdIDogZmFsc2U7XG4gICAgICBzZXRLZXkoXG4gICAgICAgIGFyZ3YsXG4gICAgICAgIGtleSxcbiAgICAgICAgdmFsdWUsXG4gICAgICAgIGZhbHNlLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhmbGFncy5zdHJpbmdzKSkge1xuICAgIGlmICghaGFzS2V5KGFyZ3YsIGtleS5zcGxpdChcIi5cIikpICYmIGdldChmbGFncy5jb2xsZWN0LCBrZXkpKSB7XG4gICAgICBzZXRLZXkoXG4gICAgICAgIGFyZ3YsXG4gICAgICAgIGtleSxcbiAgICAgICAgW10sXG4gICAgICAgIGZhbHNlLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBpZiAoZG91YmxlRGFzaCkge1xuICAgIGFyZ3ZbXCItLVwiXSA9IFtdO1xuICAgIGZvciAoY29uc3Qga2V5IG9mIG5vdEZsYWdzKSB7XG4gICAgICBhcmd2W1wiLS1cIl0ucHVzaChrZXkpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBub3RGbGFncykge1xuICAgICAgYXJndi5fLnB1c2goa2V5KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYXJndiBhcyBBcmdzPFYsIEREPjtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUU7Ozs7OztDQU1DLEdBQ0QsU0FBUyxNQUFNLFFBQVEsb0JBQW9CLENBQUM7QUE4UjVDLE1BQU0sRUFBRSxNQUFNLENBQUEsRUFBRSxHQUFHLE1BQU0sQUFBQztBQUUxQixTQUFTLEdBQUcs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