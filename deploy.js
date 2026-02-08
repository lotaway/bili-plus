const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')
const { resolveConfig } = require('vite')

async function main() {
    const packageJson = require('./package.json')
    const name = packageJson.name
    const home = os.homedir()
    const target = path.join(home, name)

    // Get vite config to determine outDir
    const viteConfig = await resolveConfig({ configFile: path.join(__dirname, 'vite.config.ts') }, 'build')
    const outDir = viteConfig.build.outDir || 'dist'
    const distPath = path.join(__dirname, outDir)

    // Check if dist exists, if not, run build
    if (!fs.existsSync(distPath)) {
        console.log('dist directory not found. Running build...')
        try {
            execSync('yarn build', { stdio: 'inherit', cwd: __dirname })
        } catch (error) {
            console.error('Error during build:', error.message)
            process.exit(1)
        }
    }

    // Create target directory if it doesn't exist
    if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true })
    }

    // Copy contents of dist to target based on platform
    try {
        if (process.platform === 'win32') {
            execSync(`xcopy "${distPath}\\*" "${target}\\" /E /I /Y`, { stdio: 'inherit' })
        } else {
            execSync(`cp -r "${distPath}"/* "${target}"/`, { stdio: 'inherit' })
        }
    } catch (error) {
        console.error('Error during copy:', error.message)
        process.exit(1)
    }

    // Remove dist directory after successful copy
    try {
        if (process.platform === 'win32') {
            execSync(`rmdir /s /q "${distPath}"`, { stdio: 'inherit' })
        } else {
            execSync(`rm -rf "${distPath}"`, { stdio: 'inherit' })
        }
    } catch (error) {
        console.error('Error during removal:', error.message)
        process.exit(1)
    }

    console.log(`Deployed to: ${target}`)
}

main().catch(console.error)
