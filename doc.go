// Package functions holds the example functions and Apps that funcd's Lima lanes deploy. funcd pins this module in
// its go.mod, as it pins the language repos (ADR-0141), and reads its files from the module cache: scripts/moddir.sh
// in the lanes and internal/testkit/langmod in the tests.
package functions

// Module is this module's path, as funcd's go.mod requires it.
const Module = "github.com/pyvvo/funcd-functions"
