import { execFile } from "child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { promisify } from "util";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    createAuthSandbox,
    serveAuthenticatedGit,
} from "../helpers/nativeAuth";
import { createSimpleGitTestContext } from "../helpers/simpleGit";

const { credentialPrompt } = vi.hoisted(() => ({
    credentialPrompt: vi.fn<() => Promise<string | undefined>>(),
}));
vi.mock("../../src/ui/modals/generalModal", () => ({
    GeneralModal: class {
        openAndGetResult = credentialPrompt;
    },
}));

const exec = promisify(execFile);
const password = "native=auth=token==";
const cleanups: Array<() => void | Promise<void>> = [];

afterEach(async () => {
    const errors: unknown[] = [];
    while (cleanups.length > 0) {
        try {
            await cleanups.pop()?.();
        } catch (error) {
            errors.push(error);
        }
    }
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    if (errors.length > 0)
        throw new AggregateError(
            errors,
            "Authentication fixture cleanup failed"
        );
});

async function createContext(env: string[] = []) {
    const context = await createSimpleGitTestContext({
        configurePlugin: (plugin) => {
            plugin.localStorage.getEnvVars = () => env;
            plugin.settings.syncMethod = "merge";
            plugin.settings.mergeStrategy = "none";
        },
    });
    cleanups.push(() => context.cleanup());
    await context.repo.git.raw([
        "--git-dir",
        context.repo.remotePath,
        "config",
        "http.receivepack",
        "true",
    ]);
    const remote = await serveAuthenticatedGit(context.repo.dir, password);
    cleanups.push(() => remote.cleanup());
    await context.repo.git.remote(["set-url", "origin", remote.url]);
    return { ...context, remote };
}

function sandbox() {
    const result = createAuthSandbox();
    cleanups.push(result.cleanup);
    credentialPrompt.mockResolvedValue(undefined);
    return result;
}

// Executable POSIX launchers and OpenSSH are used, not mocked Git transports.
describe.skipIf(process.platform === "win32")(
    "native Git authentication",
    () => {
        it("uses a configured credential helper for authenticated clone, fetch, pull and push", async () => {
            const home = sandbox();
            const helper = home.script(
                "credential-helper",
                `if (process.argv[2] === "get") {
                process.stdout.write("username=test\\npassword=${password}\\n\\n");
            }`
            );
            await exec("git", [
                "config",
                "--file",
                home.config,
                "credential.helper",
                helper,
            ]);
            const { repo, manager, plugin, remote } = await createContext();

            await manager.clone(remote.url, "authenticated");
            const cloned = path.join(repo.repoPath, "authenticated");
            expect(readFileSync(path.join(cloned, "note.md"), "utf8")).toBe(
                "base\n"
            );
            plugin.settings.basePath = "authenticated";
            await manager.setGitInstance();

            // Setup uses the local filesystem transport; only the manager has to
            // authenticate against the HTTP remote.
            await repo.writeAndCommit(
                "remote.md",
                "from remote\n",
                "remote change"
            );
            await repo.git.push([repo.remotePath, "main"]);
            const remoteHead = await repo.head();
            const originalHead = (await manager.git.revparse("HEAD")).trim();
            await manager.fetch();
            expect((await manager.git.revparse("origin/main")).trim()).toBe(
                remoteHead
            );
            expect((await manager.git.revparse("HEAD")).trim()).toBe(
                originalHead
            );

            await manager.pull();
            expect(readFileSync(path.join(cloned, "remote.md"), "utf8")).toBe(
                "from remote\n"
            );
            expect((await manager.git.revparse("HEAD")).trim()).toBe(
                remoteHead
            );

            await manager.git.addConfig("user.name", "Native Auth Test");
            await manager.git.addConfig(
                "user.email",
                "native-auth@example.invalid"
            );
            await manager.git.raw([
                "commit",
                "--allow-empty",
                "-m",
                "authenticated push",
            ]);
            await manager.push();
            expect(
                await repo.raw([
                    "--git-dir",
                    repo.remotePath,
                    "rev-parse",
                    "main",
                ])
            ).toBe((await manager.git.revparse("HEAD")).trim());
            expect(credentialPrompt).not.toHaveBeenCalled();
        });

        it("uses an external Git askpass with an explicit environment token containing equals", async () => {
            const home = sandbox();
            const askpass = home.script(
                "git-askpass",
                `process.stdout.write(process.argv[2].startsWith("Username")
                ? "test\\n" : process.env.NATIVE_AUTH_TOKEN + "\\n");`
            );
            vi.stubEnv("GIT_ASKPASS", askpass);
            const { repo, manager, remote } = await createContext([
                `NATIVE_AUTH_TOKEN=${password}`,
                "MISSING_SEPARATOR",
                "=missing-key",
            ]);

            await manager.clone(remote.url, "askpass-clone");
            expect(
                readFileSync(
                    path.join(repo.repoPath, "askpass-clone", "note.md"),
                    "utf8"
                )
            ).toBe("base\n");
            expect(credentialPrompt).not.toHaveBeenCalled();
        });

        it("respects an inherited policy forbidding SSH GUI prompts inside a credential helper", async () => {
            const home = sandbox();
            const key = path.join(home.dir, "encrypted-key");
            await exec("ssh-keygen", [
                "-q",
                "-t",
                "ed25519",
                "-a",
                "1",
                "-N",
                "test-passphrase",
                "-f",
                key,
            ]);
            const prompted = path.join(home.dir, "unwanted-prompt");
            const askpass = home.script(
                "forbidden-ssh-askpass",
                `require("fs").writeFileSync(${JSON.stringify(prompted)}, "prompted");
             process.exitCode = 1;`
            );
            vi.stubEnv("SSH_ASKPASS", askpass);
            vi.stubEnv("SSH_ASKPASS_REQUIRE", "never");
            const helper = home.script(
                "key-unlocking-helper",
                `if (process.argv[2] === "get") {
                const result = require("child_process").spawnSync("ssh-keygen",
                    ["-y", "-f", ${JSON.stringify(key)}],
                    { input: "test-passphrase\\n", encoding: "utf8", detached: true });
                if (result.status === 0) {
                    process.stdout.write("username=test\\npassword=${password}\\n\\n");
                } else { process.exitCode = 1; }
            }`
            );
            await exec("git", [
                "config",
                "--file",
                home.config,
                "credential.helper",
                helper,
            ]);
            const { manager, repo } = await createContext();
            await repo.writeAndCommit(
                "ssh-policy.md",
                "external helper\n",
                "SSH policy"
            );
            await repo.git.push([repo.remotePath, "main"]);
            const remoteHead = await repo.head();

            await manager.fetch();
            expect((await manager.git.revparse("origin/main")).trim()).toBe(
                remoteHead
            );
            expect(existsSync(prompted)).toBe(false);
            expect(credentialPrompt).not.toHaveBeenCalled();
        });

        it("fails without credentials instead of opening plugin prompts or creating a plaintext credential bridge", async () => {
            const home = sandbox();
            const { repo, manager } = await createContext();
            const configDir = path.join(
                repo.repoPath,
                ".obsidian",
                "plugins",
                "obsidian-git"
            );
            mkdirSync(configDir, { recursive: true });
            await manager.setGitInstance();
            const head = await repo.head();

            await expect(manager.fetch()).rejects.toBeInstanceOf(Error);
            expect(await repo.head()).toBe(head);
            expect(credentialPrompt).not.toHaveBeenCalled();
            expect(readdirSync(configDir)).toEqual([]);
            expect(existsSync(path.join(home.dir, ".git-credentials"))).toBe(
                false
            );
        });
    }
);
