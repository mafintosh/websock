var common = require('common');
var buffers = require('./buffers');

var noop = function() {};

var encode = function(opcode, mask, message) {
	var length = message.length + 2 + (mask ? 4 : 0);
	var first = message.length;
	var bytes = 0;

	if (message.length > 125 && message.length <= 0xffff) {
		first = 126;
		bytes = 2;
	}
	if (message.length > 0xffff) {
		first = 127;
		bytes = 8;
	}

	var buf = new Buffer(length+bytes);
	var offset = 2;

	buf[0] = opcode === 1 ? 129 : (0x80 | opcode); // 99% we use opcode 1, so just a stupid opt.
	buf[1] = (mask ? 0x80 : 0x0) | first;

	for (var i = bytes-1; i >= 0; i--) {
		buf[offset++] = (message.length >> 8*i) & 0xff;
	}
	if (mask) {
		mask = [];

		for (var i = 0; i < 4; i++) {
			mask[i] = buf[offset++] = (Math.random() * 256) | 0;
		}
		for (var i = 0; i < message.length; i++) {
			buf[offset++] = message[i] ^ mask[i % 4];
		}
	} else {
		message.copy(buf, offset);	
	}
	return buf;
};

var PING = encode(9, false, new Buffer([42]));
var CLOSE = new Buffer([136,0]);

var WebSocket = common.emitter(function(options) {
	this.masking = options.mask;
	this.type = options.type;
});

WebSocket.prototype.version = 8;
WebSocket.prototype.onconnection = function(connection, head) {
	var self = this;
	var list = buffers.create();

	this._closed = false;

	this.connection = connection;
	this.emit('open');

	var opcode;
	var mask;
	var length = 0;

	var parseHead = function() {
		if (list.length < 2) {
			return true;
		}
		var a = list.shift();
		var b = list.shift();

		opcode = 0xf & a;
		mask = 0x80 & b;
		length = 0x7f & b;

		if (length === 126) {
			parse = parse16Length;
			return;
		}
		if (length === 127) {
			parse = parse64Length;
			return;
		}
		parse = mask ? parseMask : parseBody;
	};
	var parse16Length = function() {
		if (list.length < 2) {
			return true;
		}
		length = (list.shift() << 8) | list.shift();
		parse = mask ? parseMask : parseBody;
	};
	var parse64Length = function() {
		if (list.length < 8) {
			return true;
		}
		length = 0;

		for (var i = 0; i < 8; i++) {
			length = (length << 8) | list.shift();
		}
		parse = mask ? parseMask : parseBody;
	};
	var parseMask = function() {
		if (list.length < 4) {
			return true;
		}
		mask = list.empty(4);
		parse = parseBody;	
	};
	var parseBody = function() {
		if (list.length < length) {
			return true;
		}
		var message = list.empty(length);

		if (mask) {
			for (var i = 0; i < message.length; i++) {
				message[i] ^= mask[i % 4];
			}
		}
		if (opcode === 8 && self._closed) {
			return true;
		}
		if (opcode === 8) {
			connection.write(CLOSE);
			connection.end();
			return true;
		}
		if (opcode === 9) {
			connection.write(encode(10, false, message));
			return true;
		}
		if (opcode === 10) {
			return true;
		}

		self.emit('message', message.toString('utf-8'));
		parse = parseHead;
	};
	var parse = parseHead;

	var ondata = function(data) {
		list.push(data);

		while (!parse(data));
	};

	connection.on('end', function() {
		connection.end(); // not sure about this when the server starts the closing handshake
	});
	connection.on('close', function() {
		self.emit('close');
	});
	connection.on('data', ondata);

	if (head && head.length) {
		ondata(head);
	}
};
WebSocket.prototype.send = function(message) {
	this.connection.write(encode(1, this.masking, new Buffer(message, 'utf-8')));
};
WebSocket.prototype.ping = function(interval) {
	var self = this;

	var id = setInterval(function() {
		self.connection.write(PING);
	}, interval || 60*1000);

	this.on('close', function() {
		clearInterval(id);
	});
};
WebSocket.prototype.close = WebSocket.prototype.end = function() {
	this._closed = true;
	this.connection.write(CLOSE);
};
WebSocket.prototype.destroy = function() {
	this._closed = true;
	this.connection.destroy();
};

exports.create = function(options) {
	return new WebSocket(options);
};