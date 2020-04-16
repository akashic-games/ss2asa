import path = require("path");
import fs = require("fs-extra");
import g = require("@akashic/akashic-engine");
(<any>global).g = g;
import {Skin, BoneSet, ContainerV2, ContainerV3, Content, ContentType, AnimeParams} from "@akashic-extension/akashic-animation";
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
	bundleAll: boolean;
	prefixes: string[];
}

//
// Consts
//
const FILEFORMAT_VERSION_V2: string = "2.0.0"; // file format version (v2)
const FILEFORMAT_VERSION: string = "3.0.0";    // file format version

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

	vlog.log("option:" + JSON.stringify(options));

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
			return Promise.all(
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
			if (options.bundleAll) {
				writeAllIntoProjectFile(proj, options.outDir, options.prefixes, options.outputRelatedFileInfo);
			} else {
				writeAll(proj, options.outDir, options.prefixes, options.outputRelatedFileInfo);
			}
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
		const json: string = JSON.stringify(new ContainerV2(version, obj));
		const fileName = prefix + obj.name + ext;
		const fullPath = path.join(outDir, fileName);
		fs.writeFileSync(fullPath, json, FS_WRITE_OPTION);
		vlog.log("write " + fullPath);
		fileNames.push(fileName);
	});
	return fileNames;
}

function addNamedObjectToContents<T extends { name: string }>(contents: Content<T>[], objs: T[], type: ContentType): void {
	objs.forEach((obj: T): void => {
		contents.push({
			type,
			name: obj.name,
			data: obj
		});
	});
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

function writeAll(proj: SS.Project, outDir: string, prefixes: string[], outputRelatedFileInfo: boolean, bundleAll: boolean = false): void {
	const version = FILEFORMAT_VERSION_V2;
	const boneSetFileNames = writeNamedObjects<BoneSet>(proj.boneSets, ".asabn", outDir, version, prefixes[Prefix.Bone]);
	const skinFileNames = writeNamedObjects<Skin>(proj.skins, ".asask", outDir, version, prefixes[Prefix.Skin]);
	const animFileNames = writeNamedObjects<AnimeParams.Animation>(
		proj.animations, ".asaan", outDir, version, prefixes[Prefix.Anim]);
	const effectFileNames = writeNamedObjects<any>(proj.effects, ".asaef", outDir, version, prefixes[Prefix.Effect]);
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

	const con = new ContainerV2(version, contents);
	const json = JSON.stringify(con);
	const pj_fname = path.join(outDir, prefixes[Prefix.Proj] + proj.name + ".asapj");
	fs.writeFileSync(pj_fname, json, FS_WRITE_OPTION);

	vlog.log("write " + pj_fname);
}

function writeAllIntoProjectFile(proj: SS.Project, outDir: string, prefixes: string[], outputRelatedFileInfo: boolean): void {
	const version = FILEFORMAT_VERSION;
	const contents: Content<any>[] = [];

	const project: Content<any> = new Content("project", proj.name, { userData: proj.userData });
	if (outputRelatedFileInfo) {
		// ユーザデータにcontentsと同じものを格納している。
		// asaファイル群のデータフォーマットは非公開としている。そのため
		// 内容が重複するがuserDataに格納しなおし、こちらを公開する。
		project.data.userData.relatedFileInfo = new RelatedFileInfo(proj.imageFileNames, contents);
	}
	contents.push(project);

	addNamedObjectToContents(contents, proj.boneSets, "bone");
	addNamedObjectToContents(contents, proj.skins, "skin");
	addNamedObjectToContents(contents, proj.animations, "animation");
	addNamedObjectToContents(contents, proj.effects, "effect");

	const container = new ContainerV3(version, "bundle", contents);
	const json = JSON.stringify(container);
	const pj_fname = path.join(outDir, prefixes[Prefix.Proj] + proj.name + ".asapj");
	fs.writeFileSync(pj_fname, json, FS_WRITE_OPTION);

	vlog.log("write " + pj_fname);
}
