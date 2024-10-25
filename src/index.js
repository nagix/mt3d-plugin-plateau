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

class PlateauPlugin {

    constructor(options) {
        const me = this;

        me.id = 'plateau';
        me.name = {
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
        const {map, _tick, _updateLayers} = this;

        map.setLayerVisibility('building-3d', 'none');

        if (map.getMapboxMap().getLayer('plateau-ortho')) {
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

        _tick();

        map.on('move', _updateLayers);
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
                        tileset: {
                            throttleRequests: false,
                        }
                    },
                    minzoom: 13,
                    opacity: 0.8,
                    onTileLoad: ({content}) => {
                        const zmin = content.batchTableJson._zmin,
                            cartographicOrigin = content.cartographicOrigin;

                        if (zmin) {
                            const buffer = content.batchTableBinary.buffer,
                                len = content.featureTableJson.BATCH_LENGTH,
                                zMinView = new DataView(buffer, zmin.byteOffset, len * 8),
                                zMins = [];

                            for (let i = 0; i < len; i++) {
                                zMins.push(zMinView.getFloat64(i * 8, true));
                            }
                            zMins.sort((a, b) => a - b);
                            cartographicOrigin.z -= zMins[Math.floor(len / 2)];
                        }
                        cartographicOrigin.z -= 36.6641;
                        content.featureTableBinary = null;
                        content.featureTableJson = null;
                        content.batchTableBinary = null;
                        content.batchTableJson = null;

                        for (const item of content.gltf.images || []) {
                            const image = item.image,
                                resizeWidth = image.width / 4,
                                resizeHeight = image.height / 4;

                            createImageBitmap(image, {resizeWidth, resizeHeight}).then(resizedImage => {
                                item.image = resizedImage;
                            });
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

        map.setLayerVisibility('building-3d', 'visible');
        map.off('move', _updateLayers);
    }

    onVisibilityChanged(visible) {
        const {map, _layers, _updateLayers} = this,
            mapboxMap = map.getMapboxMap();

        if (mapboxMap.getLayer('plateau-ortho')) {
            const visibility = visible ? 'visible' : 'none';

            for (const id of ['gsi-ortho', 'plateau-ortho', 'plateau-model']) {
                map.setLayerVisibility(id, visibility);
            }
            for (const code of _layers) {
                map.setLayerVisibility(`tile-3d-${code}`, visibility);
            }
            mapboxMap.once('idle', _updateLayers);
        }
    }

}

export default function(options) {
    return new PlateauPlugin(options);
}
