/* Build for static publishing (GitHub Pages). Follows the pattern of the
   web-components repo's dev/rollup.config.js: @web/rollup-plugin-html bundles the
   page's module scripts (nodeResolve + terser) and copies the linked stylesheet,
   with postcss-import inlining lumo.css's @import chain into one file. */
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { rollupPluginHTML as html } from '@web/rollup-plugin-html';
import postcss from 'postcss';
import atImport from 'postcss-import';

export default {
  input: 'index.html',
  output: { dir: 'dist' },
  plugins: [
    nodeResolve(),
    html({
      transformAsset: [
        async (content, filePath) => {
          if (filePath.endsWith('.css')) {
            const result = await postcss()
              .use(atImport())
              .process(content, { from: filePath });
            return result.css;
          }
        },
      ],
    }),
    terser(),
  ],
};
