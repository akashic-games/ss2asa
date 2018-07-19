import path = require("path");
import {Skin, Cell, Bone, BoneSet, AnimeParams, ColliderInfo, AlphaBlendMode, vfx} from "@akashic-extension/akashic-animation";
import Animation = AnimeParams.Animation;
import CurveTie = AnimeParams.CurveTie;
import Curve = AnimeParams.Curve;
import KeyFrame = AnimeParams.KeyFrame;
import IpCurve = AnimeParams.IpCurve;
import CellValue = AnimeParams.CellValue;

// SpriteStudio 5のユーザデータ定義
// ラベルをユーザデータに埋め込む機能のために`label`プロパティが拡張されている
interface UserData {
	num?: number;
	point?: number[];
	rect?: number[];
	str?: string;
	label?: string;
};

// 変換処理の都合で拡張したもの。これらは出力されない
interface EffectParameterObject extends vfx.EmitterParameterObject {
	isEmitter: boolean;
}

// SpriteStudioの属性名 と akashic-animationのAttrIdで定義される定数名の対応表
// ここに載っている属性名のみ合法とする
const ssAttr2asaAttr: any = {
	POSX: "tx",
	POSY: "ty",
	ROTZ: "rz",
	SCLX: "sx",
	SCLY: "sy",
	LSCX: "lsx",
	LSCY: "lsy",
	ALPH: "alpha",
	LALP: "lalpha",
	CELL: "cv",
	PVTX: "pvtx",
	PVTY: "pvty",
	UVTX: "tu",
	UVTY: "tv",
	PRIO: "prio",
	IFLH: "iflh",
	IFLV: "iflv",
	HIDE: "visibility",
	BNDR: "ccr",
	FLPH: "flipH",
	FLPV: "flipV",
	USER: "userData",
	EFCT: "effect"
};

// パーツ種別 "null" の扱える属性は以下に限られる
const asaAttr4nullParts: string[] = [
	"tx",
	"ty",
	"rz",
	"sx",
	"sy",
	"alpha",
	"ccr",
	"userData"
];

// akashic-animationの扱える補間方法
// 次の補間方法のみ合法とする
// undefinedは「補間なし」を意味し、これも合法とする
const validInterpolations: string[] = [
	"undefined",
	"linear",
	"bezier",
	"hermite"
];

export class RelatedFileSet {
	ssceFileNames: string[] = [];
	ssaeFileNames: string[] = [];
	sseeFileNames: string[] = [];
}

export class Project {
	name: string;
	skins: Skin[] = [];
	boneSets: BoneSet[] = [];
	animations: Animation[] = [];
	effects: vfx.EffectParameterObject[] = [];
	userData: any;
	imageFileNames: string[] = [];
}

export function createRelatedFileSetFromSSPJ(sspj: any): RelatedFileSet {
	const fileset: RelatedFileSet = new RelatedFileSet();
	let fileNames: string[] = undefined;

	if (sspj.SpriteStudioProject.cellmapNames) {
		fileNames = sspj.SpriteStudioProject.cellmapNames[0].value;
		fileset.ssceFileNames.push.apply(fileset.ssceFileNames, fileNames);
	}

	if (sspj.SpriteStudioProject.animepackNames) {
		fileNames = sspj.SpriteStudioProject.animepackNames[0].value;
		fileset.ssaeFileNames.push.apply(fileset.ssaeFileNames, fileNames);
	}

	if (sspj.SpriteStudioProject.effectFileNames) {
		fileNames = sspj.SpriteStudioProject.effectFileNames[0].value;
		fileset.sseeFileNames.push.apply(fileset.sseeFileNames, fileNames);
	}

	return fileset;
}

function didBoneStemFromInstance(bones: Bone[]): boolean {
	let result = false;
	bones.some((bone: Bone) => {
		if (bone.name.indexOf(":") !== -1) {
			result = true;
			return true;
		}
		return false;
	});
	return result;
}

