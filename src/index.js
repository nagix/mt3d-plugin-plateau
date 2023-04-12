import plateauSVG from './plateau.svg';

const models = [
    '13101_chiyoda-ku/low_resolution',
    '13102_chuo-ku/low_resolution',
    '13103_minato-ku/low_resolution',
    '13104_shinjuku-ku/low_resolution',
    '13109_shinagawa-ku/low_resolution',
    '13113_shibuya-ku/low_resolution',
    '13116_toshima-ku/low_resolution'
];

class PlateauPlugin {

    constructor(options) {
        const me = this;

        me.id = 'plateau';
        me.name = {
            en: 'PLATEAU',
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
    }

    onAdd(map) {
        const me = this;

        me.map = map;
    }

    onRemove(map) {
        map.removeLayer('plateau-ortho');
        for (const model of models) {
            map.removeLayer(`tile-3d-${model}`);
        }
        map.map.removeSource('plateau-ortho');
    }

    onEnabled() {
        const me = this,
            {map} = me;

        map.setLayerVisibility('building-3d', 'none');

        if (map.map.getLayer('plateau-ortho')) {
            return;
        }

        map.map.addSource('plateau-ortho', {
            type: 'raster',
            tiles: [
                'https://gic-plateau.s3.ap-northeast-1.amazonaws.com/2020/ortho/tiles/{z}/{x}/{y}.png'
            ],
            maxzoom: 19,
            minzoom: 10,
            attribution: '<a href="https://www.mlit.go.jp/plateau/">国土交通省Project PLATEAU</a>'
        });
        map.addLayer({
            id: 'plateau-ortho',
            type: 'raster',
            source: 'plateau-ortho'
        }, 'stations-marked-13');

        for (const model of models) {
            map.addLayer({
                id: `tile-3d-${model}`,
                type: 'tile-3d',
                data: `https://plateau.geospatial.jp/main/data/3d-tiles/bldg/13100_tokyo/${model}/tileset.json`,
                opacity: 0.8,
                onTileLoad: d => {
                    const {content} = d,
                        buffer = content.batchTableBinary.buffer,
                        key = content.batchTableJson,
                        len = key._gml_id.length,
                        zMinView = new DataView(buffer, key._zmin.byteOffset, len * 8),
                        zMins = [];

                    for (let i = 0; i < len; i++) {
                        zMins.push(zMinView.getFloat64(i * 8, true));
                    }
                    zMins.sort((a, b) => a - b);
                    content.cartographicOrigin.z -= 36.6641 + zMins[Math.floor(len / 2)];
                }
            });
        }

        me._tick();
    }

    _tick() {
        const me = this,
            {map, lastRefresh, _tick} = me,
            now = map.clock.getTime();

        if (map.map.getLayer('plateau-ortho')) {
            if (Math.floor(now / 60000) !== Math.floor(lastRefresh / 60000)) {
                const {r, g, b} = map.getLightColor(),
                    luminance = .2126 * r + .7152 * g + .0722 * b;

                map.map.setPaintProperty('plateau-ortho', 'raster-brightness-max', luminance);
                me.lastRefresh = now;
            }
            requestAnimationFrame(_tick);
        }
    }

    onDisabled() {
        this.map.setLayerVisibility('building-3d', 'visible');
    }

    onVisibilityChanged(visible) {
        const me = this;

        me.map.setLayerVisibility('plateau-ortho', visible ? 'visible' : 'none');
        for (const model of models) {
            me.map.setLayerVisibility(`tile-3d-${model}`, visible ? 'visible' : 'none');
        }
    }

}

export default function(options) {
    return new PlateauPlugin(options);
}
