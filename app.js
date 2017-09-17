var Seat = require("./models/Seat.js");

const keySecret = process.env.STRIPE_SECRET;

const app = require("express")();
var stripe = require("stripe")(keySecret);

app.set("view engine", "pug");
app.use(require("body-parser").urlencoded({extended: false}));


app.get("/", (req, res) => {

    if(!keySecret)
    {
        return res.send("No STRIPE_SECRET was set in the ENV");
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
            seats: seats
        })
    })

});

function get_seats(next)
{
    Seat.scan().all().exec(function(err, seats)
    {
        next(err, seats);
    });
}

app.post("/charge", (req, res) => {
    let amount = 500;

    var seats_selected = [];
    

    Object.keys(req.body).forEach(function(key)
    {
        if(key.indexOf("seat-") === 0 && req.body[key] == "on")
        {
            seats_selected.push(key.replace("seat-", ""));
        }
    });

    stripe.customers.create({
        email: req.body.stripeEmail,
        source: req.body.stripeToken
    })
    .then(customer =>
    stripe.charges.create({
        amount,
        description: "Workwell Cafe Seat",
        currency: "usd",
        customer: customer.id
    }))
    .then(function(charge)
    {
        seats_selected.forEach(function(seat_id)
        {
            Seat.get({id: seat_id}).then(function(seat)
            {
                if(seat && !seat.customer)
                {
                    seat.customer = req.body.stripeEmail;
                    if(!seat.date) seat.date = {};
                    seat.date.booked = new Date();
                    seat.date.free = new Date(Date.now() + 1*60*60*1000);

                    if(req.body.phone_number)
                    {
                        var phone_number = req.body.phone_number.replace(/[^\d]/g, "");

                        if(phone_number.length == 11)
                        {
                            seat.phone_number = "+" + phone_number;
                        }
                    }

                    seat.save(function(err)
                    {
                        if(err) console.log(err);
                    });
                }
            })
        });

        res.render("charge.pug")
    });
});

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
            seats.forEach(function(seat)
            {
                if(seat.date && seat.date.free)
                {
                    seat.date.free = new Date(0);
                    seat.save();
                }
            });

            setTimeout(lambda.tick, 1000);

            res.send("All seats have been emptied");
        }
    });
        
})

module.exports = app;