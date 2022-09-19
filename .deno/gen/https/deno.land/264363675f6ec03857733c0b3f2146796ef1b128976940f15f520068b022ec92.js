import { dirname, extname, fromFileUrl, join, toFileUrl, walk } from "./deps.ts";
import { error } from "./error.ts";
export async function collect(directory) {
    const routesDir = join(directory, "./routes");
    const islandsDir = join(directory, "./islands");
    const routes = [];
    try {
        const routesUrl = toFileUrl(routesDir);
        // TODO(lucacasonato): remove the extranious Deno.readDir when
        // https://github.com/denoland/deno_std/issues/1310 is fixed.
        for await (const _ of Deno.readDir(routesDir)){
        // do nothing
        }
        const routesFolder = walk(routesDir, {
            includeDirs: false,
            includeFiles: true,
            exts: [
                "tsx",
                "jsx",
                "ts",
                "js"
            ]
        });
        for await (const entry of routesFolder){
            if (entry.isFile) {
                const file = toFileUrl(entry.path).href.substring(routesUrl.href.length);
                routes.push(file);
            }
        }
    } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
        // Do nothing.
        } else {
            throw err;
        }
    }
    routes.sort();
    const islands = [];
    try {
        const islandsUrl = toFileUrl(islandsDir);
        for await (const entry1 of Deno.readDir(islandsDir)){
            if (entry1.isDirectory) {
                error(`Found subdirectory '${entry1.name}' in islands/. The islands/ folder must not contain any subdirectories.`);
            }
            if (entry1.isFile) {
                const ext = extname(entry1.name);
                if (![
                    ".tsx",
                    ".jsx",
                    ".ts",
                    ".js"
                ].includes(ext)) continue;
                const path = join(islandsDir, entry1.name);
                const file1 = toFileUrl(path).href.substring(islandsUrl.href.length);
                islands.push(file1);
            }
        }
    } catch (err1) {
        if (err1 instanceof Deno.errors.NotFound) {
        // Do nothing.
        } else {
            throw err1;
        }
    }
    islands.sort();
    return {
        routes,
        islands
    };
}
export async function generate(directory, manifest) {
    const { routes , islands  } = manifest;
    const output = `// DO NOT EDIT. This file is generated by fresh.
// This file SHOULD be checked into source version control.
// This file is automatically updated during development when running \`dev.ts\`.

${routes.map((file, i)=>`import * as $${i} from "./routes${file}";`).join("\n")}
${islands.map((file, i)=>`import * as $$${i} from "./islands${file}";`).join("\n")}

const manifest = {
  routes: {
    ${routes.map((file, i)=>`${JSON.stringify(`./routes${file}`)}: $${i},`).join("\n    ")}
  },
  islands: {
    ${islands.map((file, i)=>`${JSON.stringify(`./islands${file}`)}: $$${i},`).join("\n    ")}
  },
  baseUrl: import.meta.url,
};

export default manifest;
`;
    const proc = Deno.run({
        cmd: [
            Deno.execPath(),
            "fmt",
            "-"
        ],
        stdin: "piped",
        stdout: "piped",
        stderr: "null"
    });
    const raw = new ReadableStream({
        start (controller) {
            controller.enqueue(new TextEncoder().encode(output));
            controller.close();
        }
    });
    await raw.pipeTo(proc.stdin.writable);
    const out = await proc.output();
    await proc.status();
    proc.close();
    const manifestStr = new TextDecoder().decode(out);
    const manifestPath = join(directory, "./fresh.gen.ts");
    await Deno.writeTextFile(manifestPath, manifestStr);
    console.log(`%cThe manifest has been generated for ${routes.length} routes and ${islands.length} islands.`, "color: blue; font-weight: bold");
}
export async function dev(base, entrypoint) {
    entrypoint = new URL(entrypoint, base).href;
    const dir = dirname(fromFileUrl(base));
    let currentManifest;
    const prevManifest = Deno.env.get("FRSH_DEV_PREVIOUS_MANIFEST");
    if (prevManifest) {
        currentManifest = JSON.parse(prevManifest);
    } else {
        currentManifest = {
            islands: [],
            routes: []
        };
    }
    const newManifest = await collect(dir);
    Deno.env.set("FRSH_DEV_PREVIOUS_MANIFEST", JSON.stringify(newManifest));
    const manifestChanged = !arraysEqual(newManifest.routes, currentManifest.routes) || !arraysEqual(newManifest.islands, currentManifest.islands);
    if (manifestChanged) await generate(dir, newManifest);
    await import(entrypoint);
}
function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for(let i = 0; i < a.length; ++i){
        if (a[i] !== b[i]) return false;
    }
    return true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvZnJlc2hAMS4wLjEvc3JjL2Rldi9tb2QudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgZGlybmFtZSxcbiAgZXh0bmFtZSxcbiAgZnJvbUZpbGVVcmwsXG4gIGpvaW4sXG4gIHRvRmlsZVVybCxcbiAgd2Fsayxcbn0gZnJvbSBcIi4vZGVwcy50c1wiO1xuaW1wb3J0IHsgZXJyb3IgfSBmcm9tIFwiLi9lcnJvci50c1wiO1xuXG5pbnRlcmZhY2UgTWFuaWZlc3Qge1xuICByb3V0ZXM6IHN0cmluZ1tdO1xuICBpc2xhbmRzOiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNvbGxlY3QoZGlyZWN0b3J5OiBzdHJpbmcpOiBQcm9taXNlPE1hbmlmZXN0PiB7XG4gIGNvbnN0IHJvdXRlc0RpciA9IGpvaW4oZGlyZWN0b3J5LCBcIi4vcm91dGVzXCIpO1xuICBjb25zdCBpc2xhbmRzRGlyID0gam9pbihkaXJlY3RvcnksIFwiLi9pc2xhbmRzXCIpO1xuXG4gIGNvbnN0IHJvdXRlcyA9IFtdO1xuICB0cnkge1xuICAgIGNvbnN0IHJvdXRlc1VybCA9IHRvRmlsZVVybChyb3V0ZXNEaXIpO1xuICAgIC8vIFRPRE8obHVjYWNhc29uYXRvKTogcmVtb3ZlIHRoZSBleHRyYW5pb3VzIERlbm8ucmVhZERpciB3aGVuXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2Rlbm9sYW5kL2Rlbm9fc3RkL2lzc3Vlcy8xMzEwIGlzIGZpeGVkLlxuICAgIGZvciBhd2FpdCAoY29uc3QgXyBvZiBEZW5vLnJlYWREaXIocm91dGVzRGlyKSkge1xuICAgICAgLy8gZG8gbm90aGluZ1xuICAgIH1cbiAgICBjb25zdCByb3V0ZXNGb2xkZXIgPSB3YWxrKHJvdXRlc0Rpciwge1xuICAgICAgaW5jbHVkZURpcnM6IGZhbHNlLFxuICAgICAgaW5jbHVkZUZpbGVzOiB0cnVlLFxuICAgICAgZXh0czogW1widHN4XCIsIFwianN4XCIsIFwidHNcIiwgXCJqc1wiXSxcbiAgICB9KTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGVudHJ5IG9mIHJvdXRlc0ZvbGRlcikge1xuICAgICAgaWYgKGVudHJ5LmlzRmlsZSkge1xuICAgICAgICBjb25zdCBmaWxlID0gdG9GaWxlVXJsKGVudHJ5LnBhdGgpLmhyZWYuc3Vic3RyaW5nKFxuICAgICAgICAgIHJvdXRlc1VybC5ocmVmLmxlbmd0aCxcbiAgICAgICAgKTtcbiAgICAgICAgcm91dGVzLnB1c2goZmlsZSk7XG4gICAgICB9XG4gICAgfVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoZXJyIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuTm90Rm91bmQpIHtcbiAgICAgIC8vIERvIG5vdGhpbmcuXG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gIH1cbiAgcm91dGVzLnNvcnQoKTtcblxuICBjb25zdCBpc2xhbmRzID0gW107XG4gIHRyeSB7XG4gICAgY29uc3QgaXNsYW5kc1VybCA9IHRvRmlsZVVybChpc2xhbmRzRGlyKTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGVudHJ5IG9mIERlbm8ucmVhZERpcihpc2xhbmRzRGlyKSkge1xuICAgICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KSB7XG4gICAgICAgIGVycm9yKFxuICAgICAgICAgIGBGb3VuZCBzdWJkaXJlY3RvcnkgJyR7ZW50cnkubmFtZX0nIGluIGlzbGFuZHMvLiBUaGUgaXNsYW5kcy8gZm9sZGVyIG11c3Qgbm90IGNvbnRhaW4gYW55IHN1YmRpcmVjdG9yaWVzLmAsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBpZiAoZW50cnkuaXNGaWxlKSB7XG4gICAgICAgIGNvbnN0IGV4dCA9IGV4dG5hbWUoZW50cnkubmFtZSk7XG4gICAgICAgIGlmICghW1wiLnRzeFwiLCBcIi5qc3hcIiwgXCIudHNcIiwgXCIuanNcIl0uaW5jbHVkZXMoZXh0KSkgY29udGludWU7XG4gICAgICAgIGNvbnN0IHBhdGggPSBqb2luKGlzbGFuZHNEaXIsIGVudHJ5Lm5hbWUpO1xuICAgICAgICBjb25zdCBmaWxlID0gdG9GaWxlVXJsKHBhdGgpLmhyZWYuc3Vic3RyaW5nKGlzbGFuZHNVcmwuaHJlZi5sZW5ndGgpO1xuICAgICAgICBpc2xhbmRzLnB1c2goZmlsZSk7XG4gICAgICB9XG4gICAgfVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoZXJyIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuTm90Rm91bmQpIHtcbiAgICAgIC8vIERvIG5vdGhpbmcuXG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gIH1cbiAgaXNsYW5kcy5zb3J0KCk7XG5cbiAgcmV0dXJuIHsgcm91dGVzLCBpc2xhbmRzIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZW5lcmF0ZShkaXJlY3Rvcnk6IHN0cmluZywgbWFuaWZlc3Q6IE1hbmlmZXN0KSB7XG4gIGNvbnN0IHsgcm91dGVzLCBpc2xhbmRzIH0gPSBtYW5pZmVzdDtcblxuICBjb25zdCBvdXRwdXQgPSBgLy8gRE8gTk9UIEVESVQuIFRoaXMgZmlsZSBpcyBnZW5lcmF0ZWQgYnkgZnJlc2guXG4vLyBUaGlzIGZpbGUgU0hPVUxEIGJlIGNoZWNrZWQgaW50byBzb3VyY2UgdmVyc2lvbiBjb250cm9sLlxuLy8gVGhpcyBmaWxlIGlzIGF1dG9tYXRpY2FsbHkgdXBkYXRlZCBkdXJpbmcgZGV2ZWxvcG1lbnQgd2hlbiBydW5uaW5nIFxcYGRldi50c1xcYC5cblxuJHtcbiAgICByb3V0ZXMubWFwKChmaWxlLCBpKSA9PiBgaW1wb3J0ICogYXMgJCR7aX0gZnJvbSBcIi4vcm91dGVzJHtmaWxlfVwiO2ApLmpvaW4oXG4gICAgICBcIlxcblwiLFxuICAgIClcbiAgfVxuJHtcbiAgICBpc2xhbmRzLm1hcCgoZmlsZSwgaSkgPT4gYGltcG9ydCAqIGFzICQkJHtpfSBmcm9tIFwiLi9pc2xhbmRzJHtmaWxlfVwiO2ApXG4gICAgICAuam9pbihcIlxcblwiKVxuICB9XG5cbmNvbnN0IG1hbmlmZXN0ID0ge1xuICByb3V0ZXM6IHtcbiAgICAke1xuICAgIHJvdXRlcy5tYXAoKGZpbGUsIGkpID0+IGAke0pTT04uc3RyaW5naWZ5KGAuL3JvdXRlcyR7ZmlsZX1gKX06ICQke2l9LGApXG4gICAgICAuam9pbihcIlxcbiAgICBcIilcbiAgfVxuICB9LFxuICBpc2xhbmRzOiB7XG4gICAgJHtcbiAgICBpc2xhbmRzLm1hcCgoZmlsZSwgaSkgPT4gYCR7SlNPTi5zdHJpbmdpZnkoYC4vaXNsYW5kcyR7ZmlsZX1gKX06ICQkJHtpfSxgKVxuICAgICAgLmpvaW4oXCJcXG4gICAgXCIpXG4gIH1cbiAgfSxcbiAgYmFzZVVybDogaW1wb3J0Lm1ldGEudXJsLFxufTtcblxuZXhwb3J0IGRlZmF1bHQgbWFuaWZlc3Q7XG5gO1xuXG4gIGNvbnN0IHByb2MgPSBEZW5vLnJ1bih7XG4gICAgY21kOiBbRGVuby5leGVjUGF0aCgpLCBcImZtdFwiLCBcIi1cIl0sXG4gICAgc3RkaW46IFwicGlwZWRcIixcbiAgICBzdGRvdXQ6IFwicGlwZWRcIixcbiAgICBzdGRlcnI6IFwibnVsbFwiLFxuICB9KTtcbiAgY29uc3QgcmF3ID0gbmV3IFJlYWRhYmxlU3RyZWFtKHtcbiAgICBzdGFydChjb250cm9sbGVyKSB7XG4gICAgICBjb250cm9sbGVyLmVucXVldWUobmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKG91dHB1dCkpO1xuICAgICAgY29udHJvbGxlci5jbG9zZSgpO1xuICAgIH0sXG4gIH0pO1xuICBhd2FpdCByYXcucGlwZVRvKHByb2Muc3RkaW4ud3JpdGFibGUpO1xuICBjb25zdCBvdXQgPSBhd2FpdCBwcm9jLm91dHB1dCgpO1xuICBhd2FpdCBwcm9jLnN0YXR1cygpO1xuICBwcm9jLmNsb3NlKCk7XG5cbiAgY29uc3QgbWFuaWZlc3RTdHIgPSBuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUob3V0KTtcbiAgY29uc3QgbWFuaWZlc3RQYXRoID0gam9pbihkaXJlY3RvcnksIFwiLi9mcmVzaC5nZW4udHNcIik7XG5cbiAgYXdhaXQgRGVuby53cml0ZVRleHRGaWxlKG1hbmlmZXN0UGF0aCwgbWFuaWZlc3RTdHIpO1xuICBjb25zb2xlLmxvZyhcbiAgICBgJWNUaGUgbWFuaWZlc3QgaGFzIGJlZW4gZ2VuZXJhdGVkIGZvciAke3JvdXRlcy5sZW5ndGh9IHJvdXRlcyBhbmQgJHtpc2xhbmRzLmxlbmd0aH0gaXNsYW5kcy5gLFxuICAgIFwiY29sb3I6IGJsdWU7IGZvbnQtd2VpZ2h0OiBib2xkXCIsXG4gICk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBkZXYoYmFzZTogc3RyaW5nLCBlbnRyeXBvaW50OiBzdHJpbmcpIHtcbiAgZW50cnlwb2ludCA9IG5ldyBVUkwoZW50cnlwb2ludCwgYmFzZSkuaHJlZjtcblxuICBjb25zdCBkaXIgPSBkaXJuYW1lKGZyb21GaWxlVXJsKGJhc2UpKTtcblxuICBsZXQgY3VycmVudE1hbmlmZXN0OiBNYW5pZmVzdDtcbiAgY29uc3QgcHJldk1hbmlmZXN0ID0gRGVuby5lbnYuZ2V0KFwiRlJTSF9ERVZfUFJFVklPVVNfTUFOSUZFU1RcIik7XG4gIGlmIChwcmV2TWFuaWZlc3QpIHtcbiAgICBjdXJyZW50TWFuaWZlc3QgPSBKU09OLnBhcnNlKHByZXZNYW5pZmVzdCk7XG4gIH0gZWxzZSB7XG4gICAgY3VycmVudE1hbmlmZXN0ID0geyBpc2xhbmRzOiBbXSwgcm91dGVzOiBbXSB9O1xuICB9XG4gIGNvbnN0IG5ld01hbmlmZXN0ID0gYXdhaXQgY29sbGVjdChkaXIpO1xuICBEZW5vLmVudi5zZXQoXCJGUlNIX0RFVl9QUkVWSU9VU19NQU5JRkVTVFwiLCBKU09OLnN0cmluZ2lmeShuZXdNYW5pZmVzdCkpO1xuXG4gIGNvbnN0IG1hbmlmZXN0Q2hhbmdlZCA9XG4gICAgIWFycmF5c0VxdWFsKG5ld01hbmlmZXN0LnJvdXRlcywgY3VycmVudE1hbmlmZXN0LnJvdXRlcykgfHxcbiAgICAhYXJyYXlzRXF1YWwobmV3TWFuaWZlc3QuaXNsYW5kcywgY3VycmVudE1hbmlmZXN0LmlzbGFuZHMpO1xuXG4gIGlmIChtYW5pZmVzdENoYW5nZWQpIGF3YWl0IGdlbmVyYXRlKGRpciwgbmV3TWFuaWZlc3QpO1xuXG4gIGF3YWl0IGltcG9ydChlbnRyeXBvaW50KTtcbn1cblxuZnVuY3Rpb24gYXJyYXlzRXF1YWw8VD4oYTogVFtdLCBiOiBUW10pOiBib29sZWFuIHtcbiAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGEubGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQ0UsT0FBTyxFQUNQLE9BQU8sRUFDUCxXQUFXLEVBQ1gsSUFBSSxFQUNKLFNBQVMsRUFDVCxJQUFJLFFBQ0MsV0FBVyxDQUFDO0FBQ25CLFNBQVMsS0FBSyxRQUFRLFlBQVksQ0FBQztBQU9uQyxPQUFPLGVBQWUsT0FBTyxDQUFDLFNBQWlCLEVBQXFCO0lBQ2xFLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLEVBQUUsVUFBVSxDQUFDLEFBQUM7SUFDOUMsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxXQUFXLENBQUMsQUFBQztJQUVoRCxNQUFNLE1BQU0sR0FBRyxFQUFFLEFBQUM7SUFDbEIsSUFBSTtRQUNGLE1BQU0sU0FBUyxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsQUFBQztRQUN2Qyw4REFBOEQ7UUFDOUQsNkRBQTZEO1FBQzdELFdBQVcsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBRTtRQUM3QyxhQUFhO1NBQ2Q7UUFDRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFO1lBQ25DLFdBQVcsRUFBRSxLQUFLO1lBQ2xCLFlBQVksRUFBRSxJQUFJO1lBQ2xCLElBQUksRUFBRTtn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