// nullパーツのためのアニメーションは asaAttr4nullParts 表に
// 存在する属性のカーブのみを扱い、他はここで切り捨てる
function cullCurvesByBoneType(animations: Animation[], bones: Bone[]): void {
	bones.forEach((bone: Bone) => {
		if ((<any>bone).tmp.type === "null") {
			animations.forEach((animation: Animation) => {
				const curveTie = animation.curveTies[bone.name];
				// SpriteStudio上でパーツに一切のアニメーションがない時
				// boneに対応するcurveTieが存在しない
				if (! curveTie) {
					return;
				}
				curveTie.curves = curveTie.curves.filter((curve: Curve<any>) => {
					return asaAttr4nullParts.indexOf(curve.attribute) !== -1;
				});
			});
		}
	});
}

function deleteTmpData(bones: Bone[]): void {
	bones.forEach((bone: Bone) => {
		delete (<any>bone).tmp;
	});
}

function getRootBoneName(bones: Bone[]): string {
	for (let i = 0; i < bones.length; i++) {
		const bone = bones[i];
		if (bone.parentIndex === -1) {
			return bone.name;
		}
	}
	throw new Error("Root bone not found");
}

function deleteHiddenBones(bones: Bone[], boneSetName: string): string[] {
	const deletedBoneNames: string[] = [];
	const deletedBoneIndices: number[] = [];

	bones = bones.filter((bone: Bone) => {
		const show = (<any>bone).tmp.show;
		if (! show) {
			console.log("[INFO] delete bone: " + boneSetName + "." + bone.name);
			deletedBoneNames.push(bone.name);
			deletedBoneIndices.push(bone.arrayIndex);
		}
		return show;
	});

	bones.forEach((bone: Bone) => {
		const originalIndex = bone.arrayIndex;
		const originalParentIndex = bone.parentIndex;
		deletedBoneIndices.forEach((index: number) => {
			if (index < originalIndex) {
				bone.arrayIndex--;
			}
			if (index < originalParentIndex) {
				bone.parentIndex--;
			}
		});
	});

	return deletedBoneNames;
}

export interface LoadFromSSAEOptionObject {
	asaanLongName?: boolean;
	deleteHidden?: boolean;
	labelAsUserData?: boolean;
	outputUserData?: boolean;
	outputComboInfo?: boolean;
	outputRelatedFileInfo?: boolean;
	outputLayoutSize?: boolean;
}

export function loadFromSSAE(proj: Project, data: any, option: LoadFromSSAEOptionObject): void {
	// get bones from model and construct BoneSet
	const model: any = data.SpriteStudioAnimePack.Model;
	const name: string = data.SpriteStudioAnimePack.name[0];
	let combo: any = undefined;

	if (option.outputComboInfo) {
		combo = { boneName: undefined, animationNames: [], skinNames: [] };
	}

	const bones: Bone[] = loadBonesFromSSModels(model);

	if (didBoneStemFromInstance(bones)) {
		console.log("[INFO] ignore " + name + "'s bone set and animations because it stemmed from instance animation");
		return;
	}

	const deletedBoneNames: string[] = option.deleteHidden ? deleteHiddenBones(bones, name) : [];

	proj.boneSets.push(new BoneSet(name, bones));
	if (option.outputComboInfo) {
		combo.boneName = name;
	}

	const animationNamePrefix = option.asaanLongName ? name + "_" : ""; // bone名はssaeファイル名と一致しているはず

	// SpriteStudioは１つもアニメーションを持たないssaeファイルの作成が
	// UI上出来ない。このチェックに引っかかることは本来ないはず
	const ssAnimeList: any[] = data.SpriteStudioAnimePack.animeList[0].anime;
	if (! ssAnimeList) {
		console.log("[INFO] ignore " + name + "'s animation because it has no animation data");
		return;
	}

	// nullだけまたはeffectだけのアニメだとcellを持たない
	// effectサポートのためセルがないことを許容する (experimental)
	const cellmapNames: string[] = data.SpriteStudioAnimePack.cellmapNames[0].value || [];

	const skinNames: string[] = [];
	cellmapNames.forEach((val: string) => {
		// valにはアニメ(ssae)の参照するセルマップファイル名(cellmap.ssce)が来る
		skinNames.push(path.basename(val, ".ssce"));
	});

	const animations: Animation[] = loadAnimationsFromSSAnimeList(ssAnimeList, skinNames, option.outputUserData);

	animations.forEach((animation: Animation) => {
		deletedBoneNames.forEach((name: string) => {
			console.log("[INFO] delete animation curve: " + animation.name + "." + name);
			delete animation.curveTies[name];
		});
	});

	if (option.outputUserData && option.labelAsUserData) {
		importLabelsFromSSAnimeList(ssAnimeList, animations, getRootBoneName(bones));
	}

	cullCurvesByBoneType(animations, bones);

	deleteTmpData(bones);

	// 名前を利用する処理があるのでロングネーム化のタイミングに注意
	animations.forEach((animation: Animation) => {
		animation.name = animationNamePrefix + animation.name;
	});

	proj.animations = proj.animations.concat(animations);

	if (option.outputComboInfo) {
		animations.forEach((animation: Animation) => {
			combo.animationNames.push(animation.name);
		});
		combo.skinNames = skinNames;
		if (! proj.userData) {
			proj.userData = {};
		}
		if (! proj.userData.combinationInfo) {
			proj.userData.combinationInfo = [];
		}
		proj.userData.combinationInfo.push(combo);
	}

	if (option.outputLayoutSize) {
		const layoutSizes: {[key: string]: {width: number, height: number}} = {};

		for (let i = 0; i < ssAnimeList.length; i++) {
			const ssAnime = ssAnimeList[i];
			if (ssAnime.isSetup && ssAnime.isSetup[0] === "1") {
				continue;
			}
			const name = animationNamePrefix + ssAnime.name[0];
			const canvasSizes = ssAnime.settings[0].canvasSize[0].split(" ");
			const width = canvasSizes[0];
			const height = canvasSizes[1];
			layoutSizes[name] = {width: width, height: height};
		}

		proj.userData = (proj.userData || {});
		proj.userData.layoutSizes = layoutSizes;
	}
}

