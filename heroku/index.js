/**
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

var bodyParser = require('body-parser');
var express = require('express');
var app = express();
var xhub = require('express-x-hub');

app.set('port', (process.env.PORT || 5000));
app.listen(app.get('port'));

app.use(xhub({ algorithm: 'sha1', secret: process.env.APP_SECRET }));
app.use(bodyParser.json());

var token = process.env.TOKEN ;
var received_updates = [];

var IG_accessToken = process.env.APP_SECRET ; 

//This method prints out the log in the browser when validated with a token
app.get('/', function(req, res) {
  if (req.query['hub.verify_token'] == token) {
  console.log(req);
  res.send('<pre>' + JSON.stringify(received_updates, null, 2) + '</pre>');
  } else {
    res.sendStatus(400);
  }
});

//This route responds to check the verify token item. 
app.get(['/facebook', '/instagram', '/threads'], function(req, res) {
  if (
    req.query['hub.mode'] == 'subscribe' &&
    req.query['hub.verify_token'] == token
  ) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

app.post('/facebook', function(req, res) {
  console.log('Facebook request body:', req.body);

  if (!req.isXHubValid()) {
    console.log('Warning - request header X-Hub-Signature not present or invalid');
    res.sendStatus(401);
    return;
  }

  console.log('request header X-Hub-Signature validated');
  // Process the Facebook updates here
  received_updates.unshift(req.body);
  res.sendStatus(200);
});

//This route prints out the message based on what's received from the webhook. 

app.post('/instagram', function(req, res) {
  console.log('Instagram request body:');
  console.log(req.body);
  console.log(req.body.entry[0].messaging);

  const senderId = req.body.entry[0].messaging[0].sender.id; 
  console.log('Looking up username for ID: ', senderId);
  try {
    const url = `https://graph.instagram.com/v22.0/${senderId}?fields=username&access_token=${IG_accessToken}`;
    const response = fetch(url);
    console.log('Username:', response);
  } catch (error) {
    console.error('Error', error);
  }

  received_updates.unshift(req.body);
  res.sendStatus(200);
});

app.post('/threads', function(req, res) {
  console.log('Threads request body:');
  console.log(req.body);
  // Process the Threads updates here
  received_updates.unshift(req.body);
  res.sendStatus(200);
});

app.listen();
