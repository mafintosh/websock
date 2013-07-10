var http = require('http');
var https = require('https');
var parseURL = require('url').parse;
var crypto = require('crypto');
var common = require('common');
var protocol8 = require('./protocol-8');
var protocol0 = require('./protocol-0');

var noop = function() {};

var challenge = function(key) {
	return crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
};
var sign = function(k1, k2, head) {
	var md5 = crypto.createHash('md5');

	[k1, k2].forEach(function(k){
		var n = parseInt(k.replace(/[^\d]/g, ''), 10);
		var spaces = k.replace(/[^ ]/g, '').length;

		if (spaces === 0 || n % spaces !== 0){
			return null;
		}
		n /= spaces;
		md5.update(String.fromCharCode(n >> 24 & 0xFF, n >> 16 & 0xFF, n >> 8 & 0xFF, n & 0xFF));
	});
	return md5.update(head.toString('binary')).digest('binary');
};

var client0 = function(options, lib) {
	var ws = protocol0.create({type:'client'});
	
	// TODO: DONT HARDCODE HANDSHAKE!
	options.headers['sec-websocket-key1'] = '4 @1  46546xW%0l 1 5';
	options.headers['sec-websocket-key2'] = '12998 5 Y3 1  .P00';

	var request = lib.request(options);

	request.on('upgrade', function(request, connection, head) {
		// TODO: CHECK HANDSHAKE!
		ws.open(connection);
	});
	request.on('error', function() {
		ws.destroy();
	});

	request.end('^n:ds[4U', 'ascii');
	
	return ws;
};
var handshake0 = function(request, connection, head) {
	var sec = ('sec-websocket-key1' in request.headers) ? 'Sec-' : '';

	if (sec && !(request.headers['sec-websocket-key1'] && request.headers['sec-websocket-key2'])) {
		connection.destroy();
		return;
	}

	var token = sec && sign(request.headers['sec-websocket-key1'], request.headers['sec-websocket-key2'], head);

	if (sec && !token) {
		connection.destroy();
		return;
	}

	var handshake = [
		'HTTP/1.1 101 WebSocket Protocol Handshake', 
		'Upgrade: WebSocket', 
		'Connection: Upgrade',
		sec+'WebSocket-Origin: ' + (request.headers.origin || 'null'),
		sec+'WebSocket-Location: '+(connection.encrypted ? 'wss' : 'ws')+'://' + request.headers.host + request.url
	];

	if (!connection.writable) {
		return;
	}

	try {
		connection.write(handshake.join('\r\n')+'\r\n\r\n'+token, 'binary');
	} catch (e) {
		return;
	}

	return protocol0.create({type:'server'});
};

var client8 = function(options, lib) {
	var ws = protocol8.create({mask:true, type:'client'});
	var key = new Buffer(16);

	for (var i = 0; i < key.length; i++) {
		key[i] = (Math.random()*0xff) | 0;		
	}

	key = key.toString('base64');

	options.headers['sec-websocket-version'] = '8';
	options.headers['sec-websocket-key'] = key;

	var request = lib.request(options);
	var answer = challenge(key);

	request.on('upgrade', function(request, connection, head) {
		if (request.headers['sec-websocket-accept'] !== answer) {
			connection.destroy();
			ws.emit('close');
			return;
		}

		ws.open(connection, head);
	});
	request.on('error', function() {
		ws.destroy();
	});
	
	request.end();

	return ws;
};
var handshake8 = function(request, connection) {
	var headers = [
		'HTTP/1.1 101 Swiching Protocols', 
		'Upgrade: websocket', 
		'Connection: Upgrade',
		'Sec-WebSocket-Accept: '+challenge(request.headers['sec-websocket-key'])
	];

	if (!connection.writable) {
		return;
	}

	connection.write(headers.join('\r\n')+'\r\n\r\n', 'ascii');

	return protocol8.create({type:'server'});
};


exports.connect = function(host, options) {
	options = options || {};

	if (typeof host === 'string' && host.indexOf('://') === -1) {
		host = 'ws://'+host;
	}
	if (typeof host === 'string') {
		host = parseURL(host);
	}

	var ssl = host.protocol === 'wss:';
	var port = parseInt(host.port || (ssl ? 443 : 80), 10);
	var hostname = host.hostname;
  var agent = options.agent ? new https.Agent(options.agent) : false
	var request = {
    agent: agent,
		port: port,
		host: hostname,
		path: host.path,
		headers: {
			Connection:'Upgrade',
			Upgrade:'websocket',
			Host:host.hostname
		}
	};

	return ((typeof options.protocol === 'number' && options.protocol < 6) ? client0 : client8)(request, ssl ? https : http);
};
exports.onupgrade = function(onsocket) { // exposing this to make for more dynamic use of websock
	return function(request, connection, head, a, b) {
		connection.setNoDelay(true);

		var ws = (request.headers['sec-websocket-key'] ? handshake8 : handshake0)(request, connection, head);

		if (!ws) {
			return;
		}

		ws.once('open', function() {
			onsocket(ws, a, b);
		});

		ws.open(connection, head);
	};
};
exports.listen = function(port, onsocket, callback) {
	var that = common.createEmitter();
	var server = port;
	var protocols = {};

	if (typeof port === 'number') {
		server = http.createServer();
		server.listen(port, callback || noop);
	}
	if (server.server && typeof server.connections !== 'number') { // not a http server but a wrapper
		server = server.server;
	}

	server.on('upgrade', exports.onupgrade(function(socket) {
		if (socket.pingable) {
			var ping = setInterval(function() {
				socket.ping();
			}, 60*1000);

			socket.on('close', function() {
				clearInterval(ping);
			});
		}

		that.emit('socket', socket);
	}));

	if (onsocket) {
		that.on('socket', onsocket);
	}

	return that;
};
