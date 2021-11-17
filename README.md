# Github action for bundle taro react native project

Use this action to package your [Taro React Native](https://docs.taro.zone/) project and generate bundles for Android and iOS. Others can use [Taro Playground APP](https://github.com/wuba/taro-playground) to load the bundle for project preview.

Make it easier to share your ideas.

## Attention

0. Your React Native version and dependencies must be compatible with the [Taro Playground APP](https://github.com/wuba/taro-playground/blob/main/package.json). 
1. Taro version needs to be greater than or equal to 3.3.13.
2. add `!release/**` to the `.gitignore` file.
## Workflow

1. Execute `yarn build:rn` to build the bundle.
2. Generate a [Taro Playground APP](https://github.com/wuba/taro-playground) protocol, including platform, name, logo and bundle url.
3. Export the protocol to a file with a QR code.
4. Commit the changes.
5. If `GITHUB_REF_NAME` is tag
   1. Delete the original tag and re-tag it.
   2. Generate a release, including the QR code and other information.
6. If `GITHUB_REF_NAME` is branch
   1. Push the changes to the branch.

## Usage

### Basic Config

```yml
on:
  push:
    tags: [ v* ]
  workflow_dispatch:

jobs:
  taro_release_job:
    runs-on: ubuntu-latest
    name: Taro Bundle Release
    steps:
      - name: Release Taro React Native bundle
        uses: zhiqingchen/taro-react-native-release@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          appname: Taro-Mortgage-calculator
          logo: https://pic3.58cdn.com.cn/nowater/fangfe/n_v25b1523466b894881b9bdeda7618a8af2.png
```

### Options

see [action.yml](./action.yml) for details.

### Examples

0. [wuba/Taro-Mortgage-Calculator](https://github.com/wuba/Taro-Mortgage-Calculator/tree/master/.github/workflows/main.yml)
1. [rick-and-morty-wiki](https://github.com/rick-and-morty-wiki/rick-and-morty-wiki/blob/master/.github/workflows/main.yml)

## Acknowledgements

We use [jsDelivr](https://www.jsdelivr.com/?docs=gh) as the cdn service.
## LICENSE

The MIT License (MIT)
