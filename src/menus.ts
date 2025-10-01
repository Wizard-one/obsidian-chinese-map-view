import {
    Editor,
    MenuItem,
    Menu,
    App,
    TFile,
    TAbstractFile,
    Notice,
    type Pos,
} from 'obsidian';

import * as leaflet from 'leaflet';

import * as settings from 'src/settings';
import * as utils from 'src/utils';
import * as consts from 'src/consts';
import { LocationSearchDialog } from 'src/locationSearchDialog';
import { UrlConvertor } from 'src/urlConvertor';
import { LocationSuggest } from 'src/locationSuggest';
import { type MapState } from 'src/mapState';
import MapViewPlugin from 'src/main';
import { MapContainer } from 'src/mapContainer';
import { type PluginSettings } from 'src/settings';
import { FileMarker, renameMarker, createMarkerInFile } from 'src/fileMarker';
import { createGeoJsonInFile } from 'src/geojsonLayer';
import {
    isAutoNaviMapSource,
    transformCoordinatesFromAutoNavi,
    transformCoordinatesForAutoNavi,
} from 'src/coordinateTransformer';
import { SvelteModal } from 'src/svelte';
import TextBoxDialog from './components/TextBoxDialog.svelte';
import ImportDialog from './components/ImportDialog.svelte';
import { doRouting } from 'src/routing';
import { type GeoJSON } from 'geojson';
import { BaseGeoLayer } from 'src/baseGeoLayer';
import { GeoJsonLayer } from 'src/geojsonLayer';
import { getMarkerFromUser } from 'src/markerSelectDialog';

export function addShowOnMap(
    menu: Menu,
    geolocation: leaflet.LatLng,
    file: TAbstractFile,
    editorLine: number,
    plugin: MapViewPlugin,
    settings: PluginSettings,
    markerIdToHighlight: string = null,
) {
    if (geolocation) {
        menu.addItem((item: MenuItem) => {
            item.setTitle('在地图上显示');
            item.setSection('chinese-mapview');
            item.setIcon('globe');
            const openFunc = async (evt: MouseEvent) =>
                await plugin.openMapWithLocation(
                    geolocation,
                    utils.mouseEventToOpenMode(settings, evt, 'openMap'),
                    file,
                    editorLine,
                    evt.shiftKey,
                    markerIdToHighlight,
                );
            item.onClick(openFunc);
            addPatchyMiddleClickHandler(item, menu, openFunc);
        });
    }
}

export function addOpenWith(
    menu: Menu,
    geolocation: leaflet.LatLng,
    name: string,
    settings: settings.PluginSettings,
) {
    if (geolocation) {
        menu.addItem((item: MenuItem) => {
            item.setTitle('用默认应用打开');
            item.setIcon('map-pin');
            item.setSection('chinese-mapview');
            item.onClick((_ev) => {
                open(`geo:${geolocation.lat},${geolocation.lng}`);
            });
        });
        // Populate menu items from user defined "Open In" strings
        populateOpenInItems(menu, geolocation, name, settings);
    }
}

/**
 * Populate a context menu from the user configurable URLs
 * @param menu The menu to attach
 * @param location The geolocation to use in the menu item
 * @param settings Plugin settings
 */
export function populateOpenInItems(
    menu: Menu,
    location: leaflet.LatLng,
    name: string,
    settings: settings.PluginSettings,
) {
    for (let setting of settings.openIn) {
        if (!setting.name || !setting.urlPattern) continue;

        // Check if this is a Gaode/Amap target that needs coordinate transformation
        const isGaodeAmap =
            setting.name.toLowerCase().includes('高德') ||
            setting.name.toLowerCase().includes('amap') ||
            setting.name.toLowerCase().includes('gaode') ||
            setting.urlPattern.toLowerCase().includes('autonavi.com') ||
            setting.urlPattern.toLowerCase().includes('amap.com');

        // Apply coordinate transformation if needed
        let transformedLocation = location;
        if (isGaodeAmap) {
            transformedLocation = transformCoordinatesForAutoNavi(location);
        }

        const fullUrl = setting.urlPattern
            .replace(/{x}/g, transformedLocation.lat.toString())
            .replace(/{y}/g, transformedLocation.lng.toString())
            .replace(/{name}/g, name || '');
        menu.addItem((item: MenuItem) => {
            item.setTitle(`在${setting.name}中打开`);
            item.setIcon('map-pin');
            item.setSection('chinese-mapview');
            item.onClick((_ev) => {
                open(fullUrl);
            });
        });
    }
}

