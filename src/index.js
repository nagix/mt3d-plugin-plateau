import plateauSVG from './plateau.svg';

// Model URL
const MODEL_URL = 'https://mini-tokyo.appspot.com/plateau-models.geojson';

// GSI Ortho URL
const GSI_ORTHO_URL = 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg';

// GSI Ortho Attribution
const GSI_ORTHO_ATTRIBUTION = '<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>';

// PLATEAU Ortho URL
const PLATEAU_ORTHO_URL = 'https://api.plateauview.mlit.go.jp/tiles/plateau-ortho-2023/{z}/{x}/{y}.png';

// PLATEAU Ortho Attribution
const PLATEAU_ORTHO_ATTRIBUTION = '<a href="https://www.mlit.go.jp/plateau/">国土交通省Project PLATEAU</a>';

// Reads the per-building _zmin values from a glTF's EXT_structural_metadata
// property table (3D Tiles 1.1). Returns the valid values (noData filtered out),
// or undefined when the extension or the _zmin property is absent.
function getZMins(gltf) {
    const metadata = gltf.extensions && gltf.extensions.EXT_structural_metadata;

    if (!metadata) {
        return;
    }

    const table = (metadata.propertyTables || []).find(({properties}) => properties && properties._zmin);

    if (!table) {
        return;
    }

    const {componentType, noData} = metadata.schema.classes[table.class].properties._zmin,
        {data} = gltf.bufferViews[table.properties._zmin.values],
        view = new DataView(data.buffer, data.byteOffset, data.byteLength),
        float32 = componentType === 'FLOAT32',
        zMins = [];

    for (let i = 0; i < table.count; i++) {
        const value = float32 ? view.getFloat32(i * 4, true) : view.getFloat64(i * 8, true);

        if (value !== noData) {
            zMins.push(value);
        }
    }
    return zMins;
}

class PlateauPlugin {

    constructor(options) {
        const me = this;

        me.id = 'plateau';
        me.name = {
            de: 'PLATEAU',
            en: 'PLATEAU',
            es: 'PLATEAU',
            fr: 'PLATEAU',
            ja: 'PLATEAU',
            ko: 'PLATEAU',
            ne: 'PLATEAU',
            pt: 'PLATEAU',
            th: 'PLATEAU',
            'zh-Hans': 'PLATEAU',
            'zh-Hant': 'PLATEAU'
        };
        me.iconStyle = {
            backgroundSize: '32px',
            backgroundImage: `url("${plateauSVG}")`
        };
        me.viewModes = ['ground'];
        me.enabled = options && options.enabled;
        me._tick = me._tick.bind(me);
        me._updateLayers = me._updateLayers.bind(me);
        me._layers = new Set();
    }

    onAdd(map) {
        this.map = map;
    }

    onRemove(map) {
        for (const id of ['gsi-ortho', 'plateau-ortho', 'plateau-model']) {
            map.removeLayer(id);
        }
        for (const code of this._layer) {
            map.removeLayer(`tile-3d-${code}`);
        }
    }

    onEnabled() {
        const {map, _updateLayers} = this,
            mapboxMap = map.getMapboxMap();

        mapboxMap.on('idle', _updateLayers);

        if (mapboxMap.getLayer('plateau-ortho')) {
            return;
        }

        map.addLayer({
            id: 'gsi-ortho',
            type: 'raster',
            source: {
                type: 'raster',
                tiles: [GSI_ORTHO_URL],
                maxzoom: 18,
                minzoom: 2,
                attribution: GSI_ORTHO_ATTRIBUTION
            },
            paint: {
                'raster-emissive-strength': 0.3
            }
        }, 'stations-marked-13');
        map.addLayer({
            id: 'plateau-ortho',
            type: 'raster',
            source: {
                type: 'raster',
                tiles: [PLATEAU_ORTHO_URL],
                maxzoom: 19,
                minzoom: 10,
                attribution: PLATEAU_ORTHO_ATTRIBUTION
            },
            paint: {
                'raster-emissive-strength': 0.2,
                'raster-saturation': 0.2
            }
        }, 'stations-marked-13');
        map.addLayer({
            id: 'plateau-model',
            type: 'fill',
            source: {
                type: 'geojson',
                data: MODEL_URL
            },
            paint: {
                'fill-opacity': 0
            }
        }, 'stations-marked-13');
    }

    _tick() {
        const me = this,
            {map, lastRefresh, _tick} = me,
            mapboxMap = map.getMapboxMap(),
            now = map.clock.getTime();

        if (mapboxMap.getLayer('plateau-ortho')) {
            if (Math.floor(now / 60000) !== Math.floor(lastRefresh / 60000)) {
                const {r, g, b} = map.getLightColor(),
                    luminance = .2126 * r + .7152 * g + .0722 * b;

                for (const id of ['gsi-ortho', 'plateau-ortho']) {
                    mapboxMap.setPaintProperty(id, 'raster-brightness-max', luminance);
                }
                me.lastRefresh = now;
            }
            requestAnimationFrame(_tick);
        }
    }

