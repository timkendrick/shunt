'use strict';

var Handlebars = require('handlebars');

module.exports = Handlebars.Utils.extend({},
	require('./core'),
	require('./fs'),
	require('./media'),
	require('./site')
);
