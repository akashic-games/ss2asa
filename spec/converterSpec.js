var C = require("../lib/converter.js");

describe("converter.", function () {
	describe("createRelatedFileInfo()", function() {
		it("should return related file info object constructed properly", function() {
			var asapj = {
				boneSetFileNames: ["hoge.asabn"],
				skinFileNames: ["hoge.asask"],
				animationFileNames: ["hoge.asaan"],
			};
			var imageFileNames = ["hoge.png"];

			var r = new C.RelatedFileInfo(imageFileNames, asapj);

			expect(JSON.stringify(r)).toBe(JSON.stringify({
				boneSetFileNames: ["hoge.asabn"],
				skinFileNames: ["hoge.asask"],
				animationFileNames: ["hoge.asaan"],
				imageFileNames: ["hoge.png"]
			}));
		});
	});
});
