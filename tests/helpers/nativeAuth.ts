import { spawn, type ChildProcess } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { createServer } from "http";
import path from "path";
import { vi } from "vitest";
import { cleanupTempDirectory, createTempDirectory } from "./gitRepo";

export function createAuthSandbox() {
    const dir = createTempDirectory("obsidian-git-native-auth-");
    // Never consult the developer's credential helpers, Git configuration,
    // agent socket, askpass program, or proxy, even on a configured workstation.
    for (const key of Object.keys(process.env)) {
        if (/^(GIT_|SSH_|GCM_)|^(https?|all|no)_proxy$/i.test(key)) {
            vi.stubEnv(key, undefined);
        }
    }
    const config = path.join(dir, "gitconfig");
    writeFileSync(config, "");
    mkdirSync(path.join(dir, "xdg"));
    vi.stubEnv("HOME", dir);
    vi.stubEnv("USERPROFILE", dir);
    vi.stubEnv("XDG_CONFIG_HOME", path.join(dir, "xdg"));
    vi.stubEnv("GIT_CONFIG_GLOBAL", config);
    vi.stubEnv("GIT_CONFIG_SYSTEM", config);
    vi.stubEnv("GIT_CONFIG_NOSYSTEM", "1");
    vi.stubEnv("GIT_ATTR_NOSYSTEM", "1");
    vi.stubEnv("GIT_ALLOW_PROTOCOL", "file:http");
    vi.stubEnv("LC_ALL", "C");
    vi.stubEnv("NO_PROXY", "127.0.0.1");
    return {
        dir,
        config,
        script(name: string, code: string): string {
            const script = path.join(dir, `${name}.cjs`);
            const launcher = path.join(dir, `${name}.sh`);
            writeFileSync(script, code);
            writeFileSync(
                launcher,
                `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(script)} "$@"\n`,
                { mode: 0o700 }
            );
            return launcher;
        },
        cleanup: () => cleanupTempDirectory(dir),
    };
}

function shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

export async function serveAuthenticatedGit(root: string, password: string) {
    const authorization = `Basic ${Buffer.from(`test:${password}`).toString("base64")}`;
    const children = new Set<ChildProcess>();
    const server = createServer((request, response) => {
        if (request.headers.authorization !== authorization) {
            request.resume();
            response.writeHead(401, {
                "WWW-Authenticate": 'Basic realm="native-auth-test"',
            });
            response.end();
            return;
        }
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        const child = spawn("git", ["http-backend"], {
            env: {
                ...process.env,
                GIT_PROJECT_ROOT: root,
                GIT_HTTP_EXPORT_ALL: "1",
                PATH_INFO: url.pathname,
                QUERY_STRING: url.search.slice(1),
                REQUEST_METHOD: request.method ?? "GET",
                CONTENT_TYPE: request.headers["content-type"] ?? "",
                CONTENT_LENGTH: request.headers["content-length"] ?? "",
                REMOTE_USER: "test",
                REMOTE_ADDR: "127.0.0.1",
                SERVER_PROTOCOL: "HTTP/1.1",
            },
            stdio: ["pipe", "pipe", "pipe"],
        });
        children.add(child);
        const chunks: Buffer[] = [];
        child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
        child.stderr.resume();
        child.stdin.on("error", () => {});
        request.on("error", () => child.kill());
        request.pipe(child.stdin);
        child.on("error", () => {
            response.writeHead(500);
            response.end();
        });
        child.on("close", (code) => {
            children.delete(child);
            if (response.writableEnded) return;
            const output = Buffer.concat(chunks);
            const separator = output.indexOf("\r\n\r\n");
            if (code !== 0 || separator < 0) {
                response.writeHead(500);
                response.end();
                return;
            }
            for (const line of output
                .subarray(0, separator)
                .toString()
                .split("\r\n")) {
                const colon = line.indexOf(":");
                const name = line.slice(0, colon);
                const value = line.slice(colon + 1).trim();
                if (name.toLowerCase() === "status") {
                    response.statusCode = Number(value.split(" ")[0]);
                } else {
                    response.setHeader(name, value);
                }
            }
            response.end(output.subarray(separator + 4));
        });
    });
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") {
        throw new Error("HTTP Git server did not bind a TCP port");
    }
    return {
        url: `http://127.0.0.1:${address.port}/remote.git`,
        async cleanup() {
            const stopped = [...children].map(
                (child) =>
                    new Promise<void>((resolve) => {
                        child.once("close", () => resolve());
                        child.kill();
                    })
            );
            await new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
                server.closeAllConnections();
            });
            await Promise.all(stopped);
        },
    };
}
