{
  description = "funcd example functions and Apps";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }: let
    supportedSystems = [ "aarch64-darwin" "x86_64-linux" "aarch64-linux" ];
    forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
  in {
    devShells = forAllSystems (system: let
      pkgs = import nixpkgs { inherit system; };
    in {
      # node 22 and python 3.14 are the runtimes the functions declare (nodejs22, python314); npm comes with
      # nodejs_22, so its scripts run on node 22 too
      default = pkgs.mkShellNoCC {
        packages = with pkgs; [
          nodejs_22
          python314
          uv
          go
          just
          git
          lefthook
          ruff
        ];
        UV_PYTHON_DOWNLOADS = "never";
        # installs the git hooks from lefthook.yml; idempotent
        shellHook = ''
          [ -d .git ] && lefthook install >/dev/null 2>&1 || true
        '';
      };
    });
  };
}
