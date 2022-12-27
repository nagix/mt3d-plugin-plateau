# PLATEAU plugin for Mini Tokyo 3D

PLATEAU plugin displays realistic and detailed 3D city models on the the [Mini Tokyo 3D](https://minitokyo3d.com) map.

![Screenshot](https://nagix.github.io/mt3d-plugin-plateau/screenshot1.jpg)

PLATEAU plugin is used in [Mini Tokyo 3D Live Demo](https://minitokyo3d.com). Note that this plug-in is disabled by default, so enable it first by selecting PLATEAU from the Layer panel.

## How to Use

First, load the Mini Tokyo 3D and this plugin within the `<head>` element of the HTML file.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/mini-tokyo-3d@latest/dist/mini-tokyo-3d.min.css" />
<script src="https://cdn.jsdelivr.net/npm/mini-tokyo-3d@latest/dist/mini-tokyo-3d.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mt3d-plugin-plateau@latest/dist/mt3d-plugin-plateau.min.js"></script>
```

Then, create a MiniTokyo3D instance specifying the `plugins` property, which is the array containing the plugin instance returned by `mt3dPlateau()`.

```html
<div id="map" style="width: 400px; height: 400px;"></div>
<script>
    const map = new mt3d.MiniTokyo3D({
        container: 'map',
        plugins: [mt3dPlateau()]
    });
</script>
```

## About Data

The data for this visualization are sourced from [PLATEAU-3DTiles](https://github.com/Project-PLATEAU/plateau-streaming-tutorial/blob/main/3d-tiles/plateau-3dtiles-streaming.md) and [PLATEAU-Ortho](https://github.com/Project-PLATEAU/plateau-streaming-tutorial/blob/main/ortho/plateau-ortho-streaming.md) from the Project PLATEAU.

## How to Build

The latest version of Node.js is required. Move to the root directory of the plugin, run the following commands, then the plugin scripts will be generated in the `dist` directory.
```bash
npm install
npm run build
```

## License

PLATEAU plugin for Mini Tokyo 3D is available under the [MIT license](https://opensource.org/licenses/MIT).
