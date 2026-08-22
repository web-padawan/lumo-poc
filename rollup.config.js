import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { rollupPluginHTML as html } from '@web/rollup-plugin-html';
import postcss from 'postcss';
import atImport from 'postcss-import';
import postcssUrl from 'postcss-url';

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
              // Inline url() assets (the Aura font); @import inlining breaks relative urls otherwise
              .use(postcssUrl({ url: 'inline' }))
              .process(content, { from: filePath });
            return result.css;
          }
        },
      ],
    }),
    terser(),
  ],
};
