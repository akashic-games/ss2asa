// var mockfs = require("mock-fs");
var Utils = require("../lib/Utils.js");

// var fs = require("fs");
// // auto-mock fs
// jest.mock("fs");

describe("Utils.", function () {

	afterEach(function () {
		mockfs.restore();
	});

	describe("loadXmlAsJsAsync", function() {
		it("can load an xml file and then return it in json", function(done) {
			// mockfs({
			// 	"src.xml": "<?xml version=\"1.0\" encoding=\"utf-8\" standalone=\"yes\"?><SpriteStudioProject version=\"1.02.00\"><name>pl00_all_motion</name></SpriteStudioProject>"
			// });
			// jest.mock("fs", () => {
			// 	return {
			// 		readFile: jest.fn((path, opt, cb) => {
			// 			cb(null, "<?xml version=\"1.0\" encoding=\"utf-8\" standalone=\"yes\"?><SpriteStudioProject version=\"1.02.00\"><name>pl00_all_motion</name></SpriteStudioProject>");
			// 		})
			// 	};
			// });

			Utils.loadXmlAsJsAsync("./spec/support/src.xml", function(err, result) {
				console.log("**err", err);
				expect(err).toBeFalsy();
				expect(result.SpriteStudioProject.name[0]).toBe("pl00_all_motion");
				done(); // 非同期処理はこのようにして終了を伝える
			});
		});
	});
});
