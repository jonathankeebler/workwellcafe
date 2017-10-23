var Seat = require("./models/Seat.js");

const express = require("express"), 
    path = require("path"),
    zpad = require('zpad');
const app = express();

app.set("view engine", "pug");
app.use(require("body-parser").urlencoded({extended: false}));

app.use(express.static(path.join(__dirname, './')));

var session = require('express-session');
var DynamoDBStore = require('connect-dynamodb')({session: session});
app.use(session({store: new DynamoDBStore({}), secret: 'keyboard cat is the best'}));

var expressAuth0Simple = require('express-auth0-simple'); // Import the middleware library

var auth = new expressAuth0Simple(app, {
    auth0: {
        scope: "openid id_token email"
    }
});

app.get("/", (req, res) => {

    if(req.session.seats_selected)
    {
        res.redirect("/checkedin?seats=" + req.session.seats_selected);
        return;
    }

    get_seats(function(err, seats)
    {
        seats = seats.map(function(seat)
        {
            if(seat.date && seat.date.free && seat.date.free < new Date())
            {
                delete seat.customer;
            }

            return seat;
        }).sort(function(a,b)
        {
            return a.id - b.id;
        });

        res.render("index.pug", {
            seats: seats,
            logged_in: req.user ? true : false
        })
    })

});

function get_seats(next)
{
    Seat.scan().all().exec(function(err, seats)
    {
        next(err, seats ? seats.sort(function(a,b)
        {
            return a.id - b.id;
        }) : null);
    });
}

function show_checkin(req, res)
{
    get_seats(function(err, seats)
    {
        seats = seats.filter(function(seat)
        {
            return seat.customer == get_email(req);
        }).map(function(seat)
        {
            var minutes = ( new Date() - new Date(seat.date.booked) ) / 1000 / 60;
            
            seat.time_booked = Math.floor(minutes / 60) + ":" + zpad(Math.floor(minutes));

            return seat;
        });

        res.render("checkedin.pug", {
            seats: seats
        });
    });
}

app.get("/checkout", (req, res) => {
    res.redirect("/checkedin");
});

app.post("/logout", (req, res) => {
    req.user = null;
    req.logout();
    
    res.send("You've been logged out.")
});

app.post("/checkout", auth.requiresLogin, (req, res) => {

    get_seats(function(err, seats)
    {
        if(err) console.log(err);

        if(seats && seats.length)
        {
            var seat_promises = [];

            seats = seats.filter(function(seat)
            {
                return seat.customer == get_email(req);
            })

            total_time = 0;
            seats.forEach(function(seat)
            {
                var minutes = ( new Date() - new Date(seat.date.booked) ) / 1000 / 60;
                total_time += minutes;
            });

            Promise.all(seat_promises).then(function()
            {
                res.render("checkedout.pug", {
                    seats: seats,
                    total_time: Math.floor(total_time / 60) + ":" + zpad(Math.floor(total_time))
                });
            });
                
        }
    });
});

app.all("/admin", (req, res) => {

    get_seats(function(err, seats)
    {
        if(err) console.log(err);

        var times = {};
        var customers = {};
        seats.forEach(function(seat)
        {
            if(seat.customer)
            {
                var minutes = ( new Date() - new Date(seat.date.booked) ) / 1000 / 60;
                times[seat.id] = Math.floor(minutes / 60) + ":" + zpad(Math.floor(minutes));
                
                if(!customers[seat.customer]) customers[seat.customer] = 0;
                customers[seat.customer] += minutes;
            }
            
        });

        Object.keys(customers).forEach(function(customer)
        {
            var minutes = customers[customer];
            customers[customer] = Math.floor(minutes / 60) + ":" + zpad(Math.floor(minutes));
        });

        if(req.query.seat)
        {
            var selected_seat = seats.filter(function(seat)
            {
                return seat.id == req.query.seat;
            })[0];

            if(selected_seat)
            {
                selected_seat.customer = null;
                selected_seat.save(function(err)
                {
                    get_seats(function(err, seats)
                    {
                        if(err) console.log(err);

                        res.render("admin.pug", {seats: seats, times: times, customers: customers});
                    });
                    
                });

                return;
            }
        }

        res.render("admin.pug", {seats: seats, times: times, customers: customers});

        
    });

});

app.get("/checkedin", auth.requiresLogin, (req, res) => {

    if(req.query.seats)
    {
        perform_checkin(req, res);
    }
    else
    {
        show_checkin(req, res);
    }
});

var perform_checkin = (req, res) => {
    
        var seats_selected = ( req.query.seats ? req.query.seats.split(",") : null ) || [];
        
        if(seats_selected.length == 0)
        {
            Object.keys(req.body).forEach(function(key)
            {
                if(key.indexOf("seat-") === 0 && req.body[key] == "on")
                {
                    seats_selected.push(key.replace("seat-", ""));
                }
            });
        }
    
        var user_email = get_email(req);
    
        var seat_promises = [];
        var seat_saves = [];
    
        if(!req.user)
        {
            req.session.seats_selected = seats_selected;
            auth.requiresLogin(req, res);
            return;
        }
        else
        {
            req.session.seats_selected = null;
        }
    
        seats_selected.forEach(function(seat_id)
        {
            seat_promises.push(Seat.get({id: seat_id}).then(function(seat)
            {
                if(seat && !seat.customer)
                {
                    seat.customer = user_email;
                    if(!seat.date) seat.date = {};
                    seat.date.booked = new Date();
                    //seat.date.free = new Date(Date.now() + 1*60*60*1000);
    
                    if(req.body.phone_number)
                    {
                        var phone_number = req.body.phone_number.replace(/[^\d]/g, "");
    
                        if(phone_number.length == 11)
                        {
                            seat.phone_number = "+" + phone_number;
                        }
                    }
    
                    seat_saves.push(seat.save());
                }
            }));
        });
    
        Promise.all(seat_promises).then(function()
        {
            if(seat_saves.length)
            {
                Promise.all(seat_saves).then(function()
                {
                    show_checkin(req, res);
                }).catch(function(err)
                {
                    console.log(err);
                    show_checkin(req, res);
                });
            }
            else
            {
                show_checkin(req, res);
            }
        }).catch(function(err)
        {
            console.log(err);
            show_checkin(req, res);
        });
    };

app.post("/checkedin", perform_checkin);

function get_email(req)
{
    if(req.user && req.user.emails && req.user.emails.length > 0 && req.user.emails[0].value)
    {
        return req.user.emails[0].value;
    }

    return;
}

app.get("/tick", (req, res) => {

    var lambda = require("./lambda");
    lambda.tick();

    res.send("TICK");
})

app.get("/empty_all_seats", (req, res) => {
    
    var lambda = require("./lambda");

    get_seats(function(err, seats)
    {
        if(err) console.log(err);

        if(seats && seats.length)
        {
            var seat_promises = [];

            seats.forEach(function(seat)
            {
                if(seat.date && seat.date.free)
                {
                    seat.date.free = new Date(0);
                    seat_promises.push(seat.save());
                }
                else if(seat.customer)
                {
                    seat.customer = null;
                    seat_promises.push(seat.save());
                }
            });

            Promise.all(seat_promises).then(function()
            {
                res.send("All seats have been emptied");
            });
                
        }
    });
        
})

module.exports = app;