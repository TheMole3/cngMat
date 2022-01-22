module.exports = function(app, db, config) {
    const sharp = require('sharp'); // Image manipulation
    const request = require('request'); // Web requests
    const jsdom = require("jsdom"); // DOM manipulation
    const axios = require("axios"); // Web requests
    const schedule = require('node-schedule'); // CRON type scheduling
    const { ocrSpace } = require('ocr-space-api-wrapper'); // OCR

    Date.prototype.getWeekNumber = function(){var d = new Date(Date.UTC(this.getFullYear(), this.getMonth(), this.getDate()));var dayNum = d.getUTCDay() || 7;d.setUTCDate(d.getUTCDate() + 4 - dayNum);var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.ceil((((d - yearStart) / 86400000) + 1)/7)};
    function bufferToBase64(buf) {
        var binstr = Array.prototype.map.call(buf, function (ch) {
            return String.fromCharCode(ch);
        }).join('');
        return btoa(binstr);
    }

    let sourceUrl = "https://finspang.se/bergska/bergskagymnasiet/ovriga/matsedel/matsedelibildningen.4.166aa05167c62dff5dc3168.html"

    let cngMat = {
        loadFoodFromSource: () => {
            const weekReference = {
                "måndag": "mon",
                "mandag": "mon",
                "tisdag": "tue",
                "onsdag": "wed",
                "torsdag": "thu",
                "fredag": "fri"
            }
            request(sourceUrl, async (error, resp, body) => { // Get the body of the url
                body = decodeURIComponent( encodeURIComponent( body ));
                let doc = new jsdom.JSDOM(body); // Convert requested body to JSDOM object
                let document = doc.window.document;

                let regex = new RegExp( /skol|mat|sedel|bildningen/gi);
                let images = Array.from(document.querySelectorAll('[class^="sv-image-portlet"] > img')); // Get images from webpage
                images = images.filter(e => regex.test(e.alt)); // Remove non matsedel images
                images.forEach(async image => {
                    const input = (await axios({ url: "https://finspang.se" + image.src, responseType: "arraybuffer" })).data; // Get image from webpage as a buffer
                    sharp(input) // Load picture of food
                        .extract({ width: 500, height: 150, left: 1150, top: 500  }) // Resize picture to only show week number
                        .toBuffer({ resolveWithObject: true })
                        .then(async ({ data, info }) => {
                            let req = await ocrSpace("data:image/png;base64," + Buffer.from(data).toString('base64'), { apiKey: config.OCRSpaceKey, language: 'swe' });
                            let text = req.ParsedResults[0].ParsedText
                            console.log(text)
                            let weekObject = { // Create an object for this weeks food
                                year: new Date().getFullYear().toString(),
                                week: text.replace(/(\D)|(0+(?!$))/gm, "")
                            };
                
                            sharp(input) // Load picture of food
                            .extract({width: 1450, height: 1310, left: 130, top: 600  }) // Resize picture to only show the food
                            .toBuffer({ resolveWithObject: true })
                            .then(async ({ data, info }) => {
                                let req = await ocrSpace("data:image/png;base64," + Buffer.from(data).toString('base64'), { apiKey: config.OCRSpaceKey, language: 'swe' });
                                let str = (" "+req.ParsedResults[0].ParsedText).replace(/(.|\s)+?(?=Måndag)|/m, "").replace(/\./g, ""); // Remove Weird characters that are not relevant
                                let days = str.split(/(Måndag|Tisdag|Onsdag|Torsdag|Fredag).*\s/ig).filter(n => n); // Split into each weekday and filter empty

                                for (let i = 0; i < days.length; i+=2) {
                                    let food = days[i+1].split(/(Veg[^\w]+)/gi).map(el => el.trim()); // Split the vegitarian option
                                    food[0] = food[0].replace(/\n*$/g, "").split("\n").map(el => el.trim()); // Split into diffrent foods for the day
                                    let match = new RegExp(/(^\s*.\s*$)|(^("|o|0|\.|\s|e)*$)/gi) // Regex that matches any string that only has one character or with only 0 o e \s or . in it
                                    food[0] = food[0].filter((e) => !match.test(JSON.stringify(e))).filter((e) => !match.test(JSON.stringify(e))); // Remove all entries matching regex ^ idk why we need two filter but we apparently do?

                                    weekObject[weekReference[days[i].toLowerCase()]] = {
                                        food: food[0],
                                        veg: food[2]?food[2]:""
                                    };
                                }
                                console.log(weekObject)
                                db.cngMat.update({$and: [{week: weekObject.week}, {year: weekObject.year}]}, {$setOnInsert: weekObject}, {upsert: true}); // Add available data to database, don't update if data already exists
                            });
                        });
                });
            });
        },
        getFromDate: function(d, cb) { // Get food, in a callback, from DB by supplying a Date object
            let date = new Date(d);
            let corresponding = [null, "mon", "tue", "wed", "thu", "fri", null]
            db.cngMat.find({$and: [{week: date.getWeekNumber().toString()}, {year: date.getFullYear().toString()}]}, function(error, docs) {
              if(!corresponding[date.getDay()] || !docs[0]) return cb(404)
              let food = docs[0][corresponding[date.getDay()]]
              food.date = date
              cb(food)
            })
        },
        getAdjusted: (cb) => {
            let today = true;
            let currDate = new Date();
            if(currDate.getHours() >= 13) {
                currDate.setTime(currDate.getTime() + (24 * 60 * 60 * 1000))
                today = false;
            }
            cngMat.getFromDate(currDate, function(food) {
                cb(food, today)
            })
        }
    }

    cngMat.loadFoodFromSource() // Update database
    var updateDB = schedule.scheduleJob('00 12 * * *', function(){ // Update DB at 12:00 every day
        cngMat.loadFoodFromSource()
        console.log("Updated cngMat DB at " + new Date())
    });


    return cngMat
}