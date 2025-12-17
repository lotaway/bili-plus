const { watch, series } = require('gulp')
const { exec } = require('child_process')

function build(cb) {
  console.log('🚀 检测到文件变化，开始构建浏览器扩展...')
  exec('yarn build', (error, stdout, stderr) => {
    console.log(stdout)
    if (error) {
      console.error('❌ 构建错误详情:')
      return cb(error)
    }
    if (stderr) {
      console.error(stderr)
    }
    console.log('✅ 构建完成！请在浏览器中重新加载扩展以应用更改')
    console.log('💡 提示: 在Chrome扩展管理页面点击扩展的刷新按钮')
    cb()
  })
}

function watchFiles() {
  console.log('👀 开始监听文件变化...')
  console.log('📁 监听目录: src/, public/')
  console.log('🔄 文件变化时将自动构建扩展')

  const watchSrcChanges = () => watch('src/**/*', { ignoreInitial: false }, series(build))
  const watchPublicChanges = () => watch('public/**/*', { ignoreInitial: true }, series(build))

  watchSrcChanges()
  watchPublicChanges()
}

function buildOnce(cb) {
  console.log('🔨 执行一次性构建...')
  exec('yarn build', (error, stdout, stderr) => {
    console.log(stdout)
    if (error) {
      console.error('❌ 构建错误详情:')
      return cb(error)
    }
    if (stderr) {
      console.error(stderr)
    }
    console.log('✅ 构建完成！')
    cb()
  })
}

exports.default = watchFiles
exports.build = buildOnce
exports.watch = watchFiles
