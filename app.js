const port = 3000;

const fs = require('fs');
const byline = require('byline');
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

server.listen(port);

// ---------------------------------------------------------

const logger = (req, res, next) =>
{
    let ignore = ['/main.css', '/favicon.ico', '/banan'];

    if (ignore.indexOf(req.path) === -1)
        console.log(`${req.ip} WWW ${req.path}`);

    next();
};

app.use(logger);
app.use(express.static('public'));
app.engine('html', require('mustache-express')());
app.set('view engine', 'mustache');
app.set('views', __dirname + '/views');

app.get('/vote', (req, res) => res.render('vote.html'));
app.get('/report', (req, res) => res.render('report.html'));
app.get('/iframes', (req, res) => res.render('iframes.html'));
app.get('/simulate', (req, res) => res.render('simulate.html'));
app.get('/results', (req, res) =>
{
    let mustacheData = [];

    Object.keys(votes).forEach(party =>
    {
        let churches = [];
        Object.keys(votes[party]).forEach(church => {
            churches.push({name: church, votes: votes[party][church]});
        });
        mustacheData.push({party, churches});
    });

    res.render('results.html', {votes: mustacheData});
});

app.get('/', (req, res) => res.redirect('/iframes'));
app.get('*', (req, res) => res.render('404.html'));

// ---------------------------------------------------------

let stream, votes = {};
stream = fs.createReadStream('votes.txt');
stream = byline.createStream(stream);
stream.on('data', (line) =>
{
    let [fingerprint, church, party, count] = line.toString().split(" ");

    if (!(party in votes)) votes[party] = {};
    if (!(church in votes[party])) votes[party][church] = 0;
    votes[party][church] += Number(count) || 1;

}).on('end', () => {
    console.log(">>> Database loaded from disk.");
});

// ---------------------------------------------------------

io.on('connection', (socket) =>
{
    socket.on('message', (payload) => {
        let line = `${payload.hash || 'unknown'} ${payload.church} ${payload.party} ${payload.count || 1}\n`;
        if (payload.hash !== 'simulate') fs.appendFile('votes.txt', line, (err) => { if (err) throw err });
        io.emit('voted', {time: new Date(), vote: payload});
    });

    let emitClients = () => io.emit('clients', {
        count: io.engine.clientsCount,
        countip: Object.keys(io.sockets.connected)
                        .map(key => io.sockets.connected[key].conn.remoteAddress)
                        .filter(el => el === socket.request.connection.remoteAddress).length
    });

    emitClients(); socket.on('disconnect', emitClients);
});

