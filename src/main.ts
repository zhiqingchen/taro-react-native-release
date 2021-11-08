import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fse from 'fs-extra'
import * as github from '@actions/github'
import * as path from 'path'
import QRCode from 'qrcode'

export async function run(): Promise<void> {
  try {
    // 1. get params from workflow
    const env = process.env
    // core.info(`env: ${JSON.stringify(env, undefined, 2)}`)
    const respository = env['GITHUB_REPOSITORY'] as string
    const ref = env['GITHUB_REF']
    const owner = env['GITHUB_REPOSITORY_OWNER'] as string
    const payload = github.context.payload
    // core.info(`payload: ${JSON.stringify(payload, undefined, 2)}`)
    const publicPath = core.getInput('publicpath')
    const tag = (core.getInput('tag') || ref?.replace(/^refs\/(heads|tags)\//, '')) as string
    const prefix = `${publicPath}/${respository}@${tag}/`
    const iosBundlePath = core.getInput('iosbundlepath')
    const iosQrPath = core.getInput('iosqrpath')
    const androidBundlePath = core.getInput('androidbundlepath')
    const androidQrPath = core.getInput('androidqrpath')
    const appName = core.getInput('appname')
    const logo = core.getInput('logo')
    const token = core.getInput('token')
    const git = github.getOctokit(token)

    // 2. ios bundle params
    const bundles = []
    bundles.push({
      platform: 'ios',
      bundlePath: iosBundlePath,
      qrPath: iosQrPath
    })

    // 3. android bundle params
    bundles.push({
      platform: 'android',
      bundlePath: androidBundlePath,
      qrPath: androidQrPath
    })

    // 4. run build bundle
    for (const bundle of bundles) {
      await exec.exec(`yarn build:rn --reset-cache --platform ${bundle.platform}`)
      const bundleUrl = `${prefix}${bundle.bundlePath}`
      core.info(bundleUrl)
      const qrText = `taro://releases?url=${encodeURIComponent(bundleUrl)}&name=${encodeURIComponent(appName)}&logo=${encodeURIComponent(logo)}`
      genQr(qrText, bundle.qrPath)
    }

    // 5. reset tag
    await exec.exec(`git config --global user.name "${payload.pusher.name}"`)
    await exec.exec(`git config --global user.email "${payload.pusher.email}"`)
    await exec.exec(`git tag -d ${tag}`)
    await exec.exec(`git push origin :refs/tags/${tag}`)
    await exec.exec(`git add .`)
    await exec.exec(`git commit -m "update by github actions"`)
    await exec.exec(`git tag ${tag}`)
    await exec.exec(`git push origin ${tag}`)

    // 6. upload release
    git.rest.repos.createRelease({
      body: `|  AndroidBundle  |  iOSBundle  |
| :--: | :--: |
| ![AndroidBundle](${prefix}${androidQrPath}) | ![iOSBundle](${prefix}${androidQrPath}) |`,
      owner,
      repo: respository,
      tag_name: tag
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      core.setFailed(error.message)
    }
  }
}

function genQr(text: string, dist: string): void {
  const QR_CODE_PNG_PATH = `${process.cwd()}/${dist}`
  fse.ensureDirSync(path.dirname(QR_CODE_PNG_PATH))
  QRCode.toFile(QR_CODE_PNG_PATH, text, {type: 'png'}, err => {
    if (err) throw err
    core.info(`generated: ${text} to ${dist}`)
  })
}

run()
