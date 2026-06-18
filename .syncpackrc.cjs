/** @type {import("syncpack").RcFile} */
const config = {
  dependencyTypes: ['dev', 'prod'],
  source: [
    'package.json',
    'packages/*/package.json',
    'apps/*/package.json',
    'internal/*/package.json',
  ],
  sortFirst: [
    'name',
    'version',
    'description',
    'homepage',
    'packageManager',
    'license',
    'private',
    'author',
    'keywords',
    'sideEffects',
    'type',
    'main',
    'module',
    'types',
    'exports',
    'files',
    'repository',
    'engines',
    'scripts',
    'dependencies',
    'peerDependencies',
    'devDependencies',
  ],
  sortAz: [
    'contributors',
    'dependencies',
    'devDependencies',
    'keywords',
    'peerDependencies',
    'resolutions',
  ],
};

module.exports = config;
