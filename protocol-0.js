var common = require('common');

var noop = function() {};

var START = '\u0000';
var END   = '\ufffd';

var Parser = common.emitter(function() {
	this.buffer = '';
	this.start = 0;
	this.framing = false;
	this.top = [];
});

Parser.prototype.parse = function(data) {
	var index = -1;
	var last = 0;
	
	this.top[0] = data[data.length-2] || this.top[1];
	this.top[1] = data[data.length-1];

	while ((index = data.indexOf(this.framing ? END : START, last)) > -1) { // messages are framed by START/END
		if (this.framing) {
			this.emit('message', this.buffer.substring(this.start)+data.substring(last, index));
			this.buffer = '';
		}
		
		this.start = last = index+1;
		this.framing = !this.framing;
	}
	if (!this.framing && this.top[0] === END && this.top[1] === START) { // websocket close handshake
		this.emit('close');
		return;
	}
	if (this.framing && last <= data.length) { // we only buffer is we absolutely have to
		this.buffer += data;
	}
};

var WebSocket = common.emitter(function(options) {
	this.type = options.type;
});

WebSocket.prototype.pingable = false;
WebSocket.prototype.version = 0;

WebSocket.prototype.onconnection = function(connection) {
	var self = this;
	var parser = new Parser();
	
	this.connection = connection;
	this.emit('open');

	connection.setEncoding('utf-8');
	connection.setTimeout(2*60*1000);
		
	var destroy = function() {
		connection.destroy();
	};
	var onclose = common.once(function() {
		self.emit('close');
	});	

	parser.on('message', function(message) {
		self.emit('message', message);
	});
	parser.on('close', destroy);	

	connection.on('end', function() {
		connection.end();
	});

	connection.on('timeout', destroy);	
	connection.on('error', onclose);
	connection.on('close', onclose);
	
	connection.on('data', function(data) {
		parser.parse(data);
	});	
};

WebSocket.prototype.send = function(data) {
	var length = Buffer.byteLength(data);
	var message = new Buffer(2+length);
	
	message.write('\u0000', 'binary');
	message.write(data, 1, 'utf-8');
	message.write('\uffff', length+1, 'binary');

	this.connection.write(message); // we encourage the socket to send it as one package
}
WebSocket.prototype.ping = noop;
WebSocket.prototype.end = WebSocket.prototype.close = function() {
	this.connection.end();
};
WebSocket.prototype.destroy = function() {
	this.connection.destroy();
};

exports.create = function(options) {
	return new WebSocket(options);
};