var g = require("@akashic/akashic-engine");
global.g = g;
var path = require("path");
var U = require("../lib/Utils.js");
var SS = require("../lib/SpriteStudio.js");

// 非同期読み込み `U.loadXmlAsJsAsync()` を promise 化
function loadXmlPromise(fname) {
	var promise = new Promise(function (resolve, reject) {
		U.loadXmlAsJsAsync(fname, function(err, result) {
			if (! err) {
				resolve(result);
			} else {
				reject(err);
			}
		});
	});

	return promise;
}

function loadProjectPromise(fname) {
	var pathToProj = path.dirname(fname);

	var promise = loadXmlPromise(fname)
	.then(function(result) {
		var fset = SS.createRelatedFileSetFromSSPJ(result);
		var allFiles = fset.ssaeFileNames.concat(fset.ssceFileNames);
		var promises = allFiles.map(function(fname) {
			fname = path.join(pathToProj, fname);
			var r = loadXmlPromise(fname);
			return r;
		});
		return Promise.all(promises);
	})
	.catch(function(err) {
		console.log(err.stack);
		return Promise.reject(new Error(err));
	});

	return promise;
}

function loadProject(projFileName, onFulfilled, onRejected) {
	var proj = new SS.Project();
	proj.name = path.basename(projFileName, ".sspj");

	var promise = loadProjectPromise(projFileName);
	promise.then(function(results) {
		onFulfilled({ proj: proj, contents: results });
	}).catch(function(err) {
		onRejected(err);
	});
}

function findAnimation(proj, name) {
	for (var i = 0; i < proj.animations.length; i++) {
		var a = proj.animations[i];
		if (a.name === name) {
			return a;
		}
	}
	return undefined;
}

