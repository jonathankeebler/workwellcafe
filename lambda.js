'use strict'
const awsServerlessExpress = require('aws-serverless-express')
const app = require('./app')
const server = awsServerlessExpress.createServer(app)
const Seat = require("./models/Seat.js");

exports.handler = (event, context) => awsServerlessExpress.proxy(server, event, context)

exports.tick = (event, context) => {
 
    Seat.scan().all().exec(function(err, seats)
    {
        if(err) console.log(err);

        seats.forEach(function(seat)
        {
            if(seat.customer && seat.date && seat.date.free && new Date(seat.date.free) < new Date())
            {
                var free_time_buffer = new Date((new Date(seat.date.free)).getTime() + 15*60*1000);

                if(free_time_buffer < new Date())
                {
                    delete seat.customer;
                    delete seat.date;
                    seat.save(function(err)
                    {
                        if(err) return console.log(err);

                        console.log("Seat " + seat.id + ": is now free");
                    });
                }
                else
                {
                    console.log("Seat " + seat.id + ": about to free up at " + free_time_buffer);
                }
            }
        });
    });
    
}