export function addGeolocationToNote(
    menu: Menu,
    app: App,
    plugin: MapViewPlugin,
    editor: Editor,
    file: TFile,
    settings: settings.PluginSettings,
) {
    menu.addItem((item: MenuItem) => {
        item.setTitle('添加地理位置（front matter）');
        item.setSection('chinese-mapview');
        item.setIcon('map-pin-plus');
        item.onClick(async (_evt: MouseEvent) => {
            const dialog = new LocationSearchDialog(
                app,
                plugin,
                settings,
                'addToNote',
                'Add geolocation to note',
                editor,
                file,
            );
            dialog.open();
        });
    });
}

export function addFocusNoteInMapView(
    menu: Menu,
    file: TFile,
    settings: settings.PluginSettings,
    plugin: MapViewPlugin,
) {
    menu.addItem((item: MenuItem) => {
        const fileName = utils.trimmedFileName(file);
        item.setTitle(`在地图视图中聚焦'${fileName}'`);
        item.setIcon('map-pinned');
        item.setSection('chinese-mapview');
        const openFunc = async (evt: MouseEvent) =>
            await plugin.openMapWithState(
                {
                    query: utils.replaceFollowActiveNoteQuery(file, settings),
                } as MapState,
                utils.mouseEventToOpenMode(settings, evt, 'openMap'),
                true,
            );
        item.onClick(openFunc);
        addPatchyMiddleClickHandler(item, menu, openFunc);
    });
}

export function addUrlConversionItems(
    app: App,
    menu: Menu,
    editor: Editor,
    file: TFile,
    suggestor: LocationSuggest,
    urlConvertor: UrlConvertor,
    settings: PluginSettings,
) {
    if (editor.getSelection()) {
        // If there is text selected, add a menu item to convert it to coordinates using geosearch
        menu.addItem((item: MenuItem) => {
            item.setTitle('转换为地理位置（地理搜索）');
            item.setIcon('search');
            item.setSection('chinese-mapview');
            item.onClick(
                async () => await suggestor.selectionToLink(editor, file),
            );
        });
    }

    if (urlConvertor.hasMatchInLine(editor))
        // If the line contains a recognized geolocation that can be converted from a URL parsing rule
        menu.addItem(async (item: MenuItem) => {
            item.setTitle('转换为地理位置');
            item.setIcon('search');
            item.setSection('chinese-mapview');
            item.onClick(async () => {
                urlConvertor.convertUrlAtCursorToGeolocation(editor, file);
            });
        });

    menu.addItem((item: MenuItem) => {
        item.setTitle('粘贴为地理位置');
        item.setSection('chinese-mapview');
        item.setIcon('clipboard-x');
        item.onClick(async () => {
            const clipboard = await navigator.clipboard.readText();
            let clipboardLocation =
                urlConvertor.parseLocationFromUrl(clipboard);
            if (clipboardLocation instanceof Promise)
                clipboardLocation = await clipboardLocation;
            if (clipboardLocation)
                utils.insertLocationToEditor(
                    app,
                    clipboardLocation.location,
                    editor,
                    file,
                    settings,
                );
        });
    });
}

export function addEmbed(menu: Menu, plugin: MapViewPlugin, editor: Editor) {
    menu.addItem((item: MenuItem) => {
        item.setTitle('嵌入地图视图');
        item.setSection('chinese-mapview');
        item.setIcon('log-in');
        item.onClick(() => {
            plugin.openQuickEmbed(editor);
        });
    });
}

