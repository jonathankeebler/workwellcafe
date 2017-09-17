# WorkWell Cafe Seat Registration

The seat registration system behind the [WorkWell Cafe](http://www.workwellcafe.com/).


## Requirements
- node.js >=6
- [serverless 1.21+](serverless.com)
- Stripe secret key

## Installation
```sh
npm install
```
## Running locally
```sh
STRIPE_SECRET=YOUR_SECRET_CODE node index.js
```

## Deployment
```sh
STRIPE_SECRET=YOUR_SECRET_CODE serverless deploy
```

## Credit
Maintainer: [Jonathan Keebler](http://www.keebler.net)