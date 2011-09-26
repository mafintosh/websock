var websockets = require('./index');

websockets.listen(10000, function(socket) {
	socket.on('message', function(message) {
		socket.send(message);
	});
}, function() {
	var ws = websockets.connect('localhost:10000', {protocol:8});
	var now = Date.now();
	var max = 10000000;

	ws.on('open', function() {
		for (var i = 0; i < max; i++) {
			ws.send('hello world');
		}
	});

	var rcvd = 0;

	ws.on('message', function(message) {
		if (message !== 'hello world') {
			console.log('meh', message);
		}
		if (++rcvd === max) {
			var delta = Date.now() - now;

			console.log(delta+'ms', Math.round(1000*max/delta)+'msg/s');
			process.exit(0);
		}
	});
	ws.on('close', function() {
		console.log('client', 'close');
	});
});