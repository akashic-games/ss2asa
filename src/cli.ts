import fs = require("fs");
import path = require("path");
import program = require("commander");
import C = require("./converter");

//
// Consts
//
const PROGRAM_VERSION = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8")).version;
const DEFAULT_PREFIXES = C.DEFAULT_PREFIXES.join(",");

//
// Handle options and args
//
program
	.version(PROGRAM_VERSION)
	.usage("[options] project_file")
	.option("-o, --out-dir <outDir>", "set output directory", "./")
	.option("-p, --add-prefix", "add prefix to each file")
	.option("-l, --long-name", "add ssae file name to asaan file name")
	.option("-d, --delete-hidden", "delete bone and related animation if EYE icon is closed")
	.option("-u, --user-data", "output user data")
	.option("-L, --label-as-user-data", "export labels as user data")
	.option("-c, --combination-info", "output resoruce combination info")
	.option("-r, --related-file-info", "output related file info")
	.option("-s, --layout-size", "output layout size")
	.option("-b, --bundle-all", "bundle all asset files into an asapj file")
	.option(
		"-P, --set-prefix <[pj],[bn],[sk],[an]>",
		"set prefixes. default: " + DEFAULT_PREFIXES,
		(list: string): string[] => {
			return list.split(",");
		}
	)
	.option("-v, --verbose", "output verbosely")
	.parse(process.argv);

//
// Check arguments and options
//
if (program.args.length === 0) {
	program.outputHelp();
	process.exit(1);
} else if (program.args.length > 1) {
	console.log("too many files");
	process.exit(1);
}

const prefixes = createPrefixFromParam((<any>program).setPrefix, (<any>program).addPrefix);
if (prefixes.length < DEFAULT_PREFIXES.split(",").length) {
	console.log("Error: too few prefixes");
	process.exit(1);
}

const options: C.Options = {
	projFileName:          program.args[0],
	outDir:                <string>((<any>program).outDir),
	addPrefix:             !!(<any>program).addPrefix,
	verbose:               !!(<any>program).verbose,
	prefixes:              prefixes,
	bundleAll:             !!(<any>program).bundleAll,

	// SS.LoadFromSSAEOptionObject
	asaanLongName:         !!(<any>program).longName,
	deleteHidden:          !!(<any>program).deleteHidden,
	labelAsUserData:       !!(<any>program).labelAsUserData,
	outputUserData:        !!(<any>program).userData,
	outputComboInfo:       !!(<any>program).combinationInfo,
	outputRelatedFileInfo: !!(<any>program).relatedFileInfo,
	outputLayoutSize:      !!(<any>program).layoutSize
};

C.convert(options);

function createPrefixFromParam(param: any, isPrefixed: boolean): string[] {
	if (Array.isArray(param)) {
		return param;
	} else if (isPrefixed === true) {
		return DEFAULT_PREFIXES.split(",");
	} else {
		return ["", "", "", ""];
	}
}
