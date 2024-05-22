import { formatString, Strings } from "@core/i18n";
import Card, { CardWrapper } from "@core/ui/components/Card";
import { requireAssetIndex } from "@lib/api/assets";
import { purgeStorage, useProxy } from "@lib/api/storage";
import { BunnyPlugin, fetchPlugin, getSettings, removePlugin, startPlugin, stopPlugin } from "@lib/managers/plugins";
import { ButtonColors } from "@lib/utils/types";
import { clipboard, NavigationNative } from "@metro/common";
import { showConfirmationAlert } from "@ui/alerts";
import { showToast } from "@ui/toasts";

async function stopThenStart(plugin: BunnyPlugin, callback: Function) {
    if (plugin.enabled) stopPlugin(plugin.id, false);
    callback();
    if (plugin.enabled) await startPlugin(plugin.id);
}

export default function PluginCard({ item: plugin, index }: CardWrapper<BunnyPlugin>) {
    useProxy(plugin);

    const settings = getSettings(plugin.id);
    const navigation = NavigationNative.useNavigation();
    const [removed, setRemoved] = React.useState(false);

    // This is needed because of React™
    if (removed) return null;

    return (
        <Card
            index={index}
            // TODO: Actually make use of user IDs
            headerLabel={`${plugin.manifest.name}`}
            headerSublabel={plugin.manifest.authors?.[0] && `by ${plugin.manifest.authors.map(i => i.name).join(", ")}`}
            headerIcon={plugin.manifest.vendetta?.icon}
            toggleType="switch"
            toggleValue={plugin.enabled}
            onToggleChange={(v: boolean) => {
                try {
                    if (v) startPlugin(plugin.id); else stopPlugin(plugin.id);
                } catch (e) {
                    showToast((e as Error).message, requireAssetIndex("Small"));
                }
            }}
            descriptionLabel={plugin.manifest.description}
            overflowTitle={plugin.manifest.name}
            actions={[{
                icon: "WrenchIcon",
                disabled: !settings,
                onPress: () => navigation.push("VendettaCustomPage", {
                    title: plugin.manifest.name,
                    render: settings,
                })
            }]}
            overflowActions={[
                ...(settings ? [{
                    label: Strings.OVERFLOW_PLUGIN_SETTINGS,
                    icon: "settings",
                    onPress: () => navigation.push("VendettaCustomPage", {
                        title: plugin.manifest.name,
                        render: settings,
                    })
                }] : []),
                {
                    icon: "ic_sync_24px",
                    label: Strings.REFETCH,
                    onPress: async () => {
                        stopThenStart(plugin, () => {
                            fetchPlugin(plugin.id).then(async () => {
                                showToast(Strings.PLUGIN_REFETCH_SUCCESSFUL, requireAssetIndex("toast_image_saved"));
                            }).catch(() => {
                                showToast(Strings.PLUGIN_REFETCH_FAILED, requireAssetIndex("Small"));
                            });
                        });
                    },
                },
                {
                    icon: "copy",
                    label: Strings.COPY_URL,
                    onPress: () => {
                        clipboard.setString(plugin.id);
                        showToast.showCopyToClipboard();
                    }
                },
                {
                    icon: "ic_download_24px",
                    label: plugin.update ? Strings.DISABLE_UPDATES : Strings.ENABLE_UPDATES,
                    onPress: () => {
                        plugin.update = !plugin.update;
                        showToast(formatString("TOASTS_PLUGIN_UPDATE", { update: plugin.update, name: plugin.manifest.name }), requireAssetIndex("toast_image_saved"));
                    }
                },
                {
                    icon: "ic_duplicate",
                    label: Strings.CLEAR_DATA,
                    isDestructive: true,
                    onPress: () => showConfirmationAlert({
                        title: Strings.HOLD_UP,
                        content: formatString("ARE_YOU_SURE_TO_CLEAR_DATA", { name: plugin.manifest.name }),
                        confirmText: Strings.CLEAR,
                        cancelText: Strings.CANCEL,
                        confirmColor: ButtonColors.RED,
                        onConfirm: () => {
                            stopThenStart(plugin, () => {
                                try {
                                    purgeStorage(plugin.id);
                                    showToast(formatString("CLEAR_DATA_SUCCESSFUL", { name: plugin.manifest.name }), requireAssetIndex("trash"));
                                } catch {
                                    showToast(formatString("CLEAR_DATA_FAILED", { name: plugin.manifest.name }), requireAssetIndex("Small"));
                                }
                            });
                        }
                    }),
                },
                {
                    icon: "ic_message_delete",
                    label: Strings.DELETE,
                    isDestructive: true,
                    onPress: () => showConfirmationAlert({
                        title: Strings.HOLD_UP,
                        content: formatString("ARE_YOU_SURE_TO_DELETE_PLUGIN", { name: plugin.manifest.name }),
                        confirmText: Strings.DELETE,
                        cancelText: Strings.CANCEL,
                        confirmColor: ButtonColors.RED,
                        onConfirm: () => {
                            try {
                                removePlugin(plugin.id);
                                setRemoved(true);
                            } catch (e) {
                                showToast((e as Error).message, requireAssetIndex("Small"));
                            }
                        }
                    }),
                }
            ]}
        />
    );
}
