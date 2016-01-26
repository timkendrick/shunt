'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');
var async = require('async');
var del = require('del');
var mkdirp = require('mkdirp');
var copy = require('recursive-copy');
var imagemagick = require('imagemagick-stream');
var webshot = require('webshot');
var express = require('express');

var constants = require('../../../src/constants');
var ThemeService = require('../../../src/services/ThemeService');

var THEME_PREVIEW_FILES_PATH = constants.THEME_PREVIEW_FILES_PATH;
var THEME_THUMBNAIL_DEFAULT = constants.THEME_THUMBNAIL_DEFAULT;
var THEME_ASSETS_PATH = 'assets';
var THEME_MANIFEST_PATH = 'theme.json';
var THEME_TEMPLATES_PATH = 'templates';

var OUTPUT_PREVIEW_PATH = 'preview';
var OUTPUT_THUMBNAIL_PATH = 'thumbnail.png';

var PREVIEW_TEMPLATE_ID = 'index';
var PREVIEW_PAGE_FILENAME = 'index.html';
var PREVIEW_DOWNLOADS_PATH = 'download';
var PREVIEW_THUMBNAILS_PATH = 'thumbnail';
var PREVIEW_MEDIA_PATH = 'media';
var PREVIEW_ASSETS_PATH = 'assets';


var THUMBNAIL_EXTENSIONS = [
	'.jpg',
	'.jpeg',
	'.gif',
	'.png'
];

