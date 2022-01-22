const config = require("./config.json")

const express = require('express')
const app = express();
const http = require('http').Server(app);
const cors = require('cors');

const mongojs = require('mongojs');
const db = mongojs(config.dbConnect, ['cngMat']); // Import database TheMole and collection cngMat

let cngMat = require('./cngmat.js')(app, db, config); // Start cngmat.js

//cngMat.loadFoodFromSource()
let main = async ()  => {
    cngMat.getAdjusted((food, today) => {
        console.log(food, today)
    })
}

main()