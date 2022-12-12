const axios = require('axios');
const fs = require('fs');
const path = require('path');


const config = {
  buildDirectory: "./build",
  studiorack: {
    registryUrl: "https://studiorack.github.io/studiorack-registry/"
  },
  github: {
    url: "https://github.com"
  }
}

async function main() {

  console.log("Starting studiorack registry adapter")

  // Init registry metadara
  let registry = {
    name: "Studiorack Registry",
    url: config.studiorack.registryUrl,
    schemaVersion: "1.0.0",
    packages: {}
  }

  // Collecting packages
  console.log("Collecting studiorack effects")
  let effectsResponse = await axios.get(config.studiorack.registryUrl + "effects.json")
  let packages = convertToPackages(effectsResponse.data, "effect")

  console.log("Collecting studiorack instruments")
  let instrumentsResponse = await axios.get(config.studiorack.registryUrl + "instruments.json")
  packages = packages.concat(convertToPackages(instrumentsResponse.data, "instrument"))

  for (let pack of packages) {
    registry.packages[pack.slug] = pack;
  }

  // Write registry content to build directory
  console.log("Creating studiorack registry files...");
  try {
    if (!fs.existsSync(config.buildDirectory)) {
      fs.mkdirSync(config.buildDirectory, { recursive: true });
    }
    fs.writeFileSync(path.join(config.buildDirectory, "registry.min.json"), JSON.stringify(registry))
    fs.writeFileSync(path.join(config.buildDirectory, "registry.json"), JSON.stringify(registry, null, 2))

    console.log("Registry files saved")
  }
  catch (e) {
    console.error("Error during registry export", e);
  }

}


function convertToPackages(studiorackRegistry, pluginType) {

  let packages = [];

  for (let [SRPackageKey, SRPackage] of Object.entries(studiorackRegistry.objects)) {

    let package = {
      slug: SRPackageKey,
      latestVersion: SRPackage.version,
      versions: {}
    }

    for (let [SRVersionKey, SRVersion] of Object.entries(SRPackage.versions)) {

      let version = {
        name: SRVersion.name,
        creator: SRVersion.author,
        license: SRPackage.license,
        description: SRVersion.description,
        pageUrl: SRVersion.homepage,
        version: SRVersionKey,
        type: pluginType,
        screenshotUrl: null,
        tags: SRVersion.tags,
        bundles: [],
      }

      if(SRVersion.files.image) {
        version.screenshotUrl = SRDownloadUrl(SRVersion.repo, 
          SRVersion.version, SRVersion.files.image.name)
      }

      version.bundles = createBundles(SRVersion)
      package.versions[SRVersion.version] = version;
    }

    packages.push(package)
  }

  return packages;
}

function createBundles(SRVersion) {

  let bundles = [];

  if (SRVersion.files.win) {
    let bundle = {
      name: "Windows Realease",
      targets: ["win32", "win64"],
      format: "unknown",
      downloadUrl: SRDownloadUrl(SRVersion.repo, SRVersion.version, SRVersion.files.win.name),
      fileSize: SRVersion.files.win.size
    }
    bundles.push(bundle);
  }
  if (SRVersion.files.mac) {
    let bundle = {
      name: "MacOS Realease",
      targets: ["osx"],
      format: "unknown",
      downloadUrl: SRDownloadUrl(SRVersion.repo, SRVersion.version, SRVersion.files.mac.name),
      fileSize: SRVersion.files.mac.size
    }
    bundles.push(bundle);
  }
  if (SRVersion.files.linux) {
    let bundle = {
      name: "Linux Realease",
      targets: ["linux32", "linux64"],
      format: "unknown",
      downloadUrl: SRDownloadUrl(SRVersion.repo, SRVersion.version, SRVersion.files.linux.name),
      fileSize: SRVersion.files.linux.size
    }
    bundles.push(bundle);
  }

  return bundles;
}

function SRDownloadUrl(repo, version, name) {
  return config.github.url + "/" + repo + "/releases/download/" + version + "/" + name;
}

main();