module.exports = function(inputPath, outputPath, options, callback) {
	if ((arguments.length === 3) && (typeof options === 'function')) {
		callback = options;
		options = null;
	}
	options = options || {};
	var log = options.log || function(message) { };

	var previewFilesPath = path.join(inputPath, THEME_PREVIEW_FILES_PATH);
	var themeAssetsPath = path.join(inputPath, THEME_ASSETS_PATH);
	var inputThumbnailPath = path.join(inputPath, THEME_THUMBNAIL_DEFAULT);
	var outputPreviewPath = path.join(outputPath, OUTPUT_PREVIEW_PATH);
	var outputThumbnailPath = path.join(outputPath, OUTPUT_THUMBNAIL_PATH);
	var previewTemplateId = PREVIEW_TEMPLATE_ID;

	var themeService = new ThemeService();
	log('Loading theme configuration...');
	var theme;
	try {
		theme = loadTheme(inputPath);
	} catch(error) {
		process.nextTick(function() {
			callback(error);
		});
		return;
	}
	log('Validating theme configuration...');
	var validationErrors = getThemeValidationErrors(theme);
	if (validationErrors && (validationErrors.length > 0)) {
		process.nextTick(function() {
			var combinedErrorMessage = validationErrors.map(function(error) { return '- ' + error.message; }).join('\n');
			var error = new Error('Validation failed:\n' + combinedErrorMessage);
			callback(error);
		});
		return;
	}
	log('Generating theme preview page...');
	generateThemePreviewPage(theme, previewTemplateId, function(error, previewHtml) {
		if (error) { return callback(error); }
		log('Creating output directory at ' + outputPreviewPath);
		createDirectory(outputPreviewPath, function(error) {
			if (error) { return callback(error); }
			log('Copying preview site files to ' + outputPreviewPath);
			savePreviewSite(previewHtml, previewFilesPath, themeAssetsPath, outputPreviewPath, function(error) {
				if (error) { return callback(error); }
				log('Adding site thumbnail...');
				createSiteThumbnail(inputThumbnailPath, outputPreviewPath, outputThumbnailPath, function(error) {
					if (error) { return callback(error); }
					log('Copying theme files to ' + outputPath);
					copyThemeFiles(inputPath, outputPath, function(error) {
						if (error) { return callback(error); }
						callback(null);
					});
				});
			});
		});
	});


	function loadTheme(themePath) {
		var theme = themeService.loadTheme(themePath);
		return theme;
	}

	function getThemeValidationErrors(theme) {
		var errors = [];
		if (!theme.name) {
			errors.push(new Error('Missing theme name'));
		}
		if (!theme.templates) {
			errors.push(new Error('Missing theme templates'));
		}
		if (!theme.templates.index) {
			errors.push(new Error('Missing index template'));
		}
		if (!theme.templates.login) {
			errors.push(new Error('Missing login template'));
		}
		if (!theme.config) {
			errors.push(new Error('Missing theme configuration'));
		}
		if (!theme.defaults) {
			errors.push(new Error('Missing default configuration'));
		}
		if (!theme.preview) {
			errors.push(new Error('Missing preview configuration'));
		}
		if (Boolean(theme.id)) {
			errors.push(new Error('Invalid field: id'));
		}
		var ALLOWED_FIELDS = [
			'id',
			'name',
			'templates',
			'config',
			'defaults',
			'preview',
			'thumbnail',
			'fonts'
		];
		Object.keys(theme).forEach(function(fieldName) {
			if (ALLOWED_FIELDS.indexOf(fieldName) === -1) {
				errors.push(new Error('Invalid field: ' + fieldName));
			}
		});
		// TODO: Verify theme config
		return (errors.length > 0 ? errors : null);
	}

	function generateThemePreviewPage(theme, templateId, callback) {
		var templateData = {
			metadata: {
				siteRoot: './',
				themeRoot: './assets/',
				theme: {
					id: theme.id,
					config: theme.preview.config
				}
			},
			resource: {
				private: false,
				root: theme.preview.files
			}
		};
		themeService.renderThemeTemplate(theme, templateId, templateData)
			.then(function(html) {
				callback(null, html);
			})
			.catch(function(error) {
				callback(error);
			});
	}

	function createDirectory(path, callback) {
		fs.stat(path, function(error, stats) {
			if (error && (error.code === 'ENOENT')) {
				return mkdirp(path, callback);
			}
			if (error) { return callback(error); }
			if (!stats.isDirectory()) {
				return callback(new Error('File exists: ' + path));
			}
			fs.readdir(path, function(error, files) {
				if (error) { return callback(error); }
				if (files.length > 0) {
					return callback(new Error('Directory is not empty: ' + path));
				}
				return callback(null);
			});
		});
	}

	function savePreviewSite(previewHtml, previewFilesPath, themeAssetsPath, outputPath, callback) {
		var outputPagePath = path.join(outputPath, PREVIEW_PAGE_FILENAME);
		var outputDownloadsPath = path.join(outputPath, PREVIEW_DOWNLOADS_PATH);
		var outputThumbnailsPath = path.join(outputPath, PREVIEW_THUMBNAILS_PATH);
		var outputMediaPath = path.join(outputPath, PREVIEW_MEDIA_PATH);
		var outputAssetsPath = path.join(outputPath, PREVIEW_ASSETS_PATH);
		async.parallel([
			function(callback) { fs.writeFile(outputPagePath, previewHtml, callback); },
			function(callback) { copyFiles(previewFilesPath, outputDownloadsPath, callback); },
			function(callback) { copyMedia(previewFilesPath, outputMediaPath, callback); },
			function(callback) { copyThumbnails(previewFilesPath, outputThumbnailsPath, callback); },
			function(callback) { copyFiles(themeAssetsPath, outputAssetsPath, callback); }
		], function(error, results) {
			if (error) {
				return del(outputPath)
					.then(function() {
						return callback(error);
					})
					.catch(function() {
						return callback(error);
					});
			}
			callback(null);
		});


		function copyMedia(sourcePath, outputPath, callback) {
			return copyFiles(sourcePath, outputPath, callback);
		}

		function copyThumbnails(sourcePath, outputPath, callback) {
			var options = {
				filter: function(filePath) {
					var extension = path.extname(filePath);
					var isThumbnailEnabled = THUMBNAIL_EXTENSIONS.indexOf(extension) !== -1;
					return isThumbnailEnabled;
				},
				transform: function(src, dest, stats) {
					return imagemagick().resize('256x256').quality(80);
				}
			};
			return copy(sourcePath, outputPath, options, callback);
		}
	}

	function savePreviewThumbnail(sitePath, outputPath, callback) {
		var server = http.createServer(express.static(sitePath));
		var randomPort = 0;
		server.listen(randomPort, function(error) {
			if (error) { return callback(error); }
			var url = 'http://localhost:' + server.address().port + '/';
			log('Started PhantomJS server at ' + url);
			saveUrlScreenshot(url, outputPath, function(error) {
				if (error) { return callback(error); }
				server.close(function(error) {
					if (error) { return callback(error); }
					log('Stopped PhantomJS server');
					callback(null);
				});
			});
		});

		function saveUrlScreenshot(url, outputPath, callback) {
			webshot(url, {
				windowSize: { width: 979, height: 734 },
				shotSize: { width: 'window', height: 'window' },
				defaultWhiteBackground: true
			})
			.on('error', callback)
			.pipe(imagemagick().resize('200x150').set('format', 'png'))
			.on('error', callback)
			.pipe(fs.createWriteStream(outputPath))
			.on('error', callback)
			.on('finish', function() {
				callback(null);
			});
		}
	}

	function createSiteThumbnail(thumbnailPath, previewPath, outputPath, callback) {
		checkWhetherFileExists(inputThumbnailPath, function(error, hasThumbnail) {
			if (error) { return callback(error); }
			if (hasThumbnail) {
				log('Copying thumbnail from ' + thumbnailPath);
				copyFile(inputThumbnailPath, outputThumbnailPath, function(error) {
					callback(null);
					return;
				});
			} else {
				log('Saving theme screenshot');
				savePreviewThumbnail(outputPreviewPath, outputThumbnailPath, function(error) {
					if (error) { return callback(error); }
					callback(null);
				});
			}
		});
	}

	function copyThemeFiles(inputPath, outputPath, callback) {
		var themeAssetsPath = path.join(inputPath, THEME_ASSETS_PATH);
		var themeTemplatesPath = path.join(inputPath, THEME_TEMPLATES_PATH);
		var themeManifestPath = path.join(inputPath, THEME_MANIFEST_PATH);
		var outputAssetsPath = path.join(outputPath, THEME_ASSETS_PATH);
		var outputTemplatesPath = path.join(outputPath, THEME_TEMPLATES_PATH);
		var outputManifestPath = path.join(outputPath, THEME_MANIFEST_PATH);
		async.parallel([
			function(callback) { copyFiles(themeAssetsPath, outputAssetsPath, callback); },
			function(callback) { copyFiles(themeTemplatesPath, outputTemplatesPath, callback); },
			function(callback) { copyFile(themeManifestPath, outputManifestPath, callback); }
		], function(error, results) {
			if (error) { return callback(error); }
			callback(null);
		});
	}

	function checkWhetherFileExists(path, callback) {
		fs.stat(path, function(error, stats) {
			if (error && (error.code === 'ENOENT')) {
				return callback(null, false);
			}
			if (error) { return callback(error); }
			if (!stats.isFile()) { return callback(null, false); }
			return callback(null, true);
		});
	}

	function copyFiles(sourcePath, outputPath, callback) {
		return copy(sourcePath, outputPath, {
			expand: true
		}, callback);
	}

	function copyFile(inputPath, outputPath, callback) {
		fs.createReadStream(inputPath)
			.on('error', callback)
			.pipe(fs.createWriteStream(outputPath))
			.on('error', callback)
			.on('finish', function() {
				callback(null);
			});
	}
};