describe("SpriteStudio.", function () {

	describe("createRelatedFileSetFromSSPJ", function() {
		it("should return RelatedFileSet object constructed properly", function() {
			var r = SS.createRelatedFileSetFromSSPJ({
				SpriteStudioProject: {
					cellmapNames: [{value: ["file.ssce"] }],
					animepackNames: [{value: ["file.ssae"] }]
				}
			});
			expect(r.ssceFileNames[0]).toBe("file.ssce");
			expect(r.ssaeFileNames[0]).toBe("file.ssae");
		});
	});

	describe("loadFromSSAE(stickman.sspj)", function() {
		var proj;
		var contents;

		beforeEach(function (done) {
			loadProject(
				"spec/project/Stickman/stickman.sspj",
				function(result) {
					proj = result.proj;
					contents = result.contents;
					done();
				},
				function(err) {
					done.fail("failed to load project");
				}
			);
		});

		it("can load project and others", function() {
			expect(proj).toBeDefined();
			expect(contents).toBeDefined();
		});

		it("can load ssae and ssce", function() {
			expect(function() {
				contents.forEach(function(content) {
					if ("SpriteStudioAnimePack" in content) {
						SS.loadFromSSAE(proj, content, {asaanLongName: true});
					} else {
						SS.loadFromSSCE(proj, content);
					}
				});
			}).not.toThrow();
		});

		it("should remove tmp popperty from bones", function() {
			contents.filter(function(content) {
				return "SpriteStudioAnimePack" in content;
			}).forEach(function(content) {
				SS.loadFromSSAE(proj, content, {asaanLongName: true});
				proj.boneSets.forEach(function(boneSet) {
					boneSet.bones.forEach(function(bone) {
						expect(bone.tmp).toBeUndefined();
					});
				});
			});
		});
	});

	describe("loadFromSSAE(instance.sspj)", function() {
		var proj;
		var contents;

		beforeEach(function (done) {
			loadProject(
				"spec/project/Instance/instance.sspj",
				function(result) {
					proj = result.proj;
					contents = result.contents;
					done();
				},
				function(err) {
					done.fail("failed to load project");
				}
			);
		});

		it("can load project and others", function() {
			expect(proj).toBeDefined();
			expect(contents).toBeDefined();
		});

		it("should skip instance anime", function() {
			contents.forEach(function(content) {
				if ("SpriteStudioAnimePack" in content) {
					SS.loadFromSSAE(proj, content, {asaanLongName: true});
				}
			});
			// ２つのアニメのうち、instanceでない方のみロードされる
			expect(proj.boneSets.length).toBe(1);
			expect(proj.animations[0].name).toBe("head_anime_1");
		});

		it("should give long name to animation if requested", function() {
			contents.forEach(function(content) {
				if ("SpriteStudioAnimePack" in content) {
					SS.loadFromSSAE(proj, content, {asaanLongName: true});
				}
			});
			expect(proj.animations[0].name).toBe("head_anime_1");
		});
	});

	describe("loadFromSSAE(UnsupportedAttribute.sspj)", function() {
		var proj;
		var contents;

		beforeEach(function (done) {
			loadProject(
				"spec/project/UnsupportedAttribute/UnsupportedAttribute.sspj",
				function(result) {
					proj = result.proj;
					contents = result.contents;
					done();
				},
				function(err) {
					done.fail("failed to load project");
				}
			);
		});

		it("can load project and others", function() {
			expect(proj).toBeDefined();
			expect(contents).toBeDefined();
		});

		it("should throw an exception if animation has unsupported attributes", function() {
			expect(function() {
				contents.forEach(function(content) {
					if ("SpriteStudioAnimePack" in content) {
						SS.loadFromSSAE(proj, content, {asaanLongName: true});
					}
				});
			}).toThrow();
		});
	});

	describe("loadFromSSAE(UnsupportedInterpolation.sspj)", function() {
		var proj;
		var contents;

		beforeEach(function (done) {
			loadProject(
				"spec/project/UnsupportedInterpolation/UnsupportedInterpolation.sspj",
				function(result) {
					proj = result.proj;
					contents = result.contents;
					done();
				},
				function(err) {
					done.fail("failed to load project");
				}
			);
		});

		it("can load project and others", function() {
			expect(proj).toBeDefined();
			expect(contents).toBeDefined();
		});

		it("should throw an exception if animation has unsupported interpolation", function() {
			expect(function() {
				contents.forEach(function(content) {
					if ("SpriteStudioAnimePack" in content) {
						SS.loadFromSSAE(proj, content, {asaanLongName: true});
					}
				});
			}).toThrow();
		});
	});

	describe("loadFromSSAE(NoCellmap.sspj)", function() {
		var proj;
		var contents;

		beforeEach(function (done) {
			loadProject(
				"spec/project/NoCellmap/NoCellmap.sspj",
				function(result) {
					proj = result.proj;
					contents = result.contents;
					done();
				},
				function(err) {
					done.fail("failed to load project");
				}
			);
		});

		it("can load project and others", function() {
			expect(proj).toBeDefined();
			expect(contents).toBeDefined();
		});

		it("should have no skin", function() {
			contents.forEach(function(content) {
				if ("SpriteStudioAnimePack" in content) {
					SS.loadFromSSAE(proj, content, {asaanLongName: true});
				} else {
					SS.loadFromSSCE(proj, content);
				}
			});
			expect(proj.skins.length).toBe(0);
		});
	});

	describe("loadFromSSAE(NoAnimation.sspj)", function() {
		var proj;
		var contents;

		beforeEach(function (done) {
			loadProject(
				"spec/project/NoAnimation/NoAnimation.sspj",
				function(result) {
					proj = result.proj;
					contents = result.contents;
					done();
				},
				function(err) {
					done.fail("failed to load project");
				}
			);
		});

		it("can load project and others", function() {
			expect(proj).toBeDefined();
			expect(contents).toBeDefined();
		});

		it("should have no animation if there's no ssce file", function() {
			contents.forEach(function(content) {
				if ("SpriteStudioAnimePack" in content) {
					SS.loadFromSSAE(proj, content, {asaanLongName: true});
				} else {
					SS.loadFromSSCE(proj, content);
				}
			});
			expect(proj.animations.length).toBe(0);
		});
	});

	describe("loadFromSSAE(Empty.sspj)", function() {
		var proj;
		var contents;

		beforeEach(function (done) {
			loadProject(
				"spec/project/Empty/Empty.sspj",
				function(result) {
					proj = result.proj;
					contents = result.contents;
					done();
				},
				function(err) {
					done.fail("failed to load project");
				}
			);
		});

		it("can load project and others", function() {
			expect(proj).toBeDefined();
			expect(contents).toBeDefined();
			expect(contents instanceof Array).toBeDefined();
			expect(contents.length).toBe(0);
		});

		it("shouldn't have any data", function() {
			contents.forEach(function(content) {
				if ("SpriteStudioAnimePack" in content) {
					SS.loadFromSSAE(proj, content, {asaanLongName: true});
				} else {
					SS.loadFromSSCE(proj, content);
				}
			});
			expect(proj.skins.length).toBe(0);
			expect(proj.boneSets.length).toBe(0);
			expect(proj.animations.length).toBe(0);
		});
	});

	describe("loadFromSSAE(UserData.sspj)", function() {
		var proj;
		var contents;

		beforeEach(function (done) {
			loadProject(
				"spec/project/UserData/UserData.sspj",
				function(result) {
					proj = result.proj;
					contents = result.contents;
					done();
				},
				function(err) {
					done.fail("failed to load project");
				}
			);
		});

		it("can load project and others", function() {
			expect(proj).toBeDefined();
			expect(contents).toBeDefined();
		});

		it("can load ssae", function() {
			expect(function() {
				contents.forEach(function(content) {
					if ("SpriteStudioAnimePack" in content) {
						SS.loadFromSSAE(proj, content, {asaanLongName: true});
					}
				});
			}).not.toThrow();
		});

		it("should initialize Skin#imageAssetName", function() {
			expect(function() {
				contents.forEach(function(content) {
					if (! ("SpriteStudioAnimePack" in content)) {
						SS.loadFromSSCE(proj, content);
						expect(proj.skins[0].imageAssetName).toEqual("dummy");
						expect(proj.skins[0].name).toEqual("uzumaki");
					}
				});
			}).not.toThrow();
		});

		it("should output user data when required", function() {
			contents.forEach(function(content) {
				if ("SpriteStudioAnimePack" in content) {
					SS.loadFromSSAE(proj, content, {asaanLongName: true, outputUserData: true});

					var curves = proj.animations[0].curveTies["uzu_parts"].curves;
					var userData;
					for (var i = 0; i < curves.length; i++) {
						if (curves[i].attribute === "userData") {
							userData = curves[i].keyFrames[0].value;
						}
					}

					expect(userData).toBeDefined();
					expect(userData.num).toBe(123);
					expect(userData.rect).toEqual([1, 2, 3, 4]);
					expect(userData.point).toEqual([100, 200]);
					expect(userData.str).toEqual("Don't want geeks and opinions.");
				}
			});
		});

		it("should not output user data when not required", function() {
			contents.forEach(function(content) {
				if ("SpriteStudioAnimePack" in content) {
					SS.loadFromSSAE(proj, content, {asaanLongName: true});

					var curves = proj.animations[0].curveTies["uzu_parts"].curves;
					for (var i = 0; i < curves.length; i++) {
						expect(curves[i].attribute).not.toEqual("userData");
					}
				}
			});
		});
	});

	describe("loadFromSSAE(Label.sspj)", function() {
		var proj;
		var contents;

		beforeEach(function (done) {
			loadProject(
				"spec/project/Label/Label.sspj",
				function(result) {
					proj = result.proj;
					contents = result.contents;
					done();
				},
				function(err) {
					done.fail("failed to load project");
				}
			);
		});

		it("should output label as user data from anime_1 when required", function() {
			contents.forEach(function(content) {
				if ("SpriteStudioAnimePack" in content) {
					// ラベルのユーザデータ化の中で名前を利用している。ロングネーム化と併用して問題がないことを確認する
					SS.loadFromSSAE(proj, content, {outputUserData: true, labelAsUserData: true, asaanLongName: true});

					var anime = findAnimation(proj, "havinglabel_anime_1");
					expect(anime).toBeDefined();

					var curve;
					var curves = anime.curveTies["root"].curves;
					for (var i = 0; i < curves.length; i++) {
						if (curves[i].attribute === "userData") {
							curve = curves[i];
							break;
						}
					}

					expect(curve).toBeDefined();
					expect(curve.keyFrames.length).toBe(2);

					var key1 = curve.keyFrames[0];
					expect(key1.time).toBe(0);
					expect(key1.value).toBeDefined();
					expect(key1.value.label).toEqual("label00");
					expect(key1.value.str).toEqual("Don't worry about nothing going.");

					var key2 = curve.keyFrames[1];
					expect(key2.time).toBe(5);
					expect(key2.value).toBeDefined();
					expect(key2.value.label).toEqual("label01");
				}
			});
		});

		it("should output label as user data from anime_2 inserting new curve when required", function() {
			contents.forEach(function(content) {
				if ("SpriteStudioAnimePack" in content) {
					SS.loadFromSSAE(proj, content, {outputUserData: true, labelAsUserData: true});

					var anime = findAnimation(proj, "anime_2");
					expect(anime).toBeDefined();

					var curve;
					var curves = anime.curveTies["root"].curves;
					for (var i = 0; i < curves.length; i++) {
						if (curves[i].attribute === "userData") {
							curve = curves[i];
							break;
						}
					}

					expect(curve).toBeDefined();
					expect(curve.keyFrames.length).toBe(1);

					var key = curve.keyFrames[0];
					expect(key.time).toBe(5);
					expect(key.value).toBeDefined();
					expect(key.value.label).toEqual("label01");
				}
			});
		});
	});

	describe("loadFromSSAE(NoCurve.sspj)", function() {
		var proj;
		var contents;

		beforeEach(function (done) {
			loadProject(
				"spec/project/NoCurve/NoCurve.sspj",
				function(result) {
					proj = result.proj;
					contents = result.contents;
					done();
				},
				function(err) {
					done.fail("failed to load project");
				}
			);
		});

		it("can load project and others", function() {
			expect(proj).toBeDefined();
			expect(contents).toBeDefined();
		});

		it("can load ssae and ssce", function() {
			expect(function() {
				contents.forEach(function(content) {
					if ("SpriteStudioAnimePack" in content) {
						SS.loadFromSSAE(proj, content, {asaanLongName: true});
					} else {
						SS.loadFromSSCE(proj, content);
					}
				});
			}).not.toThrow();
		});
	});

	describe("loadFromSSAE(sticktwin.sspj)", function() {
		var proj;
		var contents;

		beforeEach(function (done) {
			loadProject(
				"spec/project/Sticktwin/sticktwin.sspj",
				function(result) {
					proj = result.proj;
					contents = result.contents;
					done();
				},
				function(err) {
					done.fail("failed to load project");
				}
			);
		});

		it("should output combination info into project", function() {
			expect(function() {
				contents.forEach(function(content) {
					if ("SpriteStudioAnimePack" in content) {
						SS.loadFromSSAE(proj, content, {asaanLongName: true, outputComboInfo: true});
					} else {
						SS.loadFromSSCE(proj, content);
					}
				});
			}).not.toThrow();

			expect(proj.userData.combinationInfo).toEqual([
				{
					"boneName":"stickgirl",
					"animationNames":["stickgirl_anime_1"],
					"skinNames":["stickman","stickgirl"]
				},
				{
					"boneName":"stickman",
					"animationNames":["stickman_anime_1","stickman_anime_1_bezier","stickman_anime_1_liner"],
					"skinNames":["stickman"]
				}
			]);
		});
	});

	describe("loadFromSSAE(HiddenParts.sspj)", function() {
		var proj;
		var contents;

		beforeEach(function (done) {
			loadProject(
				"spec/project/HiddenParts/HiddenParts.sspj",
				function(result) {
					proj = result.proj;
					contents = result.contents;
					done();
				},
				function(err) {
					done.fail("failed to load project");
				}
			);
		});

		it("can load project and others", function() {
			expect(proj).toBeDefined();
			expect(contents).toBeDefined();
		});

		it("can load ssae and ssce with asaanLongName and deleteHidden options", function() {
			expect(function() {
				contents.forEach(function(content) {
					if ("SpriteStudioAnimePack" in content) {
						SS.loadFromSSAE(proj, content, {asaanLongName: true, deleteHidden: true});
					} else {
						SS.loadFromSSCE(proj, content);
					}
				});
			}).not.toThrow();
		});
	});
});