export function loadFromSSCE(proj: Project, data: any): void {
	const skin: Skin = loadSkin(data);
	proj.skins.push(skin);
	proj.imageFileNames.push(getImageBaseName(data));
}

function toNumbers(pair: {value: string, subvalue: string}, filter?: (arr: string) => number): number[] {
	const arr = (pair.value === pair.subvalue) ? [pair.value] : [pair.value, pair.subvalue];
	return arr.map(filter ? filter : parseFloat);
}

export function loadFromSSEE(proj: Project, data: any): void {
	const nodeList = data.SpriteStudioEffect.effectData[0].nodeList[0].node;
	if (!nodeList || !nodeList.length) return;

	const fps = parseInt(data.SpriteStudioEffect.effectData[0].fps[0], 10);
	const frame2sec = (frame: number) => frame / fps;
	const frameStr2sec = (frameString: string) => frame2sec(parseFloat(frameString));
	const velStr2asaVel = (velString: string) => parseFloat(velString) * fps;
	const accStr2asaAcc = (accString: string) => parseFloat(accString) * fps * fps;
	const deg2rad = (deg: number) => deg / 180 * Math.PI;
	const degStr2rad = (degString: string) => deg2rad(parseFloat(degString));
	const degStr2asaRadR = (degString: string) => -degStr2rad(degString);
	const degStr2asaRadA = (degString: string) => -degStr2rad(degString) - deg2rad(90);

	const list: { isEmitter?: boolean, parentIndex: number }[] = [];
	for (let i = 0; i < nodeList.length; i++) {
		const node = nodeList[i];
		const nodeType = node.type[0];
		const nodeIndex = parseInt(node.arrayIndex[0], 10);
		const parentIndex = parseInt(node.parentIndex[0], 10);

		if (nodeType === "Emmiter") {
			const edata: EffectParameterObject = { isEmitter: true, parentIndex: parentIndex, userData: {} } as any;
			edata.userData.skinName = node.behavior[0].CellMapName[0].match(/(.*)\.[^.]+$/)[1];
			edata.userData.cellName = node.behavior[0].CellName[0];
			edata.userData.alphaBlendMode = node.behavior[0].BlendType[0] === "Add" ? "add" : "normal";
			edata.initParam = {} as any;

			const pdata = edata.initParam;
			const behaviors = node.behavior[0].list[0].value;
			let trans_rotation_beh: any = null;
			let trans_speed_beh: any = null;

			for (let j = 0; j < behaviors.length; j++) {
				const beh = behaviors[j];
				const behName = beh.name[0];

				if (behName === "Basic") {
					edata.maxParticles = parseInt(beh.maximumParticle[0], 10);
					edata.activePeriod = frameStr2sec(beh.lifetime[0]);
					edata.interval = frameStr2sec(beh.interval[0]);
					edata.numParticlesPerEmit = parseInt(beh.attimeCreate[0], 10);
					pdata.angle = [degStr2asaRadA((beh.angle[0]))];
					if (beh.angleVariance[0] !== "0") {
						const av2 = degStr2rad(beh.angleVariance[0]) / 2;
						pdata.angle = [pdata.angle[0] - av2, pdata.angle[0] + av2];
					}
					pdata.lifespan = toNumbers(beh.lifespan[0].$, frameStr2sec);
					pdata.v = toNumbers(beh.speed[0].$, velStr2asaVel);
				} else if (behName === "Delay") {
					edata.delayEmit = frameStr2sec(beh.DelayTime);
				} else if (behName === "init_position") {
					pdata.tx = toNumbers(beh.OffsetX[0].$);
					pdata.ty = toNumbers(beh.OffsetY[0].$).map((y) => -y);
				} else if (behName === "trans_speed") {
					trans_speed_beh = beh; // calc later.
				} else if (behName === "init_rotation") {
					pdata.rz = toNumbers(beh.Rotation[0].$, degStr2asaRadR);
					pdata.vrz = toNumbers(beh.RotationAdd[0].$, degStr2asaRadR).map(vrz => vrz * fps);
				} else if (behName === "trans_rotation") {
					trans_rotation_beh = beh; // calc later.
				} else if (behName === "Gravity") {
					const accs = beh.Gravity[0].split(" ");
					edata.gx = accStr2asaAcc(accs[0]);
					edata.gy = -accStr2asaAcc(accs[1]);
				} else if (behName === "InfiniteEmit") {
					edata.activePeriod = -1;
				}
			}

			if (trans_speed_beh) {
				pdata.a = undefined; // 実行時 最大速度 / lifetime で定まる
				pdata.v = pdata.v.map(v => v / 2); // SS6のエフェクトの計算式に合わせる
				pdata.tv = toNumbers(trans_speed_beh.Speed[0].$, velStr2asaVel);
				pdata.tvNTOA = [1.0];
			}
			if (trans_rotation_beh) {
				pdata.arz = undefined;
				pdata.tvrz = undefined;
				pdata.tvrzC = [parseFloat(trans_rotation_beh.RotationFactor[0])];
				pdata.tvrzNTOA = [parseFloat(trans_rotation_beh.EndLifeTimePer[0]) / 100];
			}

			list[nodeIndex] = edata;
		} else if (nodeType === "Particle") {
			list[nodeIndex] = { parentIndex: parentIndex };
		} else {
			list[nodeIndex] = { parentIndex: parentIndex };
		}
	}

	for (let i = 0; i < list.length; i++) {
		if (list[i].isEmitter) {
			continue;
		}
		for (let j = i + 1; j < list.length; j++) {
			if (list[j].parentIndex === i) {
				list[j].parentIndex = list[i].parentIndex;
			} else if (list[j].parentIndex > i) {
				--list[j].parentIndex;
			}
		}
		list.splice(i, 1);
		i--;
	}

	list.forEach((l) => delete l.isEmitter);

	const effect: vfx.EffectParameterObject = {
		name: data.SpriteStudioEffect.name[0],
		emitterParameters: list as vfx.EmitterParameterObject[]
	};

	proj.effects.push(effect);
}

