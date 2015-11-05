'use strict';

var path = require('path');
var fs = require('fs');
var mapSeries = require('promise-map-series');
var express = require('express');
var LocalStrategy = require('passport-local').Strategy;
var mkdirp = require('mkdirp');
var slug = require('slug');

var AuthenticationService = require('../services/AuthenticationService');
var RegistrationService = require('../services/RegistrationService');
var UserService = require('../services/UserService');

var loadFileMetadata = require('../utils/loadFileMetadata');

var HttpError = require('../errors/HttpError');

function LocalAdapter(database, options) {
	options = options || {};
	var metadata = options.metadata || null;
	var authConfig = options.auth || null;
	var sitesRoot = options.root || null;
	var downloadUrl = options.download && options.download.url || null;
	var thumbnailUrl = options.thumbnail && options.thumbnail.url || null;

	if (!database) { throw new Error('Missing database'); }
	if (!metadata) { throw new Error('Missing metadata'); }
	if (!metadata.name) { throw new Error('Missing adapter name'); }
	if (!metadata.label) { throw new Error('Missing adapter label'); }
	if (!metadata.path) { throw new Error('Missing default site path'); }
	if (!authConfig) { throw new Error('Missing local auth config'); }
	if (!authConfig.strategy) { throw new Error('Missing local auth strategy'); }
	if (!authConfig.options) { throw new Error('Missing local auth options'); }
	if (!sitesRoot) { throw new Error('Missing local sites root'); }
	if (!downloadUrl) { throw new Error('Missing local download URL'); }
	if (!thumbnailUrl) { throw new Error('Missing local thumbnail URL'); }

	this.database = database;
	this.metadata = metadata;
	this.authConfig = authConfig;
	this.sitesRoot = sitesRoot;
	this.downloadUrl = downloadUrl;
	this.thumbnailUrl = thumbnailUrl;
}

LocalAdapter.prototype.database = null;
LocalAdapter.prototype.metadata = null;
LocalAdapter.prototype.authConfig = null;
LocalAdapter.prototype.sitesRoot = null;
LocalAdapter.prototype.downloadUrl = null;
LocalAdapter.prototype.thumbnailUrl = null;

LocalAdapter.prototype.getMetadata = function(adapterConfig) {
	return {
		name: this.metadata.name,
		label: this.metadata.label,
		path: this.metadata.path
	};
};

LocalAdapter.prototype.loginMiddleware = function(passport, passportOptions, callback) {
	var database = this.database;
	var authConfig = this.authConfig;
	var userService = new UserService(database);

	var app = express();

	app.post('/', passport.authenticate('admin/local', passportOptions), callback);

	passport.use('admin/local', new LocalStrategy({ passReqToCallback: true },
		function(req, username, password, callback) {
			var authenticationService = new AuthenticationService();
			var registrationService = new RegistrationService(req);
			userService.retrieveUser(username)
				.catch(function(error) {
					if (error.status === 404) {
						var authUsername = slug(username, { lower: true });
						return authenticationService.create(authUsername, password, authConfig.strategy, authConfig.options)
							.then(function(authUser) {
								var userDetails = {
									username: authUsername
								};
								var adapterConfig = {
									strategy: authConfig.strategy,
									password: authUser.password
								};
								registrationService.setPendingUser(userDetails, 'local', adapterConfig);
								throw new HttpError(401);
							});
					}
					throw error;
				})
				.then(function(userModel) {
					var adapterConfig = userModel.adapters['local'];
					if (!adapterConfig) {
						throw new HttpError(401);
					}
					var validUsers = [
						{
							username: username,
							strategy: adapterConfig.strategy,
							password: adapterConfig.password
						}
					];
					return authenticationService.authenticate(username, password, validUsers)
						.then(function(userModel) {
							if (!userModel) { throw new HttpError(401); }
							return callback(null, userModel);
						});
				})
				.catch(function(error) {
					if (error.status === 401) {
						return callback(null, false);
					}
					return callback(error);
				});
		})
	);

	return app;
};

LocalAdapter.prototype.initSiteFolder = function(sitePath, siteFiles, options) {
	var sitesRoot = this.sitesRoot;
	return checkWhetherFileExists(sitePath)
		.then(function(folderExists) {
			if (folderExists) { return; }
			return copySiteFiles(sitePath, siteFiles);
		});


	function checkWhetherFileExists(filePath) {
		var fullPath = path.join(sitesRoot, filePath);
		return new Promise(function(resolve, reject) {
			fs.stat(fullPath, function(error, stat) {
				if (error && (error.code === 'ENOENT')) {
					return resolve(false);
				}
				if (error) { return reject(error); }
				var fileExists = Boolean(stat);
				return resolve(fileExists);
			});
		});
	}

	function copySiteFiles(sitePath, dirContents) {
		var files = getFileListing(dirContents);
		return Promise.resolve(mapSeries(files, function(fileMetadata) {
			var filePath = path.join(sitePath, fileMetadata.path);
			var fullPath = path.join(sitesRoot, filePath);
			var fileContents = fileMetadata.contents;
			return writeFile(fullPath, fileContents);
		}).then(function(results) {
			return;
		}));


		function getFileListing(namedFiles) {
			var files = Object.keys(namedFiles)
				.sort(function(filePath1, filePath2) {
					return (filePath1 < filePath2 ? -1 : 1);
				})
				.map(function(filePath) {
					var file = namedFiles[filePath];
					return {
						path: filePath,
						contents: file
					};
				});
			return files;
		}

		function writeFile(filePath, fileContents) {
			return new Promise(function(resolve, reject) {
				var parentPath = path.dirname(filePath);
				mkdirp(parentPath, function(error) {
					if (error) { return reject(error); }
					var stream = fs.createWriteStream(filePath);
					stream.on('finish', resolve);
					stream.on('error', reject);
					stream.write(fileContents);
					stream.end();
				});
			});
		}
	}
};

LocalAdapter.prototype.loadFolderContents = function(folderPath, options) {
	var sitesRoot = this.sitesRoot;
	var fullPath = path.join(sitesRoot, folderPath);
	return loadFileMetadata(fullPath, {
		root: fullPath,
		contents: true
	})
		.then(function(rootFolder) {
			return {
				root: rootFolder,
				cache: null
			};
		});
};

LocalAdapter.prototype.retrieveFileMetadata = function(filePath, options) {
	var sitesRoot = this.sitesRoot;
	var fullPath = path.resolve(sitesRoot, filePath);
	return loadFileMetadata(fullPath, {
		root: sitesRoot,
		contents: false
	})
		.catch(function(error) {
			if (error.code === 'ENOENT') { return null; }
			throw error;
		});
};

LocalAdapter.prototype.retrieveDownloadLink = function(filePath, options) {
	var downloadUrl = this.downloadUrl;
	return Promise.resolve(downloadUrl + filePath.substr('/'.length));
};

LocalAdapter.prototype.retrieveThumbnailLink = function(filePath, options) {
	var thumbnailUrl = this.thumbnailUrl;
	return Promise.resolve(thumbnailUrl + filePath.substr('/'.length));
};

LocalAdapter.prototype.getUploadConfig = function(sitePath, options) {
	return {
		adapter: 'local',
		path: sitePath
	};
};



module.exports = LocalAdapter;
