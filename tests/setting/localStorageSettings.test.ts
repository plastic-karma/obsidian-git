import { afterEach, describe, expect, it, vi } from "vitest";
import type ObsidianGit from "../../src/main";
import { LocalStorageSettings } from "../../src/setting/localStorageSettings";

function createMigration(useSimpleGit: boolean) {
    const legacy = new Map([
        ["obsidian-git:password", "legacy-test-token"],
        ["obsidian-git:hostname", "workstation"],
    ]);
    const stored = new Map<string, string>();
    vi.stubGlobal("localStorage", {
        getItem: (key: string) => legacy.get(key) ?? null,
        removeItem: (key: string) => legacy.delete(key),
    });
    const plugin = {
        manifest: { id: "obsidian-git" },
        useSimpleGit,
        app: {
            loadLocalStorage: (key: string) => stored.get(key) ?? null,
            saveLocalStorage: (key: string, value: string) => {
                stored.set(key, value);
            },
        },
    } as unknown as ObsidianGit;
    return { settings: new LocalStorageSettings(plugin), legacy, stored };
}

afterEach(() => vi.unstubAllGlobals());

describe("legacy local storage migration", () => {
    it("does not copy desktop credentials while migrating non-secret settings", () => {
        const { settings, legacy, stored } = createMigration(true);

        settings.migrate();

        expect(settings.getPassword()).toBeNull();
        expect(legacy.get("obsidian-git:password")).toBe("legacy-test-token");
        expect(stored.get("obsidian-git:hostname")).toBe("workstation");
        expect(legacy.has("obsidian-git:hostname")).toBe(false);
    });

    it("keeps mobile authentication working when relocating legacy credentials", () => {
        const { settings, legacy } = createMigration(false);

        settings.migrate();

        expect(settings.getPassword()).toBe("legacy-test-token");
        expect(legacy.has("obsidian-git:password")).toBe(false);
    });
});
