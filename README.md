# WorkWell Cafe Seat Registration

The seat registration system behind the [WorkWell Cafe](http://www.workwellcafe.com/).


## Requirements
- node.js >=6
- Stripe secret key (YOUR_SECRET_CODE in sample code below)
- AWS credentials configured in your shell
- Auth0 config variables in your shell 
```
export AUTH0_CLIENT_ID='REPLACE_ME';
export AUTH0_CLIENT_SECRET='REPLACE_ME';
export AUTH0_DOMAIN='workwellcafe.auth0.com';
```

## Installation
```sh
npm install serverless -g # If you don't have it installed globally
npm install
```
## Running locally
```sh
node index.js
```

## Deployment
```sh
serverless deploy
```

## Credit
Maintainer: [Jonathan Keebler](http://www.keebler.net)