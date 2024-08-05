var fs = require("fs-extra");
var path = require("path");
var C = require("../lib/converter.js");

describe("converter.", function () {

	describe("convert()", function () {
		it("can bundle all assets into the asapj file", function (done) {
			spyOn(fs, "writeFileSync").and.callFake(function(_filename, str) {
				var json = JSON.parse(str);
				expect(json.version).toBe("3.0.0");
				expect(json.type).toBe("bundle");
				expect(json.contents.length).toBe(4); // project + animation + bone + skin

				var project = json.contents.find(content => content.type === "project");
				expect(project.name).toBe("SupportAlphaBlend");
				expect(project.data).toBeDefined();

				var animation = json.contents.find(content => content.type === "animation");
				expect(animation.name).toBe("support_alpha_blend");
				expect(animation.data).toBeDefined();

				var bone = json.contents.find(content => content.type === "bone");
				expect(bone.name).toBe("SupportAlphaBlend");
				expect(bone.data).toBeDefined();

				var skin = json.contents.find(content => content.type === "skin");
				expect(skin.name).toBe("SupportAlphaBlend");
				expect(skin.data).toBeDefined();

				done();
			});

			C.convert({
				projFileName: path.join(__dirname, "..", "spec", "project", "SupportAlphaBlend", "SupportAlphaBlend.sspj"),
				outDir: "dummy",
				addPrefix: true,
				prefixes: ["","","","",""],
				bundleAll: true
			});
		});
	});
});
