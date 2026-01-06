import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readdirSync } from 'fs'
import { build } from 'vite'

function scanScriptFiles(dir: string) {
  const files = readdirSync(resolve(__dirname, dir))
  return files
    .filter(file => file.endsWith('.ts'))
    .map(file => ({
      name: file.replace('.ts', ''),
      path: resolve(__dirname, dir, file)
    }))
}

let cachedContentFiles: Array<{ name: string; path: string }> | null = null
let cachedInjectFiles: Array<{ name: string; path: string }> | null = null
let isBuildingScripts = false

function getContentScriptFiles() {
  if (!cachedContentFiles) {
    cachedContentFiles = scanScriptFiles('src/entry/content')
  }
  return cachedContentFiles
}

function getInjectScriptFiles() {
  if (!cachedInjectFiles) {
    cachedInjectFiles = scanScriptFiles('src/entry/inject')
  }
  return cachedInjectFiles
}

function buildScriptsPlugin(type: 'content' | 'inject') {
  const pluginName = `build-${type}-scripts`
  const getFiles = type === 'content' ? getContentScriptFiles : getInjectScriptFiles
  const scriptType = type === 'content' ? 'content script' : 'inject script'

  return {
    name: pluginName,
    async closeBundle() {
      console.log(`开始构建所有${scriptType}文件...`)

      const files = getFiles()
      console.log(`找到的${scriptType}文件:`, files.map(f => f.name))

      for (const file of files) {
        console.log(`正在构建: ${file.name}.ts -> assets/${file.name}.js`)

        try {
          await build({
            configFile: false,
            mode: 'production',
            build: {
              emptyOutDir: false,
              outDir: 'dist',
              rollupOptions: {
                input: file.path,
                output: {
                  format: 'iife',
                  entryFileNames: `assets/${file.name}.js`,
                  inlineDynamicImports: true,
                },
              },
            },
          })

          console.log(`✓ 成功构建: ${file.name}.js`)
        } catch (error) {
          console.error(`✗ 构建失败: ${file.name}.ts`, error)
        }
      }

      console.log(`所有${scriptType}构建完成!`)
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    buildScriptsPlugin('content'),
    buildScriptsPlugin('inject'),
  ],
  build: {
    rollupOptions: {
      input: {
        'popup.html': resolve(__dirname, 'src/entry/popup/index.html'),
        'sidepanel.html': resolve(__dirname, 'src/entry/sidepanel/index.html'),
        background: resolve(__dirname, 'src/entry/background/index.ts'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: true,
  },
})