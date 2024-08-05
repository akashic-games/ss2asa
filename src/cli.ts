import fs = require("fs");
import path = require("path");
import { program, Option } from "commander";
import C = require("./converter");

const PROGRAM_VERSION = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8")).version;

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
		"-P, --set-prefix <[pj],[bn],[sk],[an],[ef]>",
		"set file name prefixes",
		list => list.split(",")
	)
	.addOption(new Option("--porter <porter>", "set porter").choices(["none", "aop"]).default("none"))
	.option("--ignore-unknown-attribute", "ignore unknown attribute")
	.option("-v, --verbose", "output verbosely")
	.parse(process.argv);

const args = program.args;

if (args.length === 0) {
	program.outputHelp();
	process.exit(1);
} else if (args.length > 1) {
	console.log("Too many files");
	process.exit(1);
}

const opts = program.opts();

C.convert({
	projFileName:          args[0],
	outDir:                opts.outDir,
	addPrefix:             !!opts.addPrefix,
	verbose:               !!opts.verbose,
	bundleAll:             !!opts.bundleAll,
	prefixes:              opts.setPrefix,
	porter:                opts.porter,

	asaanLongName:         !!opts.longName,
	deleteHidden:          !!opts.deleteHidden,
	labelAsUserData:       !!opts.labelAsUserData,
	outputUserData:        !!opts.userData,
	outputComboInfo:       !!opts.combinationInfo,
	outputRelatedFileInfo: !!opts.relatedFileInfo,
	outputLayoutSize:      !!opts.layoutSize,
	ignoreUnknownAttribute:!!opts.ignoreUnknownAttribute,
}).catch(err => {
	console.log(err);
	process.exit(1);
});
