import fs from 'node:fs';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import image from '@rollup/plugin-image';

const pkg = JSON.parse(fs.readFileSync('package.json'));

// Unminified development build with source maps, emitted to the git-ignored dev/
// folder. The plugin can't run on its own, so load it into Mini Tokyo 3D's dev
// page via the MT3D_PLUGIN_PLATEAU environment variable, which serves this file
// live.
export default [{
    input: 'src/index.js',
    output: {
        name: 'mt3dPlateau',
        file: `dev/${pkg.name}.js`,
        format: 'umd',
        indent: false,
        sourcemap: true
    },
    external: ['mini-tokyo-3d'],
    plugins: [
        resolve({
            browser: true,
            preferBuiltins: false
        }),
        commonjs(),
        image()
    ]
}];
