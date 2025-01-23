import path = require("path");
// global.g が定義されていない状態で akashic-animation を import すると例外が発生するため lint エラーを抑止。
import g = require("@akashic/akashic-engine");
(<any>global).g = g;
import type {
	ProjectV2,
	ProjectV3} from "@akashic-extension/akashic-animation";
import {
	ContainerV2,
	ContainerV3,
	Content,
	aop
} from "@akashic-extension/akashic-animation";

import fs = require("fs-extra");
import SS = require("./SpriteStudio");
import U = require("./Utils");

/**
 * 関連ファイル情報。
 */
interface RelatedFileInfo {
	boneSetFileNames: string[];
	skinFileNames: string[];
	animationFileNames: string[];
	effectFileNames: string[];
	imageFileNames: string[];
}

/**
 * コンバータで利用できるポーターの種類。
 *
 * - none: ポーターを利用しない
 * - aop: Array Oriented Porter
 */
export type PorterType = "none" | "aop";

/**
 * コンバータオプション。
 */
export interface Options extends SS.LoadFromSSAEOptionObject {
	/**
	 * プロジェクトファイル名。
	 */
	projFileName: string;

	/**
	 * 出力ディレクトリ。
	 */
	outDir: string;

	/**
	 * 真の時、ファイル名にプレフィックスを付加する。
	 *
	 * 省略時、偽。
	 */
	addPrefix?: boolean;

	/**
	 * 真の時、冗長なログを出力する。
	 *
	 * 省略時、偽。
	 */
	verbose?: boolean;

	/**
	 * 真の時、全てのアニメーションデータをプロジェクトファイルにバンドルする。
	 *
	 * 省略時、偽。
	 */
	bundleAll?: boolean;

	/**
	 * ファイル名プレフィックス。
	 *
	 * 省略時、addPrefix が真であれば ["pj_", "bn_", "sk_", "an_", "ef_"]。
	 * addPrefix が偽であれば ["", "", "", "", ""]。
	 */
	prefixes?: string[];

	/**
	 * 真の時、関連ファイル情報を出力する。
	 */
	outputRelatedFileInfo?: boolean;

	/**
	 * ポーターの種類。
	 *
	 * 省略時、"none"。
	 */
	porter?: PorterType;

	/**
	 * 真の時、export したデータを import し、同じデータが得られることを検証する。
	 *
	 * 省略時、偽。
	 */
	debugVerifyPorter?: boolean;
}

export const DEFAULT_PREFIXES = ["pj_", "bn_", "sk_", "an_", "ef_"];
const FILEFORMAT_VERSION_V2: string = "2.0.0"; // file format version (v2)
const FILEFORMAT_VERSION: string = "3.0.0";    // file format version
const FS_WRITE_OPTION = { encoding: "utf8" } as const;

enum Prefix {
	Proj,
	Bone,
	Skin,
	Anim,
	Effect
}

let vlog: U.Logger;

/**
 * コンバータ。
 *
 * @param _options コンバートオプション
 * @returns コンバートのプロミス。
 */
export function convert(_options: Options): Promise<any> {
	const options = completeOptions(_options);

	vlog = new U.Logger(options.verbose);

	vlog.log("option:", options);

	return Promise.resolve()
		.then(() => new Promise<void>((resolve, reject) =>
			fs.ensureDir(options.outDir, err => err ? reject(err) : resolve())
		))
		.then(() => U.loadXMLFileAsyncPromise(options.projFileName))
		.then(result => {
			const fset = SS.createRelatedFileSetFromSSPJ(result);
			const allFiles = [...fset.ssaeFileNames, ...fset.ssceFileNames, ...fset.sseeFileNames];
			const pathToProj = path.dirname(options.projFileName);
			return Promise.all(
				allFiles.map(fname => {
					vlog.log(`Load ${fname}`);
					return U.loadXMLFileAsyncPromise(path.join(pathToProj, fname));
				})
			);
		})
		.then(results => {
			const proj = new SS.Project();
			proj.name = path.basename(options.projFileName, ".sspj");

			for (const result of results) {
				if ("SpriteStudioAnimePack" in result) {
					SS.loadFromSSAE(proj, result, options);
				} else if ("SpriteStudioCellMap" in result) {
					SS.loadFromSSCE(proj, result);
				} else if ("SpriteStudioEffect" in result) {
					SS.loadFromSSEE(proj, result);
				} else {
					return Promise.reject(new Error("Unknow file type or broken file"));
				}
			}

			if (options.bundleAll) {
				writeAsProjectV3(
					proj,
					options.outDir,
					options.prefixes,
					options.outputRelatedFileInfo,
					options.porter,
					options.debugVerifyPorter
				);
			} else {
				writeAsProjectV2(
					proj,
					options.outDir,
					options.prefixes,
					options.outputRelatedFileInfo,
					options.porter,
					options.debugVerifyPorter
				);
			}
		});
}