    _updateLayers() {
        const {map, _layers: layers} = this,
            {width, height} = map.container.getBoundingClientRect(),
            features = map.getMapboxMap().queryRenderedFeatures([width / 2, height / 2], {layers: ['plateau-model']}),
            layersToRemove = new Set(layers);

        for (const feature of features) {
            const {code, url} = feature.properties;

            layersToRemove.delete(code);
            if (!layers.has(code)) {
                map.addLayer({
                    id: `tile-3d-${code}`,
                    type: 'tile-3d',
                    data: url,
                    loadOptions: {
                        // Rewrite the tileset's 3D Tiles version to 0.0, which loaders.gl
                        // accepts, before it is parsed. See
                        // https://www.mlit.go.jp/plateau/learning/tpc30/#:~:text=3D%20Tiles%201.1%E3%81%A8deck.gl
                        fetch: async (requestUrl, options) => {
                            const response = await fetch(requestUrl, options);

                            if (requestUrl !== url) {
                                return response;
                            }

                            const json = await response.json();

                            if (json.asset && json.asset.version === '1.1') {
                                json.asset.version = '0.0';
                            }

                            const patched = new Response(JSON.stringify(json), {
                                status: response.status,
                                statusText: response.statusText,
                                headers: response.headers
                            });

                            // A hand-built Response has an empty url, but loaders.gl reads
                            // response.url to tell a tileset (.json) from tile content, so
                            // carry the original url over.
                            Object.defineProperty(patched, 'url', {value: response.url});

                            return patched;
                        },
                        tileset: {
                            throttleRequests: false
                        }
                    },
                    minzoom: 13,
                    opacity: 0.8,
                    onTileLoad: ({content}) => {
                        const cartographicOrigin = content.cartographicOrigin;

                        // Per-building minimum heights (_zmin) live in the batch table in
                        // 3D Tiles 1.0 (.b3dm) and in the glTF EXT_structural_metadata
                        // property table in 3D Tiles 1.1 (.glb). Shift the tile down by
                        // their median so the buildings sit on the ground.
                        let zMins;

                        if (content.batchTableJson) {
                            const zmin = content.batchTableJson._zmin;

                            if (zmin) {
                                const len = content.featureTableJson.BATCH_LENGTH,
                                    view = new DataView(content.batchTableBinary.buffer, zmin.byteOffset, len * 8);

                                zMins = [];
                                for (let i = 0; i < len; i++) {
                                    zMins.push(view.getFloat64(i * 8, true));
                                }
                            }
                            content.featureTableBinary = null;
                            content.featureTableJson = null;
                            content.batchTableBinary = null;
                            content.batchTableJson = null;
                        } else {
                            zMins = getZMins(content.gltf);
                        }

                        if (zMins && zMins.length) {
                            zMins.sort((a, b) => a - b);
                            cartographicOrigin.z -= zMins[Math.floor(zMins.length / 2)];
                        }
                        cartographicOrigin.z -= 36.6641;

                        for (const item of content.gltf.images || []) {
                            const image = item.image,
                                resizeWidth = image.width / 4,
                                resizeHeight = image.height / 4;

                            createImageBitmap(image, {resizeWidth, resizeHeight}).then(resizedImage => {
                                item.image = resizedImage;
                            });
                        }

                        // The data ships materials with metallicFactor 0.5 and
                        // roughnessFactor 0.3, which renders as a glossy half-metal.
                        // Without an image based lighting environment that metallic
                        // component has nothing to reflect, so untextured buildings
                        // look like reflective grey and textured buildings lose half
                        // of their albedo to specular. Turn them into matte dielectrics.
                        for (const material of content.gltf.materials || []) {
                            const pbr = material.pbrMetallicRoughness;

                            if (pbr) {
                                pbr.metallicFactor = 0;
                                pbr.roughnessFactor = 0.8;
                                // Untextured buildings use a flat color that is far
                                // brighter than the linearized photo-texture albedo of
                                // textured buildings, so dim it to rebalance.
                                pbr.baseColorFactor = pbr.baseColorTexture ?
                                    [1, 1, 1, 1] : [0.34, 0.32, 0.3, 1];
                            }
                        }
                    }
                });
                layers.add(code);
            }
        }
        for (const code of layersToRemove) {
            map.removeLayer(`tile-3d-${code}`);
            layers.delete(code);
        }
    }

    onDisabled() {
        const {map, _updateLayers} = this;

        map.getMapboxMap().off('idle', _updateLayers);
    }

    onVisibilityChanged(visible) {
        const {map, _layers} = this,
            mapboxMap = map.getMapboxMap();

        if (mapboxMap.getLayer('plateau-ortho')) {
            const visibility = visible ? 'visible' : 'none';

            for (const id of ['gsi-ortho', 'plateau-ortho', 'plateau-model']) {
                map.setLayerVisibility(id, visibility);
            }
            for (const code of _layers) {
                map.setLayerVisibility(`tile-3d-${code}`, visibility);
            }
        }
    }

}

export default function(options) {
    return new PlateauPlugin(options);
}
