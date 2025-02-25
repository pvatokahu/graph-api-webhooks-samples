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
var axios = require('axios');
const e = require('express');

app.set('port', (process.env.PORT || 5000));
app.listen(app.get('port'));

app.use(xhub({ algorithm: 'sha1', secret: process.env.APP_SECRET }));
app.use(bodyParser.json());

var token = process.env.TOKEN;
var received_updates = [];

var IG_accessToken = process.env.APP_SECRET;
var IG_appID = process.env.IG_appID || 17841465313856941;
var IG_appName = process.env.APP_IG_USER_NAME || 'okahu.ai';
//manage consent to send message
const userConsents = new Map();
function setUserConsent(userId, consent) {
  userConsents.set(userId, consent);
}
function getUserConsent(userId) {
  return userConsents.get(userId);
}

async function fetchUsername(label, IGId, accessToken) {
  try {
    const url = `https://graph.instagram.com/v22.0/${IGId}?fields=username&access_token=${accessToken}`;
    const response = await axios.get(url);
    response.data[`role`] = `${label}`;
    received_updates.unshift(response.data);
    return response.data[`username`];
  } catch (error) {
    console.error('Error fetching data:', error.message);
    return null;
  }
}

async function sendMessagetoUser(recepientId, accessToken, message) {
  const data = {
    message: { 'text': message },
    recipient: { 'id': recepientId }
  };

  console.log(data);

  const config = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  };
  console.log(config);

  try {
    const response = await axios.post(`https://graph.instagram.com/v22.0/me/messages`, data, config);
    console.log('sent a message from app account', response.data);
    received_updates.unshift(response.data);
  } catch (error) {
    if (error.response) {
      // Server responded with a status other than 2xx
      console.error('Error Status:', error.response.status);
      console.error('Error Data:', error.response.data);
    } else if (error.request) {
      // Request was made but no response received
      console.error('No response received:', error.request);
    } else {
      // Something else happened while setting up the request
      console.error('Error:', error.message);
    }
  }
}


async function getWineBotResponse(winebotToken, senderId, message, messageId) {
  try {
    const url = `https://winebot.azurewebsites.net/api/chatbot?question=${message}`;
    headers = {
      'sender': senderId,
      'session': senderId,
      'message': messageId,
      'x-functions-key': winebotToken,
    };
    const response = await axios.get(url, { headers: headers });
    console.log('Received wine.com response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching data:', error.message);
    return null;
  }
}


//This method prints out the log in the browser when validated with a token
app.get('/', function (req, res) {
  if (req.query['hub.verify_token'] == token) {
    console.log(req);
    res.send('<pre>' + JSON.stringify(received_updates, null, 2) + '</pre>');
  } else {
    res.sendStatus(400);
  }
});

//Clears the received updates array 
app.get('/clear', function (req, res) {
  if (req.query['hub.verify_token'] == token) {
    console.log('Clearing received updates');
    received_updates.length = 0;
    res.sendStatus(200);
  } else {
    res.sendStatus(400);
  }
});

//this method is in development
app.get('/login', (req, res) => {
  const mycode = req.query.code;

  if (mycode) {
    // 'mycode' exists in the query parameters
    console.log('Received mycode:', mycode);
    res.send(`Received mycode: ${mycode}`);
  } else {
    // 'mycode' is not present in the query parameters
    console.error('No mycode parameter found in the query string.');
    res.status(400).send('Missing mycode parameter.');
  }
});


//This route responds to check the verify token item - verified
app.get(['/instagram'], function (req, res) {
  if (
    req.query['hub.mode'] == 'subscribe' &&
    req.query['hub.verify_token'] == token
  ) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

//This route prints out the message based on what's received from the webhook - verified

app.post('/instagram', function (req, res) {
  console.log('Instagram request body:');
  console.log(req.body);
  received_updates.unshift(req.body);

  if (req.body.hasOwnProperty('entry')) {
    req.body.entry.forEach((entry, idx) => {
      if (entry.hasOwnProperty('messaging')) {
        entry.messaging.forEach((messaging, jdx) => {
          if (messaging.hasOwnProperty('message')) {
            const senderId = messaging.sender.id;
            const recipientId = messaging.recipient.id;
            console.log("got a message notification from", senderId, "to", recipientId);
            var senderName = fetchUsername(`sender`, senderId, IG_accessToken);
            fetchUsername(`recepient`, recipientId, IG_accessToken);

            if (senderName != IG_appName) {
              console.log("message from other person", senderId);
              if (getUserConsent(senderId) == undefined) {
                setUserConsent(senderId, `pending`);
                sendMessagetoUser(senderId, IG_accessToken, `You're talking to an AI. Please reply OK continue with consent to this conversation.`);
              } else if (getUserConsent(senderId) == `pending`) {
                if (messaging.message.text.toLowerCase() == `ok`) {
                  setUserConsent(senderId, `consented`);
                  sendMessagetoUser(senderId, IG_accessToken, `Thank you for your consent. I am wine bot. How can I help you today?`);
                } else {
                  sendMessagetoUser(senderId, IG_accessToken, `You're talking to an AI. Please reply OK continue with consent to this conversation.`);
                }
              } else {
                const wineBotResponse = getWineBotResponse(process.env.WINEBOT_TOKEN, senderId, messaging.message.text, messaging.message.mid);
                if (wineBotResponse) {
                  sendMessagetoUser(senderId, IG_accessToken, wineBotResponse);
                } else {
                    sendMessagetoUser(senderId, IG_accessToken, "Sorry, I'm having trouble understanding. Could you rephrase that?");
                }
              }
            } else {
              console.log("message from okahu");
            }
          } else if (messaging.hasOwnProperty('read')) {
            const senderId = messaging.sender.id;
            console.log("got a read notification from", senderId);
          } else if (messaging.hasOwnProperty('reaction')) {
            const senderId = messaging.sender.id;
            console.log("got a reaction notification from", senderId);
          } else {
            console.log(req.body.entry.messaging);
          }
        });
      } else if (entry.hasOwnProperty('changes')) {
        console.log('found entry.changes');
      } else {
        console.log('did not find entry.messaging or entry.changes');
      }
    });
  } else {
    console.log('did not find entry');
  }

  res.sendStatus(200);
});

app.listen();