function completeOptions(opts: Options): Required<Options> {
	let prefixes: string[];

	if (Array.isArray(opts.prefixes)) {
		prefixes = [...opts.prefixes];
		for (let i = prefixes.length; i < DEFAULT_PREFIXES.length; i++) {
			prefixes.push(DEFAULT_PREFIXES[i]);
		}
	} else {
		prefixes = opts.addPrefix
			? [...DEFAULT_PREFIXES]
			: DEFAULT_PREFIXES.map(_p => "");
	}

	return {
		projFileName: opts.projFileName,
		outDir: opts.outDir,
		addPrefix: !!opts.addPrefix,
		verbose: !!opts.verbose,
		bundleAll: !!opts.bundleAll,
		prefixes,
		outputRelatedFileInfo: !!opts.outputRelatedFileInfo,
		porter: opts.porter ?? "none",
		debugVerifyPorter: !!opts.debugVerifyPorter,

		// SS.LoadFromSSAEOptionObject
		asaanLongName: !!opts.asaanLongName,
		deleteHidden: !!opts.deleteHidden,
		labelAsUserData: !!opts.labelAsUserData,
		outputUserData: !!opts.outputUserData,
		outputComboInfo: !!opts.outputComboInfo,
		outputLayoutSize: !!opts.outputLayoutSize,
		ignoreUnknownAttributes: !!opts.ignoreUnknownAttributes,
	};
}

function writeObject(obj: any, name: string, ext: string, outDir: string, version: string, prefix: string): string {
	const json = JSON.stringify(new ContainerV2(version, obj));
	const fileName = prefix + name + ext;
	const fullPath = path.join(outDir, fileName);
	fs.writeFileSync(fullPath, json, FS_WRITE_OPTION);
	vlog.log(`Write ${fullPath}`);
	return fileName;
}

function writeNamedObjects<T extends { name: string }>(objs: T[], ext: string, outDir: string, version: string, prefix: string): string[] {
	const fileNames: string[] = [];
	objs.forEach(obj => {
		const fileName = writeObject(obj, obj.name, ext, outDir, version, prefix);
		fileNames.push(fileName);
	});
	return fileNames;
}

function assertDeepEqual(a: any, b: any): void {
	const result = U.deepEqual(a, b);

	if (result !== true) {
		throw new Error(`DeepEqual failed: ${result}`);
	}
}

/**
 * ArrayOrientedPorter で export したデータを import し、元のデータと一致することを検証する。
 *
 * 一致しなかった時、例外を投げる。
 */
function verifyArrayOrientedPorter(
	proj: SS.Project,
	schema: aop.ArrayOrientedPorterSchema,
	boneSets: any[][],
	skins: any[][],
	animations: any[][],
	effects: any[][]
): void {
	console.log(`Verify ${proj.name}`);

	const importer = new aop.ArrayOrientedImporter();

	if (!importer.validateSchema(schema)) {
		throw new Error(`Invalid schema: ${schema}`);
	}

	importer.setSchema(schema);

	const importedBoneSets = boneSets.map(boneSet => importer.importBoneSet(boneSet));
	assertDeepEqual(proj.boneSets, importedBoneSets);

	const importedSkins = skins.map(skin => importer.importSkin(skin));
	assertDeepEqual(proj.skins, importedSkins);

	const importedAnimations = animations.map(animation => importer.importAnimation(animation));
	assertDeepEqual(proj.animations, importedAnimations);

	const importedEffects = effects.map(effect => importer.importEffect(effect));
	assertDeepEqual(proj.effects, importedEffects);
}

