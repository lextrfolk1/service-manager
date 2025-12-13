# Struo React Frontend

This is the React version of the Struo Service Manager frontend built with Material-UI (MUI). It provides the same functionality as the original HTML/JS version but with a modern, polished interface and enhanced user experience.

## Features

- **Modern Material Design**: Built with MUI components for a professional look
- **Dashboard**: View and manage all services with real-time status updates
- **Service Management**: Start, stop, restart services with live feedback
- **Log Viewer**: Browse and monitor service logs with auto-refresh and advanced controls
- **Admin Panel**: Edit service configuration JSON with syntax highlighting
- **Responsive Design**: Fully responsive design that works on all devices
- **Real-time Updates**: Auto-refreshing status and logs
- **Enhanced UX**: Loading states, error handling, and user feedback

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Backend service running on port 4000

### Installation

1. Navigate to the react-frontend directory:

```bash
cd react-frontend
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm start
```

The application will open at `http://localhost:3000` and proxy API requests to `http://localhost:4000`.

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `build` folder.

## Project Structure

```
react-frontend/
├── public/
│   └── index.html          # HTML template
├── src/
│   ├── components/         # Reusable React components
│   │   ├── Header.js       # Navigation header
│   │   └── ServiceCard.js  # Individual service card
│   ├── pages/              # Page components
│   │   ├── Dashboard.js    # Main dashboard page
│   │   ├── Logs.js         # Log viewer page
│   │   └── Admin.js        # Configuration page
│   ├── services/
│   │   └── api.js          # API service layer
│   ├── App.js              # Main app component
│   ├── index.js            # React entry point
│   └── index.css           # Global styles
└── package.json
```

## Key Differences from Original

- **Material-UI Design**: Professional Material Design components and theming
- **Component-based**: Modular React components instead of vanilla JS
- **State Management**: React hooks for state management
- **Routing**: React Router for client-side navigation
- **Modern Patterns**: Uses functional components and hooks
- **Enhanced UX**: Loading spinners, snackbar notifications, and better error states
- **Responsive Grid**: MUI Grid system for perfect responsive layouts
- **Accessibility**: Built-in accessibility features from MUI components
- **Type Safety**: Structured API layer with error handling

## API Integration

The React app communicates with the same backend API:

- `GET /services` - List all services
- `GET /service/:name/status` - Get service status
- `POST /service/:name/start` - Start service
- `POST /service/:name/stop` - Stop service
- `POST /service/:name/restart` - Restart service
- `GET /logs/:service` - List log files
- `GET /logs/:service/:file` - Get log content
- `GET /config/services` - Get configuration
- `PUT /config/services` - Update configuration

## Development

The app uses Create React App for development tooling. Key scripts:

- `npm start` - Development server with hot reload
- `npm test` - Run tests
- `npm run build` - Production build
- `npm run eject` - Eject from Create React App (not recommended)

## Deployment

For production deployment:

1. Build the app: `npm run build`
2. Serve the `build` folder with a static file server
3. Ensure the backend API is accessible
4. Update API_BASE in `src/services/api.js` if needed
