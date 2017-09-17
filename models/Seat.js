var dynamoose = require('dynamoose');

dynamoose.AWS.config.update({
    region: 'us-east-1'
});

var seatSchema = new dynamoose.Schema({
    id: String,
    date: {
        booked: Date,
        free: Date,
        expiry_warning: Date
    },
    customer: String,
    phone_number: String
},
{
    throughput: {read: 5, write: 5}
});

module.exports = dynamoose.model('Seat', seatSchema);