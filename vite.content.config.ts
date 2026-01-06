import { defineConfig } from 'vite'
import { resolve } from 'path'
import { readdirSync } from 'fs'
import { build } from 'vite'

function getContentScriptFiles() {
  const contentDir = resolve(__dirname, 'src/entry/content')
  const files = readdirSync(contentDir)
  return files.filter(file => file.endsWith('.ts')).map(file => ({
    name: file.replace('.ts', ''),
    path: resolve(contentDir, file)
  }))
}

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'src/entry/content/video.ts'), // 默认入口
      output: {
        format: 'iife',
        entryFileNames: 'assets/[name].js',
      },
    },
  },
  plugins: [
    {
      name: 'build-all-content-scripts',
      async closeBundle() {
        console.log('开始构建所有content script文件...')

        const files = getContentScriptFiles()
        console.log('找到的content script文件:', files.map(f => f.name))

        for (const file of files) {
          console.log(`正在构建: ${file.name}.ts -> assets/${file.name}.js`)

          try {
            await build({
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

        console.log('所有content script构建完成!')
      }
    }
  ]
})