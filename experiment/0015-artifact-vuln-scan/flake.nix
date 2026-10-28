{
  description = "Experiment 0015: can existing scanners find the vulnerable dependencies of funcd function artifacts in a registry";

  # funcd at e5f7c7b5 (v0.33.0 and the docs sweep): funcdctl is built from it, and its nixpkgs pins Go, Node, uv and
  # every scanner. zot, the registry with a built-in scanner, is not in nixpkgs, so its release binary is pinned by the
  # release's own checksums.
  inputs = {
    funcd.url = "github:pyvvo/funcd/e5f7c7b5b8e23b87d35693f11acc41935ee29082";
    nixpkgs.follows = "funcd/nixpkgs";
  };

  outputs = { nixpkgs, funcd, ... }:
    let
      systems = [ "aarch64-darwin" "x86_64-darwin" "x86_64-linux" "aarch64-linux" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
      zotVersion = "v2.1.22";
      zotAssets = {
        aarch64-darwin = {
          name = "zot-darwin-arm64";
          sha256 = "24abc467dcd02247eae1ed66022f8e712cafadae26edbad1e9463b8aa0791bbf";
        };
        x86_64-darwin = {
          name = "zot-darwin-amd64";
          sha256 = "01964096c4bbac940794ff60bd8731ebc06a7d8cfb7a1a44bb86cd4b5c45f855";
        };
        x86_64-linux = {
          name = "zot-linux-amd64";
          sha256 = "33b9b5bfe05d6788c076de951a01920477dbd6395c330146e23cc2340073e52e";
        };
        aarch64-linux = {
          name = "zot-linux-arm64";
          sha256 = "abc9bab13c144a4ee2f9067a6bbbe70ca1c018c49dbf521db28975514ea705da";
        };
      };
      zotFor = pkgs:
        let
          asset = zotAssets.${pkgs.stdenv.hostPlatform.system};
          src = pkgs.fetchurl {
            url = "https://github.com/project-zot/zot/releases/download/${zotVersion}/${asset.name}";
            inherit (asset) sha256;
          };
        in
        pkgs.runCommand "zot-${zotVersion}" { } ''
          install -Dm755 ${src} $out/bin/zot
        '';
      tools = pkgs: [
        pkgs.go
        pkgs.just
        pkgs.git
        pkgs.gh
        pkgs.python314
        pkgs.nodejs_22
        pkgs.uv
        pkgs.trivy
        pkgs.syft
        pkgs.grype
        pkgs.oras
        pkgs.osv-scanner
      ];
    in {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShellNoCC {
          packages = tools pkgs ++ [ (zotFor pkgs) ];
          FUNCD_SRC = "${funcd}";
          ZOT_VERSION = zotVersion;
        };
        # The attestation half runs in GitHub Actions on a branch of pyvvo/funcd-functions, against GHCR: no zot.
        ci = pkgs.mkShellNoCC {
          packages = tools pkgs;
          FUNCD_SRC = "${funcd}";
        };
      });
    };
}
