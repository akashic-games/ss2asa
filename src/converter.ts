import path = require("path");
import fs = require("fs-extra");
// global.g が定義されていない状態で akashic-animation を import すると例外が発生するため lint エラーを抑止。
/* eslint import/order: 0 */
import g = require("@akashic/akashic-engine");
(<any>global).g = g;
import {
	ContainerV2,
	ContainerV3,
	Content,
	ProjectV2,
	ProjectV3,
	aop,
} from "@akashic-extension/akashic-animation";
/* eslint import/order: 2 */
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
 * 名前付きデータ。
 */
interface NamedData<T> {
	name: string;
	data: T;
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

	if (options.prefixes.length < DEFAULT_PREFIXES.length) {
		return Promise.reject(`Too few prefixes ${JSON.stringify(options.prefixes)}`);
	}

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
				writeAllIntoProjectFile(proj, options.outDir, options.prefixes, options.outputRelatedFileInfo, options.porter);
			} else {
				writeAll(proj, options.outDir, options.prefixes, options.outputRelatedFileInfo, options.porter);
			}
		});
}

function completeOptions(opts: Options): Required<Options> {
	let prefixes: string[];

	if (Array.isArray(opts.prefixes)) {
		prefixes = [];
		for (let i = 0; i < DEFAULT_PREFIXES.length; i++) {
			prefixes.push(opts.prefixes[i] ?? DEFAULT_PREFIXES[i]);
		}
	} else {
		prefixes = opts.addPrefix
			? DEFAULT_PREFIXES
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

		// SS.LoadFromSSAEOptionObject
		asaanLongName: !!opts.asaanLongName,
		deleteHidden: !!opts.deleteHidden,
		labelAsUserData: !!opts.labelAsUserData,
		outputUserData: !!opts.outputUserData,
		outputComboInfo: !!opts.outputComboInfo,
		outputLayoutSize: !!opts.outputLayoutSize,
		ignoreUnknownAttribute: !!opts.ignoreUnknownAttribute,
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function verifyPorter(
	proj: SS.Project,
	schema: aop.AOPSchema,
	boneSets: NamedData<any[]>[],
	skins: NamedData<any[]>[],
	animations: NamedData<any[]>[],
	effects: NamedData<any[]>[]
): void {
	const importer = new aop.AOPImporter(schema);

	const deserializedBoneSets = boneSets.map(boneSet => importer.importBoneSet(boneSet.data));
	assertDeepEqual(proj.boneSets, deserializedBoneSets);

	const deserializedSkins = skins.map(skin => importer.importSkin(skin.data));
	assertDeepEqual(proj.skins, deserializedSkins);

	const deserializedAnimations = animations.map(animation => importer.importAnimation(animation.data));
	assertDeepEqual(proj.animations, deserializedAnimations);

	const deserializedEffects = effects.map(effect => importer.importEffect(effect.data));
	assertDeepEqual(proj.effects, deserializedEffects);
}

function writeAllPorterNone(proj: SS.Project, outDir: string, prefixes: string[], version: string): ProjectV2 {
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

function writeAllPorterAOP(proj: SS.Project, outDir: string, prefixes: string[], version: string): ProjectV2 {
	const exporter = new aop.AOPExporter();

	const compactAnimations = proj.animations.map(anim => {
		return {
			name: anim.name,
			data: exporter.exportAnimation(anim)
		};
	});

	const compactBoneSets = proj.boneSets.map(boneSet => {
		return {
			name: boneSet.name,
			data: exporter.exportBoneSet(boneSet)
		};
	});

	const compactSkins = proj.skins.map(skin => {
		return {
			name: skin.name,
			data: exporter.exportSkin(skin)
		};
	});

	const compactEffects = proj.effects.map(effect => {
		return {
			name: effect.name,
			data: exporter.exportEffect(effect)
		};
	});

	// verifyPorter(proj, exporter.getSchema(), compactBoneSets, compactSkins, compactAnimations, compactEffects);

	const boneSetFileNames = compactBoneSets.map(boneSet =>
		writeObject(boneSet.data, boneSet.name, ".asabn", outDir, version, prefixes[Prefix.Bone])
	);

	const skinFileNames = compactSkins.map(skin =>
		writeObject(skin.data, skin.name, ".asask", outDir, version, prefixes[Prefix.Skin])
	);

	const animationFileNames = compactAnimations.map(anim =>
		writeObject(anim.data, anim.name, ".asaan", outDir, version, prefixes[Prefix.Anim])
	);

	const effectFileNames = compactEffects.map(effect =>
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
 * @param proj
 * @param outDir
 * @param prefixes
 * @param outputRelatedFileInfo
 */
function writeAll(proj: SS.Project, outDir: string, prefixes: string[], outputRelatedFileInfo: boolean, porter: PorterType): void {
	const version = FILEFORMAT_VERSION_V2;

	const projectV2 = porter === "none"
		? writeAllPorterNone(proj, outDir, prefixes, version)
		: porter === "aop"
			? writeAllPorterAOP(proj, outDir, prefixes, version)
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

function createContentsV3PorterNone(proj: SS.Project): Content<any>[] {
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

function createContentsV3PorterAOP(proj: SS.Project): Content<any>[] {
	const exporter = new aop.AOPExporter();

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

	const projectContent = new Content<ProjectV3>("project", proj.name, {
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
 * プロジェクトファイルおよびその他関連ファイルをV3形式で出力する。
 *
 * @param proj
 * @param outDir
 * @param prefixes
 * @param outputRelatedFileInfo
 */
function writeAllIntoProjectFile(
	proj: SS.Project,
	outDir: string,
	prefixes: string[],
	outputRelatedFileInfo: boolean,
	porter: PorterType
): void {
	const version = FILEFORMAT_VERSION;

	const contents = porter === "none"
		? createContentsV3PorterNone(proj)
		: porter === "aop"
			? createContentsV3PorterAOP(proj)
			: null;

	if (contents == null) {
		throw new Error(`Unknown porter: ${porter}`);
	}

	if (outputRelatedFileInfo) {
		const idx = contents.findIndex(content => content.type === "project");
		if (idx === -1) {
			throw new Error("Project not found.");
		}
		const projectV3: ProjectV3 = contents[idx].data;
		const relatedFileInfo: RelatedFileInfo = {
			boneSetFileNames: [],
			skinFileNames: [],
			animationFileNames: [],
			effectFileNames: [],
			imageFileNames: proj.imageFileNames,
		};
		const userData = projectV3.userData ?? {};
		projectV3.userData = {
			...userData,
			relatedFileInfo
		};
	}

	const container = new ContainerV3(version, "bundle", contents);
	const json = JSON.stringify(container);
	const pjFname = path.join(outDir, prefixes[Prefix.Proj] + proj.name + ".asapj");
	fs.writeFileSync(pjFname, json, FS_WRITE_OPTION);

	vlog.log("write " + pjFname);
}