export function addNewNoteItems(
    menu: Menu,
    geolocation: leaflet.LatLng,
    mapContainer: MapContainer,
    settings: settings.PluginSettings,
    app: App,
) {
    const locationString = `${geolocation.lat},${geolocation.lng}`;
    menu.addItem((item: MenuItem) => {
        item.setTitle('在此创建新笔记（inline）');
        item.setIcon('edit');
        item.setSection('new');
        const openFunc = async (ev: MouseEvent) => {
            const newFileName = utils.formatWithTemplates(
                settings.newNoteNameFormat,
            );
            const [file, cursorPos] = await utils.newNote(
                app,
                'multiLocation',
                settings.newNotePath,
                newFileName,
                locationString,
                settings.frontMatterKey,
                settings.newNoteTemplate,
            );
            mapContainer.goToFile(
                file,
                utils.mouseEventToOpenMode(settings, ev, 'openNote'),
                async (editor) =>
                    utils.goToEditorLocation(editor, cursorPos, false),
            );
        };
        item.onClick(openFunc);
        addPatchyMiddleClickHandler(item, menu, openFunc);
    });
    menu.addItem((item: MenuItem) => {
        item.setTitle('在此创建新笔记（front matter）');
        item.setIcon('edit');
        item.setSection('new');
        const openFunc = async (ev: MouseEvent) => {
            const newFileName = utils.formatWithTemplates(
                settings.newNoteNameFormat,
            );
            const [file, cursorPos] = await utils.newNote(
                app,
                'singleLocation',
                settings.newNotePath,
                newFileName,
                locationString,
                settings.frontMatterKey,
                settings.newNoteTemplate,
            );
            mapContainer.goToFile(
                file,
                utils.mouseEventToOpenMode(settings, ev, 'openNote'),
                async (editor) =>
                    utils.goToEditorLocation(editor, cursorPos, false),
            );
        };
        item.onClick(openFunc);
        addPatchyMiddleClickHandler(item, menu, openFunc);
    });
}

export function addCopyGeolocationItems(
    menu: Menu,
    geolocation: leaflet.LatLng,
    app: App,
    plugin: MapViewPlugin,
    settings: PluginSettings,
) {
    const locationString = `${geolocation.lat},${geolocation.lng}`;
    menu.addItem((item: MenuItem) => {
        item.setTitle(`复制地理位置`);
        item.setIcon('copy');
        item.setSection('copy');
        item.onClick((_ev) => {
            const dialog = new SvelteModal(
                TextBoxDialog,
                app,
                plugin,
                settings,
                {
                    label: 'Select a name for the new marker:',
                    existingText: '',
                    onOk: (text: string) => {
                        navigator.clipboard.writeText(
                            `[${text}](geo:${locationString})`,
                        );
                    },
                },
            );
            dialog.open();
        });
    });
    menu.addItem((item: MenuItem) => {
        item.setTitle(`复制地理位置为front matter`);
        item.setIcon('copy');
        item.setSection('copy');
        item.onClick((_ev) => {
            navigator.clipboard.writeText(
                `---\nlocation: "${locationString}"\n---\n\n`,
            );
        });
    });
}

export function addFocusLinesInMapView(
    menu: Menu,
    file: TFile,
    fromLine: number,
    toLine: number,
    numLocations: number,
    plugin: MapViewPlugin,
    settings: settings.PluginSettings,
) {
    menu.addItem((item: MenuItem) => {
        item.setTitle(
            `Focus ${numLocations} ${
                numLocations > 1 ? 'geolocations' : 'geolocation'
            } in Map View`,
        );
        item.setIcon('map-pinned');
        item.setSection('chinese-mapview');
        const openFunc = async (evt: MouseEvent) =>
            await plugin.openMapWithState(
                {
                    query: `path:"${file.path}" AND lines:${fromLine}-${toLine}`,
                } as MapState,
                utils.mouseEventToOpenMode(settings, evt, 'openMap'),
                true,
            );
        item.onClick(openFunc);
        addPatchyMiddleClickHandler(item, menu, openFunc);
    });
}

export function addImport(
    menu: Menu,
    editor: Editor,
    file: TFile,
    app: App,
    plugin: MapViewPlugin,
    settings: settings.PluginSettings,
) {
    menu.addItem((item: MenuItem) => {
        item.setTitle('从文件导入地理位置...');
        item.setIcon('map-pin-plus-inside');
        item.setSection('chinese-mapview');
        item.onClick(async (evt: MouseEvent) => {
            const dialog = new SvelteModal(
                ImportDialog,
                app,
                plugin,
                settings,
                { editor, file },
            );
            dialog.open();
        });
    });
}

