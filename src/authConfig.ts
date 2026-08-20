import { Configuration, LogLevel } from '@azure/msal-browser';

// TODO: Replace with the actual Azure Client ID
export const msalConfig: Configuration = {
  auth: {
    clientId: 'YOUR_AZURE_CLIENT_ID_HERE', 
    authority: 'https://login.microsoftonline.com/common', // Or tenant specific: https://login.microsoftonline.com/YOUR_TENANT_ID
    redirectUri: '/', 
    postLogoutRedirectUri: '/',
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        if (level === LogLevel.Error) console.error(message);
      },
    },
  },
};

export const loginRequest = {
  scopes: ['User.Read'],
};
