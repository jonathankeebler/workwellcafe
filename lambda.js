'use strict'
const awsServerlessExpress = require('aws-serverless-express')
const app = require('./app')
const server = awsServerlessExpress.createServer(app)
const Seat = require("./models/Seat.js");

var AWS = require('aws-sdk');
AWS.config.region = 'us-east-1';
var sns = new AWS.SNS();

exports.handler = (event, context) => awsServerlessExpress.proxy(server, event, context)

exports.tick = (event, context) => {

    Seat.scan().all().exec(function(err, seats)
    {
        if(err) console.log(err);

        seats.forEach(function(seat)
        {
            var phone_number = seat.phone_number;

            if(seat.customer && seat.date && seat.date.free && new Date(seat.date.free) < new Date())
            {
                var free_time_buffer = new Date((new Date(seat.date.free)).getTime() + 15*60*1000);

                if(free_time_buffer < new Date())
                {
                    delete seat.customer;
                    delete seat.phone_number;
                    delete seat.date;
                    seat.save(function(err)
                    {
                        if(err) return console.log(err);

                        console.log("Seat " + seat.id + ": is now free");

                        if(phone_number)
                        {
                            send_sms(phone_number, 'WorkWell Cafe: Your seat has expired. Thanks for working with us. Please come back soon!')
                        }
                    });
                }
                else
                {
                    console.log("Seat " + seat.id + ": about to free up in " + ((free_time_buffer.getTime() - Date.now())/1000/60).toFixed(1) + " minutes");
                    
                    if(phone_number && seat.date && ! seat.date.expiry_warning)
                    {
                        seat.date.expiry_warning = new Date();
                        seat.save(function(err)
                        {
                            if(err) console.log(err);
                        });
                        send_sms(phone_number, 'WorkWell Cafe: Your seat is about to expire. Want to continue? http://www.workwellcafe.com/renew')
                    }
                }
            }
            else if(seat.customer && seat.date && seat.date.free)
            {
                console.log("Seat " + seat.id + ": will free up in " + (((new Date(seat.date.free)).getTime() - Date.now())/1000/60).toFixed(1) + " minutes" );
            }
        });
    });
    
}

function send_sms(number, message)
{
    sns.publish({
        Message: message,
        MessageStructure: 'string',
        PhoneNumber: number
      }, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
    });
}