export function populateOpenNote(
    mapContainer: MapContainer,
    fileMarker: FileMarker,
    menu: Menu,
    settings: PluginSettings,
) {
    menu.addItem((item: MenuItem) => {
        item.setTitle('打开笔记');
        item.setIcon('file');
        item.setSection('open-note');
        item.onClick(async (evt: MouseEvent) => {
            mapContainer.goToMarker(
                fileMarker,
                utils.mouseEventToOpenMode(settings, evt, 'openNote'),
                true,
            );
        });
        addPatchyMiddleClickHandler(item, menu, async (evt: MouseEvent) => {
            mapContainer.goToMarker(
                fileMarker,
                utils.mouseEventToOpenMode(settings, evt, 'openNote'),
                true,
            );
        });
    });
}

export function populateRename(
    mapContainer: MapContainer,
    fileMarker: FileMarker,
    menu: Menu,
    settings: PluginSettings,
    app: App,
    plugin: MapViewPlugin,
) {
    menu.addItem((item: MenuItem) => {
        item.setTitle('重命名...');
        item.setIcon('folder-pen');
        item.setSection('open-note');
        item.onClick(async (_evt: MouseEvent) => {
            renameMarker(fileMarker, settings, app, plugin);
        });
    });
}

export function addStartEditMode(
    mapContainer: MapContainer,
    fileMarker: FileMarker,
    menu: Menu,
    settings: PluginSettings,
    app: App,
    plugin: MapViewPlugin,
) {
    if (!fileMarker.file) return;
    if (!mapContainer.viewSettings.showEdit) return;
    menu.addItem((item: MenuItem) => {
        item.setTitle('开始编辑模式');
        item.setIcon('pencil');
        item.setSection('open-note');
        item.onClick(async (_evt: MouseEvent) => {
            mapContainer.highLevelSetViewState({ editMode: true });
            mapContainer.display.controls.openEditSection(fileMarker.file);
        });
    });
}

// The MenuItem object in the Obsidian API doesn't let us listen to a middle-click, so we patch around it
function addPatchyMiddleClickHandler(
    item: MenuItem,
    menu: Menu,
    handler: (ev: MouseEvent) => void,
) {
    const itemDom = (item as any).dom as HTMLDivElement;
    if (itemDom) {
        itemDom.addEventListener('mousedown', (ev: MouseEvent) => {
            if (ev.button === 1) {
                menu.close();
                handler(ev);
            }
        });
    }
}

export function populateRouting(
    mapContainer: MapContainer,
    geolocation: leaflet.LatLng,
    menu: Menu,
    settings: settings.PluginSettings,
    app: App,
    plugin: MapViewPlugin,
    originalEvent: MouseEvent,
    existingLayer?: BaseGeoLayer,
) {
    if (geolocation) {
        menu.addItem((item: MenuItem) => {
            item.setTitle('标记为路由源');
            item.setSection('chinese-mapview');
            item.setIcon('flag');
            item.onClick(() => {
                mapContainer.setRoutingSource(geolocation, existingLayer?.name);
            });
        });

        if (mapContainer.display.routingSource) {
            menu.addItem((item: MenuItem) => {
                item.setTitle('路由到此点');
                item.setSection('chinese-mapview');
                item.setIcon('milestone');
                const submenu = (item as any).setSubmenu();
                populateRouteToPoint(
                    mapContainer,
                    geolocation,
                    submenu,
                    settings,
                );
            });
        } else {
            menu.addItem((item: MenuItem) => {
                item.setTitle('Route from...');
                item.setSection('chinese-mapview');
                item.setIcon('milestone');
                item.onClick(async () => {
                    const result = await getMarkerFromUser(
                        mapContainer.getState().mapCenter,
                        'Select a marker for routing',
                        app,
                        plugin,
                        settings,
                    );
                    if (result) {
                        const [newSource, _] = result;
                        if (newSource && newSource instanceof FileMarker) {
                            mapContainer.setRoutingSource(
                                newSource.location,
                                newSource.name,
                            );
                            const menu = new Menu();
                            populateRouteToPoint(
                                mapContainer,
                                geolocation,
                                menu,
                                settings,
                            );
                            menu.showAtMouseEvent(originalEvent);
                        }
                    }
                });
            });
        }
    }
}

