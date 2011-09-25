# WebSockets
a websocket server and client module

this module implements the websocket spec 0-12. it's easy to use:

``` js
var websockets = require('websockets');

// instead of 80 we could also parse a server to listen to
websockets.listen(80, function(socket) {
	socket.on('message', function(message) {
		socket.send('echo: ' + message); // let's echo it
	});
	socket.send('hello from server');
}, function() {
	var socket = websockets.connect('localhost');

	socket.on('open', function() {
		// yay open!
		socket.send('hello from client');
	});
	socket.on('message', function(message) {
		// yay message!
	});
});
```

## License

(The MIT License)

Copyright (c) 2011 Mathias Buus Madsen <mathiasbuus@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.