function createColliderInfo(boundsType: string): ColliderInfo {
	let info: ColliderInfo;

	// SpriteStudioの "quad" は自由変形するが、ASAでは直方体のみを扱う
	switch (boundsType) {
		case "aabb":        info = { geometryType: "cell",   boundType: "aabb" };                        break;
		case "quad":        info = { geometryType: "cell",   boundType: "box" };                         break;
		case "circle":      info = { geometryType: "circle", boundType: "circle", scaleOption: "none" }; break;
		case "circle_smin": info = { geometryType: "circle", boundType: "circle", scaleOption: "min" };  break;
		case "circle_smax": info = { geometryType: "circle", boundType: "circle", scaleOption: "max" };  break;
		case "none":        info = undefined;                                                            break;
		default: throw Error("Unknown boundary type: " + boundsType);
	}

	return info;
}

function propagateShowFlag(bones: Bone[]): void {
	bones.forEach((bone: Bone) => {
		const targetBone = <any>bone;
		while (bone.parentIndex !== -1) {
			bone = bones[bone.parentIndex];
			if (! (<any>bone).tmp.show) {
				targetBone.tmp.show = false;
				break;
			}
		}
	});
}

function loadBonesFromSSModels(models: any[]): Bone[] {
	const bones: Bone[] = [];

	// xml2jsがArrayの形に変換するが、ssaeあたりmodelは１つのみのはず
	for (let i = 0; i < models.length; i++) { // model loop
		const model: any = models[i];
		for (let j = 0; j < model.partList.length; j++) { // part loop
			const part: any = model.partList[j];
			for (let k = 0; k < part.value.length; k++) {
				const v = part.value[k];
				const bone = new Bone();
				bone.name = v.name[0];
				bone.arrayIndex = parseInt(v.arrayIndex[0], 10);
				bone.parentIndex = parseInt(v.parentIndex[0], 10);
				bone.parent = undefined;
				bone.children = undefined;
				bone.colliderInfos = [];
				bone.alphaBlendMode = exchangeAlphaBlendMode(v.alphaBlendType[0]);
				bone.effectName = v.refEffectName ? v.refEffectName[0] : undefined;

				const info = createColliderInfo(v.boundsType[0]);
				if (info) { // "アタリ判定なし" の時 undefined が返る
					bone.colliderInfos.push(info);
				}

				// テンポラリデータ。シリアライズ前に削除する
				(<any>bone).tmp = {
					type: v.type[0], // normal, null, etc...
					show: v.show[0] === "1" // フレームコントロール内の目玉ボタンの値
				};

				bones.push(bone);
			}
		}
	}

	propagateShowFlag(bones);

	return bones;
}

