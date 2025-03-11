import fs = require("fs");
import xml2js = require("xml2js");

/**
 * XMLファイルをロードしてオブジェクトに変換する。
 *
 * @param fname xmlファイル名
 * @returns オブジェクトまたはnullを返すプロミス
 */
export function loadXMLFileAsyncPromise(fname: string): Promise<Record<string, any>> {
	return new Promise((resolve, reject) => {
		fs.readFile(fname, { encoding: "utf8" }, (err, data) => {
			if (err) {
				reject(err);
				return;
			}
			const parser = new xml2js.Parser();
			parser.parseString(data, (err, result) => {
				if (err) {
					reject(err);
					return;
				}
				resolve(result);
			});
		});
	});
};


export class Logger {
	log: (...args: any[]) => void;

	constructor(isEnabled: boolean) {
		if (isEnabled) {
			this.log = (...args: any[]) => {
				console.log.apply(console, args);
			};
		} else {
			this.log = (..._args: any[]) => { /* nothing to do */ };
		}
	}
}

function notUndefinedKeys(obj: any): string[] {
	const keys = Object.keys(obj);
	const result: string[] = [];

	for (const key of keys) {
		if (obj[key] !== undefined) {
			result.push(key);
		}
	}

	return result;
}

// based on https://github.com/epoberezkin/fast-deep-equal
function _deepEqual(a: any, b: any, info: any[]): boolean {
	if (a === b) return true;

	if (a && b && typeof a == "object" && typeof b == "object") {
		// コンストラクタを比較しない。プロパティが一致していれば同一とみなす。
		// TODO: Bone クラスなどを interface に変更することを検討する
		// if (a.constructor !== b.constructor) {
		// 	info.push("a is " + a.constructor.name + ", b is " + b.constructor.name);
		// 	return false;
		// }

		let length, i;
		if (Array.isArray(a)) {
			length = a.length;
			if (length !== b.length) {
				info.push("a.length=" + a.length + ", b.length=" + b.length);
				return false;
			}
			for (i = length; i-- !== 0;) {
				info.push(i);
				if (!_deepEqual(a[i], b[i], info)) {
					return false;
				}
				info.pop();
			}
			return true;
		}

		if (a.constructor === RegExp) {
			const result = a.source === b.source && a.flags === b.flags;
			if (result) {
				return true;
			}
			info.push("a.source=" + a.source + ", b.source=" + b.source + ", a.flags=" + a.flags + ", b.flags=" + b.flags);
			return false;
		}
		if (a.valueOf !== Object.prototype.valueOf) {
			const result = a.valueOf() === b.valueOf();
			if (result) {
				return true;
			}
			info.push("a.valueOf()=" + a.valueOf() + ", b.valueOf()=" + b.valueOf());
			return false;
		}
		if (a.toString !== Object.prototype.toString) {
			const result = a.toString() === b.toString();
			if (result) {
				return true;
			}
			info.push("a.toString()=" + a.toString() + ", b.toString()=" + b.toString());
			return false;
		}

		// undefined を持つプロパティは比較しない。つまり、一方にあるプロパティ
		// の値が undefined でもう一方にはそのプロパティが存在しないこと、を
		// 許容する
		const aKeys = notUndefinedKeys(a);
		const bKeys = notUndefinedKeys(b);
		if (aKeys.length !== bKeys.length) {
			info.push(
				"a.keys=[" + aKeys.sort().join(",") + "]" + ", " +
				"b.keys=[" + bKeys.sort().join(",") + "]"
			);
			return false;
		}
		const keys = aKeys;
		length = aKeys.length;

		for (i = length; i-- !== 0;) {
			info.push(keys[i]);
			if (!Object.prototype.hasOwnProperty.call(b, keys[i])) {
				info.push("b does not have key " + keys[i]);
				return false;
			}
			info.pop();
		}

		for (i = length; i-- !== 0;) {
			const key = keys[i];
			info.push(key);
			if (!_deepEqual(a[key], b[key], info)) {
				return false;
			}
			info.pop();
		}

		return true;
	}

	// true if both NaN, false otherwise
	return a !== a && b !== b;
}

/**
 * オブジェクトを比較する
 *
 * 値が undefined のプロパティは比較しない。
 *
 * @param a オブジェクト
 * @param b オブジェクト
 * @returns オブジェクトが一致した時、真。一致しなかった時、一致しなかったプロパティのパスと詳細の文字列
 */
export function deepEqual(a: any, b: any): true | string {
	const info: any[] = [];

	const result = _deepEqual(a, b, info);

	if (result) {
		return true;
	}

	const detail = info.pop();

	return info.join(".") + " (" + detail + ")";
}
