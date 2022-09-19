// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import * as path from "../path/mod.ts";
/**
 * Test whether or not `dest` is a sub-directory of `src`
 * @param src src file path
 * @param dest dest file path
 * @param sep path separator
 */ export function isSubdir(src, dest, sep = path.sep) {
    if (src === dest) {
        return false;
    }
    const srcArray = src.split(sep);
    const destArray = dest.split(sep);
    return srcArray.every((current, i)=>destArray[i] === current);
}
/**
 * Get a human readable file type string.
 *
 * @param fileInfo A FileInfo describes a file and is returned by `stat`,
 *                 `lstat`
 */ export function getFileInfoType(fileInfo) {
    return fileInfo.isFile ? "file" : fileInfo.isDirectory ? "dir" : fileInfo.isSymlink ? "symlink" : undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE0MC4wL2ZzL191dGlsLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gXCIuLi9wYXRoL21vZC50c1wiO1xuXG4vKipcbiAqIFRlc3Qgd2hldGhlciBvciBub3QgYGRlc3RgIGlzIGEgc3ViLWRpcmVjdG9yeSBvZiBgc3JjYFxuICogQHBhcmFtIHNyYyBzcmMgZmlsZSBwYXRoXG4gKiBAcGFyYW0gZGVzdCBkZXN0IGZpbGUgcGF0aFxuICogQHBhcmFtIHNlcCBwYXRoIHNlcGFyYXRvclxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNTdWJkaXIoXG4gIHNyYzogc3RyaW5nLFxuICBkZXN0OiBzdHJpbmcsXG4gIHNlcDogc3RyaW5nID0gcGF0aC5zZXAsXG4pOiBib29sZWFuIHtcbiAgaWYgKHNyYyA9PT0gZGVzdCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCBzcmNBcnJheSA9IHNyYy5zcGxpdChzZXApO1xuICBjb25zdCBkZXN0QXJyYXkgPSBkZXN0LnNwbGl0KHNlcCk7XG4gIHJldHVybiBzcmNBcnJheS5ldmVyeSgoY3VycmVudCwgaSkgPT4gZGVzdEFycmF5W2ldID09PSBjdXJyZW50KTtcbn1cblxuZXhwb3J0IHR5cGUgUGF0aFR5cGUgPSBcImZpbGVcIiB8IFwiZGlyXCIgfCBcInN5bWxpbmtcIjtcblxuLyoqXG4gKiBHZXQgYSBodW1hbiByZWFkYWJsZSBmaWxlIHR5cGUgc3RyaW5nLlxuICpcbiAqIEBwYXJhbSBmaWxlSW5mbyBBIEZpbGVJbmZvIGRlc2NyaWJlcyBhIGZpbGUgYW5kIGlzIHJldHVybmVkIGJ5IGBzdGF0YCxcbiAqICAgICAgICAgICAgICAgICBgbHN0YXRgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRGaWxlSW5mb1R5cGUoZmlsZUluZm86IERlbm8uRmlsZUluZm8pOiBQYXRoVHlwZSB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiBmaWxlSW5mby5pc0ZpbGVcbiAgICA/IFwiZmlsZVwiXG4gICAgOiBmaWxlSW5mby5pc0RpcmVjdG9yeVxuICAgID8gXCJkaXJcIlxuICAgIDogZmlsZUluZm8uaXNTeW1saW5rXG4gICAgPyBcInN5bWxpbmtcIlxuICAgIDogdW5kZWZpbmVkO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxZQUFZLElBQUksTUFBTSxnQkFBZ0IsQ0FBQztBQUV2Qzs7Ozs7Q0FLQyxHQUNELE9BQU8sU0FBUyxRQUFRLENBQ3RCLEdBQVcsRUFDWCxJQUFZLEVBQ1osR0FBVyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQ2I7SUFDVCxJQUFJLEdBQUcsS0FBSyxJQUFJLEVBQUU7UUFDaEIsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBQ0QsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQUFBQztJQUNoQyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxBQUFDO0lBQ2xDLE9BQU8sUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLEdBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLLE9BQU8sQ0FBQyxDQUFDO0FBQ2xFLENBQUM7QUFJRDs7Ozs7Q0FLQyxHQUNELE9BQU8sU0FBUyxlQUFlLENBQUMsUUFBdUIsRUFBd0I7SUFDN0UsT0FBTyxRQUFRLENBQUMsTUFBTSxHQUNsQixNQUFNLEdBQ04sUUFBUSxDQUFDLFdBQVcsR0FDcEIsS0FBSyxHQUNMLFFBQVEsQ0FBQyxTQUFTLEdBQ2xCLFNBQVMsR0FDVCxTQUFTLENBQUM7QUFDaEIsQ0FBQyJ9