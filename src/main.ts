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
    core.info(`env: ${JSON.stringify(env, undefined, 2)}`)
    const respository = env['GITHUB_REPOSITORY'] as string
    const owner = env['GITHUB_REPOSITORY_OWNER'] as string
    const payload = github.context.payload
    core.info(`payload: ${JSON.stringify(payload, undefined, 2)}`)
    const cdnhost = core.getInput('cdnhost')
    const cdnpath = core.getInput('cdnpath')
    const refname = (core.getInput('refname') || env['GITHUB_REF_NAME']) as string
    // like '/gh/zhiqingchen/Taro-Mortgage-Calculator@feat-remote-bundle/'
    const publicPathPerfix = `${cdnpath}/${respository}@${refname}/`
    const prefix = `${cdnhost}${publicPathPerfix}`
    const iosBundlePath = core.getInput('iosbundleoutput')
    const iosQrPath = core.getInput('iosqrpath')
    const iosAssetsDest = core.getInput('iosassetsdest')
    const androidBundlePath = core.getInput('androidbundleoutput')
    const androidQrPath = core.getInput('androidqrpath')
    const androidAssetsDest = core.getInput('androidassetsdest')
    const appName = core.getInput('appname')
    const logo = core.getInput('logo')
    const releaseprefix = core.getInput('releaseprefix')
    const token = core.getInput('token')
    const git = github.getOctokit(token)

    const refType = env['GITHUB_REF_TYPE']

    // 2. ios bundle params
    const bundles = []
    bundles.push({
      platform: 'ios',
      bundlePath: iosBundlePath,
      qrPath: iosQrPath,
      assetsDest: iosAssetsDest,
      publicPath: `${publicPathPerfix}${iosAssetsDest}`
    })

    // 3. android bundle params
    bundles.push({
      platform: 'android',
      bundlePath: androidBundlePath,
      qrPath: androidQrPath,
      iosAssetsDest: androidAssetsDest,
      publicPath: `${publicPathPerfix}${androidAssetsDest}`
    })

    // 4. run build bundle
    for (const bundle of bundles) {
      const {platform, bundlePath, qrPath, assetsDest, publicPath} = bundle
      await exec.exec(`yarn build:rn --reset-cache --platform ${platform} --bundle-output ${bundlePath} --assets-dest ${assetsDest} --publicPath ${publicPath}`)
      await exec.exec(`mv ${publicPath} ${assetsDest}`)
      const bundleUrl = `${prefix}${bundlePath}`
      core.info(bundleUrl)
      const qrText = `taro://releases?platform=${platform}&url=${encodeURIComponent(bundleUrl)}&name=${encodeURIComponent(appName)}&logo=${encodeURIComponent(logo)}`
      core.info(qrText)
      genQr(qrText, qrPath)
    }

    // 5. git commit
    await exec.exec(`git config --global user.name "${payload.pusher?.name || payload.sender?.login || 'unknown Author'}"`)
    await exec.exec(`git config --global user.email "${payload.pusher?.email || 'unknown@unknown.unknown'}"`)
    await exec.exec(`git status`)
    await exec.exec(`git add .`)
    await exec.exec(`git commit -m "release: commit by github actions"`)

    if (refType === 'tag') {
      // 6. reset tag
      await exec.exec(`git tag -d ${refname}`)
      await exec.exec(`git push origin :refs/tags/${refname}`)
      await exec.exec(`git tag ${refname}`)
      await exec.exec(`git push origin ${refname}`)

      // 7. upload release
      git.rest.repos.createRelease({
        body: `${releaseprefix}

||  Android  |  iOS  |
| :--: | :--: | :--: |
| QR code | ![AndroidBundle](${prefix}${androidQrPath}) | ![iOSBundle](${prefix}${iosQrPath}) |
| Bundle file url | ${prefix}${androidBundlePath} | ${prefix}${iosBundlePath} |

  `,
        owner,
        repo: respository.replace(`${owner}/`, ''),
        tag_name: refname
      })
    } else if (refType === 'branch') {
      // 6. push branch
      await exec.exec(`git push origin`)
      core.info(`open ${prefix}${androidQrPath} , and use the Taro Playground Android APP to san for prview android release.`)
      core.info(`open ${prefix}${iosQrPath} , and use the Taro Playground iOS APP to san for prview ios release.`)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    core.setFailed(error)
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
