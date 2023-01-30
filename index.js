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

  // Init registry metadata
  let registry = {
    name: "Studiorack Registry",
    url: config.studiorack.registryUrl,
    schemaVersion: "1.0.0",
    packages: {}
  }

  // Collecting packages
  console.log("Collecting studiorack plugins...")
  let response = await axios.get(config.studiorack.registryUrl + "index.json")
  let packages = convertToPackages(response.data)

  packages.sort((a, b) => a.slug.localeCompare(b.slug))

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


function convertToPackages(studiorackRegistry) {

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
        type: "unknown",
        screenshotUrl: null,
        tags: SRVersion.tags,
        bundles: [],
      }

      if(SRVersion.files.image) {
        version.screenshotUrl = SRDownloadUrl(SRVersion.repo, 
          SRVersion.release, SRVersion.files.image.name)
      }

      version.bundles = createBundles(SRVersion)
      version.type = getTypeFromTags(SRVersion.tags)
      
      if(isOwlPlugCompatible(version)) {
        package.versions[SRVersion.version] = version;
      }
      
    }

    // If package have at least one version defined, it's added to the list.
    if (Object.keys(package.versions).length > 0) {
      packages.push(package)
    } else {
      console.log(`Skipping package ${package.slug} because no compatible version has been found.`)
    }
    
  }

  return packages;
}

function createBundles(SRVersion) {

  let bundles = [];

  if (SRVersion.files.win) {
    let bundle = {
      name: "Windows Release",
      targets: ["win32", "win64"],
      format: "unknown",
      downloadUrl: SRDownloadUrl(SRVersion.repo, SRVersion.release, SRVersion.files.win.name),
      fileSize: SRVersion.files.win.size
    }
    bundles.push(bundle);
  }
  if (SRVersion.files.mac) {
    let bundle = {
      name: "MacOS Release",
      targets: ["osx"],
      format: "unknown",
      downloadUrl: SRDownloadUrl(SRVersion.repo, SRVersion.release, SRVersion.files.mac.name),
      fileSize: SRVersion.files.mac.size
    }
    bundles.push(bundle);
  }
  if (SRVersion.files.linux) {
    let bundle = {
      name: "Linux Release",
      targets: ["linux32", "linux64"],
      format: "unknown",
      downloadUrl: SRDownloadUrl(SRVersion.repo, SRVersion.release, SRVersion.files.linux.name),
      fileSize: SRVersion.files.linux.size
    }
    bundles.push(bundle);
  }

  return bundles;
}

function SRDownloadUrl(repo, release, name) {
  return config.github.url + "/" + repo + "/releases/download/" + release + "/" + name;
}

function getTypeFromTags(tags) {

  if (tags.some(item => item.toLowerCase() === "instrument")) {
    return "instrument"
  }

  if (tags.some(item => item.toLowerCase() === "effect" 
      || item.toLowerCase() === "fx")) {
    return "effect"
  }
  
  return "unknown"
}

function isOwlPlugCompatible(version) {

  // Exclude SFZ tagged version because OwlPlug can't track them after installation
  return !(version.tags.some(item => item.toLowerCase() === "sfz"));

}

main();
