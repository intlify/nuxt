const execa = require('execa')
const path = require('path')
const fs = require('fs').promises

async function readJson(target) {
  const file = await fs.readFile(target, 'utf8')
  return JSON.parse(file)
}

function extractSpecificChangelog(changelog, version) {
  if (!changelog) {
    return null
  }
  const escapedVersion = version.replace(/\./g, '\\.')
  const regex = new RegExp(
    `(#+?\\s\\[?v?${escapedVersion}\\]?[\\s\\S]*?)(#+?\\s\\[?v?\\d+?\\.\\d+?\\.\\d+?\\]?)`,
    'g'
  )
  const matches = regex.exec(changelog)
  return matches ? matches[1] : null
}

async function commitChangelog(current, next) {
  const { stdout } = await execa('npx', [
    'lerna-changelog',
    '--next-version',
    `v${next}`
  ])
  const escapedVersion = next.replace(/\./g, '\\.')
  const regex = new RegExp(
    `(#+?\\s\\[?v?${escapedVersion}\\]?[\\s\\S]*?)(#+?\\s\\[?v?\\d\\.\\d\\.\\d\\]?)`,
    'g'
  )
  const matches = regex.exec(stdout.toString())
  const head = matches ? matches[1] : stdout
  const changelog = await fs.readFile('./CHANGELOG.md', 'utf8')
  return fs.writeFile('./CHANGELOG.md', `${head}\n\n${changelog}`)
}

module.exports = {
  mergeStrategy: { toSameBranch: ['main'] },
  monorepo: {
    mainVersionFile: 'package.json',
    packagesToBump: ['packages/nuxt3'],
    packagesToPublish: ['packages/nuxt3']
  },
  updateChangelog: false,
  installCommand: () => 'pnpm install --silent',
  buildCommand: ({ isYarn, version }) => 'pnpm build:type',
  beforeCommitChanges: async ({ nextVersion, exec, dir }) => {
    const pkg = await readJson(path.resolve(__dirname, './package.json'))
    await commitChangelog(pkg.version, nextVersion)
    await exec('pnpm format:package')
  },
  formatCommitMessage: ({ version, releaseType, mergeStrategy, baseBranch }) =>
    `${releaseType} release v${version}`,
  formatPullRequestTitle: ({ version, releaseType }) =>
    `${releaseType} release v${version}`,
  shouldRelease: () => true,
  releases: {
    extractChangelog: async ({ version, dir }) => {
      const changelogPath = path.resolve(dir, 'CHANGELOG.md')
      try {
        const changelogFile = await fs.readFile(changelogPath, 'utf-8')
        const ret = extractSpecificChangelog(changelogFile, version)
        return ret
      } catch (err) {
        if (err.code === 'ENOENT') {
          return null
        }
        throw err
      }
    }
  }
}
