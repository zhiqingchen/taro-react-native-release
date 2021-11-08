import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fse from 'fs-extra'
import * as github from '@actions/github'
import * as io from '@actions/io'
import * as path from 'path'
import QRCode from 'qrcode'

export async function run(): Promise<void> {
  try {
    // 0. get params from workflow
    const env = process.env
    // core.info(`env: ${JSON.stringify(env, undefined, 2)}`)
    const respository = env['GITHUB_REPOSITORY'] as string
    const ref = env['GITHUB_REF']
    const owner = env['GITHUB_REPOSITORY_OWNER'] as string
    const payload = github.context.payload
    // core.info(`payload: ${payload}`)
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
      qrPath: iosQrPath
    })

    // 3. build android bundle
    bundles.push({
      platform: 'android',
      bundlePath: androidBundlePath,
      qrPath: androidQrPath
    })

    // 4. run
    for (const bundle of bundles) {
      await execDebug(`yarn build:rn --reset-cache --platform ${bundle.platform}`)
      const bundleUrl = `${prefix}${bundle.bundlePath}`
      core.info(bundleUrl)
      const qrText = `taro://releases?url=${encodeURIComponent(bundleUrl)}&name=${encodeURIComponent(appName)}&logo=${encodeURIComponent(logo)}`
      genQr(qrText, bundle.qrPath)
    }

    // 5. tag
    await execDebug(`git config --global user.name "${payload.pusher.name}"`)
    await execDebug(`git config --global user.email "${payload.pusher.email}"`)
    await execDebug(`git tag -d ${tag}`)
    await execDebug(`git push origin :refs/tags/${tag}`)
    await execDebug(`git add .`)
    await execDebug(`git commit -m "update by github actions"`)
    await execDebug(`git tag ${tag}`)
    await execDebug(`git push origin ${tag}`)

    // 6.release
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
  if (stderr.length) {
    throw new Error(stderr.join(''))
  }
  core.endGroup()
}

run()
