import { FileManager, MMKVManager } from "@lib/api/native/modules";
import { Platform } from "react-native";

export interface StorageBackend {
    get: () => unknown | Promise<unknown>;
    set: (data: unknown) => void | Promise<void>;
}

const ILLEGAL_CHARS_REGEX = /[<>:"/\\|?*]/g;

const filePathFixer = (file: string): string => Platform.select({
    default: file,
    ios: FileManager.saveFileToGallery ? file : `Documents/${file}`,
});

const getMMKVPath = (name: string): string => {
    if (ILLEGAL_CHARS_REGEX.test(name)) {
        // Replace forbidden characters with hyphens
        name = name.replace(ILLEGAL_CHARS_REGEX, "-").replace(/-+/g, "-");
    }

    return `vd_mmkv/${name}`;
};

export const purgeStorage = async (store: string) => {
    if (await MMKVManager.getItem(store)) {
        MMKVManager.removeItem(store);
    }

    const mmkvPath = getMMKVPath(store);
    if (await FileManager.fileExists(`${FileManager.getConstants().DocumentsDirPath}/${mmkvPath}`)) {
        await FileManager.removeFile?.("documents", mmkvPath);
    }
};

export const createMMKVBackend = (store: string, defaultData = {}) => {
    const mmkvPath = getMMKVPath(store);
    const defaultStr = JSON.stringify(defaultData);

    return createFileBackend(mmkvPath, defaultData, (async () => {
        const path = `${FileManager.getConstants().DocumentsDirPath}/${mmkvPath}`;
        if (await FileManager.fileExists(path)) return;

        let oldData = await MMKVManager.getItem(store) ?? defaultStr;

        // From the testing on Android, it seems to return this if the data is too large
        if (oldData === "!!LARGE_VALUE!!") {
            const cachePath = `${FileManager.getConstants().CacheDirPath}/mmkv/${store}`;
            if (await FileManager.fileExists(cachePath)) {
                oldData = await FileManager.readFile(cachePath, "utf8");
            } else {
                console.log(`${store}: Experienced data loss :(`);
                oldData = defaultStr;
            }
        }

        try {
            JSON.parse(oldData);
        } catch {
            console.error(`${store} had an unparseable data while migrating`);
            oldData = defaultStr;
        }

        await FileManager.writeFile("documents", filePathFixer(mmkvPath), oldData, "utf8");
        if (await MMKVManager.getItem(store) !== null) {
            MMKVManager.removeItem(store);
            console.log(`Successfully migrated ${store} store from MMKV storage to fs`);
        }
    })());
};

export const createFileBackend = (file: string, defaultData = {}, migratePromise?: Promise<void>): StorageBackend => {
    return {
        get: async () => {
            await migratePromise;
            const path = `${FileManager.getConstants().DocumentsDirPath}/${file}`;

            if (await FileManager.fileExists(path)) {
                const content = await FileManager.readFile(path, "utf8");
                try {
                    return JSON.parse(content);
                } catch {
                    // Corrupted content, ignore
                }
            }

            await FileManager.writeFile("documents", filePathFixer(file), JSON.stringify(defaultData), "utf8");
            return JSON.parse(await FileManager.readFile(path, "utf8"));
        },
        set: async data => {
            await migratePromise;
            await FileManager.writeFile("documents", filePathFixer(file), JSON.stringify(data), "utf8");
        }
    };
};
