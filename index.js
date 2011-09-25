var http = require('http');
var crypto = require('crypto');
var common = require('common');
var protocol8 = require('./protocol-8');
var protocol0 = require('./protocol-0');

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

exports.connect = function(host, options) {
	var port = parseInt(host.split(':')[1] || 80, 10);
	var hostname = host.split(':')[0];
	var client = http.createClient(port, hostname);
	var ws;

	options = options || {};

	if (typeof options.protocol === 'number' && options.protocol < 6) {
		ws = protocol0.create({type:'client'});
		
		var request = client.request('/', {
			upgrade:'websocket',
			connection:'upgrade',
			host:host,
	        'sec-websocket-key1':'4 @1  46546xW%0l 1 5',
	        'sec-websocket-key2':'12998 5 Y3 1  .P00'
		});

		client.on('upgrade', function(request, connection, head) {
			ws.onconnection(connection);
		});

		request.end('^n:ds[4U', 'ascii');
	} else {
		var key = new Buffer(16);
	
		for (var i = 0; i < key.length; i++) {
			key[i] = (Math.random()*0xff) | 0;		
		}

		key = key.toString('base64');

		ws = protocol8.create({mask:true, type:'client'});
		
		var request = client.request('/', {
			upgrade:'websocket',
			connection:'upgrade',
			host:host,
	        'sec-websocket-version':'8',
	        'sec-websocket-key':key
		});

		var answer = challenge(key);

		client.on('upgrade', function(request, connection, head) {
			if (request.headers['sec-websocket-accept'] !== answer) {
				connection.destroy();
				ws.emit('close');
				return;
			}
			ws.onconnection(connection, head);
		});

		request.end();
	}

	return ws;
};
exports.listen = function(port, onsocket, callback) {
	var that = common.createEmitter();
	var server = port;

	if (typeof port === 'number') {
		server = http.createServer();
		server.listen(port, callback || noop);
	}
	if (server.server && typeof server.connections !== 'number') { // not a http server but a wrapper
		server = server.server;
	}

	server.on('upgrade', function(request, connection, head) {
		var ws;

		connection.setNoDelay(true);

		if (request.headers['sec-websocket-key']) {
			ws = protocol8.create({type:'server'});

			connection.write([
				'HTTP/1.1 101 Web Socket Protocol Handshake', 
				'Upgrade: websocket', 
				'Connection: Upgrade',
				'Sec-WebSocket-Accept: '+challenge(request.headers['sec-websocket-key'])
			].join('\r\n')+'\r\n\r\n', 'ascii');			
		} else {
			var sec = ('sec-websocket-key1' in request.headers) ? 'Sec-' : '';
			var token = sign(request.headers['sec-websocket-key1'], request.headers['sec-websocket-key2'], head);

			if (sec && !token) {
				connection.destroy();
				return;
			}

			ws = protocol0.create({type:'server'});

			connection.write([
				'HTTP/1.1 101 Web Socket Protocol Handshake', 
				'Upgrade: WebSocket', 
				'Connection: Upgrade',
				sec+'WebSocket-Origin: ' + request.headers.origin || 'null',
				sec+'WebSocket-Location: ws://' + request.headers.host + request.url
			].join('\r\n')+'\r\n\r\n'+token, 'binary');
		}

		ws.onconnection(connection, head);

		that.emit('socket', ws);
	});

	if (onsocket) {
		that.on('socket', onsocket);
	}

	return that;
};