export function populateRouteToPoint(
    mapContainer: MapContainer,
    geolocation: leaflet.LatLng,
    menu: Menu,
    settings: settings.PluginSettings,
) {
    const origin = mapContainer.display.routingSource.getLatLng();
    menu.addItem((item: MenuItem) => {
        item.setTitle('With external service');
        item.onClick(() => {
            const routingTemplate = settings.routingUrl;
            const url = routingTemplate
                .replace('{x0}', origin.lat.toString())
                .replace('{y0}', origin.lng.toString())
                .replace('{x1}', geolocation.lat.toString())
                .replace('{y1}', geolocation.lng.toString());
            open(url);
        });
    });
    const profiles = settings.routingGraphHopperProfiles.split(',');
    for (const profile of profiles) {
        const cleanedProfile = profile.trim();
        menu.addItem((item: MenuItem) => {
            item.setTitle(`GraphHopper: ${cleanedProfile}`);
            item.onClick(() => {
                doRouting(
                    origin,
                    geolocation,
                    'graphhopper',
                    { profile: cleanedProfile },
                    mapContainer,
                    settings,
                );
            });
        });
    }
}

/*
 * The function's confusing name is because it adds an "add to edited note" menu item when Edit Mode, or "add to note" when not.
 */
export function addMarkerAddToNote(
    menu: Menu,
    geolocation: leaflet.LatLng,
    mapContainer: MapContainer,
    settings: settings.PluginSettings,
    app: App,
    plugin: MapViewPlugin,
) {
    const enabled =
        mapContainer.getState().editMode &&
        mapContainer.display.controls.editModeTools.noteToEdit;
    menu.addItem((item: MenuItem) => {
        item.setTitle('Add to Edit Mode note');
        item.setIcon('edit');
        item.setSection('new');
        item.setDisabled(!enabled);
        item.onClick(() => {
            const file = mapContainer.display.controls.editModeTools.noteToEdit;
            const heading =
                mapContainer.display.controls.editModeTools.noteHeading;
            const tags = mapContainer.display.controls.editModeTools.tags;
            let markerLocation = geolocation;
            // 如果使用高德地图，需要将GCJ-02坐标转换回WGS84保存
            if (isAutoNaviMapSource(mapContainer.getMapSource())) {
                markerLocation =
                    transformCoordinatesFromAutoNavi(markerLocation);
            }
            createMarkerInFile(
                markerLocation,
                file,
                heading,
                tags,
                app,
                settings,
                plugin,
            );
        });
    });
}

export function addPathAddToNote(
    menu: Menu,
    geojson: GeoJSON,
    mapContainer: MapContainer,
    settings: settings.PluginSettings,
    app: App,
    plugin: MapViewPlugin,
    doAfterAdd: () => void,
) {
    const enabled =
        mapContainer.getState().editMode &&
        mapContainer.display.controls.editModeTools.noteToEdit;
    menu.addItem((item: MenuItem) => {
        item.setTitle('Add to Edit Mode note');
        item.setIcon('edit');
        item.setDisabled(!enabled);
        item.onClick(() => {
            const file = mapContainer.display.controls.editModeTools.noteToEdit;
            const heading =
                mapContainer.display.controls.editModeTools.noteHeading;
            const tags = mapContainer.display.controls.editModeTools.tags;
            createGeoJsonInFile(geojson, file, heading, tags, app, settings);
            if (doAfterAdd) doAfterAdd();
        });
    });
}

/*
 * The context menu on an area of the map where there is no existing marker or a search result, showing mostly options to add
 * a new marker or open this geolocation elsewhere.
 */
