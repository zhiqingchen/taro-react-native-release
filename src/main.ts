import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import * as io from '@actions/io'
import * as path from 'path'
import QRCode from 'qrcode'

export async function run(): Promise<void> {
  try {
    // 0. get params from workflow
    const env = process.env
    let workspace = env['GITHUB_WORKSPACE']
    core.info(`env: ${JSON.stringify(env)}`)
    const respository = env['GITHUB_REPOSITORY']
    const ref = env['GITHUB_REF']
    const payload = JSON.stringify(github.context.payload, undefined, 2)
    core.info(`payload: ${payload}`)
    const publicPath = core.getInput('PUBLICPATH') || 'https://cdn.jsdelivr.net/gh'
    const tag = core.getInput('TAG') || ref?.replace(/^refs\/(heads|tags)\//, '')
    const prefix = `${publicPath}/${respository}@${tag}/`
    const iosBundlePath = core.getInput('IOSBUNDLEPATH') || 'ios/main.js'
    const androidBundlePath = core.getInput('ANDROIDBUNDLEPATH') || 'android/main.js'
    const appName = core.getInput('APPNAME') || ''
    const logo = core.getInput('LOGO') || ''

    if (!workspace) {
      throw new Error('GITHUB_WORKSPACE not defined')
    }
    workspace = path.resolve(workspace)
    core.debug(`GITHUB_WORKSPACE = '${workspace}'`)

    const lsPath = await io.which('ls', true)
    await execDebug(lsPath)

    // 1. install node modules
    let yarnPath = 'yarn'
    try {
      yarnPath = await io.which('yarn', true)
    } catch (error) {
      core.debug('Please install yarn in global.')
    }
    await execDebug(yarnPath)

    // 2. build ios bundle
    const bundles = []
    bundles.push({
      platform: 'ios',
      bundlePath: iosBundlePath,
      qrPath: 'qrcode/ios.png'
    })

    // 3. build android bundle
    bundles.push({
      platform: 'android',
      bundlePath: androidBundlePath,
      qrPath: 'qrcode/android.png'
    })

    // 4. run
    for (const bundle of bundles) {
      await execDebug(`yarn build:rn --reset-cache --platform ${bundle.platform}`)
      const bundleUrl = `${prefix}/${bundle.bundlePath}`
      core.info(bundleUrl)
      const qrText = `taro://releases?url=${encodeURIComponent(bundleUrl)}&name=${encodeURIComponent(appName)}&logo=${encodeURIComponent(logo)}`
      genQr(qrText, bundle.qrPath)
    }

    // 5. tag
    await execDebug(`git tag -d ${tag}`)
    await execDebug(`git push origin :refs/tags/${tag}`)
    await execDebug(`git add .`)
    await execDebug(`git commit -m "update by github actions"`)
    await execDebug(`git tag ${tag}`)
    await execDebug(`git push origin ${tag}`)

    // 6.release
  } catch (error) {
    if (error instanceof SyntaxError) {
      core.setFailed(error.message)
    }
  }
}

function genQr(text: string, dist: string): void {
  const QR_CODE_PNG_PATH = `${process.cwd()}/${dist}`
  QRCode.toFile(QR_CODE_PNG_PATH, text, {type: 'png'}, err => {
    if (err) throw err
    core.info(`generated: ${text} to ${path}`)
  })
}

async function execDebug(command: string, args: string[] = []): Promise<void> {
  const stdout: string[] = []
  const stderr: string[] = []

  const options: exec.ExecOptions = {
    listeners: {
      stdout: (data: Buffer) => {
        stdout.push(data.toString())
      },
      stderr: (data: Buffer) => {
        stderr.push(data.toString())
      }
    }
  }
  core.startGroup(`execute ${command}`)
  await exec.exec(command, args, options)

  core.debug(stdout.join(''))
  core.debug(stderr.join(''))
  core.endGroup()
}

run()
