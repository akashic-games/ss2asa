var Utils = require("../lib/Utils.js");

describe("Utils.", () => {
	describe("loadXmlAsJsAsync", () => {
		it("can load an xml file and then return an object", () =>
			Utils.loadXMLFileAsyncPromise("./spec/support/src.xml")
				.then(result => {
					expect(result.SpriteStudioProject.name[0]).toBe("pl00_all_motion");
				})
		);
	});
});
