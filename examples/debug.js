var websock = require('websock');
var server = require('router').create();

websock.listen(server, function(socket) {
	console.log('[conn]','version', socket.version);

	socket.on('message', function(message) {
		console.log('[rcvd]',message);
	});
});

server.listen(8080);

/*
var sock = websock.connect('localhost:8080');

sock.on('open1', function() {
	var i = 0;

	setInterval(function() {
		var message = 'hello-'+(i++);

		console.log('[send]', message);
		sock.send(message);	
	}, 1000);
});*/