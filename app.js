const config = require("./config.json")

const express = require('express')
const app = express();
const http = require('http').Server(app);
const cors = require('cors');

const mongojs = require('mongojs');
const db = mongojs(config.dbConnect, ['cngMat']); // Import database TheMole and collection cngMat

let cngMat = require('./cngmat.js')(app, db, config); // Start cngmat.js

app.use(express.json())

/*
    Melo Auth
*/
const cookieParser = require("cookie-parser");
app.use(cookieParser())
if(config.auth) app.use(require("/home/melo/Servers/Melo.se/meloAuth/meloAuth.js").authenticateToken)


/*
    Program download
*/
app.get("/", (req, res) => { // Get available weeks
    res.sendFile(__dirname + "/client/index.html")
})
app.get("/CNGMatSetup.exe", (req, res) => { // Get available weeks
    res.sendFile(__dirname + "/client/download/CNGMatSetup.exe")
})


/* 
    API
*/
app.get("/getDate", (req, res) => { // Get date from DB ?date=2022-01-23
    cngMat.getFromDate(req.query.date, (food) => { // Get the db from mongodb
        res.send(food)
    })
})
app.get("/getAdjusted", (req, res) => { // Get adjusted from DB
    cngMat.getAdjusted((food) => { // Get the db from mongodb
        res.send(food)
    })
})

app.get("/getAvailableWeeks", (req, res) => { // Get available weeks
    cngMat.getAvailableWeeks((weeks) => { // Get the db from mongodb
        res.send(weeks)
    })
})
app.get("/getWeek", (req, res) => { // Get week from DB ?year=2020&week=45
    cngMat.getWeek({year: req.query.year, week: req.query.week}, (week) => { // Get the db from mongodb
        res.send(week)
    })
})


/*
    Admin
*/
app.get('/admin', (req, res) => {
    if(config.auth) {
		if(!req.user) return res.redirect("https://login.melo.se/?redirect=https://melo.se/cngmat/admin/") // Om man inte är inloggad, skicka personen till att logga in
		if(!req.user.scopes.includes("cngMatAdmin")) return res.sendStatus(403) // Om man inte har rätt scope skicka att personen inte är behörig
	}

	res.sendFile(__dirname + '/client/admin/admin.html')
})
app.get("/admin/update", (req, res) => { // Sätt en dags mat till något
    if(config.auth && !req.user) return res.sendStatus(401) // Om man inte är inloggad, skicka personen till att logga in
    if(config.auth && !req.user.scopes.includes("cngMatAdmin")) return res.sendStatus(403) // Om man inte har rätt scope skicka att personen inte är behörig
    cngMat.loadFoodFromSource((status) => {
        res.sendStatus(status)
    })
})
app.post("/admin/set", (req, res) => { // Sätt en dags mat till något
    if(config.auth && !req.user) return res.sendStatus(401) // Om man inte är inloggad, skicka personen till att logga in
    if(config.auth && !req.user.scopes.includes("cngMatAdmin")) return res.sendStatus(403) // Om man inte har rätt scope skicka att personen inte är behörig
    cngMat.admin.setWeekObject(req.body,
        (code)=> {
            res.sendStatus(code)
        }
    )
})
app.post("/admin/delete", (req, res) => { // Sätt en dags mat till något
    if(config.auth && !req.user) return res.sendStatus(401) // Om man inte är inloggad, skicka personen till att logga in
    if(config.auth && !req.user.scopes.includes("cngMatAdmin")) return res.sendStatus(403) // Om man inte har rätt scope skicka att personen inte är behörig
    cngMat.admin.deleteWeekObject(req.body,
        (code)=> {
            res.sendStatus(code)
        }
    )
})


/* 
    Deprecation warning
*/
app.get("/getdata", (req, res) => {
    res.send(`
    <tile>
        <visual version="2">
            <binding template="TileSquare310x310TextList03">
                <text id="1">Support har upphört</text>
                <text id="2" hint-wrap="true">Support för denna version av CNGMAT har upphört, ladda ner en ny version på https://melo.se/cngmat/</text>
            </binding>
            <binding template="TileWide310x150Text09">
                <text id="1">Support har upphört</text>
                <text id="2" hint-wrap="true">Support för denna version av CNGMAT har upphört, ladda ner en ny version på https://melo.se/cngmat/</text>
            </binding>
            <binding template="TileMedium">
                <text id="1" hint-wrap="true">Högerklicka och ändra storleken till bred för att se info</text>
            </binding>
        </visual>
    </tile>
    `)
})


http.listen(config.port, () => {
    console.log('Listening on *:' + config.port);
});