function exchangeAlphaBlendMode(alphaBlendType: string): AlphaBlendMode {
	switch (alphaBlendType) {
		case "mix":
			return "normal";
		case "add":
			return "add";
		default:
			return undefined;
	}
}

function loadKeyFramesAs<T>(attrType: string, keys: any[], parser: (val: any) => T): Curve<T> {
	// 正しいデータと考える。例外を投げない
	// 返り値がundefinedであることを利用者は想定すること
	if (keys === undefined) {
		return undefined;
	}

	const curve = new Curve<T>();

	curve.attribute = ssAttr2asaAttr[attrType];
	if (! curve.attribute) {
		throw Error("Unknown attribute: " + attrType);
	}

	for (let l = 0; l < keys.length; l++) {
		const key: any = keys[l];
		const keyFrame = new KeyFrame<T>();
		keyFrame.time = parseInt(key.$.time, 10);
		keyFrame.ipType = key.$.ipType; // e.g. linear, sprine,... (noneの時は undefined のはず)
		keyFrame.value = parser(key.value[0]);

		if ("curve" in key) {
			const src = key.curve[0]._.split(" ");
			keyFrame.ipCurve = new IpCurve();
			for (let m = 0; m < src.length; m++) {
				keyFrame.ipCurve.values.push(parseFloat(src[m]));
			}
		}

		const ipType = keyFrame.ipType + ""; // undefined -> "undefined"
		if (validInterpolations.indexOf(ipType) === -1) {
			throw Error("Invalid interpolation: " + keyFrame.ipType);
		}

		curve.keyFrames.push(keyFrame); // stored
	}

	return curve;
}

function getImageBaseName(data: any): string {
	return path.basename(data.SpriteStudioCellMap.imagePath[0]);
}