function writeRelatedFilesAsV2PorterNone(proj: SS.Project, outDir: string, prefixes: string[], version: string): ProjectV2 {
	const boneSetFileNames = writeNamedObjects(proj.boneSets, ".asabn", outDir, version, prefixes[Prefix.Bone]);
	const skinFileNames = writeNamedObjects(proj.skins, ".asask", outDir, version, prefixes[Prefix.Skin]);
	const animationFileNames = writeNamedObjects(proj.animations, ".asaan", outDir, version, prefixes[Prefix.Anim]);
	const effectFileNames = writeNamedObjects(proj.effects, ".asaef", outDir, version, prefixes[Prefix.Effect]);

	return {
		boneSetFileNames,
		skinFileNames,
		animationFileNames,
		effectFileNames,
		userData: proj.userData,
	};
}

function writeRelatedFilesAsV2PorterAOP(
	proj: SS.Project,
	outDir: string,
	prefixes: string[],
	version: string,
	debugVerifyPorter: boolean
): ProjectV2 {
	const exporter = new aop.ArrayOrientedExporter();

	const exportednimations = proj.animations.map(anim => {
		return {
			name: anim.name,
			data: exporter.exportAnimation(anim)
		};
	});

	const exportedBoneSets = proj.boneSets.map(boneSet => {
		return {
			name: boneSet.name,
			data: exporter.exportBoneSet(boneSet)
		};
	});

	const exportedSkins = proj.skins.map(skin => {
		return {
			name: skin.name,
			data: exporter.exportSkin(skin)
		};
	});

	const exportedEffects = proj.effects.map(effect => {
		return {
			name: effect.name,
			data: exporter.exportEffect(effect)
		};
	});

	if (debugVerifyPorter) {
		verifyArrayOrientedPorter(
			proj,
			exporter.getSchema(),
			exportedBoneSets.map(boneSet => boneSet.data),
			exportedSkins.map(skin => skin.data),
			exportednimations.map(anim => anim.data),
			exportedEffects.map(effect => effect.data)
		);
	}

	const boneSetFileNames = exportedBoneSets.map(boneSet =>
		writeObject(boneSet.data, boneSet.name, ".asabn", outDir, version, prefixes[Prefix.Bone])
	);

	const skinFileNames = exportedSkins.map(skin =>
		writeObject(skin.data, skin.name, ".asask", outDir, version, prefixes[Prefix.Skin])
	);

	const animationFileNames = exportednimations.map(anim =>
		writeObject(anim.data, anim.name, ".asaan", outDir, version, prefixes[Prefix.Anim])
	);

	const effectFileNames = exportedEffects.map(effect =>
		writeObject(effect.data, effect.name, ".asaef", outDir, version, prefixes[Prefix.Effect])
	);

	const schema = exporter.getSchema();

	return {
		boneSetFileNames,
		skinFileNames,
		animationFileNames,
		effectFileNames,
		userData: proj.userData,
		schema
	};
}

/**
 * プロジェクトファイルおよびその他関連ファイルをV2形式で出力する。
 *
 * @param proj SpriteStudio プロジェクト
 * @param outDir 出力ディレクトリ
 * @param prefixes ファイル名プレフィックス
 * @param outputRelatedFileInfo 真の時、関連ファイル情報を出力する
 * @param porter ポーターの種類
 * @param debugVerifyPorter 真の時、ポーターの整合性を検証する
 */
function writeAsProjectV2(
	proj: SS.Project,
	outDir: string,
	prefixes: string[],
	outputRelatedFileInfo: boolean,
	porter: PorterType,
	debugVerifyPorter: boolean
): void {
	const version = FILEFORMAT_VERSION_V2;

	const projectV2 = porter === "none"
		? writeRelatedFilesAsV2PorterNone(proj, outDir, prefixes, version)
		: porter === "aop"
			? writeRelatedFilesAsV2PorterAOP(proj, outDir, prefixes, version, debugVerifyPorter)
			: null;

	if (projectV2 == null) {
		throw new Error(`Unknown porter type: ${porter}`);
	}

	if (outputRelatedFileInfo) {
		const relatedFileInfo: RelatedFileInfo = {
			boneSetFileNames: projectV2.boneSetFileNames,
			skinFileNames: projectV2.skinFileNames,
			animationFileNames: projectV2.animationFileNames,
			effectFileNames: projectV2.effectFileNames,
			imageFileNames: proj.imageFileNames,
		};
		const userData = projectV2.userData ?? {};
		projectV2.userData = {
			...userData,
			relatedFileInfo
		};
	}

	// プロジェクトファイルを出力
	const con = new ContainerV2(version, projectV2);
	const json = JSON.stringify(con);
	const pjFname = path.join(outDir, prefixes[Prefix.Proj] + proj.name + ".asapj");
	fs.writeFileSync(pjFname, json, FS_WRITE_OPTION);

	vlog.log("write " + pjFname);
}

