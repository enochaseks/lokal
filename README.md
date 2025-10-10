# 📱 Lokal - Local Shopping Platform

Lokal is a comprehensive local shopping platform that connects buyers and sellers in their local communities. Built with React and Firebase, it features real-time messaging, secure payments, and now **automated email notifications**.

## ✨ Features

- 🛍️ **Local Shopping**: Browse and shop from local stores
- 💬 **Real-time Messaging**: Chat with sellers and buyers
- 💳 **Secure Payments**: Stripe integration with multiple payment methods
- 📧 **Email Notifications**: Automated notifications for messages and orders
- 📱 **Mobile Responsive**: Works on all devices
- 🔒 **Secure Authentication**: Firebase Auth with email verification
- 📊 **Analytics**: Store performance tracking
- 🌍 **Multi-currency**: Support for different currencies

## 📧 Email Notifications Setup

**New Feature!** Lokal now sends automatic email notifications when users receive messages, payment confirmations, order updates, and more.

### Quick Setup:
```bash
cd functions
npm run gmail:setup    # Interactive Gmail configuration
npm run gmail:test     # Test the connection
firebase deploy        # Deploy the functions
```

**Detailed Guide**: See [QUICK_EMAIL_SETUP.md](QUICK_EMAIL_SETUP.md)

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- Firebase CLI
- Gmail account (for email notifications)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/enochaseks/lokal.git
   cd lokal
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd functions && npm install && cd ..
   ```

3. **Configure Firebase**
   ```bash
   firebase login
   firebase use --add  # Select your Firebase project
   ```

4. **Set up email notifications**
   ```bash
   cd functions
   npm run gmail:setup
   ```

5. **Start development server**
   ```bash
   npm start
   ```

## 📁 Project Structure

```
lokal/
├── src/                    # React application
│   ├── components/         # Reusable components
│   ├── pages/             # Main pages
│   ├── contexts/          # React contexts
│   └── utils/             # Utility functions
├── functions/             # Firebase Cloud Functions
│   ├── email-notification-function.js  # Email notifications
│   ├── gmail-setup.js     # Gmail configuration tool  
│   └── README.md         # Functions documentation
├── public/               # Static assets
└── build/               # Production build
```

## 🛠️ Available Scripts

### Frontend
```bash
npm start          # Start development server
npm test           # Run tests
npm run build      # Build for production
```

### Functions (Email System)
```bash
cd functions
npm run gmail:setup      # Setup Gmail for notifications
npm run gmail:test       # Test Gmail connection
npm run email:stats      # View email statistics
firebase deploy --only functions  # Deploy functions
```

## 📧 Email Notification Features

- ✅ **Automatic sending** when users receive messages
- ✅ **Professional templates** with order details and branding
- ✅ **User preferences** - users can customize what emails they receive
- ✅ **Smart filtering** - skips internal messages and duplicates
- ✅ **Delivery tracking** - monitors email success/failure rates
- ✅ **Gmail integration** - reliable delivery through Gmail SMTP

### Supported Notification Types:
- 💬 New messages
- 💳 Payment confirmations
- 📦 Order ready for collection
- 🚚 Delivery updates
- 🏪 Bank transfer notifications
- 📋 Item requests

## ⚙️ Configuration

### Environment Variables
Create `functions/.env` (use `npm run gmail:setup` for interactive setup):
```bash
GMAIL_EMAIL=your-notifications@gmail.com
GMAIL_PASSWORD=your-16-character-app-password
```

### User Preferences
Users can manage their email notification preferences in:
**Settings > Communication Preferences**

## 🔧 Deployment

### Frontend
```bash
npm run build
firebase deploy --only hosting
```

### Backend Functions
```bash
firebase deploy --only functions
```

### Complete Deployment
```bash
firebase deploy
```

## 📊 Monitoring

### Email Statistics
```bash
cd functions
npm run email:stats    # View delivery rates and statistics
```

### Function Logs
```bash
firebase functions:log
```

### Email Management
```bash
npm run email:resend   # Retry failed email notifications
npm run email:cleanup  # Clean old tracking data
```

## 🔒 Security Features

- 🔐 **App Passwords**: Uses Gmail App Passwords (more secure)
- 🚫 **User Control**: Users can disable notifications anytime
- 📝 **Privacy Compliant**: Respects user preferences
- 🛡️ **Rate Limited**: Prevents spam and abuse

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (including email notifications)
5. Submit a pull request

## 📞 Support

- **Email**: helplokal@gmail.com
- **WhatsApp Community**: [Join here](https://wa.me/447377834081?text=Hi!%20I'd%20like%20to%20join%20the%20Lokal%20community%20and%20get%20support.)

## 📄 License

This project is licensed under the MIT License.

---

**Built with ❤️ for local communities**

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