export function addMapContextMenuItems(
    mapPopup: Menu,
    geolocation: leaflet.LatLng,
    mapContainer: MapContainer,
    settings: settings.PluginSettings,
    app: App,
    plugin: MapViewPlugin,
    originalEvent: MouseEvent,
) {
    addNewNoteItems(mapPopup, geolocation, mapContainer, settings, app);
    addMarkerAddToNote(
        mapPopup,
        geolocation,
        mapContainer,
        settings,
        app,
        plugin,
    );
    addCopyGeolocationItems(mapPopup, geolocation, app, plugin, settings);
    populateRouting(
        mapContainer,
        geolocation,
        mapPopup,
        settings,
        app,
        plugin,
        originalEvent,
    );
    addOpenWith(mapPopup, geolocation, null, settings);
}

export function addPathContextMenuItems(
    menu: Menu,
    layer: GeoJsonLayer,
    leafletLayer: leaflet.Layer,
    mouseEvent: MouseEvent,
    mapContainer: MapContainer,
    settings: settings.PluginSettings,
    app: App,
    plugin: MapViewPlugin,
) {
    // In the case of an embedded JSON...
    if (layer.sourceType === 'geojson' && layer.fileLocation > 0) {
        menu.addItem((item: MenuItem) => {
            item.setTitle('Go to path definition');
            item.onClick(() => {
                mapContainer.goToMarker(
                    layer,
                    utils.mouseEventToOpenMode(
                        settings,
                        mouseEvent,
                        'openNote',
                    ),
                    false,
                    // Move the cursor right before the GeoJSON in the file, so it will show the map preview and not the source code
                    -1,
                );
            });
        });
    }

    // In the case of a stand-alone file, try to list references to it
    if (layer.file && !layer.fileLocation) {
        const target = layer.file;
        type FoundFile = {
            file: TFile;
            position: Pos | null;
        };
        let results: FoundFile[] = [];
        for (const file of app.vault.getFiles()) {
            const linksFrom = app.metadataCache.getFileCache(file);
            const linksWithPosition = [
                ...(linksFrom?.links ?? []),
                ...(linksFrom?.embeds ?? []),
            ];
            for (const link of linksWithPosition) {
                if (link.link === target.name) {
                    results.push({ file: file, position: link.position });
                }
            }
            for (const link of [...(linksFrom?.frontmatterLinks ?? [])]) {
                if (link.link === target.name) {
                    results.push({ file: file, position: null });
                }
            }
        }
        if (results.length > 0) {
            const addRefernece = (
                menu: Menu,
                reference: FoundFile,
                isSingle: boolean,
            ) => {
                menu.addItem((item: MenuItem) => {
                    item.setTitle(
                        isSingle
                            ? `Open '${reference.file.basename}'`
                            : reference.file.basename,
                    );
                    item.onClick((evt) => {
                        const openMode = utils.mouseEventToOpenMode(
                            settings,
                            evt as MouseEvent,
                            'openNote',
                        );
                        mapContainer.goToFile(
                            reference.file,
                            openMode,
                            async (editor) => {
                                await utils.goToEditorLocation(
                                    editor,
                                    reference.position
                                        ? reference.position.start.offset
                                        : null,
                                    false,
                                );
                            },
                        );
                    });
                });
            };
            // If there's just one reference to the file -- list it.
            // If there are more, show a submenu.
            if (results.length === 1) {
                addRefernece(menu, results[0], true);
            } else {
                menu.addItem((item: MenuItem) => {
                    item.setTitle('Go to reference...');
                    const submenu = (item as any).setSubmenu();
                    for (const reference of results)
                        addRefernece(submenu, reference, false);
                });
            }
        }
    }

    // Finally, add an option to reveal non-notes in the file explorer
    if (layer.file && layer.file.extension !== 'md') {
        menu.addItem((item: MenuItem) => {
            item.setTitle('Reveal in file explorer');
            item.onClick(() => {
                if (!(app.vault as any)?.config?.showUnsupportedFiles)
                    new Notice(
                        'Some file types can only be displayed if you turn on "detect all file extensions" in the Obsidian "Files and links" settings.',
                        60 * 1000,
                    );
                const fileExplorer = (
                    app as any
                )?.internalPlugins?.getEnabledPluginById('file-explorer');
                fileExplorer?.revealInFolder(layer.file);
            });
        });
    }
}
