'use strict';

var path = require('path');
var express = require('express');

var pingApp = require('./ping');
var templatesApp = require('./templates');
var sitesApp = require('./sites');
var adminApp = require('./admin');
var wwwApp = require('./www');

var customDomain = require('../middleware/customDomain');
var subdomain = require('../middleware/subdomain');
var redirectToSubdomain = require('../middleware/redirectToSubdomain');
var stripTrailingSlash = require('../middleware/stripTrailingSlash');
var forceSsl = require('../middleware/forceSsl');
var useSubdomainAsPathPrefix = require('../middleware/useSubdomainAsPathPrefix');
var errorHandler = require('../middleware/errorHandler');

module.exports = function(database, config) {
	var host = config.host;

	if (!host) { throw new Error('Missing host name'); }

	var app = express();

	initMiddleware(app, {
		host: config.host,
		https: Boolean(config.https.port)
	});
	initCustomDomains(app, {
		host: config.host
	});
	initNamedSubdomains(app, database, {
		host: config.host,
		appKey: config.dropbox.appKey,
		appSecret: config.dropbox.appSecret,
		loginCallbackUrl: config.dropbox.loginCallbackUrl,
		registerCallbackUrl: config.dropbox.registerCallbackUrl,
		siteTemplates: config.templates.options,
		defaultSiteTemplate: config.templates.default
	});
	initDefaultSubdomain(app, {
		subdomain: 'www'
	});
	initWildcardSubdomain(app, {
		host: host,
		appKey: config.dropbox.appKey,
		appSecret: config.dropbox.appSecret,
		templatesUrl: config.templates.root
	});
	initErrorHandler(app, {
		template: 'error'
	});

	return app;


	function initMiddleware(app, options) {
		options = options || {};
		var host = options.host;
		var https = options.https;

		app.use(stripTrailingSlash());
		app.use(express.compress());

		if (https) {
			app.use(forceSsl({ host: host }));
		}
	}

	function initCustomDomains(app, options) {
		options = options || {};
		var host = options.host;

		app.use(customDomain({ host: host }));
	}

	function initNamedSubdomains(app, database, options) {
		options = options || {};
		var host = options.host;
		var appKey = options.appKey;
		var appSecret = options.appSecret;
		var loginCallbackUrl = options.loginCallbackUrl;
		var registerCallbackUrl = options.registerCallbackUrl;
		var siteTemplates = options.siteTemplates;
		var defaultSiteTemplate = options.defaultSiteTemplate;

		app.set('subdomain offset', host.split('.').length);

		app.use(subdomain('www', wwwApp({
			sitePath: path.resolve(__dirname, '../../templates/www')
		})));
		app.use(subdomain('ping', pingApp()));
		app.use(subdomain('templates', templatesApp({
			templatesPath: path.resolve(__dirname, '../../templates/sites/themes')
		})));
		app.use(subdomain('my', adminApp(database, {
			host: host,
			appKey: appKey,
			appSecret: appSecret,
			loginCallbackUrl: loginCallbackUrl,
			registerCallbackUrl: registerCallbackUrl,
			siteTemplates: siteTemplates,
			defaultSiteTemplate: defaultSiteTemplate
		})));
	}

	function initDefaultSubdomain(app, options) {
		options = options || {};
		var defaultSubdomain = options.subdomain;

		app.use(subdomain(null, redirectToSubdomain({
			subdomain: defaultSubdomain
		})));
	}

	function initWildcardSubdomain(app, options) {
		options = options || {};
		var host = options.host;
		var appKey = options.appKey;
		var appSecret = options.appSecret;
		var templatesUrl = options.templatesUrl;

		app.use(useSubdomainAsPathPrefix());
		app.use(sitesApp(database, {
			host: host,
			appKey: appKey,
			appSecret: appSecret,
			templatesUrl: templatesUrl
		}));
	}

	function initErrorHandler(app, options) {
		options = options || {};
		var template = options.template;

		app.use(errorHandler({ template: template }));
	}
};