function loadSkin(data: any): Skin {
	const skin = new Skin();

	skin.name = data.SpriteStudioCellMap.name[0];

	const basename = getImageBaseName(data);
	const matches = basename.match(/(.*)\.[^.]+$/); // hoge.png -> ["hoge.png", "hoge"]
	skin.imageAssetName = matches ? matches[1] : basename;

	const imageSizes = data.SpriteStudioCellMap.pixelSize[0].split(" ");
	skin.imageSizeW = parseInt(imageSizes[0], 10);
	skin.imageSizeH = parseInt(imageSizes[1], 10);

	const cells = data.SpriteStudioCellMap.cells[0].cell;
	if (cells) {
		cells.forEach((src: any) => {
			const cell = new Cell();
			cell.name = src.name[0];

			const pos = src.pos[0].split(" ");
			cell.pos.x = parseFloat(pos[0]);
			cell.pos.y = parseFloat(pos[1]);

			const size = src.size[0].split(" ");
			cell.size.width = parseFloat(size[0]);
			cell.size.height = parseFloat(size[1]);

			// Cellエディタで原点を変えるとpivot[]が変化する
			// pivotは画像の中心を(0, 0)とした時の位置で、左上が(-0.5, 0.5)になる
			// アニメーションのPVTX,PVTYはこれに加算され、その値が最終的なセルの回転軸となる
			let pivot: string[];
			if (src.pivot) {
				pivot = src.pivot[0].split(" ");
			} else {
				pivot = ["0", "0"];
				console.log("[WARN] missing pivot: " + skin.name + " uses (0, 0) instead");
			}
			cell.pivot.x = parseFloat(pivot[0]);
			cell.pivot.y = parseFloat(pivot[1]);
			cell.pivot.y *= -1; // mirror. ASA v2.0.0~ では画像下方向を正とする
			cell.rz = 0; // (2015-12-21) ASAで利用されていない。一旦０に固定する

			skin.cells[cell.name] = cell;
		});
	}

	return skin;
}

// SpriteStudioのデータ(XML)をJSONにすると、bool値は "0" or "1" の文字列で表される
function parseBoolean(val: any): boolean {
	return val !== "0";
}

function mirrorCurve(curve: Curve<any>): void {
	if (curve.attribute === "rz" || curve.attribute === "ty" || curve.attribute === "pvty") {
		curve.keyFrames.forEach((keyFrame: KeyFrame<any>) => {
			keyFrame.value *= -1;
		});
	}
}

function str2numbers(str: string): number[] {
	const strs = str.split(" ");
	const nums: number[] = [];
	for (let i = 0; i < strs.length; i++) {
		nums[i] = Number(strs[i]);
	}
	return nums;
}

function addLabelsAsUserData(labels: any[], curveTie: CurveTie): void {
	let curve: Curve<any>;
	for (let i = 0; i < curveTie.curves.length; i++) {
		if (curveTie.curves[i].attribute === ssAttr2asaAttr.USER) {
			curve = curveTie.curves[i];
			break;
		}
	}

	if (! curve) {
		curve = new Curve<any>();
		curve.attribute = ssAttr2asaAttr.USER;
		curveTie.curves.push(curve);
	}

	let isKeyFrameAdded = false;
	for (let i = 0; i < labels.length; i++) {
		const name = labels[i].name[0];
		const time = Number(labels[i].time[0]);

		let found = false;
		for (let j = 0; j < curve.keyFrames.length; j++) {
			const keyFrame = curve.keyFrames[j];
			if (keyFrame.time === time) {
				keyFrame.value.label = name;
				found = true;
				break;
			}
		}

		if (! found) {
			const keyFrame = new KeyFrame<any>();
			keyFrame.time = time;
			keyFrame.value = {label: name};
			curve.keyFrames.push(keyFrame);
			isKeyFrameAdded = true;
		}
	}

	if (isKeyFrameAdded) {
		curve.keyFrames = curve.keyFrames.sort((a: KeyFrame<any>, b: KeyFrame<any>) => {
			return a.time - b.time;
		});
	}
}

/*
 * SpriteStudioのアニメーションデータからASAの対応するアニメーションへインポートする
 */
function importLabelsFromSSAnimeList(ssAnimeList: any[], animations: Animation[], rootBoneName: string): void {
	for (let i = 0; i < ssAnimeList.length; i++) {
		const anime = ssAnimeList[i];
		const labels: any[] = anime.labels[0].value;
		if (! labels || labels.length === 0) {
			continue;
		}

		for (let j = 0; j < animations.length; j++) {
			const animation = animations[j];
			if (animation.name === anime.name[0]) {
				addLabelsAsUserData(labels, animation.curveTies[rootBoneName]);
				break;
			}
		}
	}
}

