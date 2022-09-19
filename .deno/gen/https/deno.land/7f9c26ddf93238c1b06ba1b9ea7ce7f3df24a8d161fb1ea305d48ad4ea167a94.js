// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { globToRegExp, isAbsolute, isGlob, joinGlobs, resolve, SEP_PATTERN } from "../path/mod.ts";
import { _createWalkEntry, _createWalkEntrySync, walk, walkSync } from "./walk.ts";
import { assert } from "../_util/assert.ts";
import { isWindows } from "../_util/os.ts";
function split(path) {
    const s = SEP_PATTERN.source;
    const segments = path.replace(new RegExp(`^${s}|${s}$`, "g"), "").split(SEP_PATTERN);
    const isAbsolute_ = isAbsolute(path);
    return {
        segments,
        isAbsolute: isAbsolute_,
        hasTrailingSep: !!path.match(new RegExp(`${s}$`)),
        winRoot: isWindows && isAbsolute_ ? segments.shift() : undefined
    };
}
function throwUnlessNotFound(error) {
    if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
    }
}
function comparePath(a, b) {
    if (a.path < b.path) return -1;
    if (a.path > b.path) return 1;
    return 0;
}
/** Expand the glob string from the specified `root` directory and yield each
 * result as a `WalkEntry` object.
 *
 * See [`globToRegExp()`](../path/glob.ts#globToRegExp) for details on supported
 * syntax.
 *
 * Example:
 * ```ts
 *      import { expandGlob } from "./expand_glob.ts";
 *      for await (const file of expandGlob("**\/*.ts")) {
 *        console.log(file);
 *      }
 * ```
 */ export async function* expandGlob(glob, { root =Deno.cwd() , exclude =[] , includeDirs =true , extended =true , globstar =false , caseInsensitive  } = {}) {
    const globOptions = {
        extended,
        globstar,
        caseInsensitive
    };
    const absRoot = resolve(root);
    const resolveFromRoot = (path)=>resolve(absRoot, path);
    const excludePatterns = exclude.map(resolveFromRoot).map((s)=>globToRegExp(s, globOptions));
    const shouldInclude = (path)=>!excludePatterns.some((p)=>!!path.match(p));
    const { segments , isAbsolute: isGlobAbsolute , hasTrailingSep , winRoot  } = split(glob);
    let fixedRoot = isGlobAbsolute ? winRoot != undefined ? winRoot : "/" : absRoot;
    while(segments.length > 0 && !isGlob(segments[0])){
        const seg = segments.shift();
        assert(seg != null);
        fixedRoot = joinGlobs([
            fixedRoot,
            seg
        ], globOptions);
    }
    let fixedRootInfo;
    try {
        fixedRootInfo = await _createWalkEntry(fixedRoot);
    } catch (error) {
        return throwUnlessNotFound(error);
    }
    async function* advanceMatch(walkInfo, globSegment) {
        if (!walkInfo.isDirectory) {
            return;
        } else if (globSegment == "..") {
            const parentPath = joinGlobs([
                walkInfo.path,
                ".."
            ], globOptions);
            try {
                if (shouldInclude(parentPath)) {
                    return yield await _createWalkEntry(parentPath);
                }
            } catch (error) {
                throwUnlessNotFound(error);
            }
            return;
        } else if (globSegment == "**") {
            return yield* walk(walkInfo.path, {
                skip: excludePatterns
            });
        }
        const globPattern = globToRegExp(globSegment, globOptions);
        for await (const walkEntry of walk(walkInfo.path, {
            maxDepth: 1,
            skip: excludePatterns
        })){
            if (walkEntry.path != walkInfo.path && walkEntry.name.match(globPattern)) {
                yield walkEntry;
            }
        }
    }
    let currentMatches = [
        fixedRootInfo
    ];
    for (const segment of segments){
        // Advancing the list of current matches may introduce duplicates, so we
        // pass everything through this Map.
        const nextMatchMap = new Map();
        await Promise.all(currentMatches.map(async (currentMatch)=>{
            for await (const nextMatch of advanceMatch(currentMatch, segment)){
                nextMatchMap.set(nextMatch.path, nextMatch);
            }
        }));
        currentMatches = [
            ...nextMatchMap.values()
        ].sort(comparePath);
    }
    if (hasTrailingSep) {
        currentMatches = currentMatches.filter((entry)=>entry.isDirectory);
    }
    if (!includeDirs) {
        currentMatches = currentMatches.filter((entry)=>!entry.isDirectory);
    }
    yield* currentMatches;
}
/** Synchronous version of `expandGlob()`.
 *
 * Example:
 *
 * ```ts
 *      import { expandGlobSync } from "./expand_glob.ts";
 *      for (const file of expandGlobSync("**\/*.ts")) {
 *        console.log(file);
 *      }
 * ```
 */ export function* expandGlobSync(glob, { root =Deno.cwd() , exclude =[] , includeDirs =true , extended =true , globstar =false , caseInsensitive  } = {}) {
    const globOptions = {
        extended,
        globstar,
        caseInsensitive
    };
    const absRoot = resolve(root);
    const resolveFromRoot = (path)=>resolve(absRoot, path);
    const excludePatterns = exclude.map(resolveFromRoot).map((s)=>globToRegExp(s, globOptions));
    const shouldInclude = (path)=>!excludePatterns.some((p)=>!!path.match(p));
    const { segments , isAbsolute: isGlobAbsolute , hasTrailingSep , winRoot  } = split(glob);
    let fixedRoot = isGlobAbsolute ? winRoot != undefined ? winRoot : "/" : absRoot;
    while(segments.length > 0 && !isGlob(segments[0])){
        const seg = segments.shift();
        assert(seg != null);
        fixedRoot = joinGlobs([
            fixedRoot,
            seg
        ], globOptions);
    }
    let fixedRootInfo;
    try {
        fixedRootInfo = _createWalkEntrySync(fixedRoot);
    } catch (error) {
        return throwUnlessNotFound(error);
    }
    function* advanceMatch(walkInfo, globSegment) {
        if (!walkInfo.isDirectory) {
            return;
        } else if (globSegment == "..") {
            const parentPath = joinGlobs([
                walkInfo.path,
                ".."
            ], globOptions);
            try {
                if (shouldInclude(parentPath)) {
                    return yield _createWalkEntrySync(parentPath);
                }
            } catch (error) {
                throwUnlessNotFound(error);
            }
            return;
        } else if (globSegment == "**") {
            return yield* walkSync(walkInfo.path, {
                skip: excludePatterns
            });
        }
        const globPattern = globToRegExp(globSegment, globOptions);
        for (const walkEntry of walkSync(walkInfo.path, {
            maxDepth: 1,
            skip: excludePatterns
        })){
            if (walkEntry.path != walkInfo.path && walkEntry.name.match(globPattern)) {
                yield walkEntry;
            }
        }
    }
    let currentMatches = [
        fixedRootInfo
    ];
    for (const segment of segments){
        // Advancing the list of current matches may introduce duplicates, so we
        // pass everything through this Map.
        const nextMatchMap = new Map();
        for (const currentMatch of currentMatches){
            for (const nextMatch of advanceMatch(currentMatch, segment)){
                nextMatchMap.set(nextMatch.path, nextMatch);
            }
        }
        currentMatches = [
            ...nextMatchMap.values()
        ].sort(comparePath);
    }
    if (hasTrailingSep) {
        currentMatches = currentMatches.filter((entry)=>entry.isDirectory);
    }
    if (!includeDirs) {
        currentMatches = currentMatches.filter((entry)=>!entry.isDirectory);
    }
    yield* currentMatches;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE0MC4wL2ZzL2V4cGFuZF9nbG9iLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5pbXBvcnQge1xuICBHbG9iT3B0aW9ucyxcbiAgZ2xvYlRvUmVnRXhwLFxuICBpc0Fic29sdXRlLFxuICBpc0dsb2IsXG4gIGpvaW5HbG9icyxcbiAgcmVzb2x2ZSxcbiAgU0VQX1BBVFRFUk4sXG59IGZyb20gXCIuLi9wYXRoL21vZC50c1wiO1xuaW1wb3J0IHtcbiAgX2NyZWF0ZVdhbGtFbnRyeSxcbiAgX2NyZWF0ZVdhbGtFbnRyeVN5bmMsXG4gIHdhbGssXG4gIFdhbGtFbnRyeSxcbiAgd2Fsa1N5bmMsXG59IGZyb20gXCIuL3dhbGsudHNcIjtcbmltcG9ydCB7IGFzc2VydCB9IGZyb20gXCIuLi9fdXRpbC9hc3NlcnQudHNcIjtcbmltcG9ydCB7IGlzV2luZG93cyB9IGZyb20gXCIuLi9fdXRpbC9vcy50c1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIEV4cGFuZEdsb2JPcHRpb25zIGV4dGVuZHMgT21pdDxHbG9iT3B0aW9ucywgXCJvc1wiPiB7XG4gIHJvb3Q/OiBzdHJpbmc7XG4gIGV4Y2x1ZGU/OiBzdHJpbmdbXTtcbiAgaW5jbHVkZURpcnM/OiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgU3BsaXRQYXRoIHtcbiAgc2VnbWVudHM6IHN0cmluZ1tdO1xuICBpc0Fic29sdXRlOiBib29sZWFuO1xuICBoYXNUcmFpbGluZ1NlcDogYm9vbGVhbjtcbiAgLy8gRGVmaW5lZCBmb3IgYW55IGFic29sdXRlIFdpbmRvd3MgcGF0aC5cbiAgd2luUm9vdD86IHN0cmluZztcbn1cblxuZnVuY3Rpb24gc3BsaXQocGF0aDogc3RyaW5nKTogU3BsaXRQYXRoIHtcbiAgY29uc3QgcyA9IFNFUF9QQVRURVJOLnNvdXJjZTtcbiAgY29uc3Qgc2VnbWVudHMgPSBwYXRoXG4gICAgLnJlcGxhY2UobmV3IFJlZ0V4cChgXiR7c318JHtzfSRgLCBcImdcIiksIFwiXCIpXG4gICAgLnNwbGl0KFNFUF9QQVRURVJOKTtcbiAgY29uc3QgaXNBYnNvbHV0ZV8gPSBpc0Fic29sdXRlKHBhdGgpO1xuICByZXR1cm4ge1xuICAgIHNlZ21lbnRzLFxuICAgIGlzQWJzb2x1dGU6IGlzQWJzb2x1dGVfLFxuICAgIGhhc1RyYWlsaW5nU2VwOiAhIXBhdGgubWF0Y2gobmV3IFJlZ0V4cChgJHtzfSRgKSksXG4gICAgd2luUm9vdDogaXNXaW5kb3dzICYmIGlzQWJzb2x1dGVfID8gc2VnbWVudHMuc2hpZnQoKSA6IHVuZGVmaW5lZCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gdGhyb3dVbmxlc3NOb3RGb3VuZChlcnJvcjogdW5rbm93bik6IHZvaWQge1xuICBpZiAoIShlcnJvciBpbnN0YW5jZW9mIERlbm8uZXJyb3JzLk5vdEZvdW5kKSkge1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbXBhcmVQYXRoKGE6IFdhbGtFbnRyeSwgYjogV2Fsa0VudHJ5KTogbnVtYmVyIHtcbiAgaWYgKGEucGF0aCA8IGIucGF0aCkgcmV0dXJuIC0xO1xuICBpZiAoYS5wYXRoID4gYi5wYXRoKSByZXR1cm4gMTtcbiAgcmV0dXJuIDA7XG59XG5cbi8qKiBFeHBhbmQgdGhlIGdsb2Igc3RyaW5nIGZyb20gdGhlIHNwZWNpZmllZCBgcm9vdGAgZGlyZWN0b3J5IGFuZCB5aWVsZCBlYWNoXG4gKiByZXN1bHQgYXMgYSBgV2Fsa0VudHJ5YCBvYmplY3QuXG4gKlxuICogU2VlIFtgZ2xvYlRvUmVnRXhwKClgXSguLi9wYXRoL2dsb2IudHMjZ2xvYlRvUmVnRXhwKSBmb3IgZGV0YWlscyBvbiBzdXBwb3J0ZWRcbiAqIHN5bnRheC5cbiAqXG4gKiBFeGFtcGxlOlxuICogYGBgdHNcbiAqICAgICAgaW1wb3J0IHsgZXhwYW5kR2xvYiB9IGZyb20gXCIuL2V4cGFuZF9nbG9iLnRzXCI7XG4gKiAgICAgIGZvciBhd2FpdCAoY29uc3QgZmlsZSBvZiBleHBhbmRHbG9iKFwiKipcXC8qLnRzXCIpKSB7XG4gKiAgICAgICAgY29uc29sZS5sb2coZmlsZSk7XG4gKiAgICAgIH1cbiAqIGBgYFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24qIGV4cGFuZEdsb2IoXG4gIGdsb2I6IHN0cmluZyxcbiAge1xuICAgIHJvb3QgPSBEZW5vLmN3ZCgpLFxuICAgIGV4Y2x1ZGUgPSBbXSxcbiAgICBpbmNsdWRlRGlycyA9IHRydWUsXG4gICAgZXh0ZW5kZWQgPSB0cnVlLFxuICAgIGdsb2JzdGFyID0gZmFsc2UsXG4gICAgY2FzZUluc2Vuc2l0aXZlLFxuICB9OiBFeHBhbmRHbG9iT3B0aW9ucyA9IHt9LFxuKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPFdhbGtFbnRyeT4ge1xuICBjb25zdCBnbG9iT3B0aW9uczogR2xvYk9wdGlvbnMgPSB7IGV4dGVuZGVkLCBnbG9ic3RhciwgY2FzZUluc2Vuc2l0aXZlIH07XG4gIGNvbnN0IGFic1Jvb3QgPSByZXNvbHZlKHJvb3QpO1xuICBjb25zdCByZXNvbHZlRnJvbVJvb3QgPSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+IHJlc29sdmUoYWJzUm9vdCwgcGF0aCk7XG4gIGNvbnN0IGV4Y2x1ZGVQYXR0ZXJucyA9IGV4Y2x1ZGVcbiAgICAubWFwKHJlc29sdmVGcm9tUm9vdClcbiAgICAubWFwKChzOiBzdHJpbmcpOiBSZWdFeHAgPT4gZ2xvYlRvUmVnRXhwKHMsIGdsb2JPcHRpb25zKSk7XG4gIGNvbnN0IHNob3VsZEluY2x1ZGUgPSAocGF0aDogc3RyaW5nKTogYm9vbGVhbiA9PlxuICAgICFleGNsdWRlUGF0dGVybnMuc29tZSgocDogUmVnRXhwKTogYm9vbGVhbiA9PiAhIXBhdGgubWF0Y2gocCkpO1xuICBjb25zdCB7IHNlZ21lbnRzLCBpc0Fic29sdXRlOiBpc0dsb2JBYnNvbHV0ZSwgaGFzVHJhaWxpbmdTZXAsIHdpblJvb3QgfSA9XG4gICAgc3BsaXQoZ2xvYik7XG5cbiAgbGV0IGZpeGVkUm9vdCA9IGlzR2xvYkFic29sdXRlXG4gICAgPyAod2luUm9vdCAhPSB1bmRlZmluZWQgPyB3aW5Sb290IDogXCIvXCIpXG4gICAgOiBhYnNSb290O1xuICB3aGlsZSAoc2VnbWVudHMubGVuZ3RoID4gMCAmJiAhaXNHbG9iKHNlZ21lbnRzWzBdKSkge1xuICAgIGNvbnN0IHNlZyA9IHNlZ21lbnRzLnNoaWZ0KCk7XG4gICAgYXNzZXJ0KHNlZyAhPSBudWxsKTtcbiAgICBmaXhlZFJvb3QgPSBqb2luR2xvYnMoW2ZpeGVkUm9vdCwgc2VnXSwgZ2xvYk9wdGlvbnMpO1xuICB9XG5cbiAgbGV0IGZpeGVkUm9vdEluZm86IFdhbGtFbnRyeTtcbiAgdHJ5IHtcbiAgICBmaXhlZFJvb3RJbmZvID0gYXdhaXQgX2NyZWF0ZVdhbGtFbnRyeShmaXhlZFJvb3QpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiB0aHJvd1VubGVzc05vdEZvdW5kKGVycm9yKTtcbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uKiBhZHZhbmNlTWF0Y2goXG4gICAgd2Fsa0luZm86IFdhbGtFbnRyeSxcbiAgICBnbG9iU2VnbWVudDogc3RyaW5nLFxuICApOiBBc3luY0l0ZXJhYmxlSXRlcmF0b3I8V2Fsa0VudHJ5PiB7XG4gICAgaWYgKCF3YWxrSW5mby5pc0RpcmVjdG9yeSkge1xuICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZiAoZ2xvYlNlZ21lbnQgPT0gXCIuLlwiKSB7XG4gICAgICBjb25zdCBwYXJlbnRQYXRoID0gam9pbkdsb2JzKFt3YWxrSW5mby5wYXRoLCBcIi4uXCJdLCBnbG9iT3B0aW9ucyk7XG4gICAgICB0cnkge1xuICAgICAgICBpZiAoc2hvdWxkSW5jbHVkZShwYXJlbnRQYXRoKSkge1xuICAgICAgICAgIHJldHVybiB5aWVsZCBhd2FpdCBfY3JlYXRlV2Fsa0VudHJ5KHBhcmVudFBhdGgpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICB0aHJvd1VubGVzc05vdEZvdW5kKGVycm9yKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9IGVsc2UgaWYgKGdsb2JTZWdtZW50ID09IFwiKipcIikge1xuICAgICAgcmV0dXJuIHlpZWxkKiB3YWxrKHdhbGtJbmZvLnBhdGgsIHsgc2tpcDogZXhjbHVkZVBhdHRlcm5zIH0pO1xuICAgIH1cbiAgICBjb25zdCBnbG9iUGF0dGVybiA9IGdsb2JUb1JlZ0V4cChnbG9iU2VnbWVudCwgZ2xvYk9wdGlvbnMpO1xuICAgIGZvciBhd2FpdCAoXG4gICAgICBjb25zdCB3YWxrRW50cnkgb2Ygd2Fsayh3YWxrSW5mby5wYXRoLCB7XG4gICAgICAgIG1heERlcHRoOiAxLFxuICAgICAgICBza2lwOiBleGNsdWRlUGF0dGVybnMsXG4gICAgICB9KVxuICAgICkge1xuICAgICAgaWYgKFxuICAgICAgICB3YWxrRW50cnkucGF0aCAhPSB3YWxrSW5mby5wYXRoICYmIHdhbGtFbnRyeS5uYW1lLm1hdGNoKGdsb2JQYXR0ZXJuKVxuICAgICAgKSB7XG4gICAgICAgIHlpZWxkIHdhbGtFbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBsZXQgY3VycmVudE1hdGNoZXM6IFdhbGtFbnRyeVtdID0gW2ZpeGVkUm9vdEluZm9dO1xuICBmb3IgKGNvbnN0IHNlZ21lbnQgb2Ygc2VnbWVudHMpIHtcbiAgICAvLyBBZHZhbmNpbmcgdGhlIGxpc3Qgb2YgY3VycmVudCBtYXRjaGVzIG1heSBpbnRyb2R1Y2UgZHVwbGljYXRlcywgc28gd2VcbiAgICAvLyBwYXNzIGV2ZXJ5dGhpbmcgdGhyb3VnaCB0aGlzIE1hcC5cbiAgICBjb25zdCBuZXh0TWF0Y2hNYXA6IE1hcDxzdHJpbmcsIFdhbGtFbnRyeT4gPSBuZXcgTWFwKCk7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoY3VycmVudE1hdGNoZXMubWFwKGFzeW5jIChjdXJyZW50TWF0Y2gpID0+IHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgbmV4dE1hdGNoIG9mIGFkdmFuY2VNYXRjaChjdXJyZW50TWF0Y2gsIHNlZ21lbnQpKSB7XG4gICAgICAgIG5leHRNYXRjaE1hcC5zZXQobmV4dE1hdGNoLnBhdGgsIG5leHRNYXRjaCk7XG4gICAgICB9XG4gICAgfSkpO1xuICAgIGN1cnJlbnRNYXRjaGVzID0gWy4uLm5leHRNYXRjaE1hcC52YWx1ZXMoKV0uc29ydChjb21wYXJlUGF0aCk7XG4gIH1cbiAgaWYgKGhhc1RyYWlsaW5nU2VwKSB7XG4gICAgY3VycmVudE1hdGNoZXMgPSBjdXJyZW50TWF0Y2hlcy5maWx0ZXIoXG4gICAgICAoZW50cnk6IFdhbGtFbnRyeSk6IGJvb2xlYW4gPT4gZW50cnkuaXNEaXJlY3RvcnksXG4gICAgKTtcbiAgfVxuICBpZiAoIWluY2x1ZGVEaXJzKSB7XG4gICAgY3VycmVudE1hdGNoZXMgPSBjdXJyZW50TWF0Y2hlcy5maWx0ZXIoXG4gICAgICAoZW50cnk6IFdhbGtFbnRyeSk6IGJvb2xlYW4gPT4gIWVudHJ5LmlzRGlyZWN0b3J5LFxuICAgICk7XG4gIH1cbiAgeWllbGQqIGN1cnJlbnRNYXRjaGVzO1xufVxuXG4vKiogU3luY2hyb25vdXMgdmVyc2lvbiBvZiBgZXhwYW5kR2xvYigpYC5cbiAqXG4gKiBFeGFtcGxlOlxuICpcbiAqIGBgYHRzXG4gKiAgICAgIGltcG9ydCB7IGV4cGFuZEdsb2JTeW5jIH0gZnJvbSBcIi4vZXhwYW5kX2dsb2IudHNcIjtcbiAqICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGV4cGFuZEdsb2JTeW5jKFwiKipcXC8qLnRzXCIpKSB7XG4gKiAgICAgICAgY29uc29sZS5sb2coZmlsZSk7XG4gKiAgICAgIH1cbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24qIGV4cGFuZEdsb2JTeW5jKFxuICBnbG9iOiBzdHJpbmcsXG4gIHtcbiAgICByb290ID0gRGVuby5jd2QoKSxcbiAgICBleGNsdWRlID0gW10sXG4gICAgaW5jbHVkZURpcnMgPSB0cnVlLFxuICAgIGV4dGVuZGVkID0gdHJ1ZSxcbiAgICBnbG9ic3RhciA9IGZhbHNlLFxuICAgIGNhc2VJbnNlbnNpdGl2ZSxcbiAgfTogRXhwYW5kR2xvYk9wdGlvbnMgPSB7fSxcbik6IEl0ZXJhYmxlSXRlcmF0b3I8V2Fsa0VudHJ5PiB7XG4gIGNvbnN0IGdsb2JPcHRpb25zOiBHbG9iT3B0aW9ucyA9IHsgZXh0ZW5kZWQsIGdsb2JzdGFyLCBjYXNlSW5zZW5zaXRpdmUgfTtcbiAgY29uc3QgYWJzUm9vdCA9IHJlc29sdmUocm9vdCk7XG4gIGNvbnN0IHJlc29sdmVGcm9tUm9vdCA9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT4gcmVzb2x2ZShhYnNSb290LCBwYXRoKTtcbiAgY29uc3QgZXhjbHVkZVBhdHRlcm5zID0gZXhjbHVkZVxuICAgIC5tYXAocmVzb2x2ZUZyb21Sb290KVxuICAgIC5tYXAoKHM6IHN0cmluZyk6IFJlZ0V4cCA9PiBnbG9iVG9SZWdFeHAocywgZ2xvYk9wdGlvbnMpKTtcbiAgY29uc3Qgc2hvdWxkSW5jbHVkZSA9IChwYXRoOiBzdHJpbmcpOiBib29sZWFuID0+XG4gICAgIWV4Y2x1ZGVQYXR0ZXJucy5zb21lKChwOiBSZWdFeHApOiBib29sZWFuID0+ICEhcGF0aC5tYXRjaChwKSk7XG4gIGNvbnN0IHsgc2VnbWVudHMsIGlzQWJzb2x1dGU6IGlzR2xvYkFic29sdXRlLCBoYXNUcmFpbGluZ1NlcCwgd2luUm9vdCB9ID1cbiAgICBzcGxpdChnbG9iKTtcblxuICBsZXQgZml4ZWRSb290ID0gaXNHbG9iQWJzb2x1dGVcbiAgICA/ICh3aW5Sb290ICE9IHVuZGVmaW5lZCA/IHdpblJvb3QgOiBcIi9cIilcbiAgICA6IGFic1Jvb3Q7XG4gIHdoaWxlIChzZWdtZW50cy5sZW5ndGggPiAwICYmICFpc0dsb2Ioc2VnbWVudHNbMF0pKSB7XG4gICAgY29uc3Qgc2VnID0gc2VnbWVudHMuc2hpZnQoKTtcbiAgICBhc3NlcnQoc2VnICE9IG51bGwpO1xuICAgIGZpeGVkUm9vdCA9IGpvaW5HbG9icyhbZml4ZWRSb290LCBzZWddLCBnbG9iT3B0aW9ucyk7XG4gIH1cblxuICBsZXQgZml4ZWRSb290SW5mbzogV2Fsa0VudHJ5O1xuICB0cnkge1xuICAgIGZpeGVkUm9vdEluZm8gPSBfY3JlYXRlV2Fsa0VudHJ5U3luYyhmaXhlZFJvb3QpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiB0aHJvd1VubGVzc05vdEZvdW5kKGVycm9yKTtcbiAgfVxuXG4gIGZ1bmN0aW9uKiBhZHZhbmNlTWF0Y2goXG4gICAgd2Fsa0luZm86IFdhbGtFbnRyeSxcbiAgICBnbG9iU2VnbWVudDogc3RyaW5nLFxuICApOiBJdGVyYWJsZUl0ZXJhdG9yPFdhbGtFbnRyeT4ge1xuICAgIGlmICghd2Fsa0luZm8uaXNEaXJlY3RvcnkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9IGVsc2UgaWYgKGdsb2JTZWdtZW50ID09IFwiLi5cIikge1xuICAgICAgY29uc3QgcGFyZW50UGF0aCA9IGpvaW5HbG9icyhbd2Fsa0luZm8ucGF0aCwgXCIuLlwiXSwgZ2xvYk9wdGlvbnMpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgaWYgKHNob3VsZEluY2x1ZGUocGFyZW50UGF0aCkpIHtcbiAgICAgICAgICByZXR1cm4geWllbGQgX2NyZWF0ZVdhbGtFbnRyeVN5bmMocGFyZW50UGF0aCk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHRocm93VW5sZXNzTm90Rm91bmQoZXJyb3IpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZiAoZ2xvYlNlZ21lbnQgPT0gXCIqKlwiKSB7XG4gICAgICByZXR1cm4geWllbGQqIHdhbGtTeW5jKHdhbGtJbmZvLnBhdGgsIHsgc2tpcDogZXhjbHVkZVBhdHRlcm5zIH0pO1xuICAgIH1cbiAgICBjb25zdCBnbG9iUGF0dGVybiA9IGdsb2JUb1JlZ0V4cChnbG9iU2VnbWVudCwgZ2xvYk9wdGlvbnMpO1xuICAgIGZvciAoXG4gICAgICBjb25zdCB3YWxrRW50cnkgb2Ygd2Fsa1N5bmMod2Fsa0luZm8ucGF0aCwge1xuICAgICAgICBtYXhEZXB0aDogMSxcbiAgICAgICAgc2tpcDogZXhjbHVkZVBhdHRlcm5zLFxuICAgICAgfSlcbiAgICApIHtcbiAgICAgIGlmIChcbiAgICAgICAgd2Fsa0VudHJ5LnBhdGggIT0gd2Fsa0luZm8ucGF0aCAmJiB3YWxrRW50cnkubmFtZS5tYXRjaChnbG9iUGF0dGVybilcbiAgICAgICkge1xuICAgICAgICB5aWVsZCB3YWxrRW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgbGV0IGN1cnJlbnRNYXRjaGVzOiBXYWxrRW50cnlbXSA9IFtmaXhlZFJvb3RJbmZvXTtcbiAgZm9yIChjb25zdCBzZWdtZW50IG9mIHNlZ21lbnRzKSB7XG4gICAgLy8gQWR2YW5jaW5nIHRoZSBsaXN0IG9mIGN1cnJlbnQgbWF0Y2hlcyBtYXkgaW50cm9kdWNlIGR1cGxpY2F0ZXMsIHNvIHdlXG4gICAgLy8gcGFzcyBldmVyeXRoaW5nIHRocm91Z2ggdGhpcyBNYXAuXG4gICAgY29uc3QgbmV4dE1hdGNoTWFwOiBNYXA8c3RyaW5nLCBXYWxrRW50cnk+ID0gbmV3IE1hcCgpO1xuICAgIGZvciAoY29uc3QgY3VycmVudE1hdGNoIG9mIGN1cnJlbnRNYXRjaGVzKSB7XG4gICAgICBmb3IgKGNvbnN0IG5leHRNYXRjaCBvZiBhZHZhbmNlTWF0Y2goY3VycmVudE1hdGNoLCBzZWdtZW50KSkge1xuICAgICAgICBuZXh0TWF0Y2hNYXAuc2V0KG5leHRNYXRjaC5wYXRoLCBuZXh0TWF0Y2gpO1xuICAgICAgfVxuICAgIH1cbiAgICBjdXJyZW50TWF0Y2hlcyA9IFsuLi5uZXh0TWF0Y2hNYXAudmFsdWVzKCldLnNvcnQoY29tcGFyZVBhdGgpO1xuICB9XG4gIGlmIChoYXNUcmFpbGluZ1NlcCkge1xuICAgIGN1cnJlbnRNYXRjaGVzID0gY3VycmVudE1hdGNoZXMuZmlsdGVyKFxuICAgICAgKGVudHJ5OiBXYWxrRW50cnkpOiBib29sZWFuID0+IGVudHJ5LmlzRGlyZWN0b3J5LFxuICAgICk7XG4gIH1cbiAgaWYgKCFpbmNsdWRlRGlycykge1xuICAgIGN1cnJlbnRNYXRjaGVzID0gY3VycmVudE1hdGNoZXMuZmlsdGVyKFxuICAgICAgKGVudHJ5OiBXYWxrRW50cnkpOiBib29sZWFuID0+ICFlbnRyeS5pc0RpcmVjdG9yeSxcbiAgICApO1xuICB9XG4gIHlpZWxkKiBjdXJyZW50TWF0Y2hlcztcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsU0FFRSxZQUFZLEVBQ1osVUFBVSxFQUNWLE1BQU0sRUFDTixTQUFTLEVBQ1QsT0FBTyxFQUNQLFdBQVcsUUFDTixnQkFBZ0IsQ0FBQztBQUN4QixTQUNFLGdCQUFnQixFQUNoQixvQkFBb0IsRUFDcEIsSUFBSSxFQUVKLFFBQVEsUUFDSCxXQUFXLENBQUM7QUFDbkIsU0FBUyxNQUFNLFFBQVEsb0JBQW9CLENBQUM7QUFDNUMsU0FBUyxTQUFTLFFBQVEsZ0JBQWdCLENBQUM7QUFnQjNDLFNBQVMsS0FBSyxDQUFDLElBQVksRUFBYTtJQUN0QyxNQUFNLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxBQUFDO0lBQzdCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FDbEIsT0FBTyxDQUFDLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUMzQyxLQUFLLENBQUMsV0FBVyxDQUFDLEFBQUM7SUFDdEIsTUFBTSxXQUFXLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxBQUFDO0lBQ3JDLE9BQU87UUFDTCxRQUFRO1FBQ1IsVUFBVSxFQUFFLFdBQVc7UUFDdkIsY0FBYyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFD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