function createContentsPorterNone(proj: SS.Project): Content<any>[] {
	const boneSetContents = proj.boneSets.map(boneSet =>
		new Content("bone", boneSet.name, boneSet)
	);
	const skinContents = proj.skins.map(skin =>
		new Content("skin", skin.name, skin)
	);
	const animationContents = proj.animations.map(animation =>
		new Content("animation", animation.name, animation)
	);
	const effectContents = proj.effects.map(effect =>
		new Content("effect", effect.name, effect)
	);

	const projectContent = new Content<ProjectV3>("project", proj.name, {
		userData: proj.userData,
	});

	const contents = [
		projectContent,
		...boneSetContents,
		...skinContents,
		...animationContents,
		...effectContents,
	];

	return contents;
}

function createContentsPorterAOP(proj: SS.Project, debugVerifyPorter: boolean): Content<any>[] {
	const exporter = new aop.ArrayOrientedExporter();

	const boneSetContents = proj.boneSets.map(boneSet =>
		new Content("bone", boneSet.name, exporter.exportBoneSet(boneSet))
	);
	const skinContents = proj.skins.map(skin =>
		new Content("skin", skin.name, exporter.exportSkin(skin))
	);
	const animationContents = proj.animations.map(anim =>
		new Content("animation", anim.name, exporter.exportAnimation(anim))
	);
	const effectContents = proj.effects.map(effect =>
		new Content("effect", effect.name, exporter.exportEffect(effect))
	);

	if (debugVerifyPorter) {
		verifyArrayOrientedPorter(
			proj,
			exporter.getSchema(),
			boneSetContents.map(content => content.data),
			skinContents.map(content => content.data),
			animationContents.map(content => content.data),
			effectContents.map(content => content.data)
		);
	}

	const projectContent = new Content("project", proj.name, {
		userData: proj.userData,
		schema: exporter.getSchema(),
	});

	const contents = [
		projectContent,
		...boneSetContents,
		...skinContents,
		...animationContents,
		...effectContents,
	];

	return contents;
}

/**
 * プロジェクトファイルをV3形式で出力する。
 *
 * @param proj SpriteStudio プロジェクト
 * @param outDir 出力ディレクトリ
 * @param prefixes ファイル名プレフィックス
 * @param outputRelatedFileInfo 真の時、関連ファイル情報を出力する
 * @param porter ポーターの種類
 * @param debugVerifyPorter 真の時、ポーターの整合性を検証する
 */
function writeAsProjectV3(
	proj: SS.Project,
	outDir: string,
	prefixes: string[],
	outputRelatedFileInfo: boolean,
	porter: PorterType,
	debugVerifyPorter: boolean
): void {
	const version = FILEFORMAT_VERSION;

	const contents = porter === "none"
		? createContentsPorterNone(proj)
		: porter === "aop"
			? createContentsPorterAOP(proj, debugVerifyPorter)
			: null;

	if (contents == null) {
		throw new Error(`Unknown porter: ${porter}`);
	}

	if (outputRelatedFileInfo) {
		const content = contents.find(content => content.type === "project");

		if (content == null) {
			throw new Error("Project not found.");
		}

		const projectV3 = content.data as ProjectV3;
		const relatedFileInfo: RelatedFileInfo = {
			boneSetFileNames: [],
			skinFileNames: [],
			animationFileNames: [],
			effectFileNames: [],
			imageFileNames: proj.imageFileNames,
		};

		projectV3.userData = {
			...projectV3.userData,
			relatedFileInfo
		};
	}

	const container = new ContainerV3(version, "bundle", contents);
	const json = JSON.stringify(container);
	const pjFname = path.join(outDir, prefixes[Prefix.Proj] + proj.name + ".asapj");
	fs.writeFileSync(pjFname, json, FS_WRITE_OPTION);

	vlog.log("write " + pjFname);
}
