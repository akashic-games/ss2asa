import path = require("path");
import fs = require("fs-extra");
import g = require("@akashic/akashic-engine");
(<any>global).g = g;
import {Skin, BoneSet, Container, AnimeParams} from "@akashic-extension/akashic-animation";
import SS = require("./SpriteStudio");
import U = require("./Utils");

//
// Converter's option interface
//
export interface Options extends SS.LoadFromSSAEOptionObject {
	projFileName: string;
	outDir: string;
	addPrefix: boolean;
	verbose: boolean;
	prefixes: string[];
}

//
// Consts
//
const FILEFORMAT_VERSION: string = "2.0.0"; // file format version
const FS_WRITE_OPTION: any = {encoding: "utf8"};
enum Prefix {
	Proj,
	Bone,
	Skin,
	Anim,
	Effect
}

let vlog: U.Logger = undefined;

export function convert(options: Options): void {
	vlog = new U.Logger(options.verbose);

	vlog.log("outDir:" + options.outDir);
	vlog.log("addPrefix:" + options.addPrefix);
	vlog.log("prefixes:" + options.prefixes);
	vlog.log("longName:" + options.asaanLongName);
	vlog.log("deleteHidden:" + options.deleteHidden);
	vlog.log("userData:" + options.outputUserData);

	const pathToProj = path.dirname(options.projFileName);
	const proj = new SS.Project();
	proj.name = path.basename(options.projFileName, ".sspj");

	const p: Promise<any> = new Promise<string>( // promise to create output directory
		(resolve: () => void, reject: (error: any) => void) => {
			fs.ensureDir(options.outDir, (err: any) => {
				err ? reject(err) : resolve();
			});
		}
	);
	p.then(
		() => { // promise to load project file
			return loadAsyncPromise(options.projFileName);
		},
		(err: any) => {
			console.log(err);
		}
	)
	.then(
		(result: any) => { // promise to load ssae and ssce files
			const fset = SS.createRelatedFileSetFromSSPJ(result);
			const allFiles = fset.ssaeFileNames.concat(fset.ssceFileNames, fset.sseeFileNames);
			return Promise.all( // すべてのpromiseが終了するのを待機するpromise
				allFiles.map((fname: string) => {
					console.log("loading... " + fname);
					return loadAsyncPromise(path.join(pathToProj, fname));
				})
			);
		},
		(err: any) => {
			console.log(err);
		}
	)
	.then(
		(results: any[]) => { // write all files
			results.map((result: any) => {
				if ("SpriteStudioAnimePack" in result) { // SSAE
					SS.loadFromSSAE(proj, result, options);
				} else if ("SpriteStudioCellMap" in result) {
					SS.loadFromSSCE(proj, result);
				} else if ("SpriteStudioEffect" in result) {
					SS.loadFromSSEE(proj, result);
				} else {
					console.log("unknow file type or broken file. skip");
				}
			});
			writeAll(proj, options.outDir, options.prefixes, options.outputRelatedFileInfo);
		},
		(err: any) => {
			console.log(err);
		}
	)
	.catch(
		(err: any) => { // 例外が投げられた時は全てここに到達する
			console.log(err.stack);
		}
	);
}

function loadAsyncPromise(fname: string): Promise<any> {
	return new Promise<any>(
		(resolve: (result: any) => void, reject: (error: any) => void) => {
			U.loadXmlAsJsAsync(fname, (err: any, result: any) => {
				if (! err) {
					resolve(result);
				} else {
					reject(err);
				}
			});
		}
	);
};

function writeNamedObjects<T extends { name: string }>(objs: T[], ext: string, outDir: string, version: string, prefix: string): string[] {
	const fileNames: string[] = [];
	objs.forEach((obj: T): void => {
		const json: string = JSON.stringify(new Container(version, obj));
		const fileName = prefix + obj.name + ext;
		const fullPath = path.join(outDir, fileName);
		fs.writeFileSync(fullPath, json, FS_WRITE_OPTION);
		vlog.log("write " + fullPath);
		fileNames.push(fileName);
	});
	return fileNames;
}

export class RelatedFileInfo {
	boneSetFileNames: string[];
	skinFileNames: string[];
	animationFileNames: string[];
	effectFileNames: string[];
	imageFileNames: string[];

	constructor(imageFileNames: string[], contents: any) {
		this.boneSetFileNames = contents.boneSetFileNames;
		this.skinFileNames = contents.skinFileNames;
		this.animationFileNames = contents.animationFileNames;
		this.effectFileNames = contents.effectFileNames;
		this.imageFileNames = imageFileNames;
	}
}

function writeAll(proj: SS.Project, outDir: string, prefixes: string[], outputRelatedFileInfo: boolean): void {
	const boneSetFileNames = writeNamedObjects<BoneSet>(proj.boneSets, ".asabn", outDir, FILEFORMAT_VERSION, prefixes[Prefix.Bone]);
	const skinFileNames = writeNamedObjects<Skin>(proj.skins, ".asask", outDir, FILEFORMAT_VERSION, prefixes[Prefix.Skin]);
	const animFileNames = writeNamedObjects<AnimeParams.Animation>(
		proj.animations, ".asaan", outDir, FILEFORMAT_VERSION, prefixes[Prefix.Anim]);
	const effectFileNames = writeNamedObjects<any>(proj.effects, ".asaef", outDir, FILEFORMAT_VERSION, prefixes[Prefix.Effect]);
	const contents: any = {
		boneSetFileNames: boneSetFileNames,
		skinFileNames: skinFileNames,
		animationFileNames: animFileNames,
		effectFileNames: effectFileNames,
		userData: proj.userData
	};

	if (outputRelatedFileInfo) {
		if (! contents.userData) {
			contents.userData = {};
		}
		// ユーザデータにcontentsと同じものを格納している。
		// asaファイル群のデータフォーマットは非公開としている。そのため
		// 内容が重複するがuserDataに格納しなおし、こちらを公開する。
		contents.userData.relatedFileInfo = new RelatedFileInfo(proj.imageFileNames, contents);
	}

	const con = new Container(FILEFORMAT_VERSION, contents);
	const json = JSON.stringify(con);
	const pj_fname = path.join(outDir, prefixes[Prefix.Proj] + proj.name + ".asapj");
	fs.writeFileSync(pj_fname, json, FS_WRITE_OPTION);

	vlog.log("write " + pj_fname);
}
