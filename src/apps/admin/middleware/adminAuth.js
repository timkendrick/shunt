'use strict';

var express = require('express');
var Passport = require('passport').Passport;

var adapterAuth = require('../../../middleware/adapterAuth');

var UserService = require('../../../services/UserService');

module.exports = function(database, options) {
	options = options || {};
	var loginPathPrefix = options.login || null;
	var failureRedirect = options.failure || null;
	var adapters = options.adapters || null;

	if (!loginPathPrefix) { throw new Error('Missing login path prefix'); }
	if (!failureRedirect) { throw new Error('Missing failure redirect'); }
	if (!adapters) { throw new Error('Missing adapters'); }

	var userService = new UserService(database);

	var app = express();

	var passport = new Passport();
	app.use(passport.initialize());
	app.use(passport.session());

	app.use(loginPathPrefix, adapterAuth(passport, {
		failureRedirect: failureRedirect,
		adapters: adapters
	}));

	passport.serializeUser(function(userModel, callback) {
		var username = userModel.username;
		callback(null, username);
	});

	passport.deserializeUser(function(username, callback) {
		return userService.retrieveUser(username)
			.then(function(userModel) {
				callback(null, userModel);
			})
			.catch(function(error) {
				callback(error);
			});
	});


	return app;
};
