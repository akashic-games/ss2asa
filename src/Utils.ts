import fs = require("fs");
import xml2js = require("xml2js");

export function loadXmlAsJsAsync(fname: string, callback: (err: any, result: any) => void): void {
	console.log("*** loadXmlAsJsAsync start", fname);
	fs.readFile(fname, {encoding: "utf8"}, (err: Error, data: string) => {
		console.log("*** loadXmlAsJsAsync readFile");
		if (! err) {
			console.log("*** loadXmlAsJsAsync done");
			const parser = new xml2js.Parser();
			parser.parseString(data, (err: any, result: any) => {
				callback(err, result);
			});
		} else {
			console.log("*** loadXmlAsJsAsync err");
			callback(err, data);
		}
	});
}

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
