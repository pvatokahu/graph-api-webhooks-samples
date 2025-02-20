# Instagram automated experience at Okahu

Built using Instagram's [Subscriptions API](https://www.instagram.com/developer/subscriptions/) and forking the facebook graph-api-webhooks-samples. 

This app listens to a webhook for notification from instagram and then provides an API to view the conversation. 
To run this app, you'll need following env variables
- TOKEN - this specified who can send notifications to this 
- APP_SECRET - this is the instagram access_token for the application. 
configure these in a file .env.local. 