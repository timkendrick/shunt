'use strict';

function FileModel(options) {
	this.path = options.path;
	this.mimeType = options.mimeType;
	this.size = options.size;
	this.modified = options.modified;
	this.readOnly = Boolean(options.readOnly);
	this.thumbnail = Boolean(options.thumbnail);
	if (options.directory) {
		this.directory = Boolean(options.directory);
		this.contents = options.contents ? options.contents.slice() : [];
	}
}

FileModel.prototype.path = null;
FileModel.prototype.mimeType = null;
FileModel.prototype.size = 0;
FileModel.prototype.modified = null;
FileModel.prototype.readOnly = false;
FileModel.prototype.thumbnail = false;
FileModel.prototype.directory = false;
FileModel.prototype.contents = null;

module.exports = FileModel;