function loadKeyFrames(attrType: string, keys: any[], skinNames: string[], outputUserData: boolean): Curve<any> {
	let curve: Curve<any> = undefined;

	switch (attrType) {
	case "CELL":
		curve = loadKeyFramesAs<CellValue>(attrType, keys, (val: any): CellValue => {
			const cellValue = new CellValue();
			cellValue.skinName = skinNames[parseInt(val.mapId[0], 10)];
			cellValue.cellName = val.name[0];
			return cellValue;
		});
		break;
	case "HIDE":
		curve = loadKeyFramesAs<boolean>(attrType, keys, (val: string): boolean => {
			return !parseBoolean(val); // trueの時表示としたいので逆転
		});
		break;
	case "IFLH":
	case "IFLV":
	case "FLPH":
	case "FLPV":
		curve = loadKeyFramesAs<boolean>(attrType, keys, parseBoolean);
		break;
	case "USER":
		if (! outputUserData) {
			break;
		}
		curve = loadKeyFramesAs<any>(attrType, keys, (val: any): any => {
			const result: UserData = {};
			result.num   = val.integer ? Number(val.integer[0])    : undefined;
			result.point = val.point   ? str2numbers(val.point[0]) : undefined;
			result.rect  = val.rect    ? str2numbers(val.rect[0])  : undefined;
			result.str   = val.string  ? val.string[0]             : undefined;
			return result;
		});
		break;
	case "EFCT":
		curve = loadKeyFramesAs<vfx.EffectValue>(attrType, keys, (val: any): vfx.EffectValue => {
			return {
				emitterOp: val.independent[0] === "0" ? vfx.EmitterOperation.start : vfx.EmitterOperation.stop
			};
		});
		break;
	default:
		curve = loadKeyFramesAs<number>(attrType, keys, parseFloat);
		break;
	}

	return curve;
}

function convertSSAnime(ssAnime: any, skinNames: string[], outputUserData: boolean): Animation {
	const dstAnime = new Animation();
	dstAnime.name = ssAnime.name[0];
	dstAnime.fps = parseInt(ssAnime.settings[0].fps[0], 10);
	dstAnime.frameCount = parseInt(ssAnime.settings[0].frameCount[0], 10);

	const partAnimes: any[] = ssAnime.partAnimes[0].partAnime;
	for (let j = 0; j < partAnimes.length; j++) {
		const partAnime = partAnimes[j]; // これがボーンあたりのアニメーション

		const curveTie = new CurveTie();
		curveTie.boneName = partAnime.partName[0];

		const attributes: any[] = partAnime.attributes[0].attribute; // 属性それぞれにアニメーションカーブがある

		try {
			for (let k = 0; k < attributes.length; k++) {
				const attribute: any = attributes[k];
				const keys: any[] = attribute.key;
				const attrType: string = attribute.$.tag; // e.g. POSX, POSY, ...

				const curve = loadKeyFrames(attrType, keys, skinNames, outputUserData);
				if (curve) {
					mirrorCurve(curve);
					curveTie.curves.push(curve); // stored
				}
			}
		} catch (e) {
			throw new Error(
				"Could not load animation(" + dstAnime.name + ") key frames for " + curveTie.boneName + " bone " +
				"because of the exception " + e.name + "(\"" + e.message + "\")"
			);
		}

		dstAnime.curveTies[curveTie.boneName] = curveTie; // stored
	}

	return dstAnime;
}

function loadAnimationsFromSSAnimeList(ssAnimeList: any[], skinNames: string[], outputUserData: boolean): Animation[] {
	const animations: Animation[] = [];
	for (let i = 0; i < ssAnimeList.length; i++) {
		const ssAnime = ssAnimeList[i];
		// akashic-animationでセットアップデータは利用しないので、セットアップデータは取得しないようにする
		if (ssAnime.isSetup && ssAnime.isSetup[0] === "1") {
			continue;
		}
		const anime = convertSSAnime(ssAnime, skinNames, outputUserData);
		animations.push(anime);
	}

	return animations;
}
