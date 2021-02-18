var Utils = require("../lib/Utils.js");

describe("Utils.", function () {

	describe("loadXmlAsJsAsync", function() {
		it("can load an xml file and then return it in json", function(done) {
			Utils.loadXmlAsJsAsync("./spec/support/src.xml", function(err, result) {
				expect(err).toBeFalsy();
				expect(result.SpriteStudioProject.name[0]).toBe("pl00_all_motion");
				done(); // 非同期処理はこのようにして終了を伝える
			});
		});
	});
});
