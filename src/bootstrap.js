'use strict';

var config = require('./config');

if (config.newRelic) {
	require('newrelic');
}

var DataService = require('./services/DataService');
var routerApp = require('./apps/router');
var serve = require('./serve');

var dataService = new DataService();
dataService.connect(config.db.uri)
	.then(function(database) {
		process.stdout.write('Database connected' + '\n');
		return database;
	})
	.then(function(database) {
		return routerApp(database, config);
	})
	.then(function(app) {
		process.stdout.write('Express app initialized' + '\n');
		return app;
	})
	.then(function(app) {
		var httpPort = config.http.port;
		var httpsPort = config.https.port;
		var httpsOptions = config.https;

		serve(app, {
			httpPort: httpPort,
			httpsPort: httpsPort,
			httpsOptions: httpsOptions
		});

		return app;
	})
	.then(function(app) {
		process.stdout.write('Server listening' +
			' on HTTP port ' + app.get('httpPort') +
			(app.get('httpsPort') ? ', HTTPS port ' + app.get('httpsPort') : '') +
			'\n'
		);
